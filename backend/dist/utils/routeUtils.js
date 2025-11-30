"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoutePolyline = getRoutePolyline;
exports.isLocationNearRoute = isLocationNearRoute;
exports.calculateHaversineDistance = calculateHaversineDistance;
exports.decodePolyline = decodePolyline;
exports.encodePolyline = encodePolyline;
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const polyline_1 = __importDefault(require("@mapbox/polyline"));
const googleMapsClient = new google_maps_services_js_1.Client({});
/**
 * Get route polyline and details from Google Directions API
 * @param origin Starting coordinates
 * @param destination Ending coordinates
 * @returns Route information including encoded polyline
 */
async function getRoutePolyline(origin, destination) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.warn("Google Maps API key not configured, using fallback");
            return createFallbackRoute(origin, destination);
        }
        const response = await googleMapsClient.directions({
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`,
                key: apiKey,
                mode: "driving",
                alternatives: false,
            },
        });
        if (response.data.status === "OK" &&
            response.data.routes &&
            response.data.routes.length > 0) {
            const route = response.data.routes[0];
            const leg = route.legs[0];
            const encodedPolyline = route.overview_polyline.points;
            // Decode polyline to get path coordinates
            const decodedPath = polyline_1.default.decode(encodedPolyline).map(([lat, lng]) => ({
                lat,
                lng,
            }));
            return {
                polyline: encodedPolyline,
                distance: leg.distance.value / 1000, // Convert meters to km
                duration: leg.duration.value, // in seconds
                decodedPath,
            };
        }
        console.warn("No routes found from Google Directions API");
        return createFallbackRoute(origin, destination);
    }
    catch (error) {
        console.error("Error fetching route polyline:", error);
        return createFallbackRoute(origin, destination);
    }
}
/**
 * Create a fallback straight-line route when API fails
 */
function createFallbackRoute(origin, destination) {
    const distance = calculateHaversineDistance(origin, destination);
    const estimatedDuration = (distance / 40) * 3600; // Assume 40 km/h average speed
    // Create simple straight line path
    const decodedPath = [origin, destination];
    // Encode as simple polyline
    const encodedPolyline = polyline_1.default.encode(decodedPath.map((p) => [p.lat, p.lng]));
    return {
        polyline: encodedPolyline,
        distance,
        duration: estimatedDuration,
        decodedPath,
    };
}
/**
 * Check if a location is near a route (within threshold distance)
 * @param location Location to check
 * @param routePolyline Encoded polyline string
 * @param thresholdKm Distance threshold in kilometers (default 2km)
 * @returns true if location is within threshold of the route
 */
function isLocationNearRoute(location, routePolyline, thresholdKm = 2) {
    try {
        // Decode the polyline
        const decodedPath = polyline_1.default.decode(routePolyline).map(([lat, lng]) => ({
            lat,
            lng,
        }));
        // Check distance to each segment of the route
        for (let i = 0; i < decodedPath.length - 1; i++) {
            const segmentStart = decodedPath[i];
            const segmentEnd = decodedPath[i + 1];
            const distanceToSegment = pointToSegmentDistance(location, segmentStart, segmentEnd);
            if (distanceToSegment <= thresholdKm) {
                return true;
            }
        }
        return false;
    }
    catch (error) {
        console.error("Error checking location near route:", error);
        return false;
    }
}
/**
 * Calculate perpendicular distance from a point to a line segment
 */
function pointToSegmentDistance(point, segmentStart, segmentEnd) {
    // Calculate distance from point to line segment using Haversine
    const distToStart = calculateHaversineDistance(point, segmentStart);
    const distToEnd = calculateHaversineDistance(point, segmentEnd);
    const segmentLength = calculateHaversineDistance(segmentStart, segmentEnd);
    // If segment is very short, return distance to start
    if (segmentLength < 0.001) {
        return distToStart;
    }
    // Use dot product to find projection point
    const t = Math.max(0, Math.min(1, ((point.lat - segmentStart.lat) * (segmentEnd.lat - segmentStart.lat) +
        (point.lng - segmentStart.lng) * (segmentEnd.lng - segmentStart.lng)) /
        (segmentLength * segmentLength)));
    const projectionLat = segmentStart.lat + t * (segmentEnd.lat - segmentStart.lat);
    const projectionLng = segmentStart.lng + t * (segmentEnd.lng - segmentStart.lng);
    return calculateHaversineDistance(point, {
        lat: projectionLat,
        lng: projectionLng,
    });
}
/**
 * Calculate Haversine distance between two coordinates
 */
function calculateHaversineDistance(coord1, coord2) {
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
 * Decode a polyline string to array of coordinates
 */
function decodePolyline(encodedPolyline) {
    try {
        return polyline_1.default.decode(encodedPolyline).map(([lat, lng]) => ({
            lat,
            lng,
        }));
    }
    catch (error) {
        console.error("Error decoding polyline:", error);
        return [];
    }
}
/**
 * Encode array of coordinates to polyline string
 */
function encodePolyline(path) {
    try {
        return polyline_1.default.encode(path.map((p) => [p.lat, p.lng]));
    }
    catch (error) {
        console.error("Error encoding polyline:", error);
        return "";
    }
}
