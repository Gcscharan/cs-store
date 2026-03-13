/**
 * CVRP Route Assignment Service
 * 
 * Production-grade route assignment engine for warehouse-based delivery dispatch.
 * Implements a deterministic 4-layer pipeline for Capacitated Vehicle Routing Problem (CVRP).
 * 
 * Algorithm Overview:
 * 1. Angular Sweep Clustering - Groups orders by direction from warehouse
 * 2. Capacity & Distance Route Formation - Creates routes respecting AUTO capacity (20-30 orders) and max distance
 * 3. Intra-Route Optimization - Optimizes each route using Nearest Neighbor + 2-opt
 * 4. Operational Fixups - Ensures locality constraints and boundary rebalancing
 * 
 * Usage:
 * Admin calls computeRoutes() with pending orders to get optimized route assignments.
 * Routes are then manually assigned to delivery boys via admin dashboard.
 * 
 * @module cvrpRouteAssignmentService
 */

import { calculateHaversineDistance } from "../utils/routeUtils";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Warehouse (Depot) location - configurable via environment variables
 * Defaults to Tiruvuru, Andhra Pradesh (Pincode: 521235)
 */
const WAREHOUSE_DEPOT = {
  lat: parseFloat(process.env.WAREHOUSE_LAT || '17.094'),
  lng: parseFloat(process.env.WAREHOUSE_LNG || '80.598'),
  pincode: parseInt(process.env.WAREHOUSE_PINCODE || '521235'),
};

/**
 * Vehicle constraints for AUTO rickshaw - configurable via environment
 */
const AUTO_CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
const AUTO_CAPACITY_MAX = parseInt(process.env.ROUTE_CAPACITY_MAX || '30');
const MAX_AUTO_ROUTE_DISTANCE_KM = parseFloat(process.env.ROUTE_MAX_DISTANCE_KM || '35');
const TWO_OPT_MAX_ITERATIONS = parseInt(process.env.ROUTE_TWO_OPT_ITERATIONS || '80');
const VEHICLE_TYPE_REQUIRED = "AUTO";

/**
 * Average AUTO speed for time estimation (km/h)
 */
const AVG_AUTO_SPEED_KMH = parseFloat(process.env.ROUTE_AVG_SPEED_KMH || '30');
const STOP_TIME_PER_ORDER_MIN = parseFloat(process.env.ROUTE_STOP_TIME_MIN || '5');

/**
 * Performance guard - max computation time in milliseconds
 */
const MAX_COMPUTE_MS = parseInt(process.env.ROUTE_MAX_COMPUTE_MS || '8000');

/**
 * Locality constraint radius for Layer 4 fixups
 */
const LOCALITY_RADIUS_KM = 0.5;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface OrderInput {
  orderId: string;
  lat: number;
  lng: number;
  pincode?: string;
  locality?: string; // Optional: village/locality name for Layer 4 fixups
}

export interface VehicleInput {
  type: string;
  capacity?: number; // Optional override
  maxDistanceKm?: number; // Optional override (used for preview)
}

export interface Route {
  routeId: string;
  deliveryBoyId: string | null;
  orderCount: number;
  totalDistanceKm: number;
  estimatedTimeMin: number;
  orders: string[]; // Order IDs
  routePath: string[]; // ["WAREHOUSE", "ORDER_12", "ORDER_88", ...]
  // Hub & Spoke fields
  hubId: string;
  hubName: string;
  tier: 'local' | 'hub';
  depotLat: number;
  depotLng: number;
  // Outlier fields
  isOutlierRoute: boolean;
  outlierReason?: string;
}

export interface RouteAssignmentResult {
  warehouse: {
    lat: number;
    lng: number;
    pincode: number;
  };
  vehicleType: string;
  routes: Route[];
  metadata: {
    totalOrders: number;
    totalRoutes: number;
    averageOrdersPerRoute: number;
    computationTimeMs: number;
  };
}

interface OrderWithMetadata extends OrderInput {
  angle: number; // Polar angle from warehouse (0-2π)
  distance: number; // Haversine distance from warehouse (km)
}

interface ProvisionalRoute {
  orders: OrderWithMetadata[];
  totalDistance: number;
  isOutlierRoute?: boolean;
  outlierReason?: string;
}

// ============================================================================
// LAYER 0: VALIDATION
// ============================================================================

/**
 * Validates inputs and rejects if constraints are violated
 * @throws Error if validation fails
 */
function validateInputs(
  orders: OrderInput[],
  vehicle: VehicleInput
): void {
  const minOrdersRequired =
    typeof vehicle.capacity === "number" && vehicle.capacity > 0
      ? Math.floor(vehicle.capacity)
      : AUTO_CAPACITY_MIN;

  // Vehicle type check
  if (vehicle.type !== VEHICLE_TYPE_REQUIRED) {
    throw new Error(
      `Vehicle type must be ${VEHICLE_TYPE_REQUIRED}, got ${vehicle.type}`
    );
  }

  // Minimum order count check
  if (orders.length < minOrdersRequired) {
    throw new Error(
      `Insufficient orders: ${orders.length} < ${minOrdersRequired} (minimum required)`
    );
  }

  // Validate each order has coordinates
  for (const order of orders) {
    if (
      typeof order.lat !== "number" ||
      typeof order.lng !== "number" ||
      isNaN(order.lat) ||
      isNaN(order.lng)
    ) {
      throw new Error(
        `Order ${order.orderId} missing valid lat/lng coordinates`
      );
    }
  }
}

