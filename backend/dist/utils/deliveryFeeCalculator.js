"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoadDistance = getRoadDistance;
exports.calculateHaversineDistance = calculateHaversineDistance;
exports.calculateDeliveryFee = calculateDeliveryFee;
exports.getAdminAddress = getAdminAddress;
exports.isDeliveryAvailable = isDeliveryAvailable;
exports.getDeliveryFeeBreakdown = getDeliveryFeeBreakdown;
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const ADMIN_ADDRESS = {
    _id: "admin-address",
    label: "Admin Office",
    pincode: "521235",
    city: "Tiruvuru",
    state: "Andhra Pradesh",
    addressLine: "Admin Office, Tiruvuru",
    lat: 16.5,
    lng: 80.5,
    isDefault: true,
};
const googleMapsClient = new google_maps_services_js_1.Client({});
const DELIVERY_CONFIG = {
    FREE_DELIVERY_THRESHOLD: 2000,
    DISTANCE_0_50_KM: 100,
    DISTANCE_51_100_KM: 150,
    BASE_CHARGE_100KM: 150,
    EXTRA_10KM_RATE: 10,
};
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
            const distance = response.data.rows[0].elements[0].distance.value / 1000;
            return Math.round(distance * 100) / 100;
        }
        else {
            return calculateHaversineDistance(ADMIN_ADDRESS.lat, ADMIN_ADDRESS.lng, userAddress.lat, userAddress.lng);
        }
    }
    catch (error) {
        console.error("Google Distance Matrix API error:", error);
        return calculateHaversineDistance(ADMIN_ADDRESS.lat, ADMIN_ADDRESS.lng, userAddress.lat, userAddress.lng);
    }
}
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 100) / 100;
}
async function calculateDeliveryFee(userAddress, orderAmount) {
    const distance = await getRoadDistance(userAddress);
    const isFreeDelivery = orderAmount >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;
    if (isFreeDelivery) {
        return {
            distance: distance,
            baseFee: 0,
            distanceFee: 0,
            totalFee: 0,
            isFreeDelivery: true,
            finalFee: 0,
            distanceFrom: `${distance} km from Tiruvuru`,
        };
    }
    let deliveryFee;
    if (distance <= 50) {
        deliveryFee = DELIVERY_CONFIG.DISTANCE_0_50_KM;
    }
    else if (distance <= 100) {
        deliveryFee = DELIVERY_CONFIG.DISTANCE_51_100_KM;
    }
    else {
        const extraDistance = distance - 100;
        const extraCharges = Math.ceil(extraDistance / 10) * DELIVERY_CONFIG.EXTRA_10KM_RATE;
        deliveryFee = DELIVERY_CONFIG.BASE_CHARGE_100KM + extraCharges;
    }
    if (orderAmount < DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD) {
        deliveryFee = Math.max(deliveryFee, 100);
    }
    return {
        distance: distance,
        baseFee: deliveryFee,
        distanceFee: 0,
        totalFee: deliveryFee,
        isFreeDelivery: false,
        finalFee: deliveryFee,
        distanceFrom: `${distance} km from Tiruvuru`,
    };
}
function getAdminAddress() {
    return ADMIN_ADDRESS;
}
function isDeliveryAvailable(pincode) {
    return true;
}
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
//# sourceMappingURL=deliveryFeeCalculator.js.map