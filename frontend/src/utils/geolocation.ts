// Geolocation utilities for current location detection and reverse geocoding

export interface LocationData {
  pincode: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
}

// Get current location using browser geolocation API
export const getCurrentLocation = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
};

// Reverse geocode coordinates to get address information using backend API
export const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<LocationData | null> => {
  try {
    const response = await fetch(
      `/api/location/reverse-geocode?lat=${lat}&lng=${lng}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to fetch location data");
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.message || "No address data found");
    }

    return data.data;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
};

// Get current location with reverse geocoding
export const getCurrentLocationWithAddress =
  async (): Promise<LocationData | null> => {
    try {
      const position = await getCurrentLocation();
      const locationData = await reverseGeocode(
        position.coords.latitude,
        position.coords.longitude
      );

      return locationData;
    } catch (error) {
      console.error("Error getting current location with address:", error);
      return null;
    }
  };
