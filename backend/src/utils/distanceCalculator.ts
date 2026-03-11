import { logger } from './logger';
import { Client } from "@googlemaps/google-maps-services-js";
import redisClient from "../config/redis";

/**
 * Distance Calculator Service
 * Calculates road distance using Google Directions API
 * Falls back to Haversine × 1.3 factor when API unavailable
 */

const googleMapsClient = new Client({});

export type DistanceResult = {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  source: "google" | "fallback";
  polyline?: string;
};

const CACHE_PREFIX = "route:dist:";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Calculate road distance between two coordinates
 * Uses Google Directions API with Redis caching
 */
export async function getRouteDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult> {
  // Round coordinates to 3 decimal places for cache key (~111m precision)
  const roundedOriginLat = Math.round(originLat * 1000) / 1000;
  const roundedOriginLng = Math.round(originLng * 1000) / 1000;
  const roundedDestLat = Math.round(destLat * 1000) / 1000;
  const roundedDestLng = Math.round(destLng * 1000) / 1000;

  const cacheKey = `${CACHE_PREFIX}${roundedOriginLat}:${roundedOriginLng}:${roundedDestLat}:${roundedDestLng}`;

  // Check cache first
  const cached = await getCachedDistance(cacheKey);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Try Google Directions API
  if (apiKey) {
    try {
      const result = await callGoogleDirections(
        originLat,
        originLng,
        destLat,
        destLng,
        apiKey
      );

      // Cache the result
      await cacheDistance(cacheKey, result);

      return result;
    } catch (error) {
      logger.error("[DistanceCalculator] Google Directions API failed:", error);
      // Fall through to fallback
    }
  }

  // Fallback: Haversine × 1.3 (road distance is typically 30% more than straight-line in India)
  const fallbackResult = calculateFallbackDistance(
    originLat,
    originLng,
    destLat,
    destLng
  );

  // Cache the fallback result (shorter TTL since it's less accurate)
  await cacheDistance(cacheKey, fallbackResult, 60 * 15); // 15 minutes

  return fallbackResult;
}

/**
 * Call Google Directions API
 */
async function callGoogleDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<DistanceResult> {
  const response = await googleMapsClient.directions({
    params: {
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`,
      key: apiKey,
      mode: "driving" as any,
      alternatives: false,
    },
  });

  if (response.data.status !== "OK" || !response.data.routes?.length) {
    throw new Error(`Google Directions failed: ${response.data.status}`);
  }

  const route = response.data.routes[0];
  const leg = route.legs[0];

  return {
    distanceMeters: leg.distance.value,
    distanceKm: leg.distance.value / 1000,
    durationSeconds: leg.duration.value,
    durationMinutes: Math.ceil(leg.duration.value / 60),
    source: "google",
    polyline: route.overview_polyline.points,
  };
}

/**
 * Calculate fallback distance using Haversine × 1.3
 */
function calculateFallbackDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): DistanceResult {
  // Haversine straight-line distance
  const straightLineMeters = haversineDistance(
    originLat,
    originLng,
    destLat,
    destLng
  );

  // Road distance is typically 30% more in India
  const roadDistanceMeters = straightLineMeters * 1.3;

  // Estimate duration: 25 km/h average in Indian city traffic
  const avgSpeedMps = (25 * 1000) / 3600;
  const durationSeconds = Math.floor(roadDistanceMeters / avgSpeedMps);

  return {
    distanceMeters: Math.floor(roadDistanceMeters),
    distanceKm: Math.floor(roadDistanceMeters) / 1000,
    durationSeconds,
    durationMinutes: Math.ceil(durationSeconds / 60),
    source: "fallback",
  };
}

/**
 * Haversine distance calculation
 * @returns Distance in meters
 */
export function haversineDistance(
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
 * Cache distance result in Redis
 */
async function cacheDistance(
  key: string,
  result: DistanceResult,
  ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<void> {
  await redisClient.set(key, JSON.stringify(result), { EX: ttlSeconds });
}

/**
 * Get cached distance from Redis
 */
async function getCachedDistance(key: string): Promise<DistanceResult | null> {
  const raw = await redisClient.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DistanceResult;
  } catch {
    return null;
  }
}

/**
 * Calculate distance matrix for multiple origins/destinations
 * Useful for route optimization
 */
export async function getDistanceMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>
): Promise<Array<Array<DistanceResult>>> {
  const matrix: Array<Array<DistanceResult>> = [];

  for (let i = 0; i < origins.length; i++) {
    const row: Array<DistanceResult> = [];
    for (let j = 0; j < destinations.length; j++) {
      const result = await getRouteDistance(
        origins[i].lat,
        origins[i].lng,
        destinations[j].lat,
        destinations[j].lng
      );
      row.push(result);
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Batch calculate distances (parallel processing)
 */
export async function batchGetRouteDistance(
  pairs: Array<{
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }>
): Promise<DistanceResult[]> {
  const promises = pairs.map((pair) =>
    getRouteDistance(pair.originLat, pair.originLng, pair.destLat, pair.destLng)
  );

  return Promise.all(promises);
}

export default {
  getRouteDistance,
  haversineDistance,
  getDistanceMatrix,
  batchGetRouteDistance,
};
