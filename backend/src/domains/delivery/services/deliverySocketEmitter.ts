import { v4 as uuidv4 } from "uuid";
import { Server } from "socket.io";
import { logger } from "../../../utils/logger";
import { Order } from "../../../models/Order";
import { DeliverySocketEvent } from "../../../models/DeliverySocketEvent";
import {
  computeAllowedActions,
  ComputeAllowedActionsOptions,
  DeliveryAction,
} from "../utils/allowedActions";

// ---------------------------------------------------------------------------
// Payload interfaces
// ---------------------------------------------------------------------------

export interface StatusChangedPayload {
  orderId: string;
  orderStatus: string;
  deliveryStatus: string;
  previousStatus: string;
  allowedActions: DeliveryAction[];
  riderId: string;
  version: number;
  eventId: string;
  timestamp: string;
  arrivedAt?: string | null; // P1 FIX #5: Include arrivedAt for COD/OTP UI rendering
}

export interface AssignedPayload {
  [key: string]: any;
  allowedActions: DeliveryAction[];
  eventId: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// SocketMetrics counters module
// ---------------------------------------------------------------------------

interface SocketMetricsCounters {
  // Per-minute counters (reset every 60 s)
  eventsEmittedPerMin: number;
  eventsDroppedThrottlePerMin: number;
  syncRequestsPerMin: number;
  ackRetriesPerMin: number;
  // Cumulative counters (never reset)
  totalEventsEmitted: number;
  totalSyncRequests: number;
  totalAckFailures: number;
}

const _metrics: SocketMetricsCounters = {
  eventsEmittedPerMin: 0,
  eventsDroppedThrottlePerMin: 0,
  syncRequestsPerMin: 0,
  ackRetriesPerMin: 0,
  totalEventsEmitted: 0,
  totalSyncRequests: 0,
  totalAckFailures: 0,
};

// Reset per-minute counters every 60 seconds
const _metricsResetInterval = setInterval(() => {
  _metrics.eventsEmittedPerMin = 0;
  _metrics.eventsDroppedThrottlePerMin = 0;
  _metrics.syncRequestsPerMin = 0;
  _metrics.ackRetriesPerMin = 0;
}, 60_000);

// Allow tests / graceful shutdown to clear the interval
_metricsResetInterval.unref?.();

export const socketMetrics: Readonly<SocketMetricsCounters> = _metrics;

// ---------------------------------------------------------------------------
// emitWithRetry helper
// ---------------------------------------------------------------------------

/**
 * Emit an event to a room with ACK-based retry (up to maxRetries attempts).
 * Uses exponential backoff: first retry after 1 s, second after 3 s, third after 5 s.
 * After maxRetries failed ACKs, logs warn and increments totalAckFailures.
 * Increments ackRetriesPerMin on each retry attempt.
 * Requirements: 6.7, 6.8
 */
export async function emitWithRetry(
  io: Server,
  room: string,
  eventName: string,
  payload: object,
  maxRetries = 3
): Promise<void> {
  const delays = [1000, 3000, 5000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const acked = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      io.to(room)
        .timeout(5000)
        .emit(eventName, payload, (err: any) => {
          clearTimeout(timeout);
          resolve(!err);
        });
    });

    if (acked) return;

