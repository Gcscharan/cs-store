import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import { storage } from '../../utils/storage';
import { BASE_URL } from '../../api/baseApi';
import { useGetAdminOrdersQuery, useCancelOrderMutation, useConfirmOrderMutation, usePackOrderMutation } from '../../api/adminApi';

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

const normalizeStatus = (raw?: string): StatusFilter => {
  const s = String(raw || '').toLowerCase();
  
  switch (s) {
    case 'created':
    case 'pending':
    case 'pending_payment':
      return 'CREATED';
    
    case 'confirmed':
      return 'CONFIRMED';
    
    case 'packed':
      return 'PACKED';
    
    case 'in_transit':
    case 'out_for_delivery':
      return 'IN_TRANSIT';
    
    case 'delivered':
      return 'DELIVERED';
    
    case 'cancelled':
      return 'CANCELLED';
    
    default:
      return 'CREATED';
  }
};

const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [q, setQ] = useState('');

  const { data, isFetching, error, refetch } = useGetAdminOrdersQuery(undefined);
  const orders: OrderLike[] = (data as any)?.orders || [];

  const [confirmOrder, { isLoading: confirming }] = useConfirmOrderMutation();
  const [packOrder, { isLoading: packing }] = usePackOrderMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();

  // STEP 2: Preprocess orders ONCE (not inside filter)
  const processedOrders = useMemo(() => {
    return orders.map((o) => ({
      ...o,
      normalizedStatus: normalizeStatus(o.orderStatus || o.status),
    }));
  }, [orders]);

  // STEP 3: Fix filtering logic (clean + predictable)
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    
    return processedOrders.filter((o) => {
      // FILTER BY STATUS
      if (filter !== 'ALL' && o.normalizedStatus !== filter) {
        return false;
      }
      
      // FILTER BY SEARCH
      if (!query) return true;
      
      const id = String(o._id || '').toLowerCase();
      const orderNumber = String(o.orderNumber || '').toLowerCase();
      const customerName = String(
        (o.userId as any)?.name || (o.user as any)?.name || ''
      ).toLowerCase();
      
      return (
        id.includes(query) ||
        orderNumber.includes(query) ||
        customerName.includes(query)
      );
    });
  }, [processedOrders, filter, q]);

  // STEP 5: Add debug safety (temporary)
  console.log('FILTER DEBUG', {
    selectedFilter: filter,
    total: orders.length,
    afterFilter: filtered.length,
  });

  const onConfirm = async (id: string) => {
    try {
      await confirmOrder(id).unwrap();
      Alert.alert('Success', 'Order confirmed successfully');
    } catch (err: any) {
      console.error('Confirm order error:', err);
      Alert.alert('Error', err.data?.message || 'Failed to confirm order');
    }
  };

  const onPack = async (id: string) => {
    try {
      await packOrder(id).unwrap();
      Alert.alert('Success', 'Order packed successfully');
    } catch (err: any) {
      console.error('Pack order error:', err);
      Alert.alert('Error', err.data?.message || 'Failed to pack order');
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
            await cancelOrder(id).unwrap();
            Alert.alert('Success', 'Order cancelled');
          } catch (err: any) {
            Alert.alert('Error', err.data?.message || 'Failed to cancel order');
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
        {/* STEP 6: Sticky filter bar with border */}
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
                    { marginRight: 10 }
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

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load orders</Text>
            <TouchableOpacity onPress={refetch} style={styles.retryBtn} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item._id)}
            refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No orders found</Text>
                <Text style={styles.emptySub}>Try changing filters or search</Text>
              </View>
            }
            renderItem={({ item }: { item: any }) => {
              const status = item.normalizedStatus as Exclude<StatusFilter, 'ALL'>;
              const shortId = String(item._id).slice(-6);
              const customerName = String((item.userId as any)?.name || (item.user as any)?.name || 'Unknown');
              const customerPhone = String((item.userId as any)?.phone || (item.user as any)?.phone || '-');
              const itemsCount = Array.isArray(item.items) ? item.items.length : 0;
              const total = Number(item.totalAmount || 0);

              const canConfirm = status === 'CREATED';
              const canPack = status === 'CONFIRMED';
              const canCancel = status === 'CREATED' || status === 'CONFIRMED';

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

                  {(canConfirm || canPack || canCancel) && (
                    <View style={styles.actionsRow}>
                      {canConfirm && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.confirmBtn, { marginRight: 10 }]}
                          onPress={() => onConfirm(String(item._id))}
                          disabled={confirming}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.actionText}>Confirm ✓</Text>
                        </TouchableOpacity>
                      )}
                      {canPack && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.packBtn, { marginRight: 10 }]}
                          onPress={() => onPack(String(item._id))}
                          disabled={packing}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.actionText}>Pack 📦</Text>
                        </TouchableOpacity>
                      )}
                      {canCancel && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.cancelBtn]}
                          onPress={() => onCancel(String(item._id))}
                          disabled={cancelling}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.actionText}>Cancel ✗</Text>
                        </TouchableOpacity>
                      )}
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
  // STEP 6: Sticky filter bar container
  filterBarContainer: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // STEP 1: Increased spacing + structure
  filtersRow: { 
    paddingHorizontal: 16, 
    paddingVertical: 12,
  },
  // STEP 2: Upgraded pill design
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // STEP 2: Selected pill with glow
  pillSelected: { 
    backgroundColor: '#0B5FFF',
    borderColor: '#0B5FFF',
    shadowColor: '#0B5FFF',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  // STEP 2: Unselected pill with soft gray
  pillUnselected: { 
    backgroundColor: '#F1F5F9', 
    borderColor: '#E2E8F0',
  },
  // STEP 3: Improved text readability
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
  cancelBtn: { backgroundColor: Colors.error },
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
  retryBtn: {
    marginTop: 12,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.white, fontWeight: '900' },
});

export default AdminOrdersScreen;
