"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoadDistance = getRoadDistance;
exports.calculateHaversineDistance = calculateHaversineDistance;
exports.resolveCoordinates = resolveCoordinates;
exports.calculateDeliveryFee = calculateDeliveryFee;
exports.getAdminAddress = getAdminAddress;
exports.isDeliveryAvailable = isDeliveryAvailable;
exports.getDeliveryFeeBreakdown = getDeliveryFeeBreakdown;
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const geocoding_1 = require("./geocoding");
// Admin's warehouse address (Boya Bazar, Tiruvuru, Krishna District)
// Pincode: 521235
// Accurate GPS coordinates for Boya Bazar, Tiruvuru
const ADMIN_ADDRESS = {
    _id: "admin-address",
    name: "Admin Warehouse",
    phone: "",
    label: "Boya Bazar, Tiruvuru",
    pincode: "521235",
    city: "Tiruvuru",
    state: "Andhra Pradesh",
    addressLine: "Boya Bazar, Tiruvuru, Krishna District, Andhra Pradesh - 521235",
    lat: 17.0956, // Accurate GPS for Boya Bazar, Tiruvuru
    lng: 80.6089,
    isDefault: true,
};
// Google Maps client
const googleMapsClient = new google_maps_services_js_1.Client({});
// Delivery fee configuration - Swiggy/Zomato style pricing
const DELIVERY_CONFIG = {
    FREE_DELIVERY_THRESHOLD: 2000, // Free delivery for orders ≥ ₹2000
    // New distance-based pricing tiers
    BASE_FEE_0_2_KM: 25, // ₹25 for up to 2 km
    BASE_FEE_2_6_KM_MIN: 35, // ₹35 minimum for 2-6 km range
    BASE_FEE_2_6_KM_MAX: 60, // ₹60 maximum for 2-6 km range
    BASE_FEE_BEYOND_6_KM: 60, // ₹60 base for beyond 6 km
    EXTRA_KM_RATE: 8, // ₹8 per extra km beyond 6 km
};
/**
 * Get actual road distance using Google Distance Matrix API
 * @param userAddress User's delivery address
 * @returns Distance in kilometers
 */
async function getRoadDistance(userAddress) {
    try {
        const response = await googleMapsClient.distancematrix({
            params: {
                origins: [`${ADMIN_ADDRESS.lat},${ADMIN_ADDRESS.lng}`],
                destinations: [`${userAddress.lat},${userAddress.lng}`],
                key: process.env.GOOGLE_MAPS_API_KEY || "",
                units: "metric",
            },
        });
        if (response.data.rows[0]?.elements[0]?.status === "OK") {
            const distance = response.data.rows[0].elements[0].distance.value / 1000; // Convert meters to kilometers
            return Math.round(distance * 100) / 100; // Round to 2 decimal places
        }
        else {
            // Fallback to Haversine formula if API fails
            return calculateHaversineDistance(ADMIN_ADDRESS.lat, ADMIN_ADDRESS.lng, userAddress.lat, userAddress.lng);
        }
    }
    catch (error) {
        console.error("Google Distance Matrix API error:", error);
        // Fallback to Haversine formula if API fails
        return calculateHaversineDistance(ADMIN_ADDRESS.lat, ADMIN_ADDRESS.lng, userAddress.lat, userAddress.lng);
    }
}
/**
 * Calculate the distance between two coordinates using Haversine formula (fallback)
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}
/**
 * Resolve coordinates for an address with fallback chain
 * Priority: 1) Saved coords → 2) Full geocoding → 3) Pincode centroid
 * @param address Address to resolve coordinates for
 * @returns Resolved coordinates with source information
 */
