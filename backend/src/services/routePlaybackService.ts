import redisClient from "../config/redis";
import { Order } from "../models/Order";

/**
 * Route Playback Service
 * Stores and retrieves historical location data for delivery journeys
 * Uses Redis during active delivery, flushed to MongoDB on completion
 */

export type LocationPoint = {
  lat: number;
  lng: number;
  timestamp: string;
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
};

export type RoutePlayback = {
  orderId: string;
  riderId: string;
  startTime: string;
  endTime?: string;
  points: LocationPoint[];
  totalDistanceM: number;
  totalDurationSeconds: number;
  status: "active" | "completed";
};

const REDIS_KEY_PREFIX = "route:playback:";
const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Add a location point to the route playback
 */
export async function addLocationPoint(
  orderId: string,
  riderId: string,
  point: LocationPoint
): Promise<void> {
  const key = `${REDIS_KEY_PREFIX}${orderId}`;
  
  // Get existing playback or create new
  const existing = await getRoutePlayback(orderId);
  
  if (!existing) {
    const newPlayback: RoutePlayback = {
      orderId,
      riderId,
      startTime: point.timestamp,
      points: [point],
      totalDistanceM: 0,
      totalDurationSeconds: 0,
      status: "active",
    };
    await redisClient.set(key, JSON.stringify(newPlayback), { EX: REDIS_TTL_SECONDS });
    return;
  }

  // Calculate distance from last point
  const lastPoint = existing.points[existing.points.length - 1];
  const distanceM = calculateDistanceM(
    lastPoint.lat,
    lastPoint.lng,
    point.lat,
    point.lng
  );

  // Calculate duration
  const durationSeconds = Math.floor(
    (new Date(point.timestamp).getTime() - new Date(existing.startTime).getTime()) / 1000
  );

  // Add point to existing
  const updated: RoutePlayback = {
    ...existing,
    points: [...existing.points, point],
    totalDistanceM: existing.totalDistanceM + distanceM,
    totalDurationSeconds: durationSeconds,
  };

  // Keep only last 1000 points to prevent memory issues
  if (updated.points.length > 1000) {
    // Sample every other point to reduce size
    const sampled: LocationPoint[] = [];
    for (let i = 0; i < updated.points.length; i += 2) {
      sampled.push(updated.points[i]);
    }
    updated.points = sampled;
  }

  await redisClient.set(key, JSON.stringify(updated), { EX: REDIS_TTL_SECONDS });
}

/**
 * Get route playback for an order
 */
export async function getRoutePlayback(orderId: string): Promise<RoutePlayback | null> {
  const key = `${REDIS_KEY_PREFIX}${orderId}`;
  const raw = await redisClient.get(key);
  
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RoutePlayback;
  } catch {
    return null;
  }
}

/**
 * Complete route playback and flush to MongoDB
 */
export async function completeRoutePlayback(orderId: string): Promise<void> {
  const key = `${REDIS_KEY_PREFIX}${orderId}`;
  const playback = await getRoutePlayback(orderId);

  if (!playback) return;

  // Mark as completed
  playback.status = "completed";
  playback.endTime = new Date().toISOString();

  // Store in MongoDB (as part of order document)
  await Order.findByIdAndUpdate(orderId, {
    $set: {
      routePlayback: {
        startTime: playback.startTime,
        endTime: playback.endTime,
        totalDistanceM: playback.totalDistanceM,
        totalDurationSeconds: playback.totalDurationSeconds,
        pointsCount: playback.points.length,
        // Store sampled points (every 10th point) to reduce document size
        sampledPoints: playback.points.filter((_, i) => i % 10 === 0),
      },
    },
  });

  // Delete from Redis
  await redisClient.del(key);
}

/**
 * Get sampled points for playback (reduced resolution for display)
 */
export async function getSampledPlayback(
  orderId: string,
  sampleRate: number = 10
): Promise<LocationPoint[] | null> {
  const playback = await getRoutePlayback(orderId);
  if (!playback) return null;

  // Sample every Nth point
  return playback.points.filter((_, i) => i % sampleRate === 0);
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
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
 * Clear playback data for an order (on cancellation)
 */
export async function clearRoutePlayback(orderId: string): Promise<void> {
  const key = `${REDIS_KEY_PREFIX}${orderId}`;
  await redisClient.del(key);
}

export default {
  addLocationPoint,
  getRoutePlayback,
  completeRoutePlayback,
  getSampledPlayback,
  clearRoutePlayback,
};