// ============================================================================
// LAYER 1: ANGULAR SWEEP CLUSTERING
// ============================================================================

/**
 * Computes polar angle and distance for each order relative to warehouse
 * Sorts orders by (angle, distance, orderId) for deterministic clustering
 */
function computeAngularSweep(
  orders: OrderInput[]
): OrderWithMetadata[] {
  const ordersWithMetadata: OrderWithMetadata[] = orders.map((order) => {
    // Compute angle using atan2 (returns -π to π, normalize to 0-2π)
    const deltaLat = order.lat - WAREHOUSE_DEPOT.lat;
    const deltaLng = order.lng - WAREHOUSE_DEPOT.lng;
    let angle = Math.atan2(deltaLat, deltaLng);
    
    // Normalize to 0-2π range
    if (angle < 0) {
      angle += 2 * Math.PI;
    }

    // Compute haversine distance
    const distance = calculateHaversineDistance(
      WAREHOUSE_DEPOT,
      { lat: order.lat, lng: order.lng }
    );

    return {
      ...order,
      angle,
      distance,
    };
  });

  // Deterministic sort: angle → distance → orderId
  ordersWithMetadata.sort((a, b) => {
    if (Math.abs(a.angle - b.angle) > 0.0001) {
      return a.angle - b.angle;
    }
    if (Math.abs(a.distance - b.distance) > 0.001) {
      return a.distance - b.distance;
    }
    return a.orderId.localeCompare(b.orderId);
  });

  return ordersWithMetadata;
}

// ============================================================================
// LAYER 2: CAPACITY & DISTANCE ROUTE FORMATION
// ============================================================================

/**
 * Forms routes by sweeping sorted orders and packing them into routes
 * while respecting capacity (20-30 orders) and distance (≤35km) constraints
 */
function formCapacityConstrainedRoutes(
  sortedOrders: OrderWithMetadata[],
  maxDistanceKm: number
): ProvisionalRoute[] {
  const routes: ProvisionalRoute[] = [];
  let currentRoute: ProvisionalRoute = {
    orders: [],
    totalDistance: 0,
  };
  let lastPoint = WAREHOUSE_DEPOT;

  for (const order of sortedOrders) {
    // Calculate distance from last point to this order
    const deltaDistance =
      currentRoute.orders.length === 0
        ? order.distance // First order: distance from warehouse
        : calculateHaversineDistance(
            {
              lat: lastPoint.lat,
              lng: lastPoint.lng,
            },
            { lat: order.lat, lng: order.lng }
          );

    const newTotalDistance = currentRoute.totalDistance + deltaDistance;

    // Check if we need to close current route
    const exceedsCapacity = currentRoute.orders.length >= AUTO_CAPACITY_MAX;
    const exceedsDistance = newTotalDistance > maxDistanceKm;

    if (exceedsCapacity || exceedsDistance) {
      // Close current route if it has minimum orders
      if (currentRoute.orders.length >= AUTO_CAPACITY_MIN) {
        routes.push({ ...currentRoute });
      } else {
        // Route too small - will merge later
        routes.push({ ...currentRoute });
      }

      // Start new route
      currentRoute = {
        orders: [order],
        totalDistance: order.distance, // Distance from warehouse
      };
      lastPoint = { lat: order.lat, lng: order.lng, pincode: WAREHOUSE_DEPOT.pincode };
    } else {
      // Add to current route
      currentRoute.orders.push(order);
      currentRoute.totalDistance = newTotalDistance;
      lastPoint = { lat: order.lat, lng: order.lng, pincode: WAREHOUSE_DEPOT.pincode };
    }
  }

  // Add final route if it exists
  if (currentRoute.orders.length > 0) {
    routes.push(currentRoute);
  }

  // Merge small tail routes if possible
  return mergeSmallRoutes(routes, maxDistanceKm);
}

/**
 * Merges routes with < AUTO_CAPACITY_MIN orders if possible
 */
function mergeSmallRoutes(
  routes: ProvisionalRoute[],
  maxDistanceKm: number
): ProvisionalRoute[] {
  if (routes.length === 0) return routes;

  const merged: ProvisionalRoute[] = [];
  let i = 0;

  while (i < routes.length) {
    const current = routes[i];

    // If route meets minimum capacity, keep it
    if (current.orders.length >= AUTO_CAPACITY_MIN) {
      merged.push(current);
      i++;
      continue;
    }

    // Try to merge with next route
    if (i + 1 < routes.length) {
      const next = routes[i + 1];
      const combinedOrderCount =
        current.orders.length + next.orders.length;
      const combinedDistance = estimateCombinedDistance(current, next);

      if (
        combinedOrderCount <= AUTO_CAPACITY_MAX &&
        combinedDistance <= maxDistanceKm
      ) {
        // Merge routes
        merged.push({
          orders: [...current.orders, ...next.orders],
          totalDistance: combinedDistance,
        });
        i += 2; // Skip next route
        continue;
      }
    }

    // Cannot merge - keep as is (will fail validation if < min)
    merged.push(current);
    i++;
  }

  return merged;
}

