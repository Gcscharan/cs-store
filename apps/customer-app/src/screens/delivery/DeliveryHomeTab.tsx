import React, { useState, useEffect, useRef } from 'react';
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
  deliveryApi,
} from '../../api/deliveryApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDashboardData } from '../../hooks/delivery/useDashboardData';
import { useDeliverySocket } from '../../hooks/delivery/useDeliverySocket';
import { useNetworkStatus } from '../../hooks/delivery/useNetworkStatus';
import { useActionGuard } from '../../hooks/delivery/useActionGuard';
import { useActionQueue } from '../../hooks/delivery/useActionQueue';
import { ControlBar } from '../../components/delivery/ControlBar/ControlBar';
import { IdleCard } from '../../components/delivery/StateCard/IdleCard';
import { NewOrderCard } from '../../components/delivery/StateCard/NewOrderCard';
import { ActiveOrderCard } from '../../components/delivery/StateCard/ActiveOrderCard';
import { ConnectionBanner } from '../../components/delivery/ConnectionBanner/ConnectionBanner';
import { DELIVERY_COLORS, DELIVERY_SPACING } from '../../constants/deliveryTheme';

const DeliveryHomeTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Dashboard data
  const { activeOrders, availableOrders, isOnline, isLoading, isFetching, refetch, deliveryBoy } = useDashboardData();

  // Production hardening hooks
  const { socketStatus } = useDeliverySocket();
  const { isOnline: networkIsOnline, connectionType } = useNetworkStatus();
  const { enqueue, replayQueue, isSyncing } = useActionQueue();

  // Toggle guard
  const [isToggling, setIsToggling] = useState(false);

  // Per-order state
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [deliveryAttempted, setDeliveryAttempted] = useState<Record<string, boolean>>({});
  const [codCollectionByOrderId, setCodCollectionByOrderId] = useState<Record<string, any | null | undefined>>({});
  // Per-order in-flight guards for unguarded async handlers
  const [attemptInFlight, setAttemptInFlight] = useState<Record<string, boolean>>({});
  const [codInFlight, setCodInFlight] = useState<Record<string, boolean>>({});

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
      replayQueue(async (_orderId: string) => 'unknown');
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
    }
  });

  const { guarded: handleStartDelivery } = useActionGuard(async (orderId: string) => {
    const idempotencyKey = `startDelivery:${orderId}:${Date.now()}`;
    try {
      const result = await startDelivery({ orderId, idempotencyKey }).unwrap();
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
      if (!error?.status) {
        enqueue({ id: `${orderId}-startDelivery-${Date.now()}`, action: 'startDelivery', orderId, targetStatus: 'in_transit', args: [orderId], fn: async (id: string) => { await startDelivery({ orderId: id, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        Alert.alert('Error', error?.data?.error || 'Failed to start delivery');
      }
    }
  });

  const { guarded: handleMarkArrived } = useActionGuard(async (orderId: string) => {
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
    }
  });

  const { guarded: handleVerifyOtp } = useActionGuard(async (orderId: string, otp: string) => {
    if (!otp || otp.length !== 4) {
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
    } catch (error: any) {
      if (!error?.status) {
        enqueue({ id: `${orderId}-verifyOtp-${Date.now()}`, action: 'verifyOtp', orderId, targetStatus: 'delivered', args: [orderId, otp], fn: async (id: string, o: string) => { await verifyDeliveryOtp({ orderId: id, otp: o, idempotencyKey }).unwrap(); }, idempotencyKey, enqueuedAt: Date.now() });
      } else {
        // Clear OTP on server error so rider can re-enter
        setOtpInputs(prev => ({ ...prev, [orderId]: '' }));
        Alert.alert('Error', error?.data?.error || 'Invalid OTP');
      }
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
  const { guarded: handleFailDelivery } = useActionGuard(async (orderId: string, reason: string, notes?: string) => {
    try {
      const result = await recordDeliveryAttempt({
        orderId,
        status: 'FAILED',
        failureReason: reason,
        failureNotes: notes || undefined,
      }).unwrap();
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
      Alert.alert('Success', 'Delivery attempt recorded');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.error || 'Failed to record attempt');
    }
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DELIVERY_COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
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
        {activeOrders.length > 0 && (
          <ActiveOrderCard
            activeOrders={activeOrders}
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
          />
        )}

        {/* Idle — only when nothing else to show */}
        {availableOrders.length === 0 && activeOrders.length === 0 && (
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
    paddingBottom: 40,
  },
});

export default DeliveryHomeTab;
