"use strict";
/**
 * Enterprise-Grade Delivery Fee Service
 * Handles all delivery fee calculations with multi-warehouse support,
 * Google Maps integration, caching, and advanced pricing rules
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeliveryFeeForAddress = calculateDeliveryFeeForAddress;
exports.clearDistanceCache = clearDistanceCache;
exports.getCacheStats = getCacheStats;
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const node_cache_1 = __importDefault(require("node-cache"));
const deliveryFeeConfig_1 = require("../config/deliveryFeeConfig");
// Initialize Google Maps client
const googleMapsClient = new google_maps_services_js_1.Client({});
// Initialize cache (TTL in seconds)
const distanceCache = new node_cache_1.default({
    stdTTL: deliveryFeeConfig_1.DELIVERY_CONFIG.CACHE_TTL_MINUTES * 60,
    checkperiod: 120,
});
/**
 * Calculate delivery fee for a user's address
 * Main entry point for delivery fee calculation
 */
async function calculateDeliveryFeeForAddress(userAddress, orderAmount, orderWeight = 0, isExpressDelivery = false) {
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
        const isFreeDelivery = orderAmount >= deliveryFeeConfig_1.DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;
        const discount = isFreeDelivery ? subtotal : 0;
        const total = isFreeDelivery ? 0 : Math.max(subtotal, deliveryFeeConfig_1.DELIVERY_CONFIG.MINIMUM_DELIVERY_FEE);
        // Step 8: Round to nearest configured amount
        const roundedTotal = roundToNearest(total, deliveryFeeConfig_1.DELIVERY_CONFIG.ROUND_TO_NEAREST);
        // Step 9: Build result
        const result = {
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
                    ? deliveryFeeConfig_1.DELIVERY_CONFIG.EXPRESS_DELIVERY_DAYS
                    : deliveryFeeConfig_1.DELIVERY_CONFIG.STANDARD_DELIVERY_DAYS,
            },
            breakdown: generateBreakdown(baseFee, distanceFee, surcharges, discount, roundedTotal, isFreeDelivery),
        };
        return result;
    }
    catch (error) {
        console.error("Error calculating delivery fee:", error);
        throw error;
    }
}
/**
 * Find nearest active warehouse to user's address
 */
async function findNearestWarehouse(userAddress) {
    const activeWarehouses = deliveryFeeConfig_1.WAREHOUSES.filter((w) => w.isActive).sort((a, b) => a.priority - b.priority);
    if (activeWarehouses.length === 0) {
        return null;
    }
    // For now, return the highest priority warehouse
    // In production, calculate distance to all warehouses and return nearest
    let nearestWarehouse = activeWarehouses[0];
    let minDistance = Infinity;
    for (const warehouse of activeWarehouses) {
        const distance = calculateHaversineDistance(warehouse.lat, warehouse.lng, userAddress.lat || 0, userAddress.lng || 0);
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
async function calculateDistance(warehouse, userAddress) {
    // Generate cache key
    const cacheKey = `${warehouse.id}_${userAddress.lat}_${userAddress.lng}`;
    // Check cache first
    if (deliveryFeeConfig_1.DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
        const cached = distanceCache.get(cacheKey);
        if (cached !== undefined) {
            return {
                distance: cached,
                method: "GOOGLE_MAPS",
                cached: true,
            };
        }
    }
    // Try Google Maps API if enabled
    if (deliveryFeeConfig_1.DELIVERY_CONFIG.GOOGLE_MAPS_API_ENABLED && deliveryFeeConfig_1.DELIVERY_CONFIG.GOOGLE_MAPS_API_KEY) {
        try {
            const response = await googleMapsClient.distancematrix({
                params: {
                    origins: [`${warehouse.lat},${warehouse.lng}`],
                    destinations: [`${userAddress.lat},${userAddress.lng}`],
                    key: deliveryFeeConfig_1.DELIVERY_CONFIG.GOOGLE_MAPS_API_KEY,
                    units: "metric",
                },
            });
            if (response.data.rows[0]?.elements[0]?.status === "OK") {
                const distanceInMeters = response.data.rows[0].elements[0].distance.value;
                const distanceInKm = Math.round((distanceInMeters / 1000) * 10) / 10; // Round to 1 decimal
                // Cache the result
                if (deliveryFeeConfig_1.DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
                    distanceCache.set(cacheKey, distanceInKm);
                }
                return {
                    distance: distanceInKm,
                    method: "GOOGLE_MAPS",
                    cached: false,
                };
            }
        }
        catch (error) {
            console.error("Google Maps API error, falling back to Haversine:", error);
        }
    }
    // Fallback to Haversine formula
    if (deliveryFeeConfig_1.DELIVERY_CONFIG.FALLBACK_TO_HAVERSINE) {
        const distance = calculateHaversineDistance(warehouse.lat, warehouse.lng, userAddress.lat || 0, userAddress.lng || 0);
        // Cache the fallback result too
        if (deliveryFeeConfig_1.DELIVERY_CONFIG.ENABLE_DISTANCE_CACHE) {
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
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
}
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
/**
 * Check if delivery is available based on distance and warehouse limits
 */
function isDeliveryAvailable(distance, warehouse) {
    return distance <= warehouse.maxDeliveryRadius;
}
/**
 * Find appropriate delivery tier based on distance
 */
function findDeliveryTier(distance) {
    const tier = deliveryFeeConfig_1.DELIVERY_TIERS.find((t) => distance >= t.minDistance && distance < t.maxDistance);
    return tier || deliveryFeeConfig_1.DELIVERY_TIERS[deliveryFeeConfig_1.DELIVERY_TIERS.length - 1];
}
/**
 * Calculate distance-based fee using tier's per-km rate
 */
function calculateDistanceFee(distance, tier) {
    // First 2km included in base fee
    const chargeableDistance = Math.max(0, distance - 2);
    return Math.round(chargeableDistance * tier.perKmFee);
}
/**
 * Calculate all applicable surcharges
 */
function calculateSurcharges(params) {
    const surcharges = [];
    // Check each surcharge rule
    for (const rule of deliveryFeeConfig_1.SURCHARGE_RULES) {
        if (!rule.enabled)
            continue;
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
function isPeakHour(deliveryTime, rule) {
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
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
}
/**
 * Round to nearest specified amount
 */
function roundToNearest(value, nearest) {
    return Math.round(value / nearest) * nearest;
}
/**
 * Generate human-readable breakdown
 */
function generateBreakdown(baseFee, distanceFee, surcharges, discount, total, isFreeDelivery) {
    const lines = [];
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
    }
    else {
        lines.push(`Total: ₹${total}`);
    }
    return lines.join(" | ");
}
/**
 * Create result for undeliverable address
 */
function createUndeliverableResult(warehouse, distance) {
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
function clearDistanceCache() {
    distanceCache.flushAll();
}
/**
 * Get cache statistics
 */
function getCacheStats() {
    return distanceCache.getStats();
}
