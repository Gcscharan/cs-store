/**
 * Route Assignment Service — Single-Cluster Mode
 *
 * Simplified routing for single-driver delivery.
 * All orders → ONE route → assigned to ONE delivery boy.
 *
 * Pipeline:
 *   All Orders → Nearest Neighbor → 2-opt → Quality Check
 *
 * No clustering, no splitting — admin assigns the full route to one driver.
 *
 * @module cvrpRouteAssignmentService
 */

import { calculateHaversineDistance } from "../utils/routeUtils";
import { logger } from "../utils/logger";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const WAREHOUSE_DEPOT = {
  lat: parseFloat(process.env.WAREHOUSE_LAT || '17.094'),
  lng: parseFloat(process.env.WAREHOUSE_LNG || '80.598'),
  pincode: parseInt(process.env.WAREHOUSE_PINCODE || '521235'),
};

const VEHICLE_TYPE_REQUIRED = "AUTO";
const AVG_AUTO_SPEED_KMH = parseFloat(process.env.ROUTE_AVG_SPEED_KMH || '30');
const STOP_TIME_PER_ORDER_MIN = parseFloat(process.env.ROUTE_STOP_TIME_MIN || '5');
const MAX_COMPUTE_MS = parseInt(process.env.ROUTE_MAX_COMPUTE_MS || '8000');
const TWO_OPT_MAX_ITERATIONS = parseInt(process.env.ROUTE_TWO_OPT_ITERATIONS || '80');

// Soft limits — log warnings but don't split
const SOFT_LIMIT_DISTANCE_KM = 60;
const SOFT_LIMIT_ORDER_COUNT = 40;

// Capacity / distance bounds (recovered from prior implementation). Used by the
// legacy multi-cluster helpers below; the live single-cluster pipeline ignores
// capacity but these are required for the deprecated/script code paths to compile.
const AUTO_CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
const AUTO_CAPACITY_MAX = parseInt(process.env.ROUTE_CAPACITY_MAX || '30');
const MAX_AUTO_ROUTE_DISTANCE_KM = parseFloat(process.env.ROUTE_MAX_DISTANCE_KM || '35');
const LOCALITY_RADIUS_KM = parseFloat(process.env.ROUTE_LOCALITY_RADIUS_KM || '0.5');
const CLUSTER_RADIUS_KM = parseFloat(process.env.ROUTE_CLUSTER_RADIUS_KM || '3');
const QUALITY_AVG_DIST_THRESHOLD_KM = parseFloat(process.env.ROUTE_QUALITY_AVG_DIST_KM || '5');

export const PREVIEW_CAPACITY = 1; // not used anymore, kept for API compat
export const PREVIEW_MAX_DISTANCE_KM = 999999; // not used anymore

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
// LAYER 1: GREEDY DISTANCE-BASED CLUSTERING
// (Replaces Angular Sweep — produces tight geographic clusters)
//
// Algorithm:
//   1. Sort all orders by distance from warehouse (deterministic seed order)
//   2. Pick the nearest unassigned order as cluster seed
//   3. Greedily add nearest orders to the cluster while:
//      - cluster size < maxOrders
//      - order is within CLUSTER_RADIUS_KM of cluster centroid
//   4. Repeat until all orders are assigned
//
// Result: Each cluster is a tight geographic group, not a directional sweep.
// ============================================================================

function computeGreedyClusters(
  orders: OrderInput[],
  maxOrders: number,
  maxDistanceKm: number
): OrderWithMetadata[][] {
  // Attach haversine distance from warehouse to each order
  const withMeta: OrderWithMetadata[] = orders.map((o) => ({
    ...o,
    angle: 0, // unused in greedy mode
    distance: calculateHaversineDistance(WAREHOUSE_DEPOT, { lat: o.lat, lng: o.lng }),
  }));

  // Deterministic seed order: nearest to warehouse first, then by orderId
  withMeta.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) > 0.001) return a.distance - b.distance;
    return a.orderId.localeCompare(b.orderId);
  });

  const unassigned = new Set<OrderWithMetadata>(withMeta);
  const clusters: OrderWithMetadata[][] = [];

  while (unassigned.size > 0) {
    // Seed: pick the nearest unassigned order to warehouse
    const seed = Array.from(unassigned).reduce((best, o) =>
      o.distance < best.distance ? o : best
    );

    const cluster: OrderWithMetadata[] = [seed];
    unassigned.delete(seed);

    // Grow cluster: add nearest orders within radius and capacity
    while (cluster.length < maxOrders && unassigned.size > 0) {
      // Compute current centroid
      const centroid = {
        lat: cluster.reduce((s, o) => s + o.lat, 0) / cluster.length,
        lng: cluster.reduce((s, o) => s + o.lng, 0) / cluster.length,
      };

      // Find nearest unassigned order to centroid within radius
      let bestOrder: OrderWithMetadata | null = null;
      let bestDist = Infinity;

      for (const candidate of unassigned) {
        const d = calculateHaversineDistance(centroid, { lat: candidate.lat, lng: candidate.lng });
        if (d <= CLUSTER_RADIUS_KM && d < bestDist) {
          bestDist = d;
          bestOrder = candidate;
        }
      }

      if (!bestOrder) break; // No more orders within radius

      // Check if adding this order would exceed max route distance
      // Estimate: current route distance + distance from last order to candidate
      const lastOrder = cluster[cluster.length - 1];
      const addedDist = calculateHaversineDistance(
        { lat: lastOrder.lat, lng: lastOrder.lng },
        { lat: bestOrder.lat, lng: bestOrder.lng }
      );
      const estimatedNewDist = cluster.reduce((sum, o, i) => {
        if (i === 0) return sum + o.distance;
        return sum + calculateHaversineDistance(
          { lat: cluster[i - 1].lat, lng: cluster[i - 1].lng },
          { lat: o.lat, lng: o.lng }
        );
      }, 0) + addedDist;

      if (estimatedNewDist > maxDistanceKm) break;

      cluster.push(bestOrder);
      unassigned.delete(bestOrder);
    }

    clusters.push(cluster);
  }

  logger.info(`[CLUSTER_DISTANCE_MODE] greedy_radius | clusters=${clusters.length} | orders=${orders.length} | radius=${CLUSTER_RADIUS_KM}km`);

  return clusters;
}

