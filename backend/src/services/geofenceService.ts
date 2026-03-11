import redisClient from "../config/redis";

/**
 * Geofence Service
 * Provides geofencing capabilities for automatic status updates
 * based on rider proximity to key locations (warehouse, customer address)
 */

export type GeofenceEvent =
  | "AT_WAREHOUSE"
  | "LEFT_WAREHOUSE"
  | "APPROACHING_DESTINATION"
  | "ARRIVING_SOON"
  | "ARRIVED_AT_DESTINATION"
  | "LEFT_DESTINATION";

export type GeofenceResult = {
  withinGeofence: boolean;
  distanceMeters: number;
  event?: GeofenceEvent;
  region?: "warehouse" | "destination";
};

export type GeofenceConfig = {
  warehouseRadiusM: number; // Default: 200m
  arrivingSoonRadiusM: number; // Default: 200m
  arrivedRadiusM: number; // Default: 50m
  hysteresisM: number; // Prevents flickering at boundary: Default 20m
};

const DEFAULT_CONFIG: GeofenceConfig = {
  warehouseRadiusM: 200,
  arrivingSoonRadiusM: 200,
  arrivedRadiusM: 50,
  hysteresisM: 20,
};

// Redis key prefixes for geofence state (prevents flickering)
const GEOFENCE_STATE_PREFIX = "geofence:state:";
const GEOFENCE_STATE_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Calculate Haversine distance between two coordinates
 * @returns Distance in meters
 */
