"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeAddress = geocodeAddress;
exports.geocodeByPincode = geocodeByPincode;
exports.smartGeocode = smartGeocode;
exports.reverseGeocode = reverseGeocode;
const logger_1 = require("./logger");
const axios_1 = __importDefault(require("axios"));
const redis_1 = __importDefault(require("../config/redis"));
const CACHE_PREFIX = "geocode:";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
/**
 * Geocode address using Google Maps API (primary) or Nominatim (fallback)
 */
async function geocodeAddress(addressLine, city, state, pincode) {
    // Build search query
    const searchQuery = `${addressLine}, ${city}, ${state}, ${pincode}, India`;
    // Check cache first
    const cacheKey = `${CACHE_PREFIX}${hashString(searchQuery)}`;
    const cached = await getCachedGeocode(cacheKey);
    if (cached) {
        return cached;
    }
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Try Google Geocoding API first
    if (apiKey) {
        const googleResult = await geocodeWithGoogle(searchQuery, apiKey);
        if (googleResult) {
            await cacheGeocode(cacheKey, googleResult);
            return googleResult;
        }
    }
    // Fallback to Nominatim
    const nominatimResult = await geocodeWithNominatim(addressLine, city, state, pincode);
    if (nominatimResult) {
        await cacheGeocode(cacheKey, nominatimResult);
        return nominatimResult;
    }
    // Final fallback: pincode-only geocoding
    const pincodeResult = await geocodeByPincode(pincode);
    if (pincodeResult) {
        await cacheGeocode(cacheKey, pincodeResult);
        return pincodeResult;
    }
    return null;
}
/**
 * Geocode using Google Maps Geocoding API
 */
async function geocodeWithGoogle(address, apiKey) {
    try {
        logger_1.logger.info(`🌍 [Google] Geocoding: "${address}"`);
        const response = await axios_1.default.get("https://maps.googleapis.com/maps/api/geocode/json", {
            params: {
                address,
                region: "in",
                key: apiKey,
            },
            timeout: 5000,
        });
        if (response.data.status !== "OK" || !response.data.results?.length) {
            logger_1.logger.warn(`⚠️ [Google] Geocoding failed: ${response.data.status}`);
            return null;
        }
        const result = response.data.results[0];
        const location = result.geometry.location;
        const lat = location.lat;
        const lng = location.lng;
        // Validate coordinates are within India
        if (lat < 6 || lat > 37 || lng < 68 || lng > 98) {
            logger_1.logger.warn(`⚠️ [Google] Coordinates outside India: lat=${lat}, lng=${lng}`);
            return null;
        }
        // Extract address components
        const components = parseGoogleAddressComponents(result.address_components);
        logger_1.logger.info(`✅ [Google] Geocoding successful: lat=${lat}, lng=${lng}`);
        return {
            lat,
            lng,
            formattedAddress: result.formatted_address,
            postalCode: components.postalCode,
            locality: components.locality,
            city: components.city || components.locality,
            state: components.state,
            stateCode: components.stateCode,
            country: components.country,
            coordsSource: "google",
        };
    }
    catch (error) {
        logger_1.logger.error(`❌ [Google] Geocoding error: ${error.message}`);
        return null;
    }
}
/**
 * Parse Google Maps address components
 */
function parseGoogleAddressComponents(components) {
    const result = {};
    for (const comp of components || []) {
        const types = comp.types || [];
        if (types.includes("postal_code")) {
            result.postalCode = comp.long_name;
        }
        if (types.includes("locality")) {
            result.locality = comp.long_name;
        }
        if (types.includes("administrative_area_level_3")) {
            result.city = comp.long_name;
        }
        if (types.includes("administrative_area_level_1")) {
            result.state = comp.long_name;
            result.stateCode = comp.short_name;
        }
        if (types.includes("country")) {
            result.country = comp.long_name;
        }
        if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
            result.subLocality = comp.long_name;
        }
    }
    return result;
}
/**
 * Geocode using OpenStreetMap Nominatim API (fallback)
 */
async function geocodeWithNominatim(addressLine, city, state, pincode) {
    try {
        const searchQuery = `${addressLine}, ${city}, ${state}, ${pincode}, India`;
        logger_1.logger.info(`🌍 [Nominatim] Geocoding: "${searchQuery}"`);
        const response = await axios_1.default.get("https://nominatim.openstreetmap.org/search", {
            params: {
                q: searchQuery,
                format: "json",
                limit: 1,
                countrycodes: "in",
                addressdetails: 1,
            },
            headers: {
                "User-Agent": "CSStore-ECommerce/1.0",
            },
            timeout: 5000,
        });
        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) {
                logger_1.logger.info(`✅ [Nominatim] Geocoding successful: lat=${lat}, lng=${lng}`);
                const address = result.address || {};
                return {
                    lat,
                    lng,
                    formattedAddress: result.display_name,
                    postalCode: address.postcode || pincode,
                    locality: address.city || address.town || address.village,
                    city: address.city || address.town || address.village,
                    state: address.state,
                    country: address.country,
                    coordsSource: "nominatim",
                };
            }
        }
        logger_1.logger.warn(`⚠️ [Nominatim] No results found`);
        return null;
    }
    catch (error) {
        logger_1.logger.error(`❌ [Nominatim] Geocoding error: ${error.message}`);
        return null;
    }
}
/**
 * Geocode using pincode only (last resort)
 */
