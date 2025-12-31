/**
 * Enterprise-Grade Delivery Fee Service
 * Handles all delivery fee calculations with multi-warehouse support,
 * Google Maps integration, caching, and advanced pricing rules
 */

import { Client } from "@googlemaps/google-maps-services-js";
import NodeCache from "node-cache";
import { IAddress } from "../models/User";
import {
  DELIVERY_CONFIG,
  WAREHOUSES,
  DELIVERY_TIERS,
  SURCHARGE_RULES,
  Warehouse,
  DeliveryTier,
  SurchargeRule,
} from "../config/deliveryFeeConfig";

// Initialize Google Maps client
const googleMapsClient = new Client({});

// Initialize cache (TTL in seconds)
const distanceCache = new NodeCache({
  stdTTL: DELIVERY_CONFIG.CACHE_TTL_MINUTES * 60,
  // Test-only behavior: avoid background intervals that can keep Jest open
  checkperiod: process.env.NODE_ENV === "test" ? 0 : 120,
});

/**
 * Delivery Fee Calculation Result
 */
export interface DeliveryFeeResult {
  warehouse: {
    id: string;
    name: string;
    city: string;
  };
  distance: {
    value: number; // in km
    method: "GOOGLE_MAPS" | "HAVERSINE";
    cached: boolean;
  };
  fees: {
    baseFee: number;
    distanceFee: number;
    surcharges: Array<{
      name: string;
      type: string;
      amount: number;
    }>;
    subtotal: number;
    discount: number; // if free delivery applies
    total: number;
  };
  delivery: {
    isFreeDelivery: boolean;
    isDeliverable: boolean;
    estimatedTime: string;
    estimatedDays: number;
  };
  breakdown: string; // Human-readable breakdown
}

/**
 * Calculate delivery fee for a user's address
 * Main entry point for delivery fee calculation
 */
export async function calculateDeliveryFeeForAddress(
  userAddress: IAddress,
  orderAmount: number,
  orderWeight: number = 0,
  isExpressDelivery: boolean = false
): Promise<DeliveryFeeResult> {
  try {
    // Step 1: Find nearest active warehouse
    const nearestWarehouse = await findNearestWarehouse(userAddress);

    if (!nearestWarehouse) {
      throw new Error("No active warehouse found for delivery");
    }

    // Step 2: Calculate distance
    const distanceResult = await calculateDistance(nearestWarehouse, userAddress);

    // Step 3: Check if delivery is available
    if (!isDeliveryAvailable(distanceResult.distance, nearestWarehouse)) {
      return createUndeliverableResult(nearestWarehouse, distanceResult.distance);
    }

    // Step 4: Calculate base fee based on distance tier
    const tier = findDeliveryTier(distanceResult.distance);
    const baseFee = tier.baseFee;
    const distanceFee = calculateDistanceFee(distanceResult.distance, tier);

    // Step 5: Calculate surcharges
    const surcharges = calculateSurcharges({
      orderWeight,
      isExpressDelivery,
      distance: distanceResult.distance,
      deliveryTime: new Date(),
    });

    // Step 6: Calculate subtotal
    const subtotal = baseFee + distanceFee + surcharges.reduce((sum, s) => sum + s.amount, 0);

    // Step 7: Apply free delivery discount if applicable
    const isFreeDelivery = orderAmount >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;
    const discount = isFreeDelivery ? subtotal : 0;
    const total = isFreeDelivery ? 0 : Math.max(subtotal, DELIVERY_CONFIG.MINIMUM_DELIVERY_FEE);

    // Step 8: Round to nearest configured amount
    const roundedTotal = roundToNearest(total, DELIVERY_CONFIG.ROUND_TO_NEAREST);

    // Step 9: Build result
    const result: DeliveryFeeResult = {
      warehouse: {
        id: nearestWarehouse.id,
        name: nearestWarehouse.name,
        city: nearestWarehouse.city,
      },
      distance: {
        value: distanceResult.distance,
        method: distanceResult.method,
        cached: distanceResult.cached,
      },
      fees: {
        baseFee,
        distanceFee,
        surcharges,
        subtotal,
        discount,
        total: roundedTotal,
      },
      delivery: {
        isFreeDelivery,
        isDeliverable: true,
        estimatedTime: tier.estimatedTime,
        estimatedDays: isExpressDelivery
          ? DELIVERY_CONFIG.EXPRESS_DELIVERY_DAYS
          : DELIVERY_CONFIG.STANDARD_DELIVERY_DAYS,
      },
      breakdown: generateBreakdown(baseFee, distanceFee, surcharges, discount, roundedTotal, isFreeDelivery),
    };

    return result;
  } catch (error) {
    console.error("Error calculating delivery fee:", error);
    throw error;
  }
}

