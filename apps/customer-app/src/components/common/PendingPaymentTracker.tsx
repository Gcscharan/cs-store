import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSelector } from 'react-redux';
import { useLazyGetOrdersQuery, useLazyGetPaymentStatusQuery } from '../../api/ordersApi';
import { RootState } from '../../store';
import { logEvent } from '../../utils/analytics';

export const PendingPaymentTracker: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [getOrders] = useLazyGetOrdersQuery();
  const [getPaymentStatus] = useLazyGetPaymentStatusQuery();

  useEffect(() => {
    const checkPendingPayments = async () => {
      if (!user) return;
      
      try {
        // Fetch recent orders to check for any pending payments
        const res = await getOrders({ limit: 5 }).unwrap();
        const orders = res.orders || res.data || [];
        
        const pendingOrders = orders.filter(
          (o: any) => o.paymentStatus === 'PENDING' || o.orderStatus === 'PENDING_PAYMENT'
        );

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

    // Run on initial mount
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
