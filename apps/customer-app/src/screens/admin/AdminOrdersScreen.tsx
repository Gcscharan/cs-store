import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import { useGetAdminOrdersQuery, useCancelOrderMutation, useConfirmOrderMutation, usePackOrderMutation, adminApi } from '../../api/adminApi';
import { createOrderListUpdater } from '../../utils/orderStateUtils';
import { socketClient, OrderStatusChangedData, OrderAssignedData } from '../../services/socketClient';
import { useDispatch } from 'react-redux';
import { showToast } from '../../store/slices/uiSlice';
import { AppDispatch } from '../../store';

type OrderLike = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  status?: string;
  userId?: { name?: string; phone?: string } | string;
  user?: { name?: string; phone?: string };
  items?: any[];
  totalAmount?: number;
  createdAt?: string;
  allowedActions?: string[];
};

type StatusFilter = 'ALL' | 'CREATED' | 'CONFIRMED' | 'PACKED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'CREATED', label: 'CREATED' },
  { key: 'CONFIRMED', label: 'CONFIRMED' },
  { key: 'PACKED', label: 'PACKED' },
  { key: 'IN_TRANSIT', label: 'IN_TRANSIT' },
  { key: 'DELIVERED', label: 'DELIVERED' },
  { key: 'CANCELLED', label: 'CANCELLED' },
];