/**
 * Find nearest active warehouse to user's address
 */
async function findNearestWarehouse(userAddress: IAddress): Promise<Warehouse | null> {
  const activeWarehouses = WAREHOUSES.filter((w) => w.isActive).sort((a, b) => a.priority - b.priority);

  if (activeWarehouses.length === 0) {
    return null;
  }

  // For now, return the highest priority warehouse
  // In production, calculate distance to all warehouses and return nearest
  let nearestWarehouse = activeWarehouses[0];
  let minDistance = Infinity;

  for (const warehouse of activeWarehouses) {
    const distance = calculateHaversineDistance(
      warehouse.lat,
      warehouse.lng,
      userAddress.lat || 0,
      userAddress.lng || 0
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestWarehouse = warehouse;
    }
  }

  return nearestWarehouse;
}

/**
 * Calculate distance using Google Maps API with fallback to Haversine
 */
async function calculateDistance(
  warehouse: Warehouse,
  userAddress: IAddress
): Promise<{ distance: number; method: "GOOGLE_MAPS" | "HAVERSINE"; cached: boolean }> {
  // Test-only behavior: avoid any external Google API calls for deterministic tests
  if (process.env.NODE_ENV === "test") {
    const cacheKey = `${warehouse.id}_${userAddress.lat}_${userAddress.lng}`;

    if (DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
      const cached = distanceCache.get<number>(cacheKey);
      if (cached !== undefined) {
        return {
          distance: cached,
          method: "HAVERSINE",
          cached: true,
        };
      }
    }

    const distance = calculateHaversineDistance(
      warehouse.lat,
      warehouse.lng,
      userAddress.lat || 0,
      userAddress.lng || 0
    );

    if (DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
      distanceCache.set(cacheKey, distance);
    }

    return {
      distance,
      method: "HAVERSINE",
      cached: false,
    };
  }

  // Generate cache key
  const cacheKey = `${warehouse.id}_${userAddress.lat}_${userAddress.lng}`;

  // Check cache first
  if (DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
    const cached = distanceCache.get<number>(cacheKey);
    if (cached !== undefined) {
      return {
        distance: cached,
        method: "GOOGLE_MAPS",
        cached: true,
      };
    }
  }

  // Try Google Maps API if enabled
  if (DELIVERY_CONFIG.GOOGLE_MAPS_API_ENABLED && DELIVERY_CONFIG.GOOGLE_MAPS_API_KEY) {
    try {
      const response = await googleMapsClient.distancematrix({
        params: {
          origins: [`${warehouse.lat},${warehouse.lng}`],
          destinations: [`${userAddress.lat},${userAddress.lng}`],
          key: DELIVERY_CONFIG.GOOGLE_MAPS_API_KEY,
          units: "metric" as any,
        },
      });

      if (response.data.rows[0]?.elements[0]?.status === "OK") {
        const distanceInMeters = response.data.rows[0].elements[0].distance.value;
        const distanceInKm = Math.round((distanceInMeters / 1000) * 10) / 10; // Round to 1 decimal

        // Cache the result
        if (DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
          distanceCache.set(cacheKey, distanceInKm);
        }

        return {
          distance: distanceInKm,
          method: "GOOGLE_MAPS",
          cached: false,
        };
      }
    } catch (error) {
      console.error("Google Maps API error, falling back to Haversine:", error);
    }
  }

  // Fallback to Haversine formula
  if (DELIVERY_CONFIG.FALLBACK_TO_HAVERSINE) {
    const distance = calculateHaversineDistance(
      warehouse.lat,
      warehouse.lng,
      userAddress.lat || 0,
      userAddress.lng || 0
    );

    // Cache the fallback result too
    if (DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
      distanceCache.set(cacheKey, distance);
    }

    return {
      distance,
      method: "HAVERSINE",
      cached: false,
    };
  }

  throw new Error("Unable to calculate distance - all methods failed");
}

/**
 * Haversine formula for calculating distance between two coordinates
 */
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if delivery is available based on distance and warehouse limits
 */
function isDeliveryAvailable(distance: number, warehouse: Warehouse): boolean {
  return distance <= warehouse.maxDeliveryRadius;
}

/**
 * Find appropriate delivery tier based on distance
 */
