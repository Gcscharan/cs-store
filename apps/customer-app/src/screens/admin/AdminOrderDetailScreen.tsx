import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import { useGetOrderByIdQuery } from '../../api/ordersApi';
import { useCancelOrderMutation, useConfirmOrderMutation, usePackOrderMutation } from '../../api/adminApi';

type RouteParams = { orderId: string };

type OrderItemLike = {
  productId?: any;
  product?: any;
  qty?: number;
  quantity?: number;
  price?: number;
};

type OrderLike = {
  _id: string;
  orderNumber?: string;
  items?: OrderItemLike[];
  totalAmount?: number;
  status?: string;
  orderStatus?: string;
  createdAt?: string;
  userId?: any;
  user?: any;
  address?: any;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReceivedAt?: string;
  deliveryPartner?: { name?: string; phone?: string; vehicleType?: string } | null;
  deliveryBoyId?: any;
};

const normalizeStatus = (raw?: string): string => {
  const s = String(raw || '').toUpperCase();
  if (s === 'PENDING' || s === 'PENDING_PAYMENT') return 'CREATED';
  if (s === 'OUT_FOR_DELIVERY') return 'IN_TRANSIT';
  return s || 'CREATED';
};

const getProductName = (item: OrderItemLike): string => {
  const product = typeof item.productId === 'object' ? item.productId : item.product;
  return String(product?.name || item.product?.name || 'Product');
};

const getProductImage = (item: OrderItemLike): string | undefined => {
  const product = typeof item.productId === 'object' ? item.productId : item.product;
  const images = product?.images || item.product?.images;
  const first = images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return first?.variants?.thumbnail || first?.variants?.thumb || first?.url || first?.full;
};