// ============================================================================
// OUTLIER DETECTION
// ============================================================================

const OUTLIER_ZSCORE_THRESHOLD = 2.5;
const MIN_CLUSTER_SIZE_FOR_DETECTION = 5;
const OUTLIER_COST_THRESHOLD_KM = 30;

/**
 * Detects and extracts outlier orders from routes
 * 
 * Outliers are orders that are far from the cluster centroid, causing
 * excessive route time/fuel cost. They are extracted into mini-routes.
 * 
 * @param routes Provisional routes to analyze
 * @returns Clean routes and outlier routes
 */
function detectAndExtractOutliers(routes: ProvisionalRoute[]): {
  cleanRoutes: ProvisionalRoute[];
  outlierRoutes: ProvisionalRoute[];
} {
  const cleanRoutes: ProvisionalRoute[] = [];
  const outlierOrders: (OrderWithMetadata & { reason: string })[] = [];

  for (const route of routes) {
    // For small routes, check if the orders are far from a reasonable cluster
    // A single order 100km+ from depot is likely an outlier
    if (route.orders.length < MIN_CLUSTER_SIZE_FOR_DETECTION) {
      const depotDist = route.orders.reduce((s, o) => s + o.distance, 0) / route.orders.length;
      
      if (depotDist > 100) {
        // Small route far from depot - treat as outlier
        for (const order of route.orders) {
          outlierOrders.push({
            ...order,
            reason: `${order.distance.toFixed(1)}km from depot (small route outlier)`,
          });
          console.log(`[CVRP] Small route outlier: order ${order.orderId} ` +
            `${order.distance.toFixed(1)}km from depot`);
        }
        continue; // Don't add to cleanRoutes
      }
      
      // Small route close to depot - keep as is
      cleanRoutes.push(route);
      continue;
    }

    // Calculate centroid of route orders
    const centroid = {
      lat: route.orders.reduce((s, o) => s + o.lat, 0) / route.orders.length,
      lng: route.orders.reduce((s, o) => s + o.lng, 0) / route.orders.length,
    };

    // Calculate distance from centroid for each order
    const withDist = route.orders.map(o => ({
      ...o,
      distFromCentroid: calculateHaversineDistance(centroid, { lat: o.lat, lng: o.lng }),
    }));

    // Calculate mean and standard deviation
    const mean = withDist.reduce((s, o) => s + o.distFromCentroid, 0) / withDist.length;
    const variance = withDist.reduce((s, o) => 
      s + Math.pow(o.distFromCentroid - mean, 2), 0) / withDist.length;
    const stdDev = Math.sqrt(variance);

    const normal: OrderWithMetadata[] = [];
    
    for (const order of withDist) {
      const zScore = stdDev > 0 ? (order.distFromCentroid - mean) / stdDev : 0;
      
      // Extract if both z-score AND absolute distance exceed thresholds
      if (zScore > OUTLIER_ZSCORE_THRESHOLD && 
          order.distFromCentroid > OUTLIER_COST_THRESHOLD_KM) {
        outlierOrders.push({
          ...order,
          reason: `${order.distFromCentroid.toFixed(1)}km from cluster centroid (z=${zScore.toFixed(2)})`,
        });
        console.log(`[CVRP] Outlier detected: order ${order.orderId} ` +
          `z=${zScore.toFixed(2)}, ${order.distFromCentroid.toFixed(1)}km from centroid`);
      } else {
        normal.push(order);
      }
    }

    if (normal.length > 0) {
      cleanRoutes.push({ ...route, orders: normal });
    }
  }

  // Each outlier becomes its own mini-route
  const outlierRoutes: ProvisionalRoute[] = outlierOrders.map(order => ({
    orders: [order],
    totalDistance: order.distance * 2, // round trip estimate
    isOutlierRoute: true,
    outlierReason: order.reason,
  }));

  if (outlierOrders.length > 0) {
    console.log(`[CVRP] Extracted ${outlierOrders.length} outlier orders into mini-routes`);
  }

  return { cleanRoutes, outlierRoutes };
}

/**
 * Estimates combined distance for two routes
 */
function estimateCombinedDistance(
  route1: ProvisionalRoute,
  route2: ProvisionalRoute
): number {
  if (route1.orders.length === 0 || route2.orders.length === 0) {
    return route1.totalDistance + route2.totalDistance;
  }

  // Distance from last order of route1 to first order of route2
  const lastOrder1 = route1.orders[route1.orders.length - 1];
  const firstOrder2 = route2.orders[0];
  const bridgeDistance = calculateHaversineDistance(
    { lat: lastOrder1.lat, lng: lastOrder1.lng },
    { lat: firstOrder2.lat, lng: firstOrder2.lng }
  );

  return route1.totalDistance + bridgeDistance + route2.totalDistance;
}

// ============================================================================
// LAYER 3: INTRA-ROUTE OPTIMIZATION (TSP-LITE)
// ============================================================================

