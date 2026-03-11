import { getRouteDistance, DistanceResult } from "../utils/distanceCalculator";

/**
 * Route Optimizer Service
 * Implements nearest neighbor TSP approximation for route optimization
 * Good enough for <20 orders, runs in O(n²)
 */

export type DeliveryStop = {
  orderId: string;
  address: string;
  lat: number;
  lng: number;
  isWarehouse?: boolean;
};

export type OptimizedRoute = {
  stops: DeliveryStop[];
  totalDistanceM: number;
  totalDurationMinutes: number;
  estimatedDeliveryTimes: Array<{
    orderId: string;
    estimatedArrival: Date;
    distanceFromPreviousM: number;
  }>;
};

/**
 * Optimize delivery route using nearest neighbor algorithm
 */
export async function optimizeRoute(
  warehouse: { lat: number; lng: number },
  deliveries: DeliveryStop[]
): Promise<OptimizedRoute> {
  if (deliveries.length === 0) {
    return {
      stops: [{ ...warehouse, orderId: "warehouse", address: "Warehouse", isWarehouse: true }],
      totalDistanceM: 0,
      totalDurationMinutes: 0,
      estimatedDeliveryTimes: [],
    };
  }

  // Start from warehouse
  const optimizedStops: DeliveryStop[] = [
    { ...warehouse, orderId: "warehouse", address: "Warehouse", isWarehouse: true },
  ];

  const remaining = [...deliveries];
  let totalDistanceM = 0;
  let currentLocation = warehouse;

  // Nearest neighbor: always go to closest unvisited stop
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    // Find nearest stop
    for (let i = 0; i < remaining.length; i++) {
      const stop = remaining[i];
      const distance = await getDistanceCached(currentLocation, stop);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    // Add nearest stop to route
    const nearestStop = remaining[nearestIndex];
    optimizedStops.push(nearestStop);
    totalDistanceM += nearestDistance;
    currentLocation = { lat: nearestStop.lat, lng: nearestStop.lng };
    
    // Remove from remaining
    remaining.splice(nearestIndex, 1);
  }

  // Return to warehouse
  const returnDistance = await getDistanceCached(currentLocation, warehouse);
  totalDistanceM += returnDistance;
  optimizedStops.push({ ...warehouse, orderId: "warehouse_end", address: "Warehouse", isWarehouse: true });

  // Calculate estimated delivery times
  const estimatedDeliveryTimes = calculateEstimatedTimes(optimizedStops, totalDistanceM);

  // Estimate duration (average 25 km/h in city traffic)
  const totalDurationMinutes = Math.ceil((totalDistanceM / 1000) / 25 * 60);

  return {
    stops: optimizedStops,
    totalDistanceM,
    totalDurationMinutes,
    estimatedDeliveryTimes,
  };
}

/**
 * Get distance between two points (with caching)
 */
const distanceCache = new Map<string, number>();

async function getDistanceCached(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<number> {
  const key = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}:${to.lat.toFixed(3)},${to.lng.toFixed(3)}`;
  
  if (distanceCache.has(key)) {
    return distanceCache.get(key)!;
  }

  const result = await getRouteDistance(from.lat, from.lng, to.lat, to.lng);
  distanceCache.set(key, result.distanceMeters);
  
  return result.distanceMeters;
}

/**
 * Calculate estimated delivery times for each stop
 */
function calculateEstimatedTimes(
  stops: DeliveryStop[],
  totalDistanceM: number
): Array<{
  orderId: string;
  estimatedArrival: Date;
  distanceFromPreviousM: number;
}> {
  const times: Array<{
    orderId: string;
    estimatedArrival: Date;
    distanceFromPreviousM: number;
  }> = [];

  const startTime = new Date();
  let currentTime = startTime.getTime();
  let previousStop = stops[0];

  // Skip warehouse (first stop)
  for (let i = 1; i < stops.length - 1; i++) {
    const stop = stops[i];
    const distanceFromPrevious = calculateHaversineDistanceM(
      previousStop.lat,
      previousStop.lng,
      stop.lat,
      stop.lng
    );

    // Estimate travel time (25 km/h average)
    const travelTimeMs = (distanceFromPrevious / 1000) / 25 * 60 * 60 * 1000;
    
    // Add 3 minutes for delivery stop
    const stopTimeMs = 3 * 60 * 1000;
    
    currentTime += travelTimeMs + stopTimeMs;

    times.push({
      orderId: stop.orderId,
      estimatedArrival: new Date(currentTime),
      distanceFromPreviousM: Math.round(distanceFromPrevious),
    });

    previousStop = stop;
  }

  return times;
}

/**
 * Calculate Haversine distance in meters
 */
function calculateHaversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Optimize multiple routes for multiple drivers
 * Uses simple partitioning: divide orders by geographic clusters
 */
export async function optimizeMultiDriverRoutes(
  warehouse: { lat: number; lng: number },
  deliveries: DeliveryStop[],
  numDrivers: number
): Promise<OptimizedRoute[]> {
  if (numDrivers <= 1) {
    const singleRoute = await optimizeRoute(warehouse, deliveries);
    return [singleRoute];
  }

  // Simple geographic partitioning based on angle from warehouse
  const deliveriesWithAngle = deliveries.map((d) => ({
    ...d,
    angle: Math.atan2(d.lat - warehouse.lat, d.lng - warehouse.lng),
  }));

  // Sort by angle
  deliveriesWithAngle.sort((a, b) => a.angle - b.angle);

  // Divide into equal partitions
  const partitionSize = Math.ceil(deliveries.length / numDrivers);
  const partitions: DeliveryStop[][] = [];

  for (let i = 0; i < numDrivers; i++) {
    const start = i * partitionSize;
    const end = start + partitionSize;
    partitions.push(deliveriesWithAngle.slice(start, end));
  }

  // Optimize each partition
  const routes = await Promise.all(
    partitions.map((partition) => optimizeRoute(warehouse, partition))
  );

  return routes;
}

/**
 * Calculate total route distance without optimization (for comparison)
 */
export async function calculateRouteDistance(
  stops: DeliveryStop[]
): Promise<number> {
  let totalDistance = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const result = await getRouteDistance(from.lat, from.lng, to.lat, to.lng);
    totalDistance += result.distanceMeters;
  }

  return totalDistance;
}

export default {
  optimizeRoute,
  optimizeMultiDriverRoutes,
  calculateRouteDistance,
};