const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [q, setQ] = useState('');

  const { data, isFetching, error, refetch } = useGetAdminOrdersQuery(undefined);
  const orders: OrderLike[] = (data as any)?.orders || [];

  // Refetch on focus (e.g. returning from detail screen after assignment)
  useFocusEffect(
    useCallback(() => {
      console.log('[FETCH_ORDERS_TRIGGERED] screen focused');
      refetch();
    }, [refetch])
  );

  const [confirmOrder, { isLoading: confirming }] = useConfirmOrderMutation();
  const [packOrder, { isLoading: packing }] = usePackOrderMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();

  // Local state to manage orders for real-time updates
  const [localOrders, setLocalOrders] = useState<OrderLike[]>([]);

  // Track processed socket event IDs to prevent duplicate handling
  const processedEventIds = useRef<Set<string>>(new Set());

  // Update local orders when API data changes — only when orders array reference changes
  useEffect(() => {
    if (orders.length > 0) {
      console.log('[FETCH_ORDERS_TRIGGERED] API data updated, syncing local state');
      setLocalOrders(orders);
    }
  }, [data]); // depend on `data` not `orders` to avoid re-running on every render

  // Socket: register listener ONCE on mount, clean up on unmount
  // Use a ref for localOrders inside the callback to avoid stale closure
  // without re-registering the listener on every localOrders change
  const localOrdersRef = useRef<OrderLike[]>(localOrders);
  useEffect(() => {
    localOrdersRef.current = localOrders;
  }, [localOrders]);

  useEffect(() => {
    console.log('[SOCKET_EVENT_RECEIVED] Registering socket listeners (once)');

    const unsubscribeStatusChanges = socketClient.subscribeToOrderStatusChanges((ev: OrderStatusChangedData) => {
      console.log('[SOCKET_EVENT_RECEIVED] order status change', { orderId: ev.orderId, from: ev.from, to: ev.to });

      if (!ev.order) return;

      // Idempotency: skip if we already processed this event
      const eventKey = `status:${ev.orderId}:${ev.to}:${(ev as any).eventId || ''}`;
      if (processedEventIds.current.has(eventKey)) {
        console.log('[SOCKET_EVENT_RECEIVED] duplicate event skipped', eventKey);
        return;
      }
      processedEventIds.current.add(eventKey);

      // Only update if this order exists in our current list
      const orderExists = localOrdersRef.current.some(o => o._id === ev.orderId);
      if (!orderExists) return;

      console.log('[ORDER_UPDATED_UI] updating order', ev.orderId, '→', ev.to);
      setLocalOrders(createOrderListUpdater(ev.order));

      const statusFrom = String(ev.from || '').toUpperCase();
      const statusTo   = String(ev.to   || '').toUpperCase();
      dispatch(showToast(`Order status changed: ${statusFrom} → ${statusTo}`));

      if (statusTo === 'PACKED') {
        dispatch(adminApi.util.invalidateTags(['Clusters']));
      }
    });

    const unsubscribeAssignments = socketClient.subscribeToOrderAssignments((ev: OrderAssignedData) => {
      console.log('[SOCKET_EVENT_RECEIVED] order assigned', { orderId: ev.orderId });

      if (!ev.order) return;

      const eventKey = `assign:${ev.orderId}:${(ev as any).eventId || ''}`;
      if (processedEventIds.current.has(eventKey)) {
        console.log('[SOCKET_EVENT_RECEIVED] duplicate assignment event skipped', eventKey);
        return;
      }
      processedEventIds.current.add(eventKey);

      const orderExists = localOrdersRef.current.some(o => o._id === ev.orderId);
      if (!orderExists) return;

      console.log('[ORDER_UPDATED_UI] updating assigned order', ev.orderId);
      setLocalOrders(createOrderListUpdater(ev.order));

      const partnerName = ev.deliveryPartner?.name || 'Delivery Partner';
      dispatch(showToast(`${partnerName} assigned to order`));
    });

    return () => {
      console.log('[SOCKET_EVENT_RECEIVED] Cleaning up socket listeners');
      unsubscribeStatusChanges();
      unsubscribeAssignments();
    };
  }, []); // empty deps — register once only

  const processedOrders = useMemo(() => {
    return localOrders.map((o) => ({
      ...o,
      displayStatus: (o.orderStatus || o.status || 'CREATED').toUpperCase(),
    }));
  }, [localOrders]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return processedOrders.filter((o) => {
      if (filter !== 'ALL' && o.displayStatus !== filter) return false;
      if (!query) return true;

      const id           = String(o._id || '').toLowerCase();
      const orderNumber  = String(o.orderNumber || '').toLowerCase();
      const customerName = String(
        (o.userId as any)?.name || (o.user as any)?.name || ''
      ).toLowerCase();

      return id.includes(query) || orderNumber.includes(query) || customerName.includes(query);
    });
  }, [processedOrders, filter, q]);

  const onConfirm = async (id: string) => {
    try {
      const response = await confirmOrder(id).unwrap();
      const updatedOrder = response.order || response;
      console.log('[ORDER_UPDATED_UI] confirmed', id);
      setLocalOrders(createOrderListUpdater(updatedOrder));
      dispatch(showToast('Order confirmed successfully'));
    } catch (err: any) {
      console.error('Confirm order error:', err);
      dispatch(showToast(err.data?.message || 'Failed to confirm order'));
    }
  };

  const onPack = async (id: string) => {
    try {
      const response = await packOrder(id).unwrap();
      const updatedOrder = response.order || response;
      console.log('[ORDER_UPDATED_UI] packed', id);
      setLocalOrders(createOrderListUpdater(updatedOrder));
      dispatch(showToast('Order packed — moved to Cluster Orders'));
      dispatch(adminApi.util.invalidateTags(['Clusters']));
    } catch (err: any) {
      console.error('Pack order error:', err);
      dispatch(showToast(err.data?.message || 'Failed to pack order'));
    }
  };

  const onCancel = async (id: string) => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await cancelOrder(id).unwrap();
            const updatedOrder = response.order || response;
            console.log('[ORDER_UPDATED_UI] cancelled', id);
            setLocalOrders(createOrderListUpdater(updatedOrder));
            dispatch(showToast('Order cancelled'));
          } catch (err: any) {
            dispatch(showToast(err.data?.message || 'Failed to cancel order'));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.safe}>
      <AdminHeader
        title="Orders Management"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        {/* Sticky filter bar */}
        <View style={styles.filterBarContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTERS}
            keyExtractor={(i) => i.key}
            contentContainerStyle={styles.filtersRow}
            renderItem={({ item }) => {
              const selected = item.key === filter;
              return (
                <TouchableOpacity
                  onPress={() => setFilter(item.key)}
                  style={[
                    styles.pill,
                    selected ? styles.pillSelected : styles.pillUnselected,
                    { marginRight: 10 },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.pillText, selected ? styles.pillTextSelected : styles.pillTextUnselected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by order ID or customer name"
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
            autoCapitalize="none"
          />
        </View>

        {/* Cluster Orders Navigation Button */}
        <View style={styles.clusterButtonWrap}>
          <TouchableOpacity
            style={styles.clusterButton}
            onPress={() => navigation.navigate('ClusterOrders')}
            activeOpacity={0.85}
          >
            <Text style={styles.clusterButtonText}>📦 Cluster Orders</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load orders</Text>
            <Text style={styles.emptySub}>Socket events will update orders automatically</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item._id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No orders found</Text>
                <Text style={styles.emptySub}>Try changing filters or search</Text>
              </View>
            }
            renderItem={({ item }: { item: any }) => {
              const status        = item.displayStatus as Exclude<StatusFilter, 'ALL'>;
              const shortId       = String(item._id).slice(-6);
              const customerName  = String((item.userId as any)?.name || (item.user as any)?.name || 'Unknown');
              const customerPhone = String((item.userId as any)?.phone || (item.user as any)?.phone || '-');
              const itemsCount    = Array.isArray(item.items) ? item.items.length : 0;
              const total         = Number(item.totalAmount || 0);

              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.orderTitle}>Order #{shortId}</Text>
                      <Text style={styles.muted}>ID: {String(item._id)}</Text>
                    </View>
                    <StatusBadge status={status} />
                  </View>

                  <View style={styles.row}>
                    <Text style={[styles.label, { marginRight: 10 }]}>Customer</Text>
                    <Text style={styles.value} numberOfLines={1}>
                      {customerName} · {customerPhone}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={[styles.label, { marginRight: 10 }]}>Items</Text>
                    <Text style={styles.value}>{itemsCount} items</Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={[styles.label, { marginRight: 10 }]}>Total</Text>
                    <Text style={styles.amount}>₹{total}</Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={[styles.label, { marginRight: 10 }]}>Date</Text>
                    <Text style={styles.value}>{formatDate(item.createdAt)}</Text>
                  </View>

                  {/* Action buttons — ASSIGN removed, only CONFIRM and PACK remain */}
                  {item.allowedActions && item.allowedActions.length > 0 && (
                    <View style={styles.actionsRow}>
                      {item.allowedActions.includes('CONFIRM') && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.confirmBtn, { marginRight: 8 }]}
                          onPress={() => onConfirm(String(item._id))}
                          disabled={confirming}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.actionText}>
                            {confirming ? 'Confirming...' : 'Confirm'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {item.allowedActions.includes('PACK') && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.packBtn]}
                          onPress={() => onPack(String(item._id))}
                          disabled={packing}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.actionText}>
                            {packing ? 'Packing...' : 'Pack'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {/* ASSIGN button intentionally removed — assignment happens in Cluster Orders */}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.detailsBtn}
                    onPress={() => navigation.navigate('AdminOrderDetail', { orderId: String(item._id) })}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.detailsText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  filterBarContainer: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: '#0B5FFF',
    borderColor: '#0B5FFF',
    shadowColor: '#0B5FFF',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pillUnselected: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pillTextSelected: { color: '#FFFFFF' },
  pillTextUnselected: { color: '#475569' },
  searchWrap: { paddingHorizontal: 12, paddingBottom: 10 },
  search: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  clusterButtonWrap: { paddingHorizontal: 12, paddingBottom: 10 },
  clusterButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0B5FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B5FFF',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  clusterButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  listContent: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  muted: { marginTop: 2, fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  value: { flex: 1, textAlign: 'right', fontSize: 12, color: Colors.textPrimary, fontWeight: '800' },
  amount: { fontSize: 14, color: Colors.primary, fontWeight: '900' },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: { backgroundColor: '#16a34a' },
  packBtn: { backgroundColor: '#2563eb' },
  actionText: { color: Colors.white, fontWeight: '900', fontSize: 13 },
  detailsBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  detailsText: { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  emptySub: { marginTop: 6, fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  errorText: { fontSize: 14, fontWeight: '800', color: Colors.error },
});

export default AdminOrdersScreen;