/**
 * Optimizes a single route using Nearest Neighbor + 2-opt
 */
function optimizeRoute(route: ProvisionalRoute, startTimeMs: number = Date.now()): {
  optimizedOrders: OrderWithMetadata[];
  totalDistanceKm: number;
} {
  if (route.orders.length === 0) {
    return { optimizedOrders: [], totalDistanceKm: 0 };
  }

  if (route.orders.length === 1) {
    return {
      optimizedOrders: route.orders,
      totalDistanceKm: route.orders[0].distance * 2, // To order and back
    };
  }

  // Step 1: Nearest Neighbor heuristic
  const nearestNeighborPath = nearestNeighborHeuristic(route.orders);

  // Step 2: 2-opt improvement with timeout
  const optimizedPath = twoOptOptimization(
    nearestNeighborPath,
    TWO_OPT_MAX_ITERATIONS,
    startTimeMs
  );

  // Calculate total distance (warehouse → orders → warehouse)
  const totalDistanceKm = calculateRouteDistance(optimizedPath);

  return {
    optimizedOrders: optimizedPath,
    totalDistanceKm,
  };
}

/**
 * Nearest Neighbor heuristic: Start from warehouse, always go to nearest unvisited order
 */
function nearestNeighborHeuristic(
  orders: OrderWithMetadata[]
): OrderWithMetadata[] {
  if (orders.length === 0) return [];
  if (orders.length === 1) return orders;

  const path: OrderWithMetadata[] = [];
  const unvisited = new Set(orders);
  let currentPoint = WAREHOUSE_DEPOT;

  while (unvisited.size > 0) {
    let nearest: OrderWithMetadata | null = null;
    let minDistance = Infinity;

    for (const order of unvisited) {
      const distance = calculateHaversineDistance(currentPoint, {
        lat: order.lat,
        lng: order.lng,
      });

      if (distance < minDistance) {
        minDistance = distance;
        nearest = order;
      }
    }

    if (nearest) {
      path.push(nearest);
      unvisited.delete(nearest);
      currentPoint = { lat: nearest.lat, lng: nearest.lng, pincode: WAREHOUSE_DEPOT.pincode };
    }
  }

  return path;
}

/**
 * 2-opt optimization: Swap edges to reduce total distance
 * Limited iterations and timeout to keep computation fast
 */