const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = (route.params || {}) as RouteParams;

  const { data: order, isFetching, error, refetch } = useGetOrderByIdQuery(orderId) as {
    data: OrderLike | undefined;
    isFetching: boolean;
    error: any;
    refetch: () => void;
  };

  const [confirmOrder, { isLoading: confirming }] = useConfirmOrderMutation();
  const [packOrder, { isLoading: packing }] = usePackOrderMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();

  const status = normalizeStatus(order?.orderStatus || order?.status);

  const priceDetails = useMemo(() => {
    const items = Array.isArray(order?.items) ? order?.items : [];
    let itemsSubtotal = 0;
    for (const it of items) {
      const qty = Number(it.qty || it.quantity || 1);
      const price = Number(it.price || 0);
      itemsSubtotal += price * qty;
    }
    const total = Number(order?.totalAmount || 0);
    const deliveryFee = Math.max(0, total - itemsSubtotal);
    return { itemsSubtotal, deliveryFee, total };
  }, [order]);

  const canConfirm = status === 'CREATED';
  const canPack = status === 'CONFIRMED';
  const canCancel = status === 'CREATED' || status === 'CONFIRMED';

  const customer = (order as any)?.userId && typeof (order as any).userId === 'object' ? (order as any).userId : (order as any)?.user;
  const address = (order as any)?.address;

  const partner =
    order?.deliveryPartner ||
    ((order as any)?.deliveryBoyId && typeof (order as any).deliveryBoyId === 'object'
      ? {
          name: (order as any).deliveryBoyId?.name,
          phone: (order as any).deliveryBoyId?.phone,
          vehicleType: (order as any).deliveryBoyId?.deliveryProfile?.vehicleType,
        }
      : null);

  const onCall = async (phone?: string) => {
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  };

  if (isFetching && !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <AdminHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <AdminHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load order</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Order Details" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.topRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.h1}>Order #{String(order.orderNumber || String(order._id).slice(-6)).toUpperCase()}</Text>
              <Text style={styles.muted}>ID: {String(order._id)}</Text>
              <Text style={styles.muted}>Date: {formatDate(order.createdAt)}</Text>
            </View>
            <StatusBadge status={status} />
          </View>

          {(canConfirm || canPack || canCancel) && (
            <View style={styles.actionsRow}>
              {canConfirm && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnGreen, { marginBottom: 10 }]}
                  onPress={async () => {
                    await confirmOrder(String(order._id)).unwrap();
                    refetch();
                  }}
                  disabled={confirming}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>Confirm Order</Text>
                </TouchableOpacity>
              )}

              {canPack && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnBlue, { marginBottom: 10 }]}
                  onPress={async () => {
                    await packOrder(String(order._id)).unwrap();
                    refetch();
                  }}
                  disabled={packing}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>Mark as Packed</Text>
                </TouchableOpacity>
              )}

              {canCancel && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnRed]}
                  onPress={async () => {
                    await cancelOrder(String(order._id)).unwrap();
                    refetch();
                  }}
                  disabled={cancelling}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {(order.items || []).map((it, idx) => {
            const qty = Number(it.qty || it.quantity || 1);
            const price = Number(it.price || 0);
            const img = getProductImage(it);
            return (
              <View key={String(idx)} style={styles.itemRow}>
                <View style={[styles.itemImgWrap, { marginRight: 10 }]}>
                  {img ? <Image source={{ uri: img }} style={styles.itemImg} /> : <View style={styles.itemImgPlaceholder} />}
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {getProductName(it)}
                  </Text>
                  <Text style={styles.muted}>Qty: {qty}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{price * qty}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Items Subtotal</Text>
            <Text style={styles.v}>₹{priceDetails.itemsSubtotal}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Delivery Fee</Text>
            <Text style={styles.v}>{priceDetails.deliveryFee === 0 ? 'FREE' : `₹${priceDetails.deliveryFee}`}</Text>
          </View>
          <View style={[styles.kvRow, { marginTop: 6 }]}
          >
            <Text style={styles.totalK}>Total Amount</Text>
            <Text style={styles.totalV}>₹{priceDetails.total}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Name</Text>
            <Text style={styles.v}>{String(customer?.name || 'Unknown')}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Email</Text>
            <Text style={styles.v}>{String(customer?.email || '-')}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Phone</Text>
            <Text style={styles.v}>{String(customer?.phone || '-')}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressTop}>
            <View style={styles.addressLabel}>
              <Text style={styles.addressLabelText}>{String(address?.label || 'HOME').toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.addressLine}>{String(address?.addressLine || '-')}</Text>
          <Text style={styles.muted}>
            {String(address?.city || '')}
            {address?.city ? ', ' : ''}
            {String(address?.state || '')} {String(address?.pincode || '')}
          </Text>
        </View>

        {partner?.name ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { marginRight: 10 }]}>Name</Text>
              <Text style={styles.v}>{String(partner.name)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { marginRight: 10 }]}>Phone</Text>
              <Text style={styles.v}>{String(partner.phone || '-')}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.k, { marginRight: 10 }]}>Vehicle</Text>
              <Text style={styles.v}>{String(partner.vehicleType || '-')}</Text>
            </View>

            {partner.phone ? (
              <TouchableOpacity style={styles.callBtn} onPress={() => onCall(partner.phone)} activeOpacity={0.9}>
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment Info</Text>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Method</Text>
            <Text style={styles.v}>{String(order.paymentMethod || '-')}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Status</Text>
            <Text style={styles.v}>{String(order.paymentStatus || '-')}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Paid At</Text>
            <Text style={styles.v}>{formatDate(order.paymentReceivedAt)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '900', color: Colors.error },
  retryBtn: {
    marginTop: 12,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.white, fontWeight: '900' },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  h1: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  muted: { marginTop: 4, fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  actionsRow: { marginTop: 12 },
  actionBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGreen: { backgroundColor: '#16a34a' },
  btnBlue: { backgroundColor: '#2563eb' },
  btnRed: { backgroundColor: Colors.error },
  actionText: { color: Colors.white, fontWeight: '900' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemImgWrap: { height: 48, width: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.backgroundDark },
  itemImg: { height: '100%', width: '100%' },
  itemImgPlaceholder: { flex: 1, backgroundColor: Colors.backgroundDark },
  itemName: { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  itemPrice: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  k: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  v: { fontSize: 12, color: Colors.textPrimary, fontWeight: '900', textAlign: 'right' },
  totalK: { fontSize: 13, color: Colors.textPrimary, fontWeight: '900' },
  totalV: { fontSize: 13, color: Colors.primary, fontWeight: '900' },
  addressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.backgroundDark },
  addressLabelText: { fontSize: 11, fontWeight: '900', color: Colors.textSecondary },
  addressLine: { marginTop: 8, fontSize: 12, fontWeight: '900', color: Colors.textPrimary },
  callBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: { color: Colors.white, fontWeight: '900' },
});

export default AdminOrderDetailScreen;
