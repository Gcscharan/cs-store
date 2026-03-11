import axios from "axios";
import redisClient from "../config/redis";

/**
 * Pincode Validator Service
 * Validates Indian pincodes against India Post database
 * Provides city/state suggestions for invalid entries
 */

export type PincodeInfo = {
  pincode: string;
  postOfficeName: string;
  district: string;
  state: string;
  stateCode: string;
  region: string;
  country: string;
};

export type PincodeValidationResult = {
  valid: boolean;
  pincode: string;
  suggestedCity?: string;
  suggestedState?: string;
  suggestedDistrict?: string;
  postOffices?: PincodeInfo[];
  error?: string;
};

const CACHE_PREFIX = "pincode:info:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days (pincode data rarely changes)

/**
 * Validate pincode using India Post API
 * API: https://api.postalpincode.in/pincode/{pincode}
 */
export async function validatePincode(pincode: string): Promise<PincodeValidationResult> {
  // Clean pincode
  const cleanPincode = String(pincode || "").trim();

  // Basic format validation
  if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
    return {
      valid: false,
      pincode: cleanPincode,
      error: "Pincode must be 6 digits starting with 1-9",
    };
  }

  // Check cache first
  const cached = await getCachedPincodeInfo(cleanPincode);
  if (cached) {
    return cached;
  }

  try {
    // Call India Post API
    const response = await axios.get(
      `https://api.postalpincode.in/pincode/${cleanPincode}`,
      { timeout: 5000 }
    );

    const data = response.data;

    // API returns array with status
    if (!Array.isArray(data) || data.length === 0) {
      const result: PincodeValidationResult = {
        valid: false,
        pincode: cleanPincode,
        error: "Invalid response from pincode service",
      };
      return result;
    }

    const result = data[0];

    if (result.Status === "Error" || result.Status === "404") {
      const validationResult: PincodeValidationResult = {
        valid: false,
        pincode: cleanPincode,
        error: "Pincode not found in India Post database",
      };
      await cachePincodeInfo(cleanPincode, validationResult);
      return validationResult;
    }

    // Parse post offices
    const postOffices: PincodeInfo[] = (result.PostOffice || []).map((po: any) => ({
      pincode: cleanPincode,
      postOfficeName: po.Name,
      district: po.District,
      state: po.State,
      stateCode: getStateCode(po.State),
      region: po.Region,
      country: po.Country,
    }));

    // Get primary suggestion (first post office)
    const primary = postOffices[0];

    const validationResult: PincodeValidationResult = {
      valid: true,
      pincode: cleanPincode,
      suggestedCity: primary?.postOfficeName || primary?.district,
      suggestedState: primary?.state,
      suggestedDistrict: primary?.district,
      postOffices,
    };

    // Cache the result
    await cachePincodeInfo(cleanPincode, validationResult);

    return validationResult;
  } catch (error: any) {
    console.error("[PincodeValidator] API error:", error?.message);

    // Return error but don't cache failures (might be temporary)
    return {
      valid: false,
      pincode: cleanPincode,
      error: "Failed to validate pincode. Please try again.",
    };
  }
}

/**
 * Validate city/state against pincode
 * Returns warnings if mismatch but still valid
 */