export function calculateDistanceMeters(
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
 * Check if a location is within a geofence radius
 * Uses hysteresis to prevent rapid toggling at boundary
 */
export function isWithinGeofence(
  riderLat: number,
  riderLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number,
  hysteresisM: number = 0
): boolean {
  const distance = calculateDistanceMeters(riderLat, riderLng, targetLat, targetLng);
  return distance <= (radiusMeters + hysteresisM);
}

/**
 * Get distance between rider and target location
 */
export function getDistanceToTarget(
  riderLat: number,
  riderLng: number,
  targetLat: number,
  targetLng: number
): number {
  return calculateDistanceMeters(riderLat, riderLng, targetLat, targetLng);
}

/**
 * Check geofence with state tracking to prevent flickering
 * Uses Redis to track previous state and apply hysteresis
 */
export async function checkGeofenceWithState(params: {
  riderId: string;
  orderId: string;
  riderLat: number;
  riderLng: number;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
  region: "warehouse" | "destination";
  config?: Partial<GeofenceConfig>;
}): Promise<GeofenceResult> {
  const config = { ...DEFAULT_CONFIG, ...params.config };
  const { riderId, orderId, riderLat, riderLng, targetLat, targetLng, radiusMeters, region } = params;

  const distanceMeters = calculateDistanceMeters(riderLat, riderLng, targetLat, targetLng);
  const key = `${GEOFENCE_STATE_PREFIX}${riderId}:${orderId}:${region}`;

  // Get previous state from Redis
  const previousStateRaw = await redisClient.get(key);
  const wasInside = previousStateRaw === "inside";

  // Apply hysteresis: need to be further outside to transition from inside->outside
  // and closer to transition from outside->inside
  let effectiveRadius = radiusMeters;
  if (wasInside) {
    // Was inside, need to go further to be considered outside
    effectiveRadius = radiusMeters + config.hysteresisM;
  } else {
    // Was outside, need to go closer to be considered inside
    effectiveRadius = radiusMeters - config.hysteresisM;
  }

  const withinGeofence = distanceMeters <= effectiveRadius;

  // Update state if changed
  if (withinGeofence !== wasInside) {
    await redisClient.set(
      key,
      withinGeofence ? "inside" : "outside",
      { EX: GEOFENCE_STATE_TTL_SECONDS }
    );
  }

  // Determine event based on state transition
  let event: GeofenceEvent | undefined;
  if (region === "warehouse") {
    if (!wasInside && withinGeofence) {
      event = "AT_WAREHOUSE";
    } else if (wasInside && !withinGeofence) {
      event = "LEFT_WAREHOUSE";
    }
  } else if (region === "destination") {
    if (!wasInside && withinGeofence && distanceMeters <= config.arrivedRadiusM) {
      event = "ARRIVED_AT_DESTINATION";
    } else if (!wasInside && withinGeofence && distanceMeters <= config.arrivingSoonRadiusM) {
      event = "ARRIVING_SOON";
    } else if (wasInside && !withinGeofence) {
      event = "LEFT_DESTINATION";
    }
  }

  return {
    withinGeofence,
    distanceMeters,
    event,
    region,
  };
}

/**
 * Check all geofences for a rider
 * Returns events that should trigger actions
 */
export async function checkAllGeofences(params: {
  riderId: string;
  orderId: string;
  riderLat: number;
  riderLng: number;
  warehouseLat: number;
  warehouseLng: number;
  destinationLat: number;
  destinationLng: number;
  config?: Partial<GeofenceConfig>;
}): Promise<GeofenceResult[]> {
  const config = { ...DEFAULT_CONFIG, ...params.config };
  const results: GeofenceResult[] = [];

  // Check warehouse geofence
  const warehouseResult = await checkGeofenceWithState({
    riderId: params.riderId,
    orderId: params.orderId,
    riderLat: params.riderLat,
    riderLng: params.riderLng,
    targetLat: params.warehouseLat,
    targetLng: params.warehouseLng,
    radiusMeters: config.warehouseRadiusM,
    region: "warehouse",
    config,
  });
  results.push(warehouseResult);

  // Check destination geofence (arriving soon radius)
  const destinationResult = await checkGeofenceWithState({
    riderId: params.riderId,
    orderId: params.orderId,
    riderLat: params.riderLat,
    riderLng: params.riderLng,
    targetLat: params.destinationLat,
    targetLng: params.destinationLng,
    radiusMeters: config.arrivingSoonRadiusM,
    region: "destination",
    config,
  });
  results.push(destinationResult);

  return results;
}

/**
 * Clear geofence state for an order (call when order is completed/cancelled)
 */
export async function clearGeofenceState(riderId: string, orderId: string): Promise<void> {
  const keys = [
    `${GEOFENCE_STATE_PREFIX}${riderId}:${orderId}:warehouse`,
    `${GEOFENCE_STATE_PREFIX}${riderId}:${orderId}:destination`,
  ];
  await Promise.all(keys.map((key) => redisClient.del(key)));
}

/**
 * Get notification message for geofence event
 */
export function getGeofenceEventMessage(event: GeofenceEvent): {
  title: string;
  body: string;
  priority: "low" | "medium" | "high";
} {
  switch (event) {
    case "AT_WAREHOUSE":
      return {
        title: "At Warehouse",
        body: "Delivery partner has arrived at the warehouse",
        priority: "low",
      };
    case "LEFT_WAREHOUSE":
      return {
        title: "Order Picked Up",
        body: "Your order has been picked up and is on the way",
        priority: "medium",
      };
    case "APPROACHING_DESTINATION":
      return {
        title: "Approaching",
        body: "Your delivery partner is approaching your location",
        priority: "medium",
      };
    case "ARRIVING_SOON":
      return {
        title: "Arriving Soon!",
        body: "Your delivery partner will arrive in a few minutes",
        priority: "high",
      };
    case "ARRIVED_AT_DESTINATION":
      return {
        title: "Arrived!",
        body: "Your delivery partner has arrived at your location",
        priority: "high",
      };
    case "LEFT_DESTINATION":
      return {
        title: "Delivery Complete",
        body: "Your order has been delivered",
        priority: "medium",
      };
    default:
      return {
        title: "Update",
        body: "Your order status has been updated",
        priority: "low",
      };
  }
}

export default {
  isWithinGeofence,
  calculateDistanceMeters,
  getDistanceToTarget,
  checkGeofenceWithState,
  checkAllGeofences,
  clearGeofenceState,
  getGeofenceEventMessage,
};