function twoOptOptimization(
  path: OrderWithMetadata[],
  maxIterations: number,
  startTimeMs: number = Date.now()
): OrderWithMetadata[] {
  if (path.length <= 2) return path;

  let improved = true;
  let iterations = 0;
  let bestPath = [...path];
  let bestDistance = calculateRouteDistance(bestPath);

  while (improved && iterations < maxIterations) {
    // Performance guard: stop if exceeding max compute time
    if (Date.now() - startTimeMs > MAX_COMPUTE_MS) {
      console.warn(`[CVRP] 2-opt stopped at iteration ${iterations} due to timeout (${MAX_COMPUTE_MS}ms)`);
      break;
    }

    improved = false;

    for (let i = 0; i < bestPath.length - 1; i++) {
      for (let j = i + 2; j < bestPath.length; j++) {
        // Try swapping edges (i, i+1) and (j, j+1)
        const newPath = twoOptSwap(bestPath, i, j);
        const newDistance = calculateRouteDistance(newPath);

        if (newDistance < bestDistance) {
          bestPath = newPath;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }

    iterations++;
  }

  return bestPath;
}

/**
 * Performs a 2-opt swap: reverses segment between i and j
 */
function twoOptSwap(
  path: OrderWithMetadata[],
  i: number,
  j: number
): OrderWithMetadata[] {
  const newPath = [...path];
  // Reverse segment from i+1 to j
  const segment = newPath.slice(i + 1, j + 1).reverse();
  newPath.splice(i + 1, j - i, ...segment);
  return newPath;
}

/**
 * Calculates total route distance including return to warehouse
 */
function calculateRouteDistance(path: OrderWithMetadata[]): number {
  if (path.length === 0) return 0;
  if (path.length === 1) {
    return path[0].distance * 2; // To order and back
  }

  let total = 0;

  // Distance from warehouse to first order
  total += path[0].distance;

  // Distances between consecutive orders
  for (let i = 0; i < path.length - 1; i++) {
    total += calculateHaversineDistance(
      { lat: path[i].lat, lng: path[i].lng },
      { lat: path[i + 1].lat, lng: path[i + 1].lng }
    );
  }

  // Distance from last order back to warehouse
  total += path[path.length - 1].distance;

  return total;
}

/**
 * Estimates time in minutes for a route
 */
function estimateRouteTime(
  totalDistanceKm: number,
  orderCount: number
): number {
  const travelTimeMin = (totalDistanceKm / AVG_AUTO_SPEED_KMH) * 60;
  const stopTimeMin = orderCount * STOP_TIME_PER_ORDER_MIN;
  return Math.round(travelTimeMin + stopTimeMin);
}

// ============================================================================
// LAYER 4: OPERATIONAL FIXUPS
// ============================================================================

/**
 * Applies operational fixups:
 * - Keeps orders in same locality/pincode together
 * - Boundary rebalancing between adjacent routes
 */
function applyOperationalFixups(
  routes: Route[]
): Route[] {
  // Fixup 1: Locality locking (ensure same pincode orders stay together)
  let fixedRoutes = enforceLocalityConstraints(routes);

  // Fixup 2: Boundary rebalancing
  fixedRoutes = rebalanceBoundaryOrders(fixedRoutes);

  return fixedRoutes;
}

/**
 * Ensures orders with same pincode/locality stay in same route
 * Moves orders to routes with more neighbors within LOCALITY_RADIUS_KM
 * Works on ProvisionalRoute[] with full order metadata
 */
function enforceLocalityConstraintsOnProvisional(routes: ProvisionalRoute[]): ProvisionalRoute[] {
  if (routes.length <= 1) return routes;

  let changed = true;
  let iterations = 0;
  const maxIterations = 10;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (let i = 0; i < routes.length; i++) {
      for (let j = routes[i].orders.length - 1; j >= 0; j--) {
        const order = routes[i].orders[j];
        if (!order) continue;

        let bestRouteIdx = i;
        let bestNeighborCount = 0;

        // Count neighbors in current route
        const currentNeighbors = routes[i].orders.filter((o, idx) =>
          idx !== j &&
          calculateHaversineDistance(
            { lat: order.lat, lng: order.lng },
            { lat: o.lat, lng: o.lng }
          ) <= LOCALITY_RADIUS_KM
        ).length;

        bestNeighborCount = currentNeighbors;

        // Check other routes for better locality fit
        for (let k = 0; k < routes.length; k++) {
          if (k === i) continue;
          if (routes[k].orders.length >= AUTO_CAPACITY_MAX) continue;

          const neighbors = routes[k].orders.filter(o =>
            calculateHaversineDistance(
              { lat: order.lat, lng: order.lng },
              { lat: o.lat, lng: o.lng }
            ) <= LOCALITY_RADIUS_KM
          ).length;

          if (neighbors > bestNeighborCount) {
            bestNeighborCount = neighbors;
            bestRouteIdx = k;
          }
        }

        // Move if better route found and source route stays above min
        if (bestRouteIdx !== i && routes[i].orders.length > AUTO_CAPACITY_MIN) {
          const [moved] = routes[i].orders.splice(j, 1);
          routes[bestRouteIdx].orders.push(moved);
          changed = true;
        }
      }
    }
  }

  return routes;
}

/**
 * Wrapper for Layer 4 that works on Route[] (final output format)
 * Note: This is a no-op on Route[] since metadata is lost; actual fixups
 * happen on ProvisionalRoute[] before conversion to Route[]
 */
function enforceLocalityConstraints(routes: Route[]): Route[] {
  // This operates on Route[] which lacks coordinate metadata
  // Actual locality fixups happen in enforceLocalityConstraintsOnProvisional
  return routes;
}

/**
 * Rebalances boundary orders between adjacent routes if it reduces total distance
 * Works on ProvisionalRoute[] with full order metadata
 */
function rebalanceBoundaryOrdersOnProvisional(routes: ProvisionalRoute[]): ProvisionalRoute[] {
  if (routes.length <= 1) return routes;

  function getCentroid(orders: OrderWithMetadata[]): { lat: number; lng: number } | null {
    if (orders.length === 0) return null;
    const lat = orders.reduce((s, o) => s + o.lat, 0) / orders.length;
    const lng = orders.reduce((s, o) => s + o.lng, 0) / orders.length;
    return { lat, lng };
  }

  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    for (let i = 0; i < routes.length; i++) {
      if (routes[i].orders.length <= AUTO_CAPACITY_MIN) continue;

      // Find most underloaded route
      const routeCentroids = routes.map((r, idx) => ({
        idx,
        centroid: getCentroid(r.orders),
        count: r.orders.length
      }));

      const underloaded = routeCentroids
        .filter(r => r.idx !== i && r.count < AUTO_CAPACITY_MAX && r.centroid)
        .sort((a, b) => a.count - b.count)[0];

      if (!underloaded || !underloaded.centroid) continue;

      // Find boundary order in overloaded route closest to target centroid
      let closestIdx = -1;
      let closestDist = Infinity;

      for (let j = 0; j < routes[i].orders.length; j++) {
        const dist = calculateHaversineDistance(
          { lat: routes[i].orders[j].lat, lng: routes[i].orders[j].lng },
          underloaded.centroid!
        );
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = j;
        }
      }

      if (closestIdx >= 0 && routes[i].orders.length > AUTO_CAPACITY_MIN) {
        const [moved] = routes[i].orders.splice(closestIdx, 1);
        routes[underloaded.idx].orders.push(moved);
        changed = true;
      }
    }
  }

  return routes;
}

/**
 * Wrapper for Layer 4 that works on Route[] (final output format)
 * Note: Actual rebalancing happens on ProvisionalRoute[] before conversion
 */
