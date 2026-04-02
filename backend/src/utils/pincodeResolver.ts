import fs from "fs";
import os from "os";
import path from "path";
import { Pincode } from "../models/Pincode";
import { withCircuitBreaker } from "./dbHelpers";
import { createCacheService } from "../services/cacheService";
import { logInfo, logWarn, logError } from "./structuredLogger";

const csvParser = require("csv-parser");

// Initialize cache service
const cacheService = createCacheService();
const CACHE_TTL_SECONDS = 600; // 10 minutes

export const districtOverrides: Record<string, Record<string, string>> = {
  "Andhra Pradesh": {
    "Krishna": "NTR",
    "Chittoor": "Annamayya",
  },
  "Telangana": {
    "Medak": "Sangareddy",
  },
};

export const applyDistrictOverride = (
  state: string,
  postalDistrict: string
): string => {
  return districtOverrides[state]?.[postalDistrict] || postalDistrict;
};

export type ResolvedPincodeDetails = {
  state: string;
  postal_district: string;
  cities: string[];
  single_city: string | null;
};

export type ResolvedPincodeForAddressSave = {
  state: string;
  postal_district: string;
  admin_district: string;
  cities: string[];
};

type CsvMeta = {
  state: string;
  postal_district: string;
  cities: Set<string>;
};

let csvMetaIndexPromise: Promise<Map<string, CsvMeta>> | null = null;

const resolveDatasetPath = (): string | null => {
  const fromEnv = (process.env.PINCODE_DATASET_PATH || "").trim();
  const candidates = [
    fromEnv,
    path.join(os.homedir(), "Downloads", "ap_telangana_pincodes.csv"),
    path.resolve(process.cwd(), "data", "ap_telangana_pincodes.csv"),
    path.resolve(process.cwd(), "..", "data", "ap_telangana_pincodes.csv"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }

  return null;
};

const getCsvMetaIndex = async (): Promise<Map<string, CsvMeta>> => {
  if (csvMetaIndexPromise) return csvMetaIndexPromise;

  csvMetaIndexPromise = new Promise<Map<string, CsvMeta>>((resolve) => {
    const datasetPath = resolveDatasetPath();
    if (!datasetPath) {
      resolve(new Map());
      return;
    }

    const index = new Map<string, CsvMeta>();

    fs.createReadStream(datasetPath)
      .pipe(csvParser())
      .on("data", (row: any) => {
        const pincode = String(row.pincode || "").trim();
        if (!/^\d{6}$/.test(pincode)) return;

        const state = row.state ? String(row.state).trim() : "";
        const postal_district = row.district ? String(row.district).trim() : "";
        const city = row.city ? String(row.city).trim() : "";

        if (!state || !postal_district) return;

        const existing = index.get(pincode);
        if (existing) {
          if (city) existing.cities.add(city);
          return;
        }

        const cities = new Set<string>();
        if (city) cities.add(city);

        index.set(pincode, { state, postal_district, cities });
      })
      .on("end", () => resolve(index))
      .on("error", () => resolve(new Map()));
  });

  return csvMetaIndexPromise;
};

export const resolvePincodeDetails = async (
  pincode: string
): Promise<ResolvedPincodeDetails | null> => {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return null;

  const startTime = Date.now();

  // 1. Check cache first (CacheService with 10-minute TTL)
  const cacheKey = `pincode:${pincode}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    logInfo('PINCODE_CACHE_HIT', {
      pincode,
      source: 'cache',
      duration: Date.now() - startTime,
    });
    return cached;
  }

  // 2. Try MongoDB (PRIMARY source) with circuit breaker + timeout
  try {
    const pincodeData = await withCircuitBreaker(() => 
      Pincode.findOne({ pincode })
    );
    
    if (pincodeData && pincodeData.state) {
      const state = String(pincodeData.state).trim();
      const postal_district = String(pincodeData.district || "").trim();
      
      if (state) {
        const cities = [pincodeData.taluka].filter(Boolean) as string[];
        
        // Return location data only (no business logic - architectural compliance)
        const result = {
          state,
          postal_district,
          cities,
          single_city: cities.length === 1 ? cities[0] : null,
        };
        
        // Cache the result (fire-and-forget, don't block response)
        cacheService.set(cacheKey, result, CACHE_TTL_SECONDS).catch(() => {});
        
        logInfo('PINCODE_LOOKUP', {
          pincode,
          source: 'mongo',
          cacheHit: false,
          found: true,
          duration: Date.now() - startTime,
        });
        
        return result;
      }
    }
  } catch (error) {
    // Log DB error (should not reach here with circuit breaker, but keep for safety)
    logError('PINCODE_LOOKUP_ERROR', {
      pincode,
      source: 'mongo',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });
    // Fall through to CSV fallback
  }

  // 3. Fallback to CSV (ONLY when MongoDB fails or returns nothing)
  const csvIndex = await getCsvMetaIndex();
  const meta = csvIndex.get(pincode);
  if (meta) {
    const cities = Array.from(meta.cities);
    const result = {
      state: meta.state,
      postal_district: meta.postal_district || "",
      cities,
      single_city: cities.length === 1 ? cities[0] : null,
    };
    
    // Cache the result (fire-and-forget, don't block response)
    cacheService.set(cacheKey, result, CACHE_TTL_SECONDS).catch(() => {});
    
    logInfo('PINCODE_LOOKUP', {
      pincode,
      source: 'csv_fallback',
      cacheHit: false,
      found: true,
      duration: Date.now() - startTime,
    });
    
    return result;
  }

  // 4. Not found anywhere
  logWarn('PINCODE_NOT_FOUND', {
    pincode,
    source: 'all',
    duration: Date.now() - startTime,
  });
  return null;
};

export const resolvePincodeForAddressSave = async (
  pincode: string
): Promise<ResolvedPincodeForAddressSave | null> => {
  const resolved = await resolvePincodeDetails(pincode);
  if (!resolved) return null;
  if (!resolved.state || !resolved.postal_district) return null;

  const admin_district = applyDistrictOverride(
    resolved.state,
    resolved.postal_district
  );

  if (!admin_district) return null;

  return {
    state: resolved.state,
    postal_district: resolved.postal_district || "",
    admin_district: admin_district || "",
    cities: resolved.cities,
  };
};
