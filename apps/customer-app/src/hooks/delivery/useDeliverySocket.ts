import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootState, AppDispatch } from '../../store';
import { deliveryApi } from '../../api/deliveryApi';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5002';
const LAST_EVENT_TS_KEY = 'delivery_socket_last_event_ts';

export type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface UseDeliverySocketReturn {
  socketStatus: SocketStatus;
}

export interface StatusChangedPayload {
  orderId: string;
  orderStatus: string;
  deliveryStatus: string;
  previousStatus: string;
  allowedActions: string[];
  riderId: string;
  version: number;
  eventId: string;
  timestamp: string;
}

export const useDeliverySocket = (): UseDeliverySocketReturn => {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.accessToken);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');

  useEffect(() => {
    if (!token || !userId) return;

    // --- Socket initialization ---
    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    // --- State tracking ---
    let disconnectedAt: number | null = null;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let backgroundAt: number | null = null;
    const processedEventIds = new Map<string, number>(); // eventId → processedAt ms

    // Periodic purge of the dedup map — prevents unbounded growth even when
    // events are infrequent (e.g. idle rider with no orders for hours)
    const dedupPurgeInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, ts] of processedEventIds) {
        if (now - ts > 60_000) processedEventIds.delete(id);
      }
    }, 60_000);

    // --- Helpers ---
    const isEventDuplicate = (eventId: string): boolean => {
      const now = Date.now();
      // Purge entries older than 60 seconds
      for (const [id, ts] of processedEventIds) {
        if (now - ts > 60_000) processedEventIds.delete(id);
      }
      if (processedEventIds.has(eventId)) return true;
      processedEventIds.set(eventId, now);
      return false;
    };

    const startPolling = () => {
      if (pollingInterval) return;
      pollingInterval = setInterval(() => {
        dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders']));
      }, 30_000);
    };

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const emitSyncRequest = async () => {
      try {
        const lastTs = await AsyncStorage.getItem(LAST_EVENT_TS_KEY);
        socket.emit('sync_request', {
          lastEventTimestamp: lastTs ?? new Date(0).toISOString(),
        });
      } catch {
        // AsyncStorage read failed — use epoch as fallback
        socket.emit('sync_request', {
          lastEventTimestamp: new Date(0).toISOString(),
        });
      }
    };

    const persistLastEventTs = (timestamp: string) => {
      AsyncStorage.setItem(LAST_EVENT_TS_KEY, timestamp).catch(() => {});
    };

    // --- Connection events ---
    socket.on('connect', async () => {
      setSocketStatus('connected');
      stopPolling();

      // Join personal delivery room
      socket.emit('join_room', { room: `delivery:${userId}`, token });

      // Sync if we were disconnected
      if (disconnectedAt !== null) {
        const disconnectedForMs = Date.now() - disconnectedAt;
        disconnectedAt = null;

        if (disconnectedForMs > 60_000) {
          // Extended outage: full cache invalidation
          dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders']));
        } else if (disconnectedForMs > 5_000) {
          // Short outage: sync missed events with jitter to avoid reconnect storm
          // (1000 riders reconnecting simultaneously → staggered over 2 seconds)
          const jitterMs = Math.random() * 2000;
          await new Promise(r => setTimeout(r, jitterMs));
          await emitSyncRequest();
        }
      }
    });

    socket.on('reconnect_attempt', () => setSocketStatus('reconnecting'));

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
      disconnectedAt = Date.now();
      startPolling();
    });

    // --- Event handlers ---
    const handleOrderAssigned = (order: any) => {
      if (!order?._id) {
        // Defensive fallback: old-format payload only has orderId, not _id.
        // Trigger a full cache refresh so the rider still sees the new order.
        if (order?.orderId) {
          dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders']));
        }
        return;
      }
      if (order.eventId && isEventDuplicate(order.eventId)) return;
      if (order.timestamp) persistLastEventTs(order.timestamp);

      dispatch(
        deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          const idx = draft?.orders?.findIndex((o: any) => o._id === order._id);
          if (idx !== undefined && idx !== -1) {
            draft.orders[idx] = order; // full replacement
          } else {
            draft?.orders?.push(order);
          }
        })
      );
    };

    const handleNewOrder = (order: any, ack?: () => void) => {
      if (!order?._id) return;
      if (order.eventId && isEventDuplicate(order.eventId)) {
        ack?.();
        return;
      }
      if (order.timestamp) persistLastEventTs(order.timestamp);

      dispatch(
        deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          if (!draft?.orders?.find((o: any) => o._id === order._id)) {
            draft?.orders?.push(order);
          }
        })
      );
      ack?.();
    };

    const handleStatusChanged = (event: StatusChangedPayload) => {
      if (!event?.orderId) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      if (event.timestamp) persistLastEventTs(event.timestamp);

      let unknownOrder = false;

      try {
        dispatch(
          deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
            const idx = draft?.orders?.findIndex((o: any) => o._id === event.orderId);
            if (idx === undefined || idx === -1) {
              // Unknown order — flag for targeted refetch outside immer
              unknownOrder = true;
              return;
            }
            const cached = draft.orders[idx];
            // Version guard: discard stale/out-of-order events
            if (event.version <= (cached.version ?? 0)) return;

            // Shallow merge: only update changed fields
            cached.orderStatus = event.orderStatus;
            cached.deliveryStatus = event.deliveryStatus;
            cached.allowedActions = event.allowedActions;
            cached.version = event.version;
            cached.timestamp = event.timestamp;
          })
        );
      } catch (e) {
        console.error('[useDeliverySocket] cache update error', e);
        dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders']));
        return;
      }

      // Trigger targeted refetch for unknown orderId
      if (unknownOrder) {
        dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders']));
      }
    };

    const handleOrderCancelled = (data: { orderId: string }) => {
      dispatch(
        deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          if (draft?.orders) {
            draft.orders = draft.orders.filter((o: any) => o._id !== data.orderId);
          }
        })
      );
    };

    const handleOrderReassigned = (data: { orderId: string }) => {
      dispatch(
        deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          if (draft?.orders) {
            draft.orders = draft.orders.filter((o: any) => o._id !== data.orderId);
          }
        })
      );
    };

    const handleSyncResponse = (data: {
      orders: StatusChangedPayload[];
      fullRefetchRequired?: boolean;
    }) => {
      // If the server capped the response (>500 events), do a full refetch
      if (data?.fullRefetchRequired) {
        dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders']));
        return;
      }
      if (!Array.isArray(data?.orders)) return;

      dispatch(
        deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          for (const event of data.orders) {
            const idx = draft?.orders?.findIndex((o: any) => o._id === event.orderId);
            if (idx !== undefined && idx !== -1) {
              const cached = draft.orders[idx];
              if (event.version > (cached.version ?? 0)) {
                cached.orderStatus = event.orderStatus;
                cached.deliveryStatus = event.deliveryStatus;
                cached.allowedActions = event.allowedActions;
                cached.version = event.version;
                cached.timestamp = event.timestamp;
              }
            } else {
              // New order discovered via sync — insert it
              draft?.orders?.push(event as any);
            }
          }
        })
      );
    };

    // --- Register listeners ---
    socket.on('order:assigned', handleOrderAssigned);
    socket.on('new_order', handleNewOrder);
    socket.on('order:status:changed', handleStatusChanged);
    socket.on('order:cancelled', handleOrderCancelled);
    socket.on('order:reassigned', handleOrderReassigned);
    socket.on('sync_response', handleSyncResponse);

    // --- AppState (background/foreground) ---
    const appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background') {
        backgroundAt = Date.now();
      } else if (nextState === 'active' && backgroundAt !== null) {
        const bgDurationMs = Date.now() - backgroundAt;
        backgroundAt = null;
        if (bgDurationMs > 30_000 && socket.connected) {
          await emitSyncRequest();
        }
      }
    });

    // --- Cleanup ---
    return () => {
      clearInterval(dedupPurgeInterval);
      socket.off('order:assigned', handleOrderAssigned);
      socket.off('new_order', handleNewOrder);
      socket.off('order:status:changed', handleStatusChanged);
      socket.off('order:cancelled', handleOrderCancelled);
      socket.off('order:reassigned', handleOrderReassigned);
      socket.off('sync_response', handleSyncResponse);
      stopPolling();
      appStateSubscription.remove();
      socket.disconnect();
    };
  }, [token, userId, dispatch]);

  return { socketStatus };
};