function findDeliveryTier(distance: number): DeliveryTier {
  const tier = DELIVERY_TIERS.find((t) => distance >= t.minDistance && distance < t.maxDistance);
  return tier || DELIVERY_TIERS[DELIVERY_TIERS.length - 1];
}

/**
 * Calculate distance-based fee using tier's per-km rate
 */
function calculateDistanceFee(distance: number, tier: DeliveryTier): number {
  // First 2km included in base fee
  const chargeableDistance = Math.max(0, distance - 2);
  return Math.round(chargeableDistance * tier.perKmFee);
}

/**
 * Calculate all applicable surcharges
 */
function calculateSurcharges(params: {
  orderWeight: number;
  isExpressDelivery: boolean;
  distance: number;
  deliveryTime: Date;
}): Array<{ name: string; type: string; amount: number }> {
  const surcharges: Array<{ name: string; type: string; amount: number }> = [];

  // Check each surcharge rule
  for (const rule of SURCHARGE_RULES) {
    if (!rule.enabled) continue;

    let applies = false;
    let amount = 0;

    switch (rule.type) {
      case "WEIGHT":
        if (params.orderWeight >= (rule.condition.minWeight || 0)) {
          applies = true;
          amount = rule.surcharge.value;
        }
        break;

      case "EXPRESS":
        if (params.isExpressDelivery) {
          applies = true;
          amount = rule.surcharge.value;
        }
        break;

      case "PEAK_HOUR":
        if (isPeakHour(params.deliveryTime, rule)) {
          applies = true;
          amount = rule.surcharge.value;
        }
        break;

      case "TIME_SLOT":
        if (isWeekend(params.deliveryTime) && rule.condition.dayOfWeek?.includes(params.deliveryTime.getDay())) {
          applies = true;
          amount = rule.surcharge.value;
        }
        break;
    }

    if (applies) {
      surcharges.push({
        name: rule.name,
        type: rule.type,
        amount,
      });
    }
  }

  return surcharges;
}

/**
 * Check if delivery time is during peak hours
 */
function isPeakHour(deliveryTime: Date, rule: SurchargeRule): boolean {
  const hour = deliveryTime.getHours();
  const minute = deliveryTime.getMinutes();
  const currentTime = hour * 60 + minute;

  if (rule.condition.timeSlotStart && rule.condition.timeSlotEnd) {
    const [startHour, startMin] = rule.condition.timeSlotStart.split(":").map(Number);
    const [endHour, endMin] = rule.condition.timeSlotEnd.split(":").map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  return false;
}

/**
 * Check if date is weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Round to nearest specified amount
 */
function roundToNearest(value: number, nearest: number): number {
  return Math.round(value / nearest) * nearest;
}

/**
 * Generate human-readable breakdown
 */
function generateBreakdown(
  baseFee: number,
  distanceFee: number,
  surcharges: Array<{ name: string; amount: number }>,
  discount: number,
  total: number,
  isFreeDelivery: boolean
): string {
  const lines: string[] = [];

  lines.push(`Base Fee: ₹${baseFee}`);
  if (distanceFee > 0) {
    lines.push(`Distance Charge: ₹${distanceFee}`);
  }

  surcharges.forEach((s) => {
    lines.push(`${s.name}: ₹${s.amount}`);
  });

  if (isFreeDelivery) {
    lines.push(`Free Delivery Discount: -₹${discount}`);
    lines.push(`Total: ₹0 (FREE)`);
  } else {
    lines.push(`Total: ₹${total}`);
  }

  return lines.join(" | ");
}

/**
 * Create result for undeliverable address
 */
function createUndeliverableResult(warehouse: Warehouse, distance: number): DeliveryFeeResult {
  return {
    warehouse: {
      id: warehouse.id,
      name: warehouse.name,
      city: warehouse.city,
    },
    distance: {
      value: distance,
      method: "HAVERSINE",
      cached: false,
    },
    fees: {
      baseFee: 0,
      distanceFee: 0,
      surcharges: [],
      subtotal: 0,
      discount: 0,
      total: 0,
    },
    delivery: {
      isFreeDelivery: false,
      isDeliverable: false,
      estimatedTime: "Not available",
      estimatedDays: 0,
    },
    breakdown: `Delivery not available. Distance ${distance} km exceeds maximum delivery radius.`,
  };
}

/**
 * Clear distance cache (for testing or manual refresh)
 */
export function clearDistanceCache(): void {
  distanceCache.flushAll();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return distanceCache.getStats();
}
