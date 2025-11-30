"use strict";
/**
 * Location Smoothing Utilities
 * Provides smooth marker movement for real-time delivery tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveLocationStore = exports.LocationThrottler = exports.LocationSmoother = void 0;
exports.smoothMarkerMovement = smoothMarkerMovement;
exports.calculateSpeed = calculateSpeed;
exports.calculateHeading = calculateHeading;
/**
 * Interpolate between two locations for smooth animation
 * @param oldPosition Previous location
 * @param newPosition New location
 * @param steps Number of interpolation steps (default 10)
 * @returns Array of interpolated positions
 */
function smoothMarkerMovement(oldPosition, newPosition, steps = 10) {
    const interpolated = [];
    for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        interpolated.push({
            lat: oldPosition.lat + (newPosition.lat - oldPosition.lat) * ratio,
            lng: oldPosition.lng + (newPosition.lng - oldPosition.lng) * ratio,
            timestamp: Date.now() + (i * 100), // 100ms between steps
        });
    }
    return interpolated;
}
/**
 * Calculate speed between two locations
 * @param oldPosition Previous location with timestamp
 * @param newPosition New location with timestamp
 * @returns Speed in km/h
 */
function calculateSpeed(oldPosition, newPosition) {
    if (!oldPosition.timestamp || !newPosition.timestamp) {
        return 0;
    }
    const distance = calculateDistance(oldPosition, newPosition);
    const timeDiff = (newPosition.timestamp - oldPosition.timestamp) / 1000 / 3600; // hours
    if (timeDiff === 0)
        return 0;
    return distance / timeDiff; // km/h
}
/**
 * Calculate heading/bearing between two locations
 * @param oldPosition Previous location
 * @param newPosition New location
 * @returns Heading in degrees (0-360)
 */
function calculateHeading(oldPosition, newPosition) {
    const lat1 = toRadians(oldPosition.lat);
    const lat2 = toRadians(newPosition.lat);
    const dLng = toRadians(newPosition.lng - oldPosition.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const heading = Math.atan2(y, x);
    return (toDegrees(heading) + 360) % 360;
}
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
function toDegrees(radians) {
    return radians * (180 / Math.PI);
}
/**
 * Apply Kalman filter for location smoothing (simplified version)
 * Reduces GPS jitter and provides more stable location updates
 */
class LocationSmoother {
    constructor() {
        this.lastPosition = null;
        this.lastVelocity = { lat: 0, lng: 0 };
        this.processNoise = 0.001; // Q
        this.measurementNoise = 0.01; // R
        this.estimateError = 1; // P
    }
    /**
     * Process a new location update and return smoothed location
     */
    smooth(newLocation) {
        if (!this.lastPosition) {
            this.lastPosition = newLocation;
            return {
                ...newLocation,
                speed: 0,
                heading: 0,
            };
        }
        // Predict next position based on velocity
        const predicted = {
            lat: this.lastPosition.lat + this.lastVelocity.lat,
            lng: this.lastPosition.lng + this.lastVelocity.lng,
        };
        // Update estimate error
        this.estimateError += this.processNoise;
        // Calculate Kalman gain
        const kalmanGain = this.estimateError / (this.estimateError + this.measurementNoise);
        // Update position estimate
        const smoothedLat = predicted.lat + kalmanGain * (newLocation.lat - predicted.lat);
        const smoothedLng = predicted.lng + kalmanGain * (newLocation.lng - predicted.lng);
        // Update velocity
        this.lastVelocity = {
            lat: smoothedLat - this.lastPosition.lat,
            lng: smoothedLng - this.lastPosition.lng,
        };
        // Update estimate error
        this.estimateError *= 1 - kalmanGain;
        // Calculate speed and heading
        const speed = calculateSpeed({ ...this.lastPosition, timestamp: Date.now() - 5000 }, { lat: smoothedLat, lng: smoothedLng, timestamp: Date.now() });
        const heading = calculateHeading(this.lastPosition, {
            lat: smoothedLat,
            lng: smoothedLng,
        });
        const smoothedLocation = {
            lat: smoothedLat,
            lng: smoothedLng,
            timestamp: newLocation.timestamp || Date.now(),
            speed: Math.max(0, Math.min(speed, 120)), // Cap speed between 0-120 km/h
            heading,
        };
        this.lastPosition = smoothedLocation;
        return smoothedLocation;
    }
    /**
     * Reset the smoother state
     */
    reset() {
        this.lastPosition = null;
        this.lastVelocity = { lat: 0, lng: 0 };
        this.estimateError = 1;
    }
}
exports.LocationSmoother = LocationSmoother;
/**
 * Throttle location updates to prevent excessive broadcasts
 * @param minInterval Minimum interval between updates in milliseconds
 */
class LocationThrottler {
    constructor(minIntervalMs = 3000) {
        this.lastBroadcast = 0;
        // Default 3 seconds
        this.minInterval = minIntervalMs;
    }
    /**
     * Check if enough time has passed to broadcast a new location
     */
    shouldBroadcast() {
        const now = Date.now();
        if (now - this.lastBroadcast >= this.minInterval) {
            this.lastBroadcast = now;
            return true;
        }
        return false;
    }
    /**
     * Force next broadcast (useful for important updates)
     */
    forceNext() {
        this.lastBroadcast = 0;
    }
    /**
     * Update minimum interval
     */
    setInterval(intervalMs) {
        this.minInterval = intervalMs;
    }
}
exports.LocationThrottler = LocationThrottler;
/**
 * In-memory store for live delivery boy locations
 * Prevents excessive database writes
 */
class LiveLocationStore {
    constructor() {
        this.locations = new Map();
    }
    /**
     * Update location for a delivery boy
     */
    updateLocation(deliveryBoyId, newLocation) {
        let entry = this.locations.get(deliveryBoyId);
        if (!entry) {
            entry = {
                location: { ...newLocation, speed: 0, heading: 0 },
                smoother: new LocationSmoother(),
                throttler: new LocationThrottler(3000), // 3 second throttle
            };
            this.locations.set(deliveryBoyId, entry);
        }
        // Apply smoothing
        const smoothedLocation = entry.smoother.smooth(newLocation);
        entry.location = smoothedLocation;
        // Check if should broadcast
        if (entry.throttler.shouldBroadcast()) {
            return smoothedLocation;
        }
        return null; // Don't broadcast yet
    }
    /**
     * Get current location for a delivery boy
     */
    getLocation(deliveryBoyId) {
        return this.locations.get(deliveryBoyId)?.location || null;
    }
    /**
     * Remove delivery boy from store (when offline)
     */
    removeLocation(deliveryBoyId) {
        this.locations.delete(deliveryBoyId);
    }
    /**
     * Force broadcast for a delivery boy
     */
    forceBroadcast(deliveryBoyId) {
        this.locations.get(deliveryBoyId)?.throttler.forceNext();
    }
    /**
     * Get all active delivery boy IDs
     */
    getActiveDeliveryBoys() {
        return Array.from(this.locations.keys());
    }
}
exports.LiveLocationStore = LiveLocationStore;
