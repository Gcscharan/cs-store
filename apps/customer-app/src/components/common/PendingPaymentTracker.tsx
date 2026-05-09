import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLazyGetOrdersQuery, useLazyGetPaymentStatusQuery } from '../../api/ordersApi';
import { RootState } from '../../store';
import { logEvent } from '../../utils/analytics';

const ONE_HOUR_MS = 3600000; // 1 hour in milliseconds
const MAX_POLLING_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2000; // 2 seconds

export const PendingPaymentTracker: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [getOrders] = useLazyGetOrdersQuery();
  const [getPaymentStatus] = useLazyGetPaymentStatusQuery();
  const isPollingRef = useRef(false);

  /**
   * Resume polling for a specific pending order
   * This is called when app restarts and finds a pending payment in AsyncStorage
   */
  const resumePollingForOrder = async (orderId: string) => {
    if (isPollingRef.current) {
      console.log('⏭️ [PaymentTracker] Already polling, skipping duplicate');
      return;
    }

    isPollingRef.current = true;
    console.log(`🔄 [PaymentTracker] Resuming polling for order ${orderId}`);

    try {
      for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
        try {
          console.log(`🔄 [PaymentTracker] Polling attempt ${attempt}/${MAX_POLLING_ATTEMPTS} for order ${orderId}`);
          
          const res = await getPaymentStatus(orderId).unwrap();
          const paymentStatus = res?.paymentStatus;
          
          if (paymentStatus === 'PAID') {
            // Payment successful - clear pending order
            console.log('✅ [PaymentTracker] Payment verified successfully in background');
            await AsyncStorage.removeItem('pendingPaymentOrderId');
            await AsyncStorage.removeItem('pendingPaymentTimestamp');
            
            logEvent('background_payment_verified', { 
              orderId,
              attempts: attempt 
            });
            
            isPollingRef.current = false;
            return;
          }
          
          if (paymentStatus === 'FAILED') {
            // Payment failed - clear pending order
            console.log('❌ [PaymentTracker] Payment failed in background');
            await AsyncStorage.removeItem('pendingPaymentOrderId');
            await AsyncStorage.removeItem('pendingPaymentTimestamp');
            
            logEvent('background_payment_failed', { 
              orderId,
              attempts: attempt 
            });
            
            isPollingRef.current = false;
            return;
          }
          
          // Still pending, wait before next attempt
          if (attempt < MAX_POLLING_ATTEMPTS) {
            await new Promise<void>(resolve => setTimeout(() => resolve(), POLL_INTERVAL_MS));
          }
          
        } catch (error) {
          console.error(`❌ [PaymentTracker] Polling attempt ${attempt} failed:`, error);
          
          // Continue polling on error (network issues)
          if (attempt < MAX_POLLING_ATTEMPTS) {
            await new Promise<void>(resolve => setTimeout(() => resolve(), POLL_INTERVAL_MS));
          }
        }
      }
      
      // Timeout - stop polling but keep the pending order for user to check manually
      console.log('⏱️ [PaymentTracker] Payment verification timeout in background');
      logEvent('background_payment_timeout', { orderId });
      
    } finally {
      isPollingRef.current = false;
    }
  };

  /**
   * Check for pending payment in AsyncStorage on app startup
   * Requirements: BR-004, US-003
   */
  const checkPendingPaymentOnStartup = async () => {
    if (!user) return;

    try {
      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');
      
      if (pendingOrderId && pendingTimestamp) {
        const timestamp = parseInt(pendingTimestamp, 10);
        const age = Date.now() - timestamp;
        
        // Only check if less than 1 hour old
        if (age < ONE_HOUR_MS) {
          console.log(`🔄 [PaymentTracker] Found pending payment (${Math.round(age / 1000)}s old), resuming verification for order: ${pendingOrderId}`);
          
          logEvent('pending_payment_recovery_started', { 
            orderId: pendingOrderId,
            ageSeconds: Math.round(age / 1000)
          });
          
          // Resume polling for this specific order
          await resumePollingForOrder(pendingOrderId);
        } else {
          // Too old, clear it
          console.log(`🗑️ [PaymentTracker] Pending payment too old (${Math.round(age / 1000)}s), clearing: ${pendingOrderId}`);
          await AsyncStorage.removeItem('pendingPaymentOrderId');
          await AsyncStorage.removeItem('pendingPaymentTimestamp');
          
          logEvent('pending_payment_cleared_stale', { 
            orderId: pendingOrderId,
            ageSeconds: Math.round(age / 1000)
          });
        }
      }
    } catch (error) {
      console.error('❌ [PaymentTracker] Failed to check pending payment on startup:', error);
    }
  };

  /**
   * Check recent orders for any pending payments (fallback mechanism)
   * This runs on app foreground to catch any pending orders that might have been missed.
   * Only checks orders created within the last 45 minutes (just over the 40s polling window)
   * to avoid repeatedly polling legitimately-cancelled stale orders.
   */
  const checkPendingPayments = async () => {
    if (!user) return;
    
    try {
      // Fetch recent orders to check for any pending payments
      const res = await getOrders({ limit: 5 }).unwrap();
      const orders = res.orders || res.data || [];
      
      const now = Date.now();
      const MAX_AGE_MS = 45 * 60 * 1000; // 45 minutes — covers the 40s polling window + buffer

      const pendingOrders = orders.filter((o: any) => {
        if (o.paymentStatus !== 'PENDING' && o.orderStatus !== 'PENDING_PAYMENT') return false;
        // Skip orders older than 45 minutes — stale cancelled/abandoned attempts
        const createdAt = o.createdAt ? new Date(o.createdAt).getTime() : 0;
        return (now - createdAt) < MAX_AGE_MS;
      });

      for (const order of pendingOrders) {
        try {
          const statusRes = await getPaymentStatus(order._id).unwrap();
          if (statusRes.paymentStatus !== 'PENDING') {
            logEvent('background_payment_resolved', { 
              orderId: order._id, 
              newStatus: statusRes.paymentStatus 
            });
          }
        } catch (err) {
          console.warn(`Failed to verify pending order ${order._id} in background`, err);
        }
      }
    } catch (e) {
      // If it's a 401, baseApi's reauth logic will handle it, 
      // but we still want to log other errors for debugging.
      if ((e as any).status !== 401) {
        console.warn('⚠️ [PaymentTracker] Failed to fetch orders for verification:', e);
      }
    }
  };

  useEffect(() => {
    // Run on initial mount - check for pending payment from AsyncStorage
    checkPendingPaymentOnStartup();

    // Also run the fallback check for recent pending orders
    checkPendingPayments();

    // Run whenever app comes to the foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPendingPayments();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, getOrders, getPaymentStatus]);

  return null; // This is a logic-only component, renders nothing
};