export async function validateAddressPincode(params: {
  pincode: string;
  city?: string;
  state?: string;
}): Promise<{
  valid: boolean;
  pincodeValid: boolean;
  cityMismatch: boolean;
  stateMismatch: boolean;
  suggestedCity?: string;
  suggestedState?: string;
  warnings: string[];
}> {
  const { pincode, city, state } = params;
  const warnings: string[] = [];

  const pincodeResult = await validatePincode(pincode);

  if (!pincodeResult.valid) {
    return {
      valid: false,
      pincodeValid: false,
      cityMismatch: false,
      stateMismatch: false,
      suggestedCity: undefined,
      suggestedState: undefined,
      warnings: [pincodeResult.error || "Invalid pincode"],
    };
  }

  let cityMismatch = false;
  let stateMismatch = false;

  // Check state mismatch
  if (state && pincodeResult.suggestedState) {
    const normalizedInputState = normalizeStateName(state);
    const normalizedSuggestedState = normalizeStateName(pincodeResult.suggestedState);

    if (normalizedInputState !== normalizedSuggestedState) {
      stateMismatch = true;
      warnings.push(
        `State "${state}" doesn't match pincode ${pincode}. Suggested: ${pincodeResult.suggestedState}`
      );
    }
  }

  // Check city mismatch (more lenient - city might be district or locality)
  if (city && pincodeResult.suggestedCity) {
    const normalizedInputCity = normalizeCityName(city);
    const normalizedSuggestedCity = normalizeCityName(pincodeResult.suggestedCity);
    const normalizedDistrict = pincodeResult.suggestedDistrict
      ? normalizeCityName(pincodeResult.suggestedDistrict)
      : null;

    // City matches if it matches either the post office name or district
    const cityMatches =
      normalizedInputCity === normalizedSuggestedCity ||
      normalizedInputCity === normalizedDistrict ||
      normalizedSuggestedCity.includes(normalizedInputCity) ||
      normalizedInputCity.includes(normalizedSuggestedCity);

    if (!cityMatches) {
      cityMismatch = true;
      warnings.push(
        `City "${city}" may not match pincode ${pincode}. Suggested: ${pincodeResult.suggestedCity}`
      );
    }
  }

  return {
    valid: true,
    pincodeValid: true,
    cityMismatch,
    stateMismatch,
    suggestedCity: pincodeResult.suggestedCity,
    suggestedState: pincodeResult.suggestedState,
    warnings,
  };
}

/**
 * Get state code from state name
 */
function getStateCode(stateName: string): string {
  const stateCodes: Record<string, string> = {
    "Andhra Pradesh": "AP",
    "Arunachal Pradesh": "AR",
    Assam: "AS",
    Bihar: "BR",
    Chhattisgarh: "CG",
    Goa: "GA",
    Gujarat: "GJ",
    Haryana: "HR",
    "Himachal Pradesh": "HP",
    Jharkhand: "JH",
    Karnataka: "KA",
    Kerala: "KL",
    "Madhya Pradesh": "MP",
    Maharashtra: "MH",
    Manipur: "MN",
    Meghalaya: "ML",
    Mizoram: "MZ",
    Nagaland: "NL",
    Odisha: "OD",
    Punjab: "PB",
    Rajasthan: "RJ",
    Sikkim: "SK",
    "Tamil Nadu": "TN",
    Telangana: "TS",
    Tripura: "TR",
    "Uttar Pradesh": "UP",
    Uttarakhand: "UK",
    "West Bengal": "WB",
    Delhi: "DL",
    "Jammu and Kashmir": "JK",
    Ladakh: "LA",
    Puducherry: "PY",
    Chandigarh: "CH",
    "Andaman and Nicobar Islands": "AN",
    "Dadra and Nagar Haveli and Daman and Diu": "DN",
    Lakshadweep: "LD",
  };

  return stateCodes[stateName] || stateName.substring(0, 2).toUpperCase();
}

/**
 * Normalize state name for comparison
 */
function normalizeStateName(state: string): string {
  return String(state || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace("telengana", "telangana");
}

/**
 * Normalize city name for comparison
 */
function normalizeCityName(city: string): string {
  return String(city || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Cache pincode info in Redis
 */
async function cachePincodeInfo(
  pincode: string,
  info: PincodeValidationResult
): Promise<void> {
  await redisClient.set(`${CACHE_PREFIX}${pincode}`, JSON.stringify(info), {
    EX: CACHE_TTL_SECONDS,
  });
}

/**
 * Get cached pincode info
 */
async function getCachedPincodeInfo(
  pincode: string
): Promise<PincodeValidationResult | null> {
  const raw = await redisClient.get(`${CACHE_PREFIX}${pincode}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PincodeValidationResult;
  } catch {
    return null;
  }
}

/**
 * Batch validate multiple pincodes
 */
export async function batchValidatePincodes(
  pincodes: string[]
): Promise<Map<string, PincodeValidationResult>> {
  const results = new Map<string, PincodeValidationResult>();

  // Process in parallel
  const promises = pincodes.map(async (pincode) => {
    const result = await validatePincode(pincode);
    return { pincode, result };
  });

  const settled = await Promise.all(promises);
  for (const { pincode, result } of settled) {
    results.set(pincode, result);
  }

  return results;
}

export default {
  validatePincode,
  validateAddressPincode,
  batchValidatePincodes,
};