async function resolveCoordinates(address) {
    console.log(`\n🔍 [resolveCoordinates] Resolving coordinates for address: ${address.addressLine}, ${address.city}`);
    // Step 1: Check if address has valid saved coordinates
    if (address.lat && address.lng &&
        address.lat !== 0 && address.lng !== 0 &&
        !isNaN(address.lat) && !isNaN(address.lng)) {
        // Validate coordinates are within India bounds
        const isInIndia = address.lat >= 6 && address.lat <= 37 &&
            address.lng >= 68 && address.lng <= 98;
        if (isInIndia) {
            console.log(`✅ [resolveCoordinates] Using saved coordinates: lat=${address.lat}, lng=${address.lng}`);
            return {
                lat: address.lat,
                lng: address.lng,
                coordsSource: 'saved'
            };
        }
        else {
            console.warn(`⚠️ [resolveCoordinates] Saved coordinates outside India bounds, will re-geocode`);
        }
    }
    else {
        console.warn(`⚠️ [resolveCoordinates] Missing or invalid saved coordinates (lat=${address.lat}, lng=${address.lng})`);
    }
    // Step 2: Attempt full address geocoding
    console.log(`🌍 [resolveCoordinates] Attempting full address geocoding...`);
    const geocodeResult = await (0, geocoding_1.smartGeocode)(address.addressLine, address.city, address.state, address.pincode);
    if (geocodeResult) {
        console.log(`✅ [resolveCoordinates] Full geocoding successful: lat=${geocodeResult.lat}, lng=${geocodeResult.lng}`);
        return {
            lat: geocodeResult.lat,
            lng: geocodeResult.lng,
            coordsSource: 'geocoded'
        };
    }
    console.warn(`⚠️ [resolveCoordinates] Full geocoding failed, trying pincode fallback...`);
    // Step 3: Fallback to pincode centroid
    const pincodeResult = await (0, geocoding_1.geocodeByPincode)(address.pincode);
    if (pincodeResult) {
        console.log(`✅ [resolveCoordinates] Pincode geocoding successful: lat=${pincodeResult.lat}, lng=${pincodeResult.lng}`);
        console.warn(`⚠️ Using PINCODE CENTROID - delivery fee will be ESTIMATED. User should update address for exact fee.`);
        return {
            lat: pincodeResult.lat,
            lng: pincodeResult.lng,
            coordsSource: 'pincode'
        };
    }
    // Step 4: All resolution attempts failed
    console.error(`❌ [resolveCoordinates] All coordinate resolution attempts failed for: ${address.addressLine}, ${address.city}, ${address.pincode}`);
    return {
        lat: 0,
        lng: 0,
        coordsSource: 'unresolved',
        error: 'ADDRESS_COORDINATES_UNRESOLVED'
    };
}
/**
 * Calculate delivery fee based on distance and order amount
 * @param userAddress User's delivery address
 * @param orderAmount Total order amount
 * @returns Delivery fee details
 */