    if (attempt < maxRetries) {
      _metrics.ackRetriesPerMin++;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    } else {
      _metrics.totalAckFailures++;
      logger.warn("[Socket] emitWithRetry: max retries reached", {
        room,
        eventName,
        orderId: (payload as any).orderId,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// DeliverySocketEmitter
// ---------------------------------------------------------------------------

export class DeliverySocketEmitter {
  constructor(private io: Server) {}

  /**
   * Emit `order:status:changed` to all three rooms simultaneously.
   *
   * 1. Atomically increments `socketVersion` on the Order document.
   * 2. Computes `allowedActions` via `computeAllowedActions`.
   * 3. Builds payload with `eventId` (UUID v4) and ISO timestamp.
   * 4. Emits to `delivery:{deliveryBoyId}`, `admin_room`, and `order:{userId}`.
   *    Rooms with null IDs are skipped with a `warn` log.
   * 5. Persists to `DeliverySocketEvent` asynchronously (fire-and-forget).
   * 6. Logs at `info` level.
   */
  async emitStatusChanged(params: {
    order: any;
    previousStatus: string;
    options: ComputeAllowedActionsOptions;
  }): Promise<void> {
    const { order, previousStatus, options } = params;

    // 1. Atomically increment socketVersion
    const updated = await Order.findByIdAndUpdate(
      order._id,
      { $inc: { socketVersion: 1 } },
      { new: true, select: "socketVersion" }
    ).lean();
    const version = (updated as any)?.socketVersion ?? 1;

    // 2. Compute allowedActions
    const allowedActions = computeAllowedActions(order, options);

    // 3. Build payload
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
    const orderId = String(order._id);
    const riderId = order.deliveryBoyId ? String(order.deliveryBoyId) : "";

    const payload: StatusChangedPayload = {
      orderId,
      orderStatus: String(order.orderStatus ?? ""),
      deliveryStatus: String(order.deliveryStatus ?? ""),
      previousStatus,
      allowedActions,
      riderId,
      version,
      eventId,
      timestamp,
      // P1 FIX #5: Include arrivedAt so mobile can render COD/OTP buttons correctly
      arrivedAt: order.arrivedAt ? new Date(order.arrivedAt).toISOString() : null,
    };

    // 4. Determine rooms, skipping nulls
    const rooms: string[] = [];

    // P0 FIX #2: Use deliveryPartnerId (User._id) for room name, matching mobile's delivery:${userId}
    const riderUserId = order.deliveryPartnerId ? String(order.deliveryPartnerId) : null;
    if (riderUserId) {
      rooms.push(`delivery:${riderUserId}`);
    } else {
      logger.warn("[DeliverySocketEmitter] emitStatusChanged: deliveryPartnerId is null, skipping delivery room", {
        orderId,
      });
    }

    rooms.push("admin_room");

    if (order.userId) {
      rooms.push(`order:${String(order.userId)}`);
    } else {
      logger.warn("[DeliverySocketEmitter] emitStatusChanged: userId is null, skipping order room", {
        orderId,
      });
    }

    // Emit to all rooms simultaneously
    for (const room of rooms) {
      this.io.to(room).emit("order:status:changed", payload);
    }

    // Update metrics
    _metrics.eventsEmittedPerMin++;
    _metrics.totalEventsEmitted++;

    // 5. Persist asynchronously (fire-and-forget)
    if (order.deliveryBoyId) {
      DeliverySocketEvent.create({
        orderId: order._id,
        riderId: order.deliveryBoyId,
        eventName: "order:status:changed",
        payload: {
          orderId,
          orderStatus: payload.orderStatus,
          deliveryStatus: payload.deliveryStatus,
          allowedActions: allowedActions as string[],
          version,
          eventId,
          timestamp,
        },
        timestamp: new Date(timestamp),
      }).catch((err: any) => {
        logger.error("[DeliverySocketEmitter] Failed to persist DeliverySocketEvent", {
          orderId,
          error: err?.message,
        });
      });
    }

    // 6. Log at info level
    logger.info("[DeliverySocketEmitter] emitStatusChanged", {
      eventName: "order:status:changed",
      rooms,
      orderId,
      riderId,
      timestamp,
    });
  }

  /**
   * Emit `order:assigned` to `delivery:{riderId}` and `admin_room`.
   * Uses `emitWithRetry` for reliable delivery to the rider room.
   */
  async emitOrderAssigned(params: {
    order: any;
    options: ComputeAllowedActionsOptions;
  }): Promise<void> {
    const { order, options } = params;

    // Increment socketVersion so the version field is set from the moment of
    // assignment. Without this, the first order:status:changed event (version=1)
    // would be compared against undefined (treated as 0) — which works, but
    // setting it here makes the version sequence consistent from the start.
    const updated = await Order.findByIdAndUpdate(
      order._id,
      { $inc: { socketVersion: 1 } },
      { new: true, select: "socketVersion" }
    ).lean();
    const version = (updated as any)?.socketVersion ?? 1;

    const allowedActions = computeAllowedActions(order, options);
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    const payload: AssignedPayload = {
      ...order,
      allowedActions,
      eventId,
      timestamp,
      version,
    };

    // P0 FIX #2: Use deliveryPartnerId (User._id) for room name, matching mobile's delivery:${userId}
    const riderId = order.deliveryPartnerId ? String(order.deliveryPartnerId) : null;

    if (riderId) {
      await emitWithRetry(this.io, `delivery:${riderId}`, "order:assigned", payload);
    } else {
      logger.warn("[DeliverySocketEmitter] emitOrderAssigned: riderId (deliveryPartnerId) is null, skipping delivery room", {
        orderId: String(order._id),
      });
    }

    this.io.to("admin_room").emit("order:assigned", payload);

    // Also emit to the customer's order room so tracking screens update
    if (order.userId) {
      this.io.to(`order:${String(order.userId)}`).emit("order:assigned", payload);
    }

    _metrics.eventsEmittedPerMin++;
    _metrics.totalEventsEmitted++;

    logger.info("[DeliverySocketEmitter] emitOrderAssigned", {
      eventName: "order:assigned",
      rooms: riderId
        ? [`delivery:${riderId}`, "admin_room"]
        : ["admin_room"],
      orderId: String(order._id),
      riderId,
      timestamp,
    });
  }

  /**
   * Emit `order:cancelled` to `delivery:{riderId}` and `admin_room`.
   */
  async emitOrderCancelled(params: {
    orderId: string;
    riderId: string | null;
    reason?: string;
  }): Promise<void> {
    const { orderId, riderId, reason } = params;
    const timestamp = new Date().toISOString();
    const payload = { orderId, reason, timestamp };

    const rooms: string[] = [];

    if (riderId) {
      rooms.push(`delivery:${riderId}`);
    } else {
      logger.warn("[DeliverySocketEmitter] emitOrderCancelled: riderId is null, skipping delivery room", {
        orderId,
      });
    }

    rooms.push("admin_room");

    for (const room of rooms) {
      this.io.to(room).emit("order:cancelled", payload);
    }

    _metrics.eventsEmittedPerMin++;
    _metrics.totalEventsEmitted++;

    logger.info("[DeliverySocketEmitter] emitOrderCancelled", {
      eventName: "order:cancelled",
      rooms,
      orderId,
      riderId,
      timestamp,
    });
  }

  /**
   * Emit `order:reassigned` to the OLD rider's room.
   */
  async emitOrderReassigned(params: {
    orderId: string;
    oldRiderId: string;
    newRiderId: string;
  }): Promise<void> {
    const { orderId, oldRiderId, newRiderId } = params;
    const timestamp = new Date().toISOString();
    const payload = { orderId, oldRiderId, newRiderId, timestamp };

    const room = `delivery:${oldRiderId}`;
    this.io.to(room).emit("order:reassigned", payload);

    _metrics.eventsEmittedPerMin++;
    _metrics.totalEventsEmitted++;

    logger.info("[DeliverySocketEmitter] emitOrderReassigned", {
      eventName: "order:reassigned",
      rooms: [room],
      orderId,
      riderId: oldRiderId,
      timestamp,
    });
  }
}
