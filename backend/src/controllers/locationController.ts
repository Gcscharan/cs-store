import { Request, Response } from "express";

export interface LocationData {
  pincode: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
}

interface NominatimResponse {
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state_district?: string;
    state?: string;
    house_number?: string;
    road?: string;
    suburb?: string;
  };
}

// Reverse geocode coordinates to get address information
export const reverseGeocodeController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
      return;
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values",
      });
      return;
    }

    // Call OpenStreetMap Nominatim API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch location data from geocoding service");
    }

    const data = (await response.json()) as any;

    if (!data || !data.address) {
      res.status(404).json({
        success: false,
        message: "No address data found for the provided coordinates",
      });
      return;
    }

    const address = data.address;

    // Extract pincode (postcode)
    const pincode = address.postcode || "";

    // Extract city (try multiple fields)
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.state_district ||
      "Unknown City";

    // Extract state
    const state = address.state || "Unknown State";

    // Create formatted address
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

    const locationData: LocationData = {
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
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reverse geocode coordinates",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get current location with reverse geocoding (for testing)
export const getCurrentLocationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // This endpoint is for testing purposes
    // In production, coordinates should come from the frontend
    res.status(200).json({
      success: true,
      message: "Use the reverse-geocode endpoint with lat and lng parameters",
      example: "/api/location/reverse-geocode?lat=17.3850&lng=78.4867",
    });
  } catch (error) {
    console.error("Location controller error:", error);
    res.status(500).json({
      success: false,
      message: "Location service error",
    });
  }
};