async function calculateDeliveryFee(userAddress, orderAmount) {
    // STEP 1: Resolve coordinates with fallback chain
    const coordsResult = await resolveCoordinates(userAddress);
    // Check if coordinate resolution failed completely
    if (coordsResult.coordsSource === 'unresolved') {
        console.error('❌ [Backend] Coordinate resolution failed - cannot calculate delivery fee');
        return {
            distance: 0,
            baseFee: 0,
            distanceFee: 0,
            totalFee: 0,
            isFreeDelivery: false,
            finalFee: 0,
            distanceFrom: 'Unknown location',
            coordsSource: 'unresolved',
            error: 'ADDRESS_COORDINATES_UNRESOLVED'
        };
    }
    // Create resolved address for distance calculation
    const resolvedAddress = {
        ...userAddress,
        lat: coordsResult.lat,
        lng: coordsResult.lng
    };
    // STEP 2: Calculate distance using resolved coordinates
    const distance = await getRoadDistance(resolvedAddress);
    // Debug logs for verification
    console.log('🚚 [Backend] Delivery Fee Calculation:', {
        warehouseCoords: { lat: ADMIN_ADDRESS.lat, lng: ADMIN_ADDRESS.lng, location: ADMIN_ADDRESS.addressLine },
        userCoords: { lat: coordsResult.lat, lng: coordsResult.lng, location: `${userAddress.city}, ${userAddress.state}` },
        coordsSource: coordsResult.coordsSource,
        calculatedDistance: `${distance.toFixed(2)} km`,
        orderAmount: `₹${orderAmount}`,
    });
    // STEP 3: Validate distance
    if (isNaN(distance) || distance < 0) {
        console.error('❌ [Backend] CRITICAL: Invalid distance after coordinate resolution!');
        return {
            distance: 0,
            baseFee: 0,
            distanceFee: 0,
            totalFee: 0,
            isFreeDelivery: false,
            finalFee: 0,
            distanceFrom: 'Invalid distance calculation',
            coordsSource: coordsResult.coordsSource,
            error: 'INVALID_DISTANCE_CALCULATION'
        };
    }
    // Check if order qualifies for free delivery
    const isFreeDelivery = orderAmount >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;
    if (isFreeDelivery) {
        console.log('✅ [Backend] Free Delivery Applied! (Order ≥ ₹2000)');
        return {
            distance: distance,
            baseFee: 0,
            distanceFee: 0,
            totalFee: 0,
            isFreeDelivery: true,
            finalFee: 0,
            distanceFrom: `${distance} km from Tiruvuru`,
            coordsSource: coordsResult.coordsSource,
        };
    }
    // Calculate delivery fee based on distance - Swiggy/Zomato style
    let deliveryFee;
    if (distance <= 2) {
        // Up to 2 km: ₹25
        deliveryFee = DELIVERY_CONFIG.BASE_FEE_0_2_KM;
        console.log(`📍 [Backend] Distance: ${distance.toFixed(2)} km (≤2 km) → Base Fee: ₹${deliveryFee}`);
    }
    else if (distance <= 6) {
        // 2 to 6 km: ₹35 to ₹60 (progressive increase)
        // Linear interpolation: ₹35 at 2km → ₹60 at 6km
        const progressInRange = (distance - 2) / 4; // 0 to 1
        deliveryFee = DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN +
            (progressInRange * (DELIVERY_CONFIG.BASE_FEE_2_6_KM_MAX - DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN));
        deliveryFee = Math.round(deliveryFee); // Round to nearest rupee
        console.log(`📍 [Backend] Distance: ${distance.toFixed(2)} km (2-6 km) → Progressive Fee: ₹${deliveryFee}`);
    }
    else {
        // Beyond 6 km: ₹60 + ₹8 per extra km
        const extraDistance = distance - 6;
        deliveryFee = DELIVERY_CONFIG.BASE_FEE_BEYOND_6_KM + (extraDistance * DELIVERY_CONFIG.EXTRA_KM_RATE);
        deliveryFee = Math.round(deliveryFee); // Round to nearest rupee
        console.log(`📍 [Backend] Distance: ${distance.toFixed(2)} km (>6 km) → ₹60 + (${extraDistance.toFixed(2)} km × ₹8) = ₹${deliveryFee}`);
    }
    console.log(`💰 [Backend] Final Delivery Fee: ₹${deliveryFee}`);
    return {
        distance: distance,
        baseFee: deliveryFee,
        distanceFee: 0, // No separate distance fee calculation
        totalFee: deliveryFee,
        isFreeDelivery: false,
        finalFee: deliveryFee,
        distanceFrom: `${distance} km from Tiruvuru`,
        coordsSource: coordsResult.coordsSource,
    };
}
/**
 * Get admin's default address
 * @returns Admin's address
 */
function getAdminAddress() {
    return ADMIN_ADDRESS;
}
/**
 * Check if delivery is available to a specific pincode
 * @param pincode Target pincode
 * @returns Whether delivery is available
 */
function isDeliveryAvailable(pincode) {
    // For now, we'll allow delivery to all pincodes
    // You can add specific pincode restrictions here
    return true;
}
/**
 * Get delivery fee breakdown for display
 * @param userAddress User's delivery address
 * @param orderAmount Total order amount
 * @returns Formatted delivery fee information
 */
async function getDeliveryFeeBreakdown(userAddress, orderAmount) {
    const feeDetails = await calculateDeliveryFee(userAddress, orderAmount);
    return {
        distance: `${feeDetails.distance} km`,
        baseFee: `₹${feeDetails.baseFee}`,
        distanceFee: `₹${feeDetails.distanceFee}`,
        totalFee: `₹${feeDetails.totalFee}`,
        isFreeDelivery: feeDetails.isFreeDelivery,
        finalFee: `₹${feeDetails.finalFee}`,
        message: feeDetails.isFreeDelivery
            ? "Free delivery on orders above ₹2000"
            : `Distance: ${feeDetails.distanceFrom} — Delivery charge: ₹${feeDetails.finalFee}`,
        distanceFrom: feeDetails.distanceFrom,
    };
}