function rebalanceBoundaryOrders(routes: Route[]): Route[] {
  // This operates on Route[] which lacks coordinate metadata
  // Actual rebalancing happens in rebalanceBoundaryOrdersOnProvisional
  return routes;
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class CVRPRouteAssignmentService {
  /**
   * Main entry point: Computes optimized routes for given orders
   * 
   * @param orders Array of orders with lat/lng coordinates
   * @param vehicle Vehicle configuration (must be AUTO)
   * @returns RouteAssignmentResult with optimized routes
   * @throws Error if constraints are violated
   */
  computeRoutes(
    orders: OrderInput[],
    vehicle: VehicleInput
  ): RouteAssignmentResult {
    const startTime = Date.now();

    // Performance warning for large order volumes
    if (orders.length > 1000) {
      console.warn(`[CVRP] Large order batch: ${orders.length} orders. Consider batching for better performance.`);
    }

    const minOrdersPerRoute =
      typeof vehicle.capacity === "number" && vehicle.capacity > 0
        ? Math.floor(vehicle.capacity)
        : AUTO_CAPACITY_MIN;

    const maxDistanceKm =
      typeof vehicle.maxDistanceKm === "number" && vehicle.maxDistanceKm > 0
        ? vehicle.maxDistanceKm
        : MAX_AUTO_ROUTE_DISTANCE_KM;

    // Layer 0: Validation
    validateInputs(orders, vehicle);

    // Layer 1: Angular Sweep
    const sortedOrders = computeAngularSweep(orders);

    // Layer 2: Capacity-Constrained Route Formation
    let provisionalRoutes = formCapacityConstrainedRoutes(sortedOrders, maxDistanceKm);

    // Layer 4 (Part A): Apply fixups on ProvisionalRoute[] with full metadata
    provisionalRoutes = enforceLocalityConstraintsOnProvisional(provisionalRoutes);
    provisionalRoutes = rebalanceBoundaryOrdersOnProvisional(provisionalRoutes);

    // Outlier Detection: Extract far orders into mini-routes
    const { cleanRoutes, outlierRoutes } = detectAndExtractOutliers(provisionalRoutes);
    provisionalRoutes = [...cleanRoutes, ...outlierRoutes];

    // Validate provisional routes meet minimum capacity (relaxed for outlier routes)
    for (let i = 0; i < provisionalRoutes.length; i++) {
      const route = provisionalRoutes[i];
      // Skip minimum capacity check for outlier routes
      if (route.isOutlierRoute) continue;
      
      if (route.orders.length < minOrdersPerRoute) {
        throw new Error(
          `Route ${i + 1} has ${route.orders.length} orders, minimum ${minOrdersPerRoute} required`
        );
      }
      if (route.orders.length > AUTO_CAPACITY_MAX) {
        throw new Error(
          `Route ${i + 1} has ${route.orders.length} orders, maximum ${AUTO_CAPACITY_MAX} allowed`
        );
      }
    }

    // Layer 3: Intra-Route Optimization (with timeout)
    const optimizedRoutes: Route[] = provisionalRoutes.map((route, idx) => {
      const { optimizedOrders, totalDistanceKm } = optimizeRoute(route, startTime);

      // Validate optimized route distance (skip for outlier routes)
      if (!route.isOutlierRoute && totalDistanceKm > maxDistanceKm) {
        throw new Error(
          `Route ${idx + 1} distance ${totalDistanceKm.toFixed(2)} km exceeds maximum ${maxDistanceKm} km`
        );
      }

      const estimatedTimeMin = estimateRouteTime(
        totalDistanceKm,
        optimizedOrders.length
      );

      return {
        routeId: `AUTO-R-${String(idx + 1).padStart(2, "0")}`,
        deliveryBoyId: null, // Admin assigns later
        orderCount: optimizedOrders.length,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10, // Round to 1 decimal
        estimatedTimeMin,
        orders: optimizedOrders.map((o) => o.orderId),
        routePath: [
          "WAREHOUSE",
          ...optimizedOrders.map((o) => o.orderId),
        ],
        // Hub & Spoke fields (default to warehouse)
        hubId: 'warehouse',
        hubName: 'Warehouse (Local)',
        tier: 'local',
        depotLat: WAREHOUSE_DEPOT.lat,
        depotLng: WAREHOUSE_DEPOT.lng,
        // Outlier fields
        isOutlierRoute: route.isOutlierRoute || false,
        outlierReason: route.outlierReason,
      };
    });

    // Layer 4 (Part B): Final fixups on Route[] (no-op, already done on ProvisionalRoute[])
    const finalRoutes = applyOperationalFixups(optimizedRoutes);

    const computationTimeMs = Date.now() - startTime;
    const totalOrders = orders.length;
    const totalRoutes = finalRoutes.length;
    const averageOrdersPerRoute =
      totalRoutes > 0 ? totalOrders / totalRoutes : 0;

    return {
      warehouse: {
        lat: WAREHOUSE_DEPOT.lat,
        lng: WAREHOUSE_DEPOT.lng,
        pincode: WAREHOUSE_DEPOT.pincode,
      },
      vehicleType: VEHICLE_TYPE_REQUIRED,
      routes: finalRoutes,
      metadata: {
        totalOrders,
        totalRoutes,
        averageOrdersPerRoute: Math.round(averageOrdersPerRoute * 10) / 10,
        computationTimeMs,
      },
    };
  }

  /**
   * Compute routes for a specific hub with custom depot coordinates
   * Used in Hub & Spoke model for last-mile delivery from regional hubs
   * 
   * @param orders Array of orders with lat/lng coordinates
   * @param vehicle Vehicle configuration (must be AUTO)
   * @param hubConfig Hub configuration with depot coordinates
   * @returns RouteAssignmentResult with optimized routes for this hub
   */
  computeRoutesForHub(
    orders: OrderInput[],
    vehicle: VehicleInput,
    hubConfig: {
      hubId: string;
      hubName: string;
      depotLat: number;
      depotLng: number;
      tier: 'local' | 'hub';
    }
  ): RouteAssignmentResult {
    const startTime = Date.now();

    if (orders.length === 0) {
      return {
        warehouse: { lat: hubConfig.depotLat, lng: hubConfig.depotLng, pincode: 0 },
        vehicleType: VEHICLE_TYPE_REQUIRED,
        routes: [],
        metadata: { totalOrders: 0, totalRoutes: 0, averageOrdersPerRoute: 0, computationTimeMs: 0 },
      };
    }

    // Performance warning for large order volumes
    if (orders.length > 1000) {
      console.warn(`[CVRP] Large order batch: ${orders.length} orders. Consider batching for better performance.`);
    }

    const minOrdersPerRoute =
      typeof vehicle.capacity === "number" && vehicle.capacity > 0
        ? Math.floor(vehicle.capacity)
        : AUTO_CAPACITY_MIN;

    const maxDistanceKm =
      typeof vehicle.maxDistanceKm === "number" && vehicle.maxDistanceKm > 0
        ? vehicle.maxDistanceKm
        : MAX_AUTO_ROUTE_DISTANCE_KM;

    // Validate each order has coordinates
    for (const order of orders) {
      if (
        typeof order.lat !== "number" ||
        typeof order.lng !== "number" ||
        isNaN(order.lat) ||
        isNaN(order.lng)
      ) {
        throw new Error(`Order ${order.orderId} missing valid lat/lng coordinates`);
      }
    }

    // Layer 1: Angular Sweep from hub depot
    const sortedOrders = this.computeAngularSweepFromDepot(orders, hubConfig.depotLat, hubConfig.depotLng);

    // Layer 2: Capacity-Constrained Route Formation
    let provisionalRoutes = this.formCapacityConstrainedRoutesFromDepot(
      sortedOrders, 
      maxDistanceKm, 
      hubConfig.depotLat, 
      hubConfig.depotLng
    );

    // Layer 4 (Part A): Apply fixups
    provisionalRoutes = enforceLocalityConstraintsOnProvisional(provisionalRoutes);
    provisionalRoutes = rebalanceBoundaryOrdersOnProvisional(provisionalRoutes);

    // Outlier Detection: Extract far orders into mini-routes
    const { cleanRoutes, outlierRoutes } = detectAndExtractOutliers(provisionalRoutes);
    provisionalRoutes = [...cleanRoutes, ...outlierRoutes];

    // Validate provisional routes meet minimum capacity (relaxed for hubs and outlier routes)
    for (let i = 0; i < provisionalRoutes.length; i++) {
      const route = provisionalRoutes[i];
      // Skip minimum capacity check for outlier routes
      if (route.isOutlierRoute) continue;
      
      if (route.orders.length < Math.min(minOrdersPerRoute, 10)) {
        // Allow smaller routes for hub last-mile (min 10 instead of 20)
        console.warn(`[CVRP] Hub route ${i + 1} has only ${route.orders.length} orders`);
      }
      if (route.orders.length > AUTO_CAPACITY_MAX) {
        throw new Error(
          `Route ${i + 1} has ${route.orders.length} orders, maximum ${AUTO_CAPACITY_MAX} allowed`
        );
      }
    }

    // Layer 3: Intra-Route Optimization (with timeout)
    const optimizedRoutes: Route[] = provisionalRoutes.map((route, idx) => {
      const { optimizedOrders, totalDistanceKm } = this.optimizeRouteFromDepot(
        route, 
        startTime, 
        hubConfig.depotLat, 
        hubConfig.depotLng
      );

      // Validate optimized route distance (skip for outlier routes)
      if (!route.isOutlierRoute && totalDistanceKm > maxDistanceKm) {
        throw new Error(
          `Route ${idx + 1} distance ${totalDistanceKm.toFixed(2)} km exceeds maximum ${maxDistanceKm} km`
        );
      }

      const estimatedTimeMin = estimateRouteTime(
        totalDistanceKm,
        optimizedOrders.length
      );

      return {
        routeId: `${hubConfig.hubId}-R-${String(idx + 1).padStart(2, "0")}`,
        deliveryBoyId: null,
        orderCount: optimizedOrders.length,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        estimatedTimeMin,
        orders: optimizedOrders.map((o) => o.orderId),
        routePath: ["DEPOT", ...optimizedOrders.map((o) => o.orderId)],
        hubId: hubConfig.hubId,
        hubName: hubConfig.hubName,
        tier: hubConfig.tier,
        depotLat: hubConfig.depotLat,
        depotLng: hubConfig.depotLng,
        // Outlier fields
        isOutlierRoute: route.isOutlierRoute || false,
        outlierReason: route.outlierReason,
      };
    });

    const computationTimeMs = Date.now() - startTime;
    const totalOrders = orders.length;
    const totalRoutes = optimizedRoutes.length;
    const averageOrdersPerRoute = totalRoutes > 0 ? totalOrders / totalRoutes : 0;

    return {
      warehouse: { lat: hubConfig.depotLat, lng: hubConfig.depotLng, pincode: 0 },
      vehicleType: VEHICLE_TYPE_REQUIRED,
      routes: optimizedRoutes,
      metadata: {
        totalOrders,
        totalRoutes,
        averageOrdersPerRoute: Math.round(averageOrdersPerRoute * 10) / 10,
        computationTimeMs,
      },
    };
  }

  /**
   * Compute angular sweep from custom depot (for hubs)
   */
  private computeAngularSweepFromDepot(
    orders: OrderInput[],
    depotLat: number,
    depotLng: number
  ): OrderWithMetadata[] {
    const ordersWithMetadata: OrderWithMetadata[] = orders.map((order) => ({
      ...order,
      angle: Math.atan2(order.lat - depotLat, order.lng - depotLng),
      distance: calculateHaversineDistance(
        { lat: depotLat, lng: depotLng },
        { lat: order.lat, lng: order.lng }
      ),
    }));

    return ordersWithMetadata.sort((a, b) => {
      if (a.angle !== b.angle) return a.angle - b.angle;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.orderId.localeCompare(b.orderId);
    });
  }

  /**
   * Form capacity-constrained routes from custom depot
   */
  private formCapacityConstrainedRoutesFromDepot(
    sortedOrders: OrderWithMetadata[],
    maxDistanceKm: number,
    depotLat: number,
    depotLng: number
  ): ProvisionalRoute[] {
    const routes: ProvisionalRoute[] = [];
    let currentRoute: OrderWithMetadata[] = [];
    let currentDistance = 0;

    for (const order of sortedOrders) {
      if (currentRoute.length === 0) {
        currentRoute.push(order);
        currentDistance = order.distance * 2; // Round trip estimate
      } else {
        const lastOrder = currentRoute[currentRoute.length - 1];
        const incrementalDist = calculateHaversineDistance(lastOrder, order);
        const returnDist = calculateHaversineDistance(order, { lat: depotLat, lng: depotLng });
        const newTotalDist = currentDistance - calculateHaversineDistance(lastOrder, { lat: depotLat, lng: depotLng }) + incrementalDist + returnDist;

        if (
          currentRoute.length < AUTO_CAPACITY_MAX &&
          newTotalDist <= maxDistanceKm
        ) {
          currentRoute.push(order);
          currentDistance = newTotalDist;
        } else {
          routes.push({ orders: currentRoute, totalDistance: currentDistance });
          currentRoute = [order];
          currentDistance = order.distance * 2;
        }
      }
    }

    if (currentRoute.length > 0) {
      routes.push({ orders: currentRoute, totalDistance: currentDistance });
    }

    // Merge small routes
    return mergeSmallRoutes(routes, maxDistanceKm);
  }

  /**
   * Optimize route from custom depot
   */
  private optimizeRouteFromDepot(
    route: ProvisionalRoute,
    startTimeMs: number,
    depotLat: number,
    depotLng: number
  ): { optimizedOrders: OrderWithMetadata[]; totalDistanceKm: number } {
    if (route.orders.length <= 2) {
      const totalDist = route.orders.reduce((sum, o, i) => {
        const prev = i === 0 ? { lat: depotLat, lng: depotLng } : route.orders[i - 1];
        return sum + calculateHaversineDistance(prev, o);
      }, 0) + calculateHaversineDistance(route.orders[route.orders.length - 1], { lat: depotLat, lng: depotLng });
      return { optimizedOrders: route.orders, totalDistanceKm: totalDist };
    }

    // Nearest neighbor from depot
    const remaining = [...route.orders];
    const optimized: OrderWithMetadata[] = [];
    let current = { lat: depotLat, lng: depotLng };

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = calculateHaversineDistance(current, remaining[i]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      optimized.push(remaining[nearestIdx]);
      current = remaining[nearestIdx];
      remaining.splice(nearestIdx, 1);
    }

    // 2-opt optimization
    const finalPath = twoOptOptimization(optimized, TWO_OPT_MAX_ITERATIONS, startTimeMs);

    // Calculate total distance
    let totalDist = calculateHaversineDistance({ lat: depotLat, lng: depotLng }, finalPath[0]);
    for (let i = 1; i < finalPath.length; i++) {
      totalDist += calculateHaversineDistance(finalPath[i - 1], finalPath[i]);
    }
    totalDist += calculateHaversineDistance(finalPath[finalPath.length - 1], { lat: depotLat, lng: depotLng });

    return { optimizedOrders: finalPath, totalDistanceKm: totalDist };
  }
}

// Export singleton instance
export const cvrpRouteAssignmentService = new CVRPRouteAssignmentService();
