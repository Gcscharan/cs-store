/**
 * Route Auto Scheduler
 * 
 * Debounced auto-compute trigger for route clustering.
 * Schedules route recomputation when:
 * - New orders are packed
 * - Orders are cancelled
 * - Routes need rebalancing
 * 
 * Uses configurable debounce to batch multiple triggers into a single computation.
 */

import { logger } from '../utils/logger';
import { Order } from '../models/Order';
import { Route as PersistedRoute } from '../models/Route';
import { cvrpRouteAssignmentService, OrderInput, VehicleInput } from './cvrpRouteAssignmentService';

let pendingRecompute = false;
let recomputeTimer: NodeJS.Timeout | null = null;
let lastComputedAt: Date | null = null;

const DEBOUNCE_MS = parseInt(process.env.ROUTE_RECOMPUTE_DEBOUNCE_MS || '300000'); // 5 min default

export interface RecomputeResult {
  success: boolean;
  routeCount: number;
  orderCount: number;
  computationTimeMs: number;
  error?: string;
}

/**
 * Schedule a debounced route recompute
 * Multiple calls within DEBOUNCE_MS will be batched into a single computation
 */
export function scheduleRouteRecompute(reason: string): void {
  if (pendingRecompute) {
    logger.info(`[RouteAutoScheduler] Recompute already scheduled, reason: ${reason}`);
    return;
  }

  pendingRecompute = true;
  logger.info(`[RouteAutoScheduler] Route recompute scheduled: ${reason}, will run in ${DEBOUNCE_MS / 1000}s`);

  recomputeTimer = setTimeout(async () => {
    try {
      pendingRecompute = false;
      const result = await computeAndPersistRoutes();
      lastComputedAt = new Date();
      logger.info(`[RouteAutoScheduler] Auto route recompute complete: ${result.routeCount} routes, ${result.orderCount} orders`);
    } catch (err: any) {
      logger.error('[RouteAutoScheduler] Auto route recompute failed:', err);
      pendingRecompute = false;
    }
  }, DEBOUNCE_MS);
}

/**
 * Cancel any scheduled recompute
 */
export function cancelScheduledRecompute(): void {
  if (recomputeTimer) {
    clearTimeout(recomputeTimer);
    recomputeTimer = null;
    pendingRecompute = false;
    logger.info('[RouteAutoScheduler] Scheduled recompute cancelled');
  }
}

/**
 * Check if a recompute is pending
 */
export function isRecomputePending(): boolean {
  return pendingRecompute;
}

/**
 * Get the time of last successful computation
 */
export function getLastComputedAt(): Date | null {
  return lastComputedAt;
}

/**
 * Get the scheduled recompute time (if pending)
 */
export function getNextScheduledRecompute(): Date | null {
  if (!pendingRecompute || !recomputeTimer) return null;
  return new Date(Date.now() + DEBOUNCE_MS);
}

/**
 * Main computation function - fetches eligible orders and runs CVRP
 * Creates routes in CREATED status (awaiting admin assignment)
 */
export async function computeAndPersistRoutes(): Promise<RecomputeResult> {
  const startTime = Date.now();

  try {
    // 1. Find orders in active routes (ASSIGNED, IN_PROGRESS) to exclude
    const activeRouteOrderIds = await PersistedRoute.find({
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
    })
      .select('orderIds')
      .lean();

    const excludedOrderIds = new Set<string>();
    for (const route of activeRouteOrderIds) {
      for (const oid of route.orderIds || []) {
        excludedOrderIds.add(String(oid));
      }
    }

    // 2. Fetch eligible PACKED orders
    const orders = await Order.find({
      orderStatus: { $in: ['PACKED', 'packed'] },
    }).lean();

    // Filter out orders in active routes
    const eligibleOrders = orders.filter(
      (order: any) => !excludedOrderIds.has(String(order._id))
    );

    if (eligibleOrders.length === 0) {
      return {
        success: true,
        routeCount: 0,
        orderCount: 0,
        computationTimeMs: Date.now() - startTime,
      };
    }

    logger.info(`[RouteAutoScheduler] Found ${eligibleOrders.length} eligible orders for routing`);

    // 3. Transform to CVRP input
    const orderInputs: OrderInput[] = [];
    for (const order of eligibleOrders) {
      const latRaw = order?.address?.lat;
      const lngRaw = order?.address?.lng;

      if (latRaw === null || latRaw === undefined || lngRaw === null || lngRaw === undefined) {
        logger.warn(`[RouteAutoScheduler] Order ${order._id} missing coordinates, skipping`);
        continue;
      }

      orderInputs.push({
        orderId: String(order._id),
        lat: Number(latRaw),
        lng: Number(lngRaw),
        pincode: order.address?.pincode,
        locality: order.address?.city || order.address?.admin_district,
      });
    }

    if (orderInputs.length === 0) {
      return {
        success: true,
        routeCount: 0,
        orderCount: 0,
        computationTimeMs: Date.now() - startTime,
      };
    }

    // 4. Run CVRP
    const vehicleInput: VehicleInput = { type: 'AUTO' };
    const result = cvrpRouteAssignmentService.computeRoutes(orderInputs, vehicleInput);

    // 5. Persist routes (in CREATED status)
    const routeDocs = [];
    for (const route of result.routes) {
      const routeDoc = new PersistedRoute({
        routeId: route.routeId,
        orderIds: route.orders.map((id: string) => id),
        routePath: route.routePath,
        vehicleType: 'AUTO',
        totalDistanceKm: route.totalDistanceKm,
        estimatedTimeMin: route.estimatedTimeMin,
        status: 'CREATED',
        deliveryBoyId: null,
        deliveredCount: 0,
        failedCount: 0,
        computedAt: new Date(),
      });
      routeDocs.push(routeDoc);
    }

    // Delete old CREATED routes (not yet assigned) before creating new ones
    await PersistedRoute.deleteMany({ status: 'CREATED' });

    // Save new routes
    if (routeDocs.length > 0) {
      await PersistedRoute.insertMany(routeDocs);
    }

    return {
      success: true,
      routeCount: result.routes.length,
      orderCount: result.metadata.totalOrders,
      computationTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    logger.error('[RouteAutoScheduler] computeAndPersistRoutes failed:', error);
    return {
      success: false,
      routeCount: 0,
      orderCount: 0,
      computationTimeMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Force immediate recompute (bypasses debounce)
 */
export async function forceRecomputeNow(): Promise<RecomputeResult> {
  cancelScheduledRecompute();
  return computeAndPersistRoutes();
}

export default {
  scheduleRouteRecompute,
  cancelScheduledRecompute,
  isRecomputePending,
  getLastComputedAt,
  getNextScheduledRecompute,
  computeAndPersistRoutes,
  forceRecomputeNow,
};