async function geocodeByPincode(pincode) {
    try {
        logger_1.logger.info(`🌍 [Pincode] Geocoding: "${pincode}"`);
        // Try Google first
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (apiKey) {
            const response = await axios_1.default.get("https://maps.googleapis.com/maps/api/geocode/json", {
                params: {
                    address: `${pincode}, India`,
                    region: "in",
                    key: apiKey,
                },
                timeout: 5000,
            });
            if (response.data.status === "OK" && response.data.results?.length) {
                const result = response.data.results[0];
                const location = result.geometry.location;
                if (location.lat >= 6 && location.lat <= 37 && location.lng >= 68 && location.lng <= 98) {
                    logger_1.logger.info(`✅ [Google Pincode] Geocoding successful`);
                    return {
                        lat: location.lat,
                        lng: location.lng,
                        postalCode: pincode,
                        coordsSource: "pincode",
                    };
                }
            }
        }
        // Fallback to Nominatim
        const response = await axios_1.default.get("https://nominatim.openstreetmap.org/search", {
            params: {
                postalcode: pincode,
                country: "India",
                format: "json",
                limit: 1,
            },
            headers: {
                "User-Agent": "CSStore-ECommerce/1.0",
            },
            timeout: 5000,
        });
        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) {
                logger_1.logger.info(`✅ [Nominatim Pincode] Geocoding successful`);
                return {
                    lat,
                    lng,
                    postalCode: pincode,
                    coordsSource: "pincode",
                };
            }
        }
        logger_1.logger.warn(`⚠️ [Pincode] Geocoding failed for: ${pincode}`);
        return null;
    }
    catch (error) {
        logger_1.logger.error(`❌ [Pincode] Geocoding error: ${error.message}`);
        return null;
    }
}
/**
 * Smart geocoding: Try full address first, fallback to pincode
 */
async function smartGeocode(addressLine, city, state, pincode) {
    // Try full address first
    let coords = await geocodeAddress(addressLine, city, state, pincode);
    if (coords) {
        return coords;
    }
    // Fallback to pincode-only geocoding
    logger_1.logger.info("⚠️ Full address geocoding failed, trying pincode-only...");
    coords = await geocodeByPincode(pincode);
    return coords;
}
/**
 * Reverse geocoding: Convert lat/lng to address
 */
async function reverseGeocode(lat, lng) {
    // Check cache
    const cacheKey = `${CACHE_PREFIX}rev:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const cached = await getCachedGeocode(cacheKey);
    if (cached) {
        return cached;
    }
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Try Google Reverse Geocoding API
    if (apiKey) {
        const googleResult = await reverseGeocodeWithGoogle(lat, lng, apiKey);
        if (googleResult) {
            await cacheGeocode(cacheKey, googleResult);
            return googleResult;
        }
    }
    // Fallback to Nominatim
    const nominatimResult = await reverseGeocodeWithNominatim(lat, lng);
    if (nominatimResult) {
        await cacheGeocode(cacheKey, nominatimResult);
        return nominatimResult;
    }
    return null;
}
/**
 * Reverse geocode using Google Maps API
 */
async function reverseGeocodeWithGoogle(lat, lng, apiKey) {
    try {
        logger_1.logger.info(`🌍 [Google] Reverse geocoding: ${lat}, ${lng}`);
        const response = await axios_1.default.get("https://maps.googleapis.com/maps/api/geocode/json", {
            params: {
                latlng: `${lat},${lng}`,
                key: apiKey,
            },
            timeout: 5000,
        });
        if (response.data.status !== "OK" || !response.data.results?.length) {
            logger_1.logger.warn(`⚠️ [Google] Reverse geocoding failed: ${response.data.status}`);
            return null;
        }
        const result = response.data.results[0];
        const components = parseGoogleAddressComponents(result.address_components);
        logger_1.logger.info(`✅ [Google] Reverse geocoding successful`);
        return {
            formattedAddress: result.formatted_address,
            addressLine: result.formatted_address.split(",")[0],
            city: components.city || components.locality,
            state: components.state,
            stateCode: components.stateCode,
            postalCode: components.postalCode,
            country: components.country,
            locality: components.locality,
            subLocality: components.subLocality,
            coordsSource: "google",
        };
    }
    catch (error) {
        logger_1.logger.error(`❌ [Google] Reverse geocoding error: ${error.message}`);
        return null;
    }
}
/**
 * Reverse geocode using Nominatim
 */
async function reverseGeocodeWithNominatim(lat, lng) {
    try {
        logger_1.logger.info(`🌍 [Nominatim] Reverse geocoding: ${lat}, ${lng}`);
        const response = await axios_1.default.get("https://nominatim.openstreetmap.org/reverse", {
            params: {
                lat,
                lon: lng,
                format: "json",
                addressdetails: 1,
            },
            headers: {
                "User-Agent": "CSStore-ECommerce/1.0",
            },
            timeout: 5000,
        });
        if (response.data && response.data.display_name) {
            const address = response.data.address || {};
            logger_1.logger.info(`✅ [Nominatim] Reverse geocoding successful`);
            return {
                formattedAddress: response.data.display_name,
                addressLine: response.data.display_name.split(",")[0],
                city: address.city || address.town || address.village,
                state: address.state,
                postalCode: address.postcode,
                country: address.country,
                locality: address.city || address.town || address.village,
                coordsSource: "nominatim",
            };
        }
        return null;
    }
    catch (error) {
        logger_1.logger.error(`❌ [Nominatim] Reverse geocoding error: ${error.message}`);
        return null;
    }
}
/**
 * Hash string for cache key
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}
/**
 * Cache geocode result
 */
async function cacheGeocode(key, result) {
    await redis_1.default.set(key, JSON.stringify(result), { EX: CACHE_TTL_SECONDS });
}
/**
 * Get cached geocode result
 */
async function getCachedGeocode(key) {
    const raw = await redis_1.default.get(key);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
exports.default = {
    geocodeAddress,
    geocodeByPincode,
    smartGeocode,
    reverseGeocode,
};
