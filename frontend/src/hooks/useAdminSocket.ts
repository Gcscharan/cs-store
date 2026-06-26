/**
 * useAdminSocket — real-time socket hook for the admin dashboard.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 9c.4
 *
 * Responsibilities:
 *  - Connects to the Socket.IO server with the admin's JWT
 *  - Joins `admin_room` on connect
 *  - On reconnect: full cache invalidation (AdminOrders + AdminRiders)
 *  - Batches `order:status:changed` events with a 500 ms flush window
 *  - Deduplicates events by `eventId` (Map<eventId, processedAtMs>, 60 s TTL)
 *  - Handles `order:assigned`: full replacement in admin orders cache
 *  - Handles `driver:status:update`: updates rider availability + status
 *  - Handles `driver:location:update`: dispatches adminActions.updateRiderLocation
 *  - Returns { socketStatus: 'connected' | 'reconnecting' | 'disconnected' }
 */

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useDispatch, useSelector } from "react-redux";

import { getApiOrigin } from "../config/runtime";
import { api as adminApi } from "../store/api";
import { adminActions } from "../store/slices/adminSlice";
import type { RootState, AppDispatch } from "../store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminSocketStatus = "connected" | "reconnecting" | "disconnected";

export interface UseAdminSocketReturn {
  socketStatus: AdminSocketStatus;
}

interface StatusChangedPayload {
  orderId: string;
  orderStatus: string;
  deliveryStatus: string;
  previousStatus?: string;
  allowedActions: string[];
  riderId?: string;
  version: number;
  eventId: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCKET_URL = getApiOrigin() || "/";
const BATCH_FLUSH_MS = 500;
const DEDUP_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAdminSocket = (): UseAdminSocketReturn => {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.tokens.accessToken);
  const [socketStatus, setSocketStatus] = useState<AdminSocketStatus>("disconnected");

  useEffect(() => {
    if (!token) return;

    // --- Socket initialization ---
    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    // --- Event deduplication ---
    const processedEventIds = new Map<string, number>(); // eventId → processedAt ms

    const isEventDuplicate = (eventId: string): boolean => {
      const now = Date.now();
      // Purge entries older than 60 seconds
      for (const [id, ts] of processedEventIds) {
        if (now - ts > DEDUP_TTL_MS) processedEventIds.delete(id);
      }
      if (processedEventIds.has(eventId)) return true;
      processedEventIds.set(eventId, now);
      return false;
    };

    // --- 500 ms batch flush for order:status:changed ---
    let pendingUpdates: StatusChangedPayload[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;

    const flushBatch = () => {
      batchTimer = null;
      if (pendingUpdates.length === 0) return;
      const batch = pendingUpdates.splice(0);

      dispatch(
        adminApi.util.updateQueryData("getAdminOrders" as any, undefined, (draft: any) => {
          for (const event of batch) {
            const idx = draft?.orders?.findIndex((o: any) => o._id === event.orderId);
            if (idx !== undefined && idx !== -1) {
              const cached = draft.orders[idx];
              if (event.version > (cached.version ?? 0)) {
                cached.orderStatus = event.orderStatus;
                cached.deliveryStatus = event.deliveryStatus;
                cached.allowedActions = event.allowedActions;
                cached.version = event.version;
              }
            }
          }
        })
      );
    };

    const scheduleBatchFlush = () => {
      if (batchTimer) return;
      batchTimer = setTimeout(flushBatch, BATCH_FLUSH_MS);
    };

    // --- Connection events ---
    socket.on("connect", () => {
      setSocketStatus("connected");
      socket.emit("join_room", { room: "admin_room", token });
    });

    socket.on("reconnect_attempt", () => setSocketStatus("reconnecting"));

    socket.on("disconnect", () => setSocketStatus("disconnected"));

    socket.on("reconnect", () => {
      // Full state refresh on reconnect — no sync_request for admins
      dispatch(adminApi.util.invalidateTags(["Order", "DeliveryProfile", "Product"]));
    });

    // --- Event handlers ---
    const handleStatusChanged = (event: StatusChangedPayload) => {
      if (!event?.orderId) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;

      pendingUpdates.push(event);
      scheduleBatchFlush();
    };

    const handleOrderAssigned = (order: any) => {
      if (!order?._id) return;
      if (order.eventId && isEventDuplicate(order.eventId)) return;

      dispatch(
        adminApi.util.updateQueryData("getAdminOrders" as any, undefined, (draft: any) => {
          const idx = draft?.orders?.findIndex((o: any) => o._id === order._id);
          if (idx !== undefined && idx !== -1) {
            draft.orders[idx] = order; // full replacement
          } else {
            draft?.orders?.push(order);
          }
        })
      );
    };

    const handleDriverStatusUpdate = (data: any) => {
      if (!data?.driverId) return;

      dispatch(
        adminApi.util.updateQueryData("getAdminRiders" as any, undefined, (draft: any) => {
          const idx = draft?.riders?.findIndex((r: any) => r._id === data.driverId);
          if (idx !== undefined && idx !== -1) {
            draft.riders[idx].availability = data.availability;
            draft.riders[idx].status = data.status;
          }
        })
      );
    };

    const handleDriverLocationUpdate = (data: any) => {
      dispatch(adminActions.updateRiderLocation(data));
    };

    const handleProductCreated = (event: any) => {
      if (!event?.product?._id) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      dispatch(
        adminApi.util.updateQueryData("getAdminProducts" as any, undefined, (draft: any) => {
          const exists = draft?.products?.find((p: any) => p._id === event.product._id);
          if (!exists) draft?.products?.unshift(event.product);
        })
      );
    };

    const handleProductUpdated = (event: any) => {
      if (!event?.product?._id) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      dispatch(
        adminApi.util.updateQueryData("getAdminProducts" as any, undefined, (draft: any) => {
          const idx = draft?.products?.findIndex((p: any) => p._id === event.product._id);
          if (idx !== undefined && idx !== -1) draft.products[idx] = event.product;
        })
      );
    };

    const handleProductDeleted = (event: any) => {
      if (!event?.productId) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      dispatch(
        adminApi.util.updateQueryData("getAdminProducts" as any, undefined, (draft: any) => {
          if (draft?.products) {
            draft.products = draft.products.filter((p: any) => p._id !== event.productId);
          }
        })
      );
    };

    // --- Register listeners ---
    socket.on("order:status:changed", handleStatusChanged);
    socket.on("order:assigned", handleOrderAssigned);
    socket.on("driver:status:update", handleDriverStatusUpdate);
    socket.on("driver:location:update", handleDriverLocationUpdate);
    socket.on("product:created", handleProductCreated);
    socket.on("product:updated", handleProductUpdated);
    socket.on("product:deleted", handleProductDeleted);

    // --- Cleanup ---
    return () => {
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      socket.off("order:status:changed", handleStatusChanged);
      socket.off("order:assigned", handleOrderAssigned);
      socket.off("driver:status:update", handleDriverStatusUpdate);
      socket.off("driver:location:update", handleDriverLocationUpdate);
      socket.off("product:created", handleProductCreated);
      socket.off("product:updated", handleProductUpdated);
      socket.off("product:deleted", handleProductDeleted);
      socket.disconnect();
    };
  }, [token, dispatch]);

  return { socketStatus };
};