/**
 * Legacy: kept for reference but no longer called in main pipeline.
 * @deprecated Use computeGreedyClusters instead.
 */
function computeAngularSweep(orders: OrderInput[]): OrderWithMetadata[] {
  const ordersWithMetadata: OrderWithMetadata[] = orders.map((order) => {
    const deltaLat = order.lat - WAREHOUSE_DEPOT.lat;
    const deltaLng = order.lng - WAREHOUSE_DEPOT.lng;
    let angle = Math.atan2(deltaLat, deltaLng);
    if (angle < 0) angle += 2 * Math.PI;
    const distance = calculateHaversineDistance(WAREHOUSE_DEPOT, { lat: order.lat, lng: order.lng });
    return { ...order, angle, distance };
  });
  ordersWithMetadata.sort((a, b) => {
    if (Math.abs(a.angle - b.angle) > 0.0001) return a.angle - b.angle;
    if (Math.abs(a.distance - b.distance) > 0.001) return a.distance - b.distance;
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
 * Phase 2 fix: Locality fixups now run AFTER 2-opt on final Route[].
 * Passes orderCoordMap so enforceLocalityConstraints has coordinate data.
 */
function applyOperationalFixups(
  routes: Route[],
  orderCoordMap: Map<string, { lat: number; lng: number }>
): Route[] {
  // Locality fix runs AFTER 2-opt (Phase 2 fix — was previously a no-op)
  const fixedRoutes = enforceLocalityConstraints(routes, orderCoordMap);

  // Quality metrics logging (Phase 4)
  logRouteQuality(fixedRoutes, orderCoordMap);

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
 * Phase 2 fix: Locality constraints now run on FINAL Route[] AFTER 2-opt.
 * Removes orders that are geographic outliers from the route centroid.
 * Requires orderCoordMap to look up coordinates by orderId.
 */
function enforceLocalityConstraints(
  routes: Route[],
  orderCoordMap?: Map<string, { lat: number; lng: number }>
): Route[] {
  if (!orderCoordMap || orderCoordMap.size === 0) return routes; // no-op if no coords

  const OUTLIER_CENTROID_THRESHOLD_KM = 10;

  return routes.map((route) => {
    const coords = route.orders
      .map((id) => orderCoordMap!.get(id))
      .filter((c): c is { lat: number; lng: number } => !!c);

    if (coords.length < 3) return route;

    const centroid = {
      lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
      lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
    };

    const filtered = route.orders.filter((id) => {
      const c = orderCoordMap!.get(id);
      if (!c) return true;
      const d = calculateHaversineDistance(centroid, c);
      if (d > OUTLIER_CENTROID_THRESHOLD_KM) {
        logger.info(`[LOCALITY_FIX] Outlier removed from ${route.routeId}: order=${id} dist=${d.toFixed(1)}km from centroid`);
        return false;
      }
      return true;
    });

    if (filtered.length === route.orders.length) return route;

    return {
      ...route,
      orders: filtered,
      orderCount: filtered.length,
      routePath: ['WAREHOUSE', ...filtered],
    };
  });
}

/**
 * Phase 4: Route quality metrics — logs and flags bad clusters.
 */
function logRouteQuality(
  routes: Route[],
  orderCoordMap: Map<string, { lat: number; lng: number }>
): void {
  for (const route of routes) {
    const coords = route.orders
      .map((id) => orderCoordMap.get(id))
      .filter((c): c is { lat: number; lng: number } => !!c);

    const avgDistPerOrder = coords.length > 0
      ? route.totalDistanceKm / coords.length
      : 0;

    let maxDistFromCentroid = 0;
    if (coords.length >= 2) {
      const centroid = {
        lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
        lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
      };
      maxDistFromCentroid = Math.max(
        ...coords.map((c) => calculateHaversineDistance(centroid, c))
      );
    }

    const isBad = avgDistPerOrder > QUALITY_AVG_DIST_THRESHOLD_KM;

    logger.info(
      `[ROUTE_QUALITY] routeId=${route.routeId} orders=${route.orderCount} ` +
      `totalDist=${route.totalDistanceKm.toFixed(1)}km ` +
      `avgPerOrder=${avgDistPerOrder.toFixed(1)}km ` +
      `spread=${maxDistFromCentroid.toFixed(1)}km ` +
      `eta=${route.estimatedTimeMin}min ` +
      `${isBad ? '⚠️ BAD_CLUSTER' : '✅ OK'}`
    );

    if (isBad) {
      logger.warn(
        `[ROUTE_QUALITY] ⚠️ Bad cluster detected: ${route.routeId} — ` +
        `avgDistPerOrder=${avgDistPerOrder.toFixed(1)}km > threshold=${QUALITY_AVG_DIST_THRESHOLD_KM}km`
      );
    }
  }
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
   * Computes a SINGLE optimized route for all orders.
   * All orders → one route → assigned to one delivery boy.
   * No clustering, no splitting.
   */
  computeRoutes(
    orders: OrderInput[],
    vehicle: VehicleInput
  ): RouteAssignmentResult {
    const startTime = Date.now();

    if (orders.length === 0) {
      return {
        warehouse: { lat: WAREHOUSE_DEPOT.lat, lng: WAREHOUSE_DEPOT.lng, pincode: WAREHOUSE_DEPOT.pincode },
        vehicleType: VEHICLE_TYPE_REQUIRED,
        routes: [],
        metadata: { totalOrders: 0, totalRoutes: 0, averageOrdersPerRoute: 0, computationTimeMs: 0 },
      };
    }

    // Validate vehicle type only — no capacity/distance hard limits
    if (vehicle.type !== VEHICLE_TYPE_REQUIRED) {
      throw new Error(`Vehicle type must be ${VEHICLE_TYPE_REQUIRED}, got ${vehicle.type}`);
    }

    for (const order of orders) {
      if (!Number.isFinite(order.lat) || !Number.isFinite(order.lng)) {
        throw new Error(`Order ${order.orderId} missing valid lat/lng coordinates`);
      }
    }

    // Attach distance from warehouse to each order
    const ordersWithMeta: OrderWithMetadata[] = orders.map(o => ({
      ...o,
      angle: 0,
      distance: calculateHaversineDistance(WAREHOUSE_DEPOT, { lat: o.lat, lng: o.lng }),
    }));

    // Single provisional route = ALL orders
    const singleRoute: ProvisionalRoute = {
      orders: ordersWithMeta,
      totalDistance: 0, // will be computed by optimizeRoute
    };

    // Nearest Neighbor + 2-opt on the single route
    const { optimizedOrders, totalDistanceKm } = optimizeRoute(singleRoute, startTime);
    const estimatedTimeMin = estimateRouteTime(totalDistanceKm, optimizedOrders.length);

    // Soft limit warnings — log but never split
    if (totalDistanceKm > SOFT_LIMIT_DISTANCE_KM || optimizedOrders.length > SOFT_LIMIT_ORDER_COUNT) {
      logger.warn(
        `[ROUTE_WARNING] large_route orders=${optimizedOrders.length} distanceKm=${totalDistanceKm.toFixed(1)}`
      );
    }

    logger.info(
      `[ORDER_SEQUENCE] path=WAREHOUSE→${optimizedOrders.map(o => o.orderId.slice(-4)).join('→')}`
    );

    const route: Route = {
      routeId: 'AUTO-R-01',
      deliveryBoyId: null,
      orderCount: optimizedOrders.length,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      estimatedTimeMin,
      orders: optimizedOrders.map(o => o.orderId),
      routePath: ['WAREHOUSE', ...optimizedOrders.map(o => o.orderId)],
      hubId: 'warehouse',
      hubName: 'Warehouse (Local)',
      tier: 'local',
      depotLat: WAREHOUSE_DEPOT.lat,
      depotLng: WAREHOUSE_DEPOT.lng,
      isOutlierRoute: false,
    };

    const computationTimeMs = Date.now() - startTime;

    return {
      warehouse: { lat: WAREHOUSE_DEPOT.lat, lng: WAREHOUSE_DEPOT.lng, pincode: WAREHOUSE_DEPOT.pincode },
      vehicleType: VEHICLE_TYPE_REQUIRED,
      routes: [route],
      metadata: {
        totalOrders: orders.length,
        totalRoutes: 1,
        averageOrdersPerRoute: orders.length,
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
