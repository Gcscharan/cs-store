import axios from "axios";

/**
 * Geocode an address to latitude and longitude using OpenStreetMap Nominatim API (Free)
 * @param addressLine Full address line
 * @param city City name
 * @param state State name
 * @param pincode Postal code
 * @returns Promise with { lat, lng } or null if geocoding fails
 */
export async function geocodeAddress(
  addressLine: string,
  city: string,
  state: string,
  pincode: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    // Build search query - combine address components for better accuracy
    const searchQuery = `${addressLine}, ${city}, ${state}, ${pincode}, India`;
    
    console.log(`🌍 Geocoding address: "${searchQuery}"`);
    
    // Use OpenStreetMap Nominatim API (Free, no API key required)
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: searchQuery,
        format: "json",
        limit: 1,
        countrycodes: "in", // Restrict to India
        addressdetails: 1,
      },
      headers: {
        "User-Agent": "CSStore-ECommerce/1.0", // Required by Nominatim
      },
      timeout: 5000, // 5 second timeout
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      // Validate coordinates are reasonable for India
      if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98) {
        console.log(`✅ Geocoding successful: lat=${lat}, lng=${lng}`);
        return { lat, lng };
      } else {
        console.warn(`⚠️ Geocoding returned coordinates outside India: lat=${lat}, lng=${lng}`);
        return null;
      }
    }

    console.warn(`⚠️ Geocoding failed: No results found for "${searchQuery}"`);
    return null;
  } catch (error: any) {
    console.error(`❌ Geocoding error: ${error.message}`);
    return null;
  }
}

/**
 * Geocode using pincode only as fallback
 * @param pincode Postal code
 * @returns Promise with { lat, lng } or null if geocoding fails
 */
export async function geocodeByPincode(
  pincode: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log(`🌍 Geocoding by pincode: "${pincode}"`);
    
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
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
        console.log(`✅ Pincode geocoding successful: lat=${lat}, lng=${lng}`);
        return { lat, lng };
      }
    }

    console.warn(`⚠️ Pincode geocoding failed for: ${pincode}`);
    return null;
  } catch (error: any) {
    console.error(`❌ Pincode geocoding error: ${error.message}`);
    return null;
  }
}

/**
 * Smart geocoding: Try full address first, fallback to pincode
 * @param addressLine Full address line
 * @param city City name
 * @param state State name
 * @param pincode Postal code
 * @returns Promise with { lat, lng } or null if all attempts fail
 */
export async function smartGeocode(
  addressLine: string,
  city: string,
  state: string,
  pincode: string
): Promise<{ lat: number; lng: number } | null> {
  // Try full address first
  let coords = await geocodeAddress(addressLine, city, state, pincode);
  
  if (coords) {
    return coords;
  }

  // Fallback to pincode-only geocoding
  console.log("⚠️ Full address geocoding failed, trying pincode-only...");
  coords = await geocodeByPincode(pincode);
  
  return coords;
}
