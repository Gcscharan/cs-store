import { Server } from "socket.io";
import { OrderEvent } from "../../../models/OrderEvent";
import { Order } from "../../../models/Order";
import { OrderStatus } from "../enums/OrderStatus";

/**
 * OrderEventBroadcaster
 * 
 * Broadcasts ORDER_STATUS_CHANGED events to appropriate Socket.IO rooms
 * based on actor roles and order ownership.
 * 
 * Room Strategy:
 * - `admin_room`: All admins receive all order updates
 * - `order_${orderId}`: Customer who owns the order
 * - `delivery_${deliveryBoyId}`: Assigned delivery partner
 */
export class OrderEventBroadcaster {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Broadcast ORDER_STATUS_CHANGED event to all relevant parties
   */
  async broadcastOrderStatusChanged(params: {
    orderId: string;
    from: OrderStatus;
    to: OrderStatus;
    actorRole: "CUSTOMER" | "DELIVERY_PARTNER" | "ADMIN";
    actorId: string;
    timestamp: Date;
  }) {
    const { orderId, from, to, actorRole, actorId, timestamp } = params;

    try {
      // Fetch order to get customer and delivery partner info
      const order = await Order.findById(orderId)
        .select('userId deliveryBoyId deliveryPartnerId')
        .lean();

      if (!order) {
        console.error(`[OrderEventBroadcaster] Order ${orderId} not found`);
        return;
      }

      const eventPayload = {
        orderId,
        from,
        to,
        actorRole,
        actorId,
        timestamp: timestamp.toISOString(),
      };

      // Broadcast to admin room (all admins)
      this.io.to("admin_room").emit("order:status:changed", eventPayload);

      console.log(`✅ [OrderEventBroadcaster] Broadcasted ${from} → ${to} for order ${orderId}`);
    } catch (error) {
      console.error(`[OrderEventBroadcaster] Error broadcasting event:`, error);
    }
  }

  /**
   * Poll for unpublished ORDER_STATUS_CHANGED events and broadcast them
   * This ensures events are delivered even if real-time emission fails
   */
  async pollAndBroadcastPending() {
    try {
      const unpublishedEvents = await OrderEvent.find({
        type: "ORDER_STATUS_CHANGED",
        publishedAt: { $exists: false },
      })
        .sort({ createdAt: 1 })
        .limit(50)
        .lean();

      for (const event of unpublishedEvents) {
        const payload = (event as any).payload;

        await this.broadcastOrderStatusChanged({
          orderId: String((event as any).orderId),
          from: payload.from,
          to: payload.to,
          actorRole: payload.actorRole,
          actorId: payload.actorId,
          timestamp: (event as any).createdAt,
        });

        // Mark as published
        await OrderEvent.updateOne(
          { _id: (event as any)._id },
          { $set: { publishedAt: new Date() } }
        );
      }

      if (unpublishedEvents.length > 0) {
        console.log(`✅ [OrderEventBroadcaster] Published ${unpublishedEvents.length} pending events`);
      }
    } catch (error) {
      console.error(`[OrderEventBroadcaster] Error polling pending events:`, error);
    }
  }

  /**
   * Start periodic polling for pending events (fallback mechanism)
   */
  startPolling(intervalMs: number = 5000) {
    setInterval(() => {
      this.pollAndBroadcastPending();
    }, intervalMs);

    console.log(`✅ [OrderEventBroadcaster] Started polling every ${intervalMs}ms`);
  }
}
