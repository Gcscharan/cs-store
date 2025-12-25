import { Client } from "@googlemaps/google-maps-services-js";
import polyline from "@mapbox/polyline";

const googleMapsClient = new Client({});

export interface RouteInfo {
  polyline: string; // Encoded polyline
  distance: number; // in kilometers
  duration: number; // in seconds
  decodedPath: Array<{ lat: number; lng: number }>;
}

/**
 * Get route polyline and details from Google Directions API
 * @param origin Starting coordinates
 * @param destination Ending coordinates
 * @returns Route information including encoded polyline
 */
export async function getRoutePolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteInfo | null> {
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
        mode: "driving" as any,
        alternatives: false,
      },
    });

    if (
      response.data.status === "OK" &&
      response.data.routes &&
      response.data.routes.length > 0
    ) {
      const route = response.data.routes[0];
      const leg = route.legs[0];
      const encodedPolyline = route.overview_polyline.points;

      // Decode polyline to get path coordinates
      const decodedPath = polyline.decode(encodedPolyline).map(([lat, lng]: [number, number]) => ({
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
  } catch (error) {
    console.error("Error fetching route polyline:", error);
    return createFallbackRoute(origin, destination);
  }
}

/**
 * Create a fallback straight-line route when API fails
 */
function createFallbackRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): RouteInfo {
  const distance = calculateHaversineDistance(origin, destination);
  const estimatedDuration = (distance / 40) * 3600; // Assume 40 km/h average speed

  // Create simple straight line path
  const decodedPath = [origin, destination];
  
  // Encode as simple polyline
  const encodedPolyline = polyline.encode(
    decodedPath.map((p) => [p.lat, p.lng])
  );

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
export function isLocationNearRoute(
  location: { lat: number; lng: number },
  routePolyline: string,
  thresholdKm: number = 2
): boolean {
  try {
    // Decode the polyline
    const decodedPath = polyline.decode(routePolyline).map(([lat, lng]: [number, number]) => ({
      lat,
      lng,
    }));

    // Check distance to each segment of the route
    for (let i = 0; i < decodedPath.length - 1; i++) {
      const segmentStart = decodedPath[i];
      const segmentEnd = decodedPath[i + 1];

      const distanceToSegment = pointToSegmentDistance(
        location,
        segmentStart,
        segmentEnd
      );

      if (distanceToSegment <= thresholdKm) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking location near route:", error);
    return false;
  }
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function pointToSegmentDistance(
  point: { lat: number; lng: number },
  segmentStart: { lat: number; lng: number },
  segmentEnd: { lat: number; lng: number }
): number {
  // Calculate distance from point to line segment using Haversine
  const distToStart = calculateHaversineDistance(point, segmentStart);
  const distToEnd = calculateHaversineDistance(point, segmentEnd);
  const segmentLength = calculateHaversineDistance(segmentStart, segmentEnd);

  // If segment is very short, return distance to start
  if (segmentLength < 0.001) {
    return distToStart;
  }

  // Use dot product to find projection point
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.lat - segmentStart.lat) * (segmentEnd.lat - segmentStart.lat) +
        (point.lng - segmentStart.lng) * (segmentEnd.lng - segmentStart.lng)) /
        (segmentLength * segmentLength)
    )
  );

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
export function calculateHaversineDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Decode a polyline string to array of coordinates
 */
export function decodePolyline(
  encodedPolyline: string
): Array<{ lat: number; lng: number }> {
  try {
    return polyline.decode(encodedPolyline).map(([lat, lng]: [number, number]) => ({
      lat,
      lng,
    }));
  } catch (error) {
    console.error("Error decoding polyline:", error);
    return [];
  }
}

/**
 * Encode array of coordinates to polyline string
 */
export function encodePolyline(
  path: Array<{ lat: number; lng: number }>
): string {
  try {
    return polyline.encode(path.map((p) => [p.lat, p.lng]));
  } catch (error) {
    console.error("Error encoding polyline:", error);
    return "";
  }
}

