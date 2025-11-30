"use strict";
/**
 * Delivery Fee Configuration
 * All configurable parameters for delivery fee calculation
 * Similar to Amazon/Flipkart's pricing structure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_ZONES = exports.SURCHARGE_RULES = exports.DELIVERY_TIERS = exports.WAREHOUSES = exports.DELIVERY_CONFIG = void 0;
exports.DELIVERY_CONFIG = {
    // Free delivery threshold
    FREE_DELIVERY_THRESHOLD: 2000, // ₹2,000
    // Minimum and maximum fees
    MINIMUM_DELIVERY_FEE: 40, // ₹40
    MAXIMUM_DELIVERY_FEE: 1000, // ₹1,000
    // Distance calculation
    GOOGLE_MAPS_API_ENABLED: true,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
    FALLBACK_TO_HAVERSINE: true,
    // Cache settings
    ENABLE_DISTANCE_CACHE: true,
    CACHE_TTL_MINUTES: 60, // 1 hour
    // Delivery timing
    STANDARD_DELIVERY_DAYS: 3,
    EXPRESS_DELIVERY_DAYS: 1,
    EXPRESS_DELIVERY_SURCHARGE: 50, // ₹50 extra
    // Weight-based pricing
    WEIGHT_BASED_PRICING: {
        enabled: true,
        thresholds: [
            { maxWeight: 5, fee: 0 }, // Up to 5kg - no extra charge
            { maxWeight: 10, fee: 20 }, // 5-10kg - ₹20 extra
            { maxWeight: 20, fee: 50 }, // 10-20kg - ₹50 extra
            { maxWeight: Infinity, fee: 100 }, // Above 20kg - ₹100 extra
        ],
    },
    // Peak hour surcharge
    PEAK_HOUR_SURCHARGE: {
        enabled: true,
        hours: [
            { start: "18:00", end: "21:00" }, // Evening peak
            { start: "12:00", end: "14:00" }, // Lunch peak
        ],
        surcharge: 30, // ₹30 extra during peak hours
    },
    // Rounding
    ROUND_TO_NEAREST: 10, // Round to nearest ₹10
};
// Warehouse locations
exports.WAREHOUSES = [
    {
        id: "WH001",
        name: "Tiruvuru Main Warehouse",
        address: "Admin Office, Tiruvuru",
        city: "Tiruvuru",
        state: "Andhra Pradesh",
        pincode: "521235",
        lat: 16.5,
        lng: 80.5,
        isActive: true,
        operatingHours: {
            start: "09:00",
            end: "21:00",
        },
        maxDeliveryRadius: 500, // 500km
        priority: 1,
    },
    {
        id: "WH002",
        name: "Hyderabad Distribution Center",
        address: "Gachibowli, Hyderabad",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500081",
        lat: 17.4065,
        lng: 78.4772,
        isActive: true,
        operatingHours: {
            start: "08:00",
            end: "22:00",
        },
        maxDeliveryRadius: 300,
        priority: 2,
    },
    // Add more warehouses as needed
];
// Distance-based delivery tiers
exports.DELIVERY_TIERS = [
    {
        minDistance: 0,
        maxDistance: 5,
        baseFee: 40,
        perKmFee: 5,
        estimatedTime: "30-45 mins",
    },
    {
        minDistance: 5,
        maxDistance: 10,
        baseFee: 60,
        perKmFee: 8,
        estimatedTime: "45-60 mins",
    },
    {
        minDistance: 10,
        maxDistance: 20,
        baseFee: 100,
        perKmFee: 10,
        estimatedTime: "1-2 hours",
    },
    {
        minDistance: 20,
        maxDistance: 50,
        baseFee: 150,
        perKmFee: 12,
        estimatedTime: "2-4 hours",
    },
    {
        minDistance: 50,
        maxDistance: 100,
        baseFee: 200,
        perKmFee: 15,
        estimatedTime: "4-6 hours",
    },
    {
        minDistance: 100,
        maxDistance: Infinity,
        baseFee: 300,
        perKmFee: 20,
        estimatedTime: "1-2 days",
    },
];
// Surcharge rules
exports.SURCHARGE_RULES = [
    {
        id: "WEIGHT_HEAVY",
        name: "Heavy Item Surcharge",
        type: "WEIGHT",
        enabled: true,
        condition: {
            minWeight: 10,
        },
        surcharge: {
            type: "FIXED",
            value: 50,
        },
    },
    {
        id: "EXPRESS_DELIVERY",
        name: "Express Delivery",
        type: "EXPRESS",
        enabled: true,
        condition: {},
        surcharge: {
            type: "FIXED",
            value: 50,
        },
    },
    {
        id: "PEAK_HOUR",
        name: "Peak Hour Delivery",
        type: "PEAK_HOUR",
        enabled: true,
        condition: {
            timeSlotStart: "18:00",
            timeSlotEnd: "21:00",
        },
        surcharge: {
            type: "FIXED",
            value: 30,
        },
    },
    {
        id: "WEEKEND_SURCHARGE",
        name: "Weekend Delivery",
        type: "TIME_SLOT",
        enabled: false, // Disabled by default
        condition: {
            dayOfWeek: [0, 6], // Sunday and Saturday
        },
        surcharge: {
            type: "PERCENTAGE",
            value: 10, // 10% extra
        },
    },
];
// Delivery zones (optional - for zone-based pricing)
exports.DELIVERY_ZONES = [
    {
        id: "ZONE_AP_TS",
        name: "Andhra Pradesh & Telangana",
        pincodeRanges: ["500001-534999", "515001-535999"],
        baseFee: 40,
        freeDeliveryThreshold: 1500,
        maxDeliveryDistance: 500,
    },
    {
        id: "ZONE_SOUTH",
        name: "South India",
        pincodeRanges: ["560001-695999"],
        baseFee: 80,
        freeDeliveryThreshold: 2000,
        maxDeliveryDistance: 1000,
    },
    {
        id: "ZONE_NORTH",
        name: "North India",
        pincodeRanges: ["110001-249999"],
        baseFee: 100,
        freeDeliveryThreshold: 2500,
        maxDeliveryDistance: 1500,
    },
];
