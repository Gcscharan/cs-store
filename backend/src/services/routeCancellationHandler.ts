/**
 * Route Cancellation Handler
 * 
 * Handles order cancellations when orders are part of active routes.
 * Removes cancelled orders from routes and flags underloaded routes.
 * Emits socket events to notify delivery boys.
 */

import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { Route as PersistedRoute } from '../models/Route';
import { Order } from '../models/Order';
import socketService from './socketService';

const AUTO_CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');

export interface CancellationResult {
  success: boolean;
  routeId: string | null;
  remainingOrders: number;
  routeFlagged: boolean;
  error?: string;
}

/**
 * Handle an order that was cancelled while in an active route
 * 
 * @param orderId - The cancelled order ID
 * @param reason - Cancellation reason (for logging)
 * @returns Result of the cancellation handling
 */
export async function handleOrderCancelledFromRoute(
  orderId: string,
  reason?: string
): Promise<CancellationResult> {
  try {
    // Find route containing this order
    const route = await PersistedRoute.findOne({
      orderIds: new mongoose.Types.ObjectId(orderId),
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
    });

    if (!route) {
      logger.info(`[RouteCancellation] Order ${orderId} not in any active route`);
      return {
        success: true,
        routeId: null,
        remainingOrders: 0,
        routeFlagged: false,
      };
    }

    const originalCount = route.orderIds.length;

    // Remove order from route
    route.orderIds = route.orderIds.filter(
      (id) => id.toString() !== orderId
    );

    const newCount = route.orderIds.length;
    let routeFlagged = false;

    // Flag route if underloaded
    if (newCount < AUTO_CAPACITY_MIN) {
      const existingFlags: string[] = (route as any).flags || [];
      if (!existingFlags.includes('UNDERLOADED')) {
        (route as any).flags = [...existingFlags, 'UNDERLOADED'];
      }
      routeFlagged = true;
      logger.warn(
        `[RouteCancellation] Route ${route.routeId} is now underloaded (${newCount} < ${AUTO_CAPACITY_MIN})`
      );
    }

    // Update route checkpoints if they exist
    if ((route as any).checkpoints && Array.isArray((route as any).checkpoints)) {
      (route as any).checkpoints = (route as any).checkpoints.filter(
        (cp: any) => cp.orderId?.toString() !== orderId
      );
    }

    await route.save();

    logger.info(
      `[RouteCancellation] Removed order ${orderId} from route ${route.routeId}. ` +
      `Orders: ${originalCount} → ${newCount}. Reason: ${reason || 'N/A'}`
    );

    // Notify delivery boy via socket
    notifyDeliveryBoyOfRemoval(route, orderId, newCount);

    return {
      success: true,
      routeId: route.routeId,
      remainingOrders: newCount,
      routeFlagged,
    };
  } catch (error: any) {
    logger.error(`[RouteCancellation] Failed to handle cancelled order ${orderId}:`, error);
    return {
      success: false,
      routeId: null,
      remainingOrders: 0,
      routeFlagged: false,
      error: error.message,
    };
  }
}

/**
 * Handle multiple order cancellations at once
 */
export async function handleBatchOrderCancellations(
  orderIds: string[],
  reason?: string
): Promise<CancellationResult[]> {
  const results: CancellationResult[] = [];

  for (const orderId of orderIds) {
    const result = await handleOrderCancelledFromRoute(orderId, reason);
    results.push(result);
  }

  return results;
}

/**
 * Check if a route needs rebalancing after cancellations
 */
export async function checkRouteNeedsRebalancing(routeId: string): Promise<{
  needsRebalancing: boolean;
  currentOrderCount: number;
  minCapacity: number;
}> {
  const route = await PersistedRoute.findOne({ routeId }).lean();

  if (!route) {
    return {
      needsRebalancing: false,
      currentOrderCount: 0,
      minCapacity: AUTO_CAPACITY_MIN,
    };
  }

  const currentCount = route.orderIds?.length || 0;
  const flags: string[] = (route as any).flags || [];

  return {
    needsRebalancing: flags.includes('UNDERLOADED') || currentCount < AUTO_CAPACITY_MIN,
    currentOrderCount: currentCount,
    minCapacity: AUTO_CAPACITY_MIN,
  };
}

/**
 * Get all routes that are flagged as underloaded
 */
export async function getUnderloadedRoutes(): Promise<any[]> {
  const routes = await PersistedRoute.find({
    status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'CREATED'] },
    $or: [
      { flags: 'UNDERLOADED' },
      { orderIds: { $exists: true, $not: { $size: { $gte: AUTO_CAPACITY_MIN } } } },
    ],
  }).lean();

  return routes.filter((r) => (r.orderIds?.length || 0) < AUTO_CAPACITY_MIN);
}

/**
 * Notify delivery boy about order removal via socket
 */
function notifyDeliveryBoyOfRemoval(
  route: any,
  orderId: string,
  remainingOrders: number
): void {
  try {
    // Socket service is a singleton, get the IO instance from it
    const io = (socketService as any).io;
    if (!io) {
      logger.warn('[RouteCancellation] Socket IO not initialized');
      return;
    }

    const deliveryBoyId = route.deliveryBoyId;
    if (!deliveryBoyId) {
      logger.debug('[RouteCancellation] No delivery boy assigned to route');
      return;
    }

    // Emit to delivery boy's room (standardized format)
    io.to(`delivery:${deliveryBoyId}`).emit('route:order:removed', {
      routeId: route.routeId,
      orderId,
      remainingOrders,
      message: "Order removed from your route",
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `[RouteCancellation] Notified delivery boy ${deliveryBoyId} about order ${orderId} removal`
    );
  } catch (error: any) {
    logger.error('[RouteCancellation] Failed to notify delivery boy:', error);
  }
}

/**
 * Log cancellation with reason for audit
 */
export async function logCancellationAudit(
  orderId: string,
  routeId: string | null,
  reason: string,
  actorId: string,
  actorRole: string
): Promise<void> {
  logger.info(
    `[RouteCancellationAudit] Order: ${orderId}, Route: ${routeId || 'N/A'}, ` +
    `Reason: ${reason}, Actor: ${actorId} (${actorRole})`
  );

  // In production, this would write to an audit collection
  // For now, structured logging is sufficient
}

export default {
  handleOrderCancelledFromRoute,
  handleBatchOrderCancellations,
  checkRouteNeedsRebalancing,
  getUnderloadedRoutes,
  logCancellationAudit,
};
