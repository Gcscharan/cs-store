"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentLocationController = exports.reverseGeocodeController = void 0;
const reverseGeocodeController = async (req, res) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            res.status(400).json({
                success: false,
                message: "Latitude and longitude are required",
            });
            return;
        }
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        if (isNaN(latitude) || isNaN(longitude)) {
            res.status(400).json({
                success: false,
                message: "Invalid latitude or longitude values",
            });
            return;
        }
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`);
        if (!response.ok) {
            throw new Error("Failed to fetch location data from geocoding service");
        }
        const data = (await response.json());
        if (!data || !data.address) {
            res.status(404).json({
                success: false,
                message: "No address data found for the provided coordinates",
            });
            return;
        }
        const address = data.address;
        const pincode = address.postcode || "";
        const city = address.city ||
            address.town ||
            address.village ||
            address.county ||
            address.state_district ||
            "Unknown City";
        const state = address.state || "Unknown State";
        const formattedAddress = [
            address.house_number,
            address.road,
            address.suburb,
            address.city || address.town,
            address.state,
            address.postcode,
        ]
            .filter(Boolean)
            .join(", ");
        const locationData = {
            pincode,
            city,
            state,
            address: formattedAddress,
            lat: latitude,
            lng: longitude,
        };
        res.status(200).json({
            success: true,
            data: locationData,
        });
    }
    catch (error) {
        console.error("Reverse geocoding error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reverse geocode coordinates",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.reverseGeocodeController = reverseGeocodeController;
const getCurrentLocationController = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: "Use the reverse-geocode endpoint with lat and lng parameters",
            example: "/api/location/reverse-geocode?lat=17.3850&lng=78.4867",
        });
    }
    catch (error) {
        console.error("Location controller error:", error);
        res.status(500).json({
            success: false,
            message: "Location service error",
        });
    }
};
exports.getCurrentLocationController = getCurrentLocationController;
//# sourceMappingURL=locationController.js.map