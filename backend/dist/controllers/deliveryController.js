"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeliveryFeeTiersController = exports.calculateDeliveryFeeController = void 0;
/**
 * Calculate delivery fee based on customer address
 * POST /api/delivery/calculate-fee
 */
const calculateDeliveryFeeController = async (req, res) => {
    try {
        const { address } = req.body;
        // Validate required fields
        if (!address || !address.city || !address.pincode) {
            return res.status(400).json({
                success: false,
                message: "Address with city and pincode is required",
            });
        }
        // Calculate delivery fee
        const deliveryFee = await getDeliveryFeeForAddress(address);
        return res.json({
            success: true,
            data: deliveryFee,
        });
    }
    catch (error) {
        console.error("Error calculating delivery fee:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to calculate delivery fee",
        });
    }
};
exports.calculateDeliveryFeeController = calculateDeliveryFeeController;
/**
 * Get delivery fee tiers for display
 * GET /api/delivery/fee-tiers
 */
const getDeliveryFeeTiersController = async (req, res) => {
    try {
        const tiers = getDeliveryFeeTiers();
        return res.json({
            success: true,
            data: tiers,
        });
    }
    catch (error) {
        console.error("Error getting delivery fee tiers:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get delivery fee tiers",
        });
    }
};
exports.getDeliveryFeeTiersController = getDeliveryFeeTiersController;
// Store location (CS Store headquarters)
const STORE_LOCATION = {
    lat: 17.385, // Hyderabad coordinates
    lng: 78.4867,
};
// Delivery fee tiers based on distance
const DELIVERY_TIERS = [
    { maxDistance: 5, baseFee: 50, perKmFee: 5, estimatedTime: "30-45 mins" },
    { maxDistance: 10, baseFee: 80, perKmFee: 8, estimatedTime: "45-60 mins" },
    { maxDistance: 20, baseFee: 120, perKmFee: 10, estimatedTime: "1-2 hours" },
    { maxDistance: 50, baseFee: 200, perKmFee: 15, estimatedTime: "2-4 hours" },
    {
        maxDistance: Infinity,
        baseFee: 300,
        perKmFee: 20,
        estimatedTime: "4+ hours",
    },
];
// Maximum delivery distance (in kilometers)
const MAX_DELIVERY_DISTANCE = 100;
/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(coord2.lat - coord1.lat);
    const dLng = toRadians(coord2.lng - coord1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(coord1.lat)) *
            Math.cos(toRadians(coord2.lat)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
/**
 * Geocode an address to get coordinates
 * This is a mock implementation - in production, use a real geocoding service
 */
async function geocodeAddress(address) {
    // Mock geocoding - in production, use Google Maps API, OpenStreetMap, etc.
    const mockCoordinates = {
        // Hyderabad area
        "500001": { lat: 17.385, lng: 78.4867 },
        "500032": { lat: 17.436, lng: 78.377 },
        "500045": { lat: 17.4399, lng: 78.3481 },
        "500081": { lat: 17.4065, lng: 78.4772 },
        // Mancherial area (from the image)
        "504208": { lat: 18.87, lng: 79.45 },
        "504201": { lat: 18.85, lng: 79.43 },
        // Other major cities
        "110001": { lat: 28.6139, lng: 77.209 }, // Delhi
        "400001": { lat: 19.076, lng: 72.8777 }, // Mumbai
        "560001": { lat: 12.9716, lng: 77.5946 }, // Bangalore
        "600001": { lat: 13.0827, lng: 80.2707 }, // Chennai
        "700001": { lat: 22.5726, lng: 88.3639 }, // Kolkata
    };
    // Try to find coordinates by pincode first
    if (mockCoordinates[address.pincode]) {
        return mockCoordinates[address.pincode];
    }
    // Fallback: try to find by city name
    const cityLower = address.city.toLowerCase();
    if (cityLower.includes("hyderabad")) {
        return { lat: 17.385, lng: 78.4867 };
    }
    else if (cityLower.includes("mancherial")) {
        return { lat: 18.87, lng: 79.45 };
    }
    else if (cityLower.includes("delhi")) {
        return { lat: 28.6139, lng: 77.209 };
    }
    else if (cityLower.includes("mumbai")) {
        return { lat: 19.076, lng: 72.8777 };
    }
    else if (cityLower.includes("bangalore")) {
        return { lat: 12.9716, lng: 77.5946 };
    }
    else if (cityLower.includes("chennai")) {
        return { lat: 13.0827, lng: 80.2707 };
    }
    else if (cityLower.includes("kolkata")) {
        return { lat: 22.5726, lng: 88.3639 };
    }
    // Default fallback to Hyderabad
    console.warn(`Could not geocode address: ${address.city}, ${address.pincode}. Using default location.`);
    return { lat: 17.385, lng: 78.4867 };
}
/**
 * Calculate delivery fee based on distance
 */
function calculateDeliveryFee(distance) {
    // Check if delivery is possible
    if (distance > MAX_DELIVERY_DISTANCE) {
        return {
            distance,
            baseFee: 0,
            distanceFee: 0,
            totalFee: 0,
            isDeliverable: false,
            estimatedTime: "Not available",
        };
    }
    // Find the appropriate tier
    const tier = DELIVERY_TIERS.find((t) => distance <= t.maxDistance) ||
        DELIVERY_TIERS[DELIVERY_TIERS.length - 1];
    // Calculate fees
    const baseFee = tier.baseFee;
    const distanceFee = Math.max(0, distance - 2) * tier.perKmFee; // First 2km included in base fee
    const totalFee = baseFee + distanceFee;
    return {
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
        baseFee,
        distanceFee: Math.round(distanceFee),
        totalFee: Math.round(totalFee),
        isDeliverable: true,
        estimatedTime: tier.estimatedTime,
    };
}
/**
 * Main function to calculate delivery fee for an address
 */
async function getDeliveryFeeForAddress(address) {
    try {
        // Geocode the address to get coordinates
        const customerCoords = await geocodeAddress(address);
        // Calculate distance from store
        const distance = calculateDistance(STORE_LOCATION, customerCoords);
        // Calculate delivery fee
        const deliveryFee = calculateDeliveryFee(distance);
        console.log("Delivery fee calculation:", {
            address: `${address.city}, ${address.pincode}`,
            customerCoords,
            storeCoords: STORE_LOCATION,
            distance: `${distance.toFixed(2)} km`,
            deliveryFee,
        });
        return deliveryFee;
    }
    catch (error) {
        console.error("Error calculating delivery fee:", error);
        // Return a default fee if calculation fails
        return {
            distance: 0,
            baseFee: 50,
            distanceFee: 0,
            totalFee: 50,
            isDeliverable: true,
            estimatedTime: "30-45 mins",
        };
    }
}
/**
 * Get delivery fee tiers for display
 */
function getDeliveryFeeTiers() {
    return DELIVERY_TIERS.map((tier) => ({
        ...tier,
        maxDistance: tier.maxDistance === Infinity ? "Unlimited" : `${tier.maxDistance} km`,
    }));
}
