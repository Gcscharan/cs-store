import { logger } from '../../../utils/logger';
import { Client } from "@googlemaps/google-maps-services-js";
import redisClient from "../../../config/redis";

/**
 * ETA Calculator Service
 * Calculates real-time ETA using Google Directions API with traffic awareness
 */

const googleMapsClient = new Client({});

export type ETAResult = {
  etaMinutes: number;
  etaP50: Date;
  etaP90: Date;
  distanceRemainingM: number;
  durationSeconds: number;
  durationInTrafficSeconds: number;
  confidence: "high" | "medium" | "low";
  trafficModel: "optimistic" | "best_guess" | "pessimistic";
  source: "google" | "fallback";
  calculatedAt: Date;
};

export type ETACacheEntry = {
  etaMinutes: number;
  etaP50: string;
  etaP90: string;
  distanceRemainingM: number;
  confidence: string;
  trafficModel: string;
  source: string;
  calculatedAt: string;
};

const CACHE_PREFIX = "eta:calc:";
const CACHE_TTL_SECONDS = 60; // Cache for 60 seconds

/**
 * Calculate ETA using Google Directions API with traffic
 */
export async function calculateETA(params: {
  riderLat: number;
  riderLng: number;
  destLat: number;
  destLng: number;
  orderId: string;
  accuracyM?: number;
}): Promise<ETAResult> {
  const { riderLat, riderLng, destLat, destLng, orderId, accuracyM } = params;

  // Check cache first
  const cacheKey = `${CACHE_PREFIX}${orderId}`;
  const cached = await getCachedETA(cacheKey);
  if (cached) {
    return {
      ...cached,
      etaP50: new Date(cached.etaP50),
      etaP90: new Date(cached.etaP90),
      calculatedAt: new Date(cached.calculatedAt),
    } as ETAResult;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Determine confidence based on GPS accuracy
  const confidence = getConfidenceFromAccuracy(accuracyM);

  // Try Google Directions API
  if (apiKey) {
    try {
      const result = await callGoogleDirections(
        riderLat,
        riderLng,
        destLat,
        destLng,
        apiKey
      );

      const etaResult = buildETAResult(
        result.distanceM,
        result.durationSeconds,
        result.durationInTrafficSeconds,
        confidence,
        "google"
      );

      // Cache the result
      await cacheETA(cacheKey, etaResult);

      return etaResult;
    } catch (error) {
      logger.error("[ETA] Google Directions API failed:", error);
      // Fall through to fallback
    }
  }

  // Fallback: Haversine distance + average speed estimation
  const fallbackResult = calculateFallbackETA(
    riderLat,
    riderLng,
    destLat,
    destLng,
    confidence
  );

  // Cache the fallback result
  await cacheETA(cacheKey, fallbackResult);

  return fallbackResult;
}

/**
 * Call Google Directions API with traffic
 */
async function callGoogleDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<{
  distanceM: number;
  durationSeconds: number;
  durationInTrafficSeconds: number;
}> {
  const response = await googleMapsClient.directions({
    params: {
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      key: apiKey,
      mode: "driving" as any,
      departure_time: "now" as any,
      traffic_model: "best_guess" as any,
    },
  });

  if (response.data.status !== "OK" || !response.data.routes?.length) {
    throw new Error(`Google Directions failed: ${response.data.status}`);
  }

  const route = response.data.routes[0];
  const leg = route.legs[0];

  return {
    distanceM: leg.distance.value,
    durationSeconds: leg.duration.value,
    durationInTrafficSeconds: leg.duration_in_traffic?.value ?? leg.duration.value,
  };
}

/**
 * Build ETA result from Google API response
 */
function buildETAResult(
  distanceM: number,
  durationSeconds: number,
  durationInTrafficSeconds: number,
  confidence: "high" | "medium" | "low",
  source: "google" | "fallback"
): ETAResult {
  const now = new Date();

  // Use traffic-aware duration for ETA
  const etaMinutes = Math.ceil(durationInTrafficSeconds / 60);

  // P50 = traffic-aware ETA
  const etaP50 = new Date(now.getTime() + durationInTrafficSeconds * 1000);

  // P90 = P50 × 1.25 (buffer for delays)
  const p90DurationSeconds = Math.floor(durationInTrafficSeconds * 1.25);
  const etaP90 = new Date(now.getTime() + p90DurationSeconds * 1000);

  return {
    etaMinutes,
    etaP50,
    etaP90,
    distanceRemainingM: distanceM,
    durationSeconds,
    durationInTrafficSeconds,
    confidence,
    trafficModel: "best_guess",
    source,
    calculatedAt: now,
  };
}

/**
 * Calculate fallback ETA using Haversine + average speed
 */
function calculateFallbackETA(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  confidence: "high" | "medium" | "low"
): ETAResult {
  const now = new Date();

  // Haversine distance
  const distanceM = haversineDistanceM(originLat, originLng, destLat, destLng);

  // Average speed in Indian cities: 25 km/h (considering traffic)
  const avgSpeedMps = (25 * 1000) / 3600; // 6.94 m/s

  // Apply 1.3 factor for road distance vs straight-line
  const roadDistanceM = distanceM * 1.3;

  // Duration in seconds
  const durationSeconds = Math.floor(roadDistanceM / avgSpeedMps);

  // Add 20% buffer for uncertainty
  const bufferedDurationSeconds = Math.floor(durationSeconds * 1.2);

  const etaMinutes = Math.ceil(bufferedDurationSeconds / 60);
  const etaP50 = new Date(now.getTime() + bufferedDurationSeconds * 1000);
  const etaP90 = new Date(now.getTime() + bufferedDurationSeconds * 1.25 * 1000);

  return {
    etaMinutes,
    etaP50,
    etaP90,
    distanceRemainingM: Math.floor(roadDistanceM),
    durationSeconds,
    durationInTrafficSeconds: bufferedDurationSeconds,
    confidence,
    trafficModel: "best_guess",
    source: "fallback",
    calculatedAt: now,
  };
}

/**
 * Haversine distance in meters
 */
function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Determine confidence based on GPS accuracy
 */
function getConfidenceFromAccuracy(
  accuracyM?: number
): "high" | "medium" | "low" {
  if (!accuracyM) return "low";
  if (accuracyM <= 50) return "high";
  if (accuracyM <= 200) return "medium";
  return "low";
}

/**
 * Cache ETA result in Redis
 */
async function cacheETA(key: string, result: ETAResult): Promise<void> {
  const entry: ETACacheEntry = {
    etaMinutes: result.etaMinutes,
    etaP50: result.etaP50.toISOString(),
    etaP90: result.etaP90.toISOString(),
    distanceRemainingM: result.distanceRemainingM,
    confidence: result.confidence,
    trafficModel: result.trafficModel,
    source: result.source,
    calculatedAt: result.calculatedAt.toISOString(),
  };

  await redisClient.set(key, JSON.stringify(entry), { EX: CACHE_TTL_SECONDS });
}

/**
 * Get cached ETA from Redis
 */
async function getCachedETA(key: string): Promise<ETACacheEntry | null> {
  const raw = await redisClient.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ETACacheEntry;
  } catch {
    return null;
  }
}

/**
 * Clear ETA cache for an order
 */
export async function clearETACache(orderId: string): Promise<void> {
  await redisClient.del(`${CACHE_PREFIX}${orderId}`);
}

/**
 * Batch calculate ETA for multiple orders
 */
export async function batchCalculateETA(
  orders: Array<{
    orderId: string;
    riderLat: number;
    riderLng: number;
    destLat: number;
    destLng: number;
    accuracyM?: number;
  }>
): Promise<Map<string, ETAResult>> {
  const results = new Map<string, ETAResult>();

  // Process in parallel with Promise.all
  const promises = orders.map(async (order) => {
    const eta = await calculateETA({
      riderLat: order.riderLat,
      riderLng: order.riderLng,
      destLat: order.destLat,
      destLng: order.destLng,
      orderId: order.orderId,
      accuracyM: order.accuracyM,
    });
    return { orderId: order.orderId, eta };
  });

  const settled = await Promise.all(promises);
  for (const { orderId, eta } of settled) {
    results.set(orderId, eta);
  }

  return results;
}

export default {
  calculateETA,
  clearETACache,
  batchCalculateETA,
};
