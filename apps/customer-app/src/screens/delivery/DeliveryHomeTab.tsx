import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { store } from '../../store';
import { deliveryApi } from '../../api/deliveryApi';
import {
  useAcceptOrderMutation,
  useRejectOrderMutation,
  usePickupOrderMutation,
  useStartDeliveryMutation,
  useMarkArrivedMutation,
  useDeliverAttemptMutation,
  useVerifyDeliveryOtpMutation,
  useRecordDeliveryAttemptMutation,
  useCreateCodCollectionMutation,
  useToggleStatusMutation,
  useEscalateOrderMutation,
} from '../../api/deliveryApi';
import { registerActionHandler } from '../../hooks/delivery/useActionQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDashboardData } from '../../hooks/delivery/useDashboardData';
import { useDeliverySocket } from '../../hooks/delivery/useDeliverySocket';
import { useNetworkStatus } from '../../hooks/delivery/useNetworkStatus';
import { useActionGuard } from '../../hooks/delivery/useActionGuard';
import { useActionQueue } from '../../hooks/delivery/useActionQueue';
import { useRouteArrangement } from '../../hooks/delivery/useRouteArrangement';
import { ControlBar } from '../../components/delivery/ControlBar/ControlBar';
import { IdleCard } from '../../components/delivery/StateCard/IdleCard';
import { NewOrderCard } from '../../components/delivery/StateCard/NewOrderCard';
import { ActiveOrderCard } from '../../components/delivery/StateCard/ActiveOrderCard';
import { ConnectionBanner } from '../../components/delivery/ConnectionBanner/ConnectionBanner';
import { GlobalConnectivityBanner } from '../../components/delivery/GlobalConnectivityBanner/GlobalConnectivityBanner';
import { StickyCurrentOrderPanel } from '../../components/delivery/StickyCurrentOrderPanel';
import { DELIVERY_COLORS, DELIVERY_SPACING } from '../../constants/deliveryTheme';
import { DELIVERY_CONFIG } from '../../constants/deliveryConfig';
import { useAttemptTracker } from '../../hooks/delivery/useAttemptTracker';
import { FailureReasonKey } from '../../components/delivery/StateCard/ActiveOrderCard';

const DeliveryHomeTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Dashboard data
  const { activeOrders, availableOrders, isOnline, isLoading, isFetching, refetch, deliveryBoy } = useDashboardData();

  // Production hardening hooks
  const { socketStatus } = useDeliverySocket();
  const { isOnline: networkIsOnline, connectionType } = useNetworkStatus();
  const { enqueue, replayQueue, hasPendingActionsForOrder, isSyncing } = useActionQueue();

  // Toggle guard
  const [isToggling, setIsToggling] = useState(false);

  // Per-order state
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [deliveryAttempted, setDeliveryAttempted] = useState<Record<string, boolean>>({});
  const [codCollectionByOrderId, setCodCollectionByOrderId] = useState<Record<string, any | null | undefined>>({});
  // Per-order in-flight guards for unguarded async handlers
  const [attemptInFlight, setAttemptInFlight] = useState<Record<string, boolean>>({});
  const [codInFlight, setCodInFlight] = useState<Record<string, boolean>>({});
  // Per-order fail-in-progress guard — prevents double-tap race condition (Edge case 1)
  const failInProgressRef = useRef<Record<string, boolean>>({});

  // Per-order cross-action guard (Fix #27) — blocks ALL action buttons for an
  // order while any one action is in flight, preventing conflicting mutations
  // (e.g. "Mark Arrived" + "Cancel Delivery" fired simultaneously).
  const orderActionInFlightRef = useRef<Record<string, boolean>>({});

  /** Acquire the per-order action lock. Returns false if already locked. */
  const acquireOrderLock = useCallback((orderId: string, actionType?: string): boolean => {
    if (orderActionInFlightRef.current[orderId]) return false;
    // Fix 2 — block forward transitions when a different action is queued,
    // but allow retrying the same action type (dedup replaces it in the queue).
    if (hasPendingActionsForOrder(orderId, actionType)) {
      Alert.alert(
        'Action Pending Sync',
        'A previous action for this order is waiting to sync. Please wait for it to complete before taking another action.',
        [{ text: 'OK' }]
      );
      return false;
    }
    orderActionInFlightRef.current[orderId] = true;
    return true;
  }, [hasPendingActionsForOrder]);

  /** Release the per-order action lock. */
  const releaseOrderLock = useCallback((orderId: string): void => {
    orderActionInFlightRef.current[orderId] = false;
  }, []);

  // ── Force Sync handler (Task 13.1) ────────────────────────────────────────
  // Manually triggers replayQueue() — wired to GlobalConnectivityBanner's
  // onForceSync prop. Uses the same fetchOrderStatus logic as the auto-replay
  // that fires when the network comes back online.
  const handleForceSync = useCallback(() => {
    replayQueue(async (orderId: string) => {
      const result = deliveryApi.endpoints.getDeliveryOrders.select()(
        store.getState() as any
      );
      const order = result?.data?.orders?.find((o: any) => o._id === orderId);
      return order?.orderStatus?.toLowerCase() ?? 'unknown';
    });
  }, [replayQueue]);

  // ── Reset State handler (Task 13.2) ──────────────────────────────────────
  // Clears all local delivery AsyncStorage keys and refetches from server.
  // Shows confirmation dialog, progress indicator, and completion message.
  const DELIVERY_RESET_KEYS = [
    '@delivery_action_queue',
    '@delivery_attempt_tracker',
    '@delivery_sorted_orders',
    '@delivery_current_order',
    '@delivery_route_arranged',
    '@delivery_escalated_orders',
  ];

  const [isResetting, setIsResetting] = useState(false);

  const handleResetState = useCallback(() => {
    Alert.alert(
      'Reset Delivery State',
      'This will clear all queued actions, retry counts, and route arrangement. Your orders will be reloaded from the server.\n\nAny unsynced actions will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await Promise.all(
                DELIVERY_RESET_KEYS.map(key => AsyncStorage.removeItem(key))
              );
              // Clear in-memory escalated orders set
              setEscalatedOrderIds(new Set());
              // Refetch orders from server
              await refetch();
              Alert.alert('Recovery Complete', 'Recovery complete — you can continue.');
            } catch (err) {
              Alert.alert('Reset Failed', 'Could not reset state. Please try again.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  }, [refetch]);

  // Route arrangement hook
  const {
    sortedOrderIds,
    currentOrderId,
    isArranged,
    isArranging,
    canArrangeRoute,
    arrangeRoute,
    resetArrangement,
    isOrderLocked,
    isOrderCurrent,
    driverLocation,
  } = useRouteArrangement(activeOrders);

  // Derive current order for StickyCurrentOrderPanel (Task 14.1)
  // When route is arranged, use currentOrderId; otherwise fall back to first active order.
  const currentOrder = useMemo(() => {
    if (isArranged && currentOrderId) {
      return activeOrders.find(o => o._id === currentOrderId) ?? null;
    }
    return activeOrders.length > 0 ? activeOrders[0] : null;
  }, [isArranged, currentOrderId, activeOrders]);

  // Attempt tracker for multi-attempt failure flow
  const {
    getAttemptState,
    incrementAttempt,
    removeAttempt,
    cleanup,
    isRetryLocked,
    getRemainingSeconds,
    mergeServerAttempt,
  } = useAttemptTracker();

  // ── Stale state protection: escalated order IDs (Requirement 5.7) ─────────
  // Once an order is escalated and removed, it must never be re-added from stale
  // server state. We persist a set of escalated order IDs in AsyncStorage and
  // clear entries older than 24 hours to prevent unbounded growth.
  const ESCALATED_ORDERS_KEY = '@delivery_escalated_orders';
  const ESCALATED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const [escalatedOrderIds, setEscalatedOrderIds] = useState<Set<string>>(new Set());

  // Load escalated order IDs from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ESCALATED_ORDERS_KEY);
        if (!raw) return;
        const stored: Record<string, number> = JSON.parse(raw); // { orderId: escalatedAt }
        const now = Date.now();
        // Filter out entries older than 24 hours
        const fresh: Record<string, number> = {};
        for (const [id, ts] of Object.entries(stored)) {
          if (now - ts < ESCALATED_TTL_MS) {
            fresh[id] = ts;
          }
        }
        setEscalatedOrderIds(new Set(Object.keys(fresh)));
        // Persist cleaned-up set
        await AsyncStorage.setItem(ESCALATED_ORDERS_KEY, JSON.stringify(fresh));
      } catch {
        // Safe default — empty set
      }
    })();
  }, []);

  /** Mark an order as escalated (terminal state). */
  const markOrderEscalated = async (orderId: string) => {
    setEscalatedOrderIds(prev => new Set([...prev, orderId]));
    try {
      const raw = await AsyncStorage.getItem(ESCALATED_ORDERS_KEY);
      const stored: Record<string, number> = raw ? JSON.parse(raw) : {};
      stored[orderId] = Date.now();
      await AsyncStorage.setItem(ESCALATED_ORDERS_KEY, JSON.stringify(stored));
    } catch {
      // Non-critical — in-memory set still protects against re-addition
    }
  };

  // Filter active orders to exclude any that have been escalated (Requirement 5.7)
  const filteredActiveOrders = activeOrders.filter(o => !escalatedOrderIds.has(o._id));

  // Cleanup stale attempt entries when active orders change (Requirements: 8.1, 8.4)
  useEffect(() => {
    const activeOrderIds = filteredActiveOrders.map(o => o._id);
    cleanup(activeOrderIds);
  }, [filteredActiveOrders, cleanup]);

  // ⚠️5 — Sync server attempt counts on every fetch/socket update.
  // Guard: only call mergeServerAttempt when server count exceeds local count
  // to avoid unnecessary AsyncStorage writes on large order lists.
  useEffect(() => {
    activeOrders.forEach(order => {
      const serverCount = (order as any).deliveryAttempts;
      if (typeof serverCount === 'number' && serverCount > 0) {
        // mergeServerAttempt internally checks serverCount > localCount before writing
        mergeServerAttempt(order._id, serverCount);
      }
    });
  }, [activeOrders, mergeServerAttempt]);

  // Mutations
  const [toggleStatus] = useToggleStatusMutation();
  const [acceptOrder] = useAcceptOrderMutation();
  const [rejectOrder] = useRejectOrderMutation();
  const [pickupOrder] = usePickupOrderMutation();
  const [startDelivery] = useStartDeliveryMutation();
  const [markArrived] = useMarkArrivedMutation();
  const [deliverAttempt] = useDeliverAttemptMutation();
  const [verifyDeliveryOtp] = useVerifyDeliveryOtpMutation();
  const [recordDeliveryAttempt] = useRecordDeliveryAttemptMutation();
  const [createCodCollection] = useCreateCodCollectionMutation();
  const [escalateOrder] = useEscalateOrderMutation();

  // Register action handlers for crash-recovery fn reconstruction.
  // These run on every render but registerActionHandler is idempotent (Map.set).
  // The registry is module-level so handlers are available when loadQueue runs
  // and when replayQueue attempts reconstruction before replay.
  useEffect(() => {
    registerActionHandler('accept', (_args, key) => async (id: string) => {
      await acceptOrder({ orderId: id, idempotencyKey: key }).unwrap();
    });
    registerActionHandler('reject', (_args, key) => async (id: string) => {
      await rejectOrder({ orderId: id, idempotencyKey: key }).unwrap();
    });
    registerActionHandler('pickup', (_args, key) => async (id: string) => {
      await pickupOrder({ orderId: id, idempotencyKey: key }).unwrap();
    });
    registerActionHandler('startDelivery', (_args, key) => async (id: string) => {
      await startDelivery({ orderId: id, idempotencyKey: key }).unwrap();
    });
    registerActionHandler('markArrived', (_args, key) => async (id: string) => {
      await markArrived({ orderId: id, idempotencyKey: key }).unwrap();
    });
    registerActionHandler('verifyOtp', (_args, key) => async (id: string, otp: string) => {
      await verifyDeliveryOtp({ orderId: id, otp, idempotencyKey: key }).unwrap();
    });
    registerActionHandler('escalate', (_args, key) => async (id: string, reason: string, notes?: string) => {
      await escalateOrder({ orderId: id, reason, notes, idempotencyKey: key }).unwrap();
    });
  }, [acceptOrder, rejectOrder, pickupOrder, startDelivery, markArrived, verifyDeliveryOtp, escalateOrder]);

  // Fetch COD collection status from backend
  const fetchCodCollection = async (orderId: string): Promise<void> => {
    try {
      const result = await dispatch(deliveryApi.endpoints.getCodCollection.initiate(orderId)).unwrap();
      setCodCollectionByOrderId(prev => ({ ...prev, [orderId]: result?.codCollection ?? null }));
    } catch {
      setCodCollectionByOrderId(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // Fetch COD collections when activeOrders change
  useEffect(() => {
    activeOrders.forEach(order => {
      const isCod = order.paymentMethod?.toLowerCase() === 'cod';
      const hasArrived = !!order.arrivedAt;
      if (isCod && hasArrived && !(order._id in codCollectionByOrderId)) {
        fetchCodCollection(order._id);
      }
    });
  }, [activeOrders]);

  // Replay queued actions when network comes back online
  const prevOnlineRef = useRef(networkIsOnline);
  useEffect(() => {
    if (!prevOnlineRef.current && networkIsOnline) {
      // Use stable RTK selector instead of fragile string-based cache key lookup
      replayQueue(async (orderId: string) => {
        const result = deliveryApi.endpoints.getDeliveryOrders.select()(
          store.getState() as any
        );
        const order = result?.data?.orders?.find((o: any) => o._id === orderId);
        return order?.orderStatus?.toLowerCase() ?? 'unknown';
      });
    }
    prevOnlineRef.current = networkIsOnline;
  }, [networkIsOnline]);

  // ─── Action handlers ──────────────────────────────────────────────────────

  const handleToggleStatus = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await toggleStatus({ isOnline: !isOnline }).unwrap();
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to update status');
    } finally {
      setIsToggling(false);
    }
  };

  // ── StickyCurrentOrderPanel callbacks (Task 14.1) ─────────────────────────

  /** Opens the phone dialer for the customer's phone number. */
  const handleCallCustomer = useCallback((phone: string) => {
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Phone calls are not supported on this device');
        }
      })
      .catch(() => Alert.alert('Error', 'Could not open phone dialer'));
  }, []);

  /** Opens Google Maps navigation to the delivery address. */
  const handleNavigateToOrder = useCallback((order: any) => {
    const lat = order?.address?.lat;
    const lng = order?.address?.lng;
    const label = encodeURIComponent(order?.address?.addressLine ?? 'Delivery Address');
    if (lat && lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
      Linking.openURL(url).catch(() =>
        Alert.alert('Error', 'Could not open Google Maps')
      );
    } else {
      Alert.alert('Navigation', 'No coordinates available for this address');
    }
  }, []);

  const { guarded: handleAcceptOrder } = useActionGuard(async (orderId: string) => {
    const idempotencyKey = `accept:${orderId}:${Date.now()}`;
    try {
      await acceptOrder({ orderId, idempotencyKey }).unwrap();
      Alert.alert('Success', 'Order accepted!');
    } catch (error: any) {
      if (error?.status === 409) {
        dispatch(deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          draft.orders = draft.orders.filter((o: any) => o._id !== orderId);
        }));
        Alert.alert('Order Taken', 'Order already taken by another rider');
      } else if (!error?.status) {
        enqueue({ id: `${orderId}-accept-${Date.now()}`, action: 'accept', orderId, targetStatus: 'assigned', args: [orderId], fn: async (id: string) => { await acceptOrder({ orderId: id, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        Alert.alert('Error', error?.data?.error || 'Failed to accept order');
      }
    }
  });

  const { guarded: handleRejectOrder } = useActionGuard(async (orderId: string) => {
    const idempotencyKey = `reject:${orderId}:${Date.now()}`;
    try {
      await rejectOrder({ orderId, idempotencyKey }).unwrap();
      Alert.alert('Success', 'Order rejected');
    } catch (error: any) {
      if (!error?.status) {
        enqueue({ id: `${orderId}-reject-${Date.now()}`, action: 'reject', orderId, targetStatus: 'rejected', args: [orderId], fn: async (id: string) => { await rejectOrder({ orderId: id, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        Alert.alert('Error', error?.data?.error || 'Failed to reject order');
      }
    }
  });

  const { guarded: handlePickup } = useActionGuard(async (orderId: string) => {
    if (!acquireOrderLock(orderId, 'pickup')) return;
    const idempotencyKey = `pickup:${orderId}:${Date.now()}`;
    try {
      const result = await pickupOrder({ orderId, idempotencyKey }).unwrap();
      // Update cache from mutation response — version guard prevents overwriting a
      // socket event that arrived before the HTTP response resolved (race condition fix)
      if (result?.order) {
        dispatch(deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          const idx = draft?.orders?.findIndex((o: any) => o._id === orderId);
          if (idx !== undefined && idx !== -1) {
            const cached = draft.orders[idx];
            const responseVersion = result.version ?? result.orderVersion ?? 0;
            if (responseVersion > 0 && responseVersion < (cached.version ?? 0)) return; // socket already ahead
            draft.orders[idx] = {
              ...cached,
              orderStatus: result.orderStatus ?? result.order.orderStatus,
              deliveryStatus: result.deliveryStatus ?? result.order.deliveryStatus,
              allowedActions: result.allowedActions ?? [],
              ...(responseVersion > 0 ? { version: responseVersion } : {}),
            };
          }
        }));
      }
      Alert.alert('Success', 'Order marked as picked up!');
    } catch (error: any) {
      if (!error?.status) {
        enqueue({ id: `${orderId}-pickup-${Date.now()}`, action: 'pickup', orderId, targetStatus: 'picked_up', args: [orderId], fn: async (id: string) => { await pickupOrder({ orderId: id, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        Alert.alert('Error', error?.data?.error || 'Failed to pickup order');
      }
    } finally {
      releaseOrderLock(orderId); // cross-action guard (Fix #27)
    }
  });

  const { guarded: handleStartDelivery } = useActionGuard(async (orderId: string) => {
    if (!acquireOrderLock(orderId, 'startDelivery')) return;
    console.log('[START_DELIVERY_HANDLER] Called with orderId:', orderId);
    const idempotencyKey = `startDelivery:${orderId}:${Date.now()}`;
    console.log('[START_DELIVERY_HANDLER] Idempotency key:', idempotencyKey);
    
    try {
      console.log('[START_DELIVERY_HANDLER] Calling startDelivery mutation...');
      const result = await startDelivery({ orderId, idempotencyKey }).unwrap();
      console.log('[START_DELIVERY_HANDLER] Mutation success:', result);
      
      if (result?.order) {
        dispatch(deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          const idx = draft?.orders?.findIndex((o: any) => o._id === orderId);
          if (idx !== undefined && idx !== -1) {
            const cached = draft.orders[idx];
            const responseVersion = result.version ?? result.orderVersion ?? 0;
            if (responseVersion > 0 && responseVersion < (cached.version ?? 0)) return;
            draft.orders[idx] = {
              ...cached,
              orderStatus: result.orderStatus ?? result.order.orderStatus,
              deliveryStatus: result.deliveryStatus ?? result.order.deliveryStatus,
              allowedActions: result.allowedActions ?? [],
              ...(responseVersion > 0 ? { version: responseVersion } : {}),
            };
          }
        }));
      }
      Alert.alert('Success', 'Delivery started!');
    } catch (error: any) {
      console.error('[START_DELIVERY_HANDLER] Error:', error);
      console.error('[START_DELIVERY_HANDLER] Error status:', error?.status);
      console.error('[START_DELIVERY_HANDLER] Error data:', error?.data);
      
      if (!error?.status) {
        console.log('[START_DELIVERY_HANDLER] No status - queuing for offline retry');
        enqueue({ id: `${orderId}-startDelivery-${Date.now()}`, action: 'startDelivery', orderId, targetStatus: 'in_transit', args: [orderId], fn: async (id: string) => { await startDelivery({ orderId: id, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        Alert.alert('Error', error?.data?.error || 'Failed to start delivery');
      }
    } finally {
      releaseOrderLock(orderId); // cross-action guard (Fix #27)
    }
  });

  const { guarded: handleMarkArrived } = useActionGuard(async (orderId: string) => {
    if (!acquireOrderLock(orderId, 'markArrived')) return;
    const idempotencyKey = `markArrived:${orderId}:${Date.now()}`;
    try {
      const result = await markArrived({ orderId, idempotencyKey }).unwrap();
      if (result?.order) {
        dispatch(deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          const idx = draft?.orders?.findIndex((o: any) => o._id === orderId);
          if (idx !== undefined && idx !== -1) {
            const cached = draft.orders[idx];
            const responseVersion = result.version ?? result.orderVersion ?? 0;
            if (responseVersion > 0 && responseVersion < (cached.version ?? 0)) return;
            draft.orders[idx] = {
              ...cached,
              orderStatus: result.orderStatus ?? result.order.orderStatus,
              deliveryStatus: result.deliveryStatus ?? result.order.deliveryStatus,
              allowedActions: result.allowedActions ?? [],
              arrivedAt: result.order.arrivedAt,
              ...(responseVersion > 0 ? { version: responseVersion } : {}),
            };
          }
        }));
      }
      Alert.alert('Success', 'Marked as arrived!');
    } catch (error: any) {
      if (!error?.status) {
        enqueue({ id: `${orderId}-markArrived-${Date.now()}`, action: 'markArrived', orderId, targetStatus: 'arrived', args: [orderId], fn: async (id: string) => { await markArrived({ orderId: id, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        Alert.alert('Error', error?.data?.error || 'Failed to mark arrived');
      }
    } finally {
      releaseOrderLock(orderId); // cross-action guard (Fix #27)
    }
  });

  const { guarded: handleVerifyOtp } = useActionGuard(async (orderId: string, otp: string) => {
    if (!acquireOrderLock(orderId, 'verifyOtp')) return;
    if (!otp || otp.length !== 4) {
      releaseOrderLock(orderId);
      Alert.alert('Error', 'Please enter 4-digit OTP');
      return;
    }
    const idempotencyKey = `verifyOtp:${orderId}:${Date.now()}`;
    try {
      const result = await verifyDeliveryOtp({ orderId, otp, idempotencyKey }).unwrap();
      // Update cache from mutation response with version guard
      if (result?.order) {
        dispatch(deliveryApi.util.updateQueryData('getDeliveryOrders', undefined, (draft) => {
          const idx = draft?.orders?.findIndex((o: any) => o._id === orderId);
          if (idx !== undefined && idx !== -1) {
            const cached = draft.orders[idx];
            const responseVersion = result.version ?? result.orderVersion ?? 0;
            if (responseVersion > 0 && responseVersion < (cached.version ?? 0)) return;
            draft.orders[idx] = {
              ...cached,
              orderStatus: result.orderStatus ?? result.order.orderStatus,
              deliveryStatus: result.deliveryStatus ?? result.order.deliveryStatus,
              allowedActions: result.allowedActions ?? [],
              ...(responseVersion > 0 ? { version: responseVersion } : {}),
            };
          }
        }));
      }
      Alert.alert('Success', 'Delivery completed!');
      setOtpInputs(prev => ({ ...prev, [orderId]: '' }));
      setDeliveryAttempted(prev => ({ ...prev, [orderId]: false }));
      // Cleanup attempt state on successful delivery (Requirement 8.2)
      await removeAttempt(orderId);
    } catch (error: any) {
      if (!error?.status) {
        enqueue({ id: `${orderId}-verifyOtp-${Date.now()}`, action: 'verifyOtp', orderId, targetStatus: 'delivered', args: [orderId, otp], fn: async (id: string, o: string) => { await verifyDeliveryOtp({ orderId: id, otp: o, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        // Clear OTP on server error so rider can re-enter
        setOtpInputs(prev => ({ ...prev, [orderId]: '' }));
        Alert.alert('Error', error?.data?.error || 'Invalid OTP');
      }
    } finally {
      releaseOrderLock(orderId); // cross-action guard (Fix #27)
    }
  });

  const handleStartDeliveryAttempt = async (orderId: string): Promise<void> => {
    if (attemptInFlight[orderId]) return;
    setAttemptInFlight(prev => ({ ...prev, [orderId]: true }));
    try {
      await deliverAttempt(orderId).unwrap();
      setDeliveryAttempted(prev => ({ ...prev, [orderId]: true }));
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to start delivery attempt');
    } finally {
      setAttemptInFlight(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleCollectCOD = async (orderId: string, mode: 'CASH' | 'UPI'): Promise<void> => {
    if (codInFlight[orderId]) return;
    setCodInFlight(prev => ({ ...prev, [orderId]: true }));
    const idempotencyKey = `cod_collection_idem_${orderId}`;
    try {
      const result = await createCodCollection({ orderId, mode, idempotencyKey }).unwrap();
      setCodCollectionByOrderId(prev => ({ ...prev, [orderId]: result?.codCollection ?? null }));
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to record payment');
    } finally {
      setCodInFlight(prev => ({ ...prev, [orderId]: false }));
    }
  };
  const { guarded: handleFailDelivery } = useActionGuard(async (orderId: string, reason: FailureReasonKey, notes?: string) => {
    // Guard against double-tap / rapid re-submission (Edge case 1)
    if (failInProgressRef.current[orderId]) return;
    failInProgressRef.current[orderId] = true;
    if (!acquireOrderLock(orderId, 'escalate')) {
      failInProgressRef.current[orderId] = false;
      return;
    }
    try {
    // 1. Read current attempt count WITHOUT incrementing — decide path first
    const currentState = getAttemptState(orderId);
    const currentCount = currentState?.attemptCount ?? 0;

    // 2. Check if this failure will reach max attempts
    if (currentCount + 1 >= DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS) {
      // Escalation path — stable idempotency key generated once here
      const escalateKey = `escalate:${orderId}:${currentCount + 1}`;
      try {
        await escalateOrder({ orderId, reason, notes, idempotencyKey: escalateKey }).unwrap();
        // Only remove + mark escalated AFTER backend confirms (Fix #3)
        await removeAttempt(orderId);
        await markOrderEscalated(orderId);
        Alert.alert('Order Escalated', 'Order has been escalated for reassignment');
      } catch (error: any) {
        if (!error?.status) {
          // Network error — enqueue for offline replay with stable idempotency key
          // DO NOT remove attempt count or mark escalated — order stays visible (Fix #3)
          enqueue({
            id: `${orderId}-escalate-${currentCount + 1}`,
            action: 'escalate',
            orderId,
            targetStatus: 'escalated',
            args: [orderId, reason, notes],
            fn: async (id: string, r: string, n?: string) => {
              await escalateOrder({ orderId: id, reason: r, notes: n, idempotencyKey: escalateKey }).unwrap();
            },
            idempotencyKey: escalateKey,
            enqueuedAt: Date.now(),
          });
          Alert.alert(
            'No Network',
            'Escalation queued — order stays active until confirmed when you reconnect.'
          );
        } else {
          // Server error — show error and keep order
          Alert.alert('Escalation Failed', error?.data?.error || 'Failed to escalate order');
          return; // Don't remove order
        }
      }
    } else {
      // Retry path — call API first, increment only on success (Fix #2 + #7)
      try {
        await recordDeliveryAttempt({
          orderId,
          status: 'FAILED',
          failureReason: reason,
          failureNotes: notes || undefined,
        }).unwrap();
        // Increment ONLY after API succeeds — prevents phantom attempts on failure
        await incrementAttempt(orderId);
        const remaining = DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS - (currentCount + 1);
        const minutes = Math.floor(DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS / 60);
        Alert.alert(
          'Attempt Recorded',
          `Retry available in ${minutes} minutes. ${remaining} attempt(s) remaining.`
        );
      } catch (error: any) {
        // API failed — do NOT increment attempt count
        Alert.alert('Error', error?.data?.error || 'Failed to record attempt');
      }
    }
    } finally {
      // Always release both guards
      failInProgressRef.current[orderId] = false;
      releaseOrderLock(orderId); // cross-action guard (Fix #27)
    }
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DELIVERY_COLORS.primary} />
      </View>
    );
  }

  // Show full-screen progress overlay during reset (Task 13.2)
  if (isResetting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DELIVERY_COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* GlobalConnectivityBanner — persistent network status (Task 14.1, 13.1) */}
      <GlobalConnectivityBanner onForceSync={handleForceSync} />

      <ConnectionBanner
        isOnline={networkIsOnline}
        socketStatus={socketStatus}
        connectionType={connectionType}
        isSyncing={isSyncing}
      />
      <ControlBar
        isOnline={isOnline}
        earnings={deliveryBoy?.earnings ?? 0}
        onToggleOnline={handleToggleStatus}
        isToggling={isToggling}
      />

      {/* StickyCurrentOrderPanel — always-visible current order info (Task 14.1) */}
      <StickyCurrentOrderPanel
        currentOrder={currentOrder}
        isArranged={isArranged}
        onCallCustomer={handleCallCustomer}
        onNavigate={handleNavigateToOrder}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Available orders — always shown when present, even alongside active orders.
            Matches web EnhancedHomeTab which renders both sections independently. */}
        {availableOrders.length > 0 && (
          <NewOrderCard
            availableOrders={availableOrders}
            onAccept={handleAcceptOrder}
            onReject={handleRejectOrder}
          />
        )}

        {/* Active orders — always shown when present */}
        {filteredActiveOrders.length > 0 && (
          <ActiveOrderCard
            activeOrders={filteredActiveOrders}
            deliveryAttempted={deliveryAttempted}
            codCollectionByOrderId={codCollectionByOrderId}
            otpInputs={otpInputs}
            onOtpChange={(orderId, value) => setOtpInputs(prev => ({ ...prev, [orderId]: value }))}
            onPickup={handlePickup}
            onStartDelivery={handleStartDelivery}
            onMarkArrived={handleMarkArrived}
            onStartDeliveryAttempt={handleStartDeliveryAttempt}
            onVerifyOtp={handleVerifyOtp}
            onCollectCOD={handleCollectCOD}
            onFailDelivery={handleFailDelivery}
            onRefetch={refetch}
            // Route arrangement props
            canArrangeRoute={canArrangeRoute}
            isArranging={isArranging}
            isArranged={isArranged}
            onArrangeRoute={arrangeRoute}
            onResetRoute={resetArrangement}
            isOrderLocked={isOrderLocked}
            isOrderCurrent={isOrderCurrent}
            sortedOrderIds={sortedOrderIds}
            driverLocation={driverLocation}
            // Attempt tracker props
            getAttemptState={getAttemptState}
            isOrderRetryLocked={isRetryLocked}
            getOrderRemainingSeconds={getRemainingSeconds}
          />
        )}

        {/* Idle — only when nothing else to show */}
        {availableOrders.length === 0 && filteredActiveOrders.length === 0 && (
          <IdleCard
            earnings={deliveryBoy?.earnings ?? 0}
            onRefresh={refetch}
          />
        )}
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DELIVERY_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.background,
  },
  scroll: {
    // Add top padding to prevent content from hiding under the StickyCurrentOrderPanel
    // (which is absolutely positioned at 120dp height)
    paddingTop: 132,
    paddingBottom: 40,
  },
});

export default DeliveryHomeTab;
