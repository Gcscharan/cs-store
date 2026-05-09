import React, { useMemo, useState, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import { useGetOrderByIdQuery } from '../../api/ordersApi';
import { useCancelOrderMutation, useConfirmOrderMutation, usePackOrderMutation, useAssignOrderMutation, useGetAdminCodCollectionQuery, useGetAdminOrdersQuery } from '../../api/adminApi';
import DeliveryPartnerSelectionModal from '../../components/admin/DeliveryPartnerSelectionModal';
import CancelOrderModal from '../../components/admin/CancelOrderModal';
import CodCollectionCard from '../../components/admin/CodCollectionCard';
import { socketClient, OrderStatusChangedData, OrderAssignedData } from '../../services/socketClient';
import { updateSingleOrderState } from '../../utils/orderStateUtils';
import { useDispatch } from 'react-redux';
import { showToast } from '../../store/slices/uiSlice';
import { AppDispatch } from '../../store';

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
  allowedActions?: string[];
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
  const dispatch = useDispatch<AppDispatch>();
  const route = useRoute<any>();
  const { orderId } = (route.params || {}) as RouteParams;

  console.log('🔍 AdminOrderDetailScreen - orderId:', orderId);

  // PRIMARY: Fetch from admin orders list (same as web app)
  const { data: adminOrdersData, isFetching: adminFetching, error: adminError } = useGetAdminOrdersQuery(undefined);

  // Find order from admin orders list
  const orderFromList = React.useMemo(() => {
    if (!adminOrdersData?.orders) {
      console.log('⚠️ No admin orders data yet');
      return undefined;
    }
    console.log('📋 Admin orders count:', adminOrdersData.orders.length);
    const found = adminOrdersData.orders.find((o: any) => String(o._id) === String(orderId));
    console.log('🔎 Found order in list:', !!found, found?._id);
    return found;
  }, [adminOrdersData, orderId]);

  // FALLBACK: Try direct order fetch if admin orders fails
  const { data: directOrder, isFetching: directFetching, error: directError } = useGetOrderByIdQuery(orderId, {
    skip: !!orderFromList, // Skip if we already have the order from admin list
  });

  const order = orderFromList || directOrder;
  const isFetching = adminFetching || directFetching;
  const error = adminError || directError;

  const refetch = () => {
    // Refetch will be handled by RTK Query automatically
    console.log('🔄 Refetch triggered');
  };

  const [confirmOrder, { isLoading: confirming }] = useConfirmOrderMutation();
  const [packOrder, { isLoading: packing }] = usePackOrderMutation();
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [assignOrder, { isLoading: assigning }] = useAssignOrderMutation();

  // Local state to manage order for real-time updates
  const [localOrder, setLocalOrder] = useState<OrderLike | null>(null);
  
  // Modal state for delivery partner selection
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // Modal state for cancel confirmation
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // Update local order when data changes
  React.useEffect(() => {
    const finalOrder = order;
    if (finalOrder) {
      console.log('📦 Order data loaded:', {
        orderId: finalOrder._id,
        orderNumber: finalOrder.orderNumber,
        status: finalOrder.orderStatus || finalOrder.status,
        hasItems: !!finalOrder.items?.length,
        itemsCount: finalOrder.items?.length || 0,
        hasCustomer: !!finalOrder.userId,
        customerName: typeof finalOrder.userId === 'object' ? finalOrder.userId?.name : 'Not populated',
        hasAddress: !!finalOrder.address,
        addressLine: finalOrder.address?.addressLine || 'No address',
      });
      setLocalOrder(finalOrder);
    } else {
      console.log('⚠️ No order data available yet');
    }
  }, [order]);

  // Use local order for display, fallback to API order
  const displayOrder = localOrder || order;
  const status = (displayOrder?.orderStatus || displayOrder?.status || 'CREATED').toUpperCase();

  // Fetch COD collection data if payment method is COD
  const paymentMethod = String(displayOrder?.paymentMethod || '').toLowerCase();
  const { data: codCollectionData, isLoading: codLoading } = useGetAdminCodCollectionQuery(orderId, {
    skip: paymentMethod !== 'cod',
  });

  // Connect socket events to order state updates
  useEffect(() => {
    const unsubscribeStatusChanges = socketClient.subscribeToOrderStatusChanges((data: OrderStatusChangedData) => {
      // Update order state when status changes from other sources (web admin, etc.)
      // Only update if this is the order we're currently viewing (relevant orders only)
      if (data.order && data.orderId === orderId) {
        setLocalOrder(data.order);
        
        // Show toast notification for status changes
        const statusFrom = data.from?.toUpperCase();
        const statusTo = data.to?.toUpperCase();
        dispatch(showToast(`Order status changed: ${statusFrom} → ${statusTo}`));
      }
    });

    const unsubscribeAssignments = socketClient.subscribeToOrderAssignments((data: OrderAssignedData) => {
      // Update order state when delivery partner is assigned from other sources
      // Only update if this is the order we're currently viewing (relevant orders only)
      if (data.order && data.orderId === orderId) {
        setLocalOrder(data.order);
        
        // Show toast notification for delivery partner assignment
        const partnerName = data.deliveryPartner?.name || 'Delivery Partner';
        dispatch(showToast(`${partnerName} assigned to order`));
      }
    });

    // Cleanup socket listeners on unmount
    return () => {
      unsubscribeStatusChanges();
      unsubscribeAssignments();
    };
  }, [orderId, dispatch]);

  const priceDetails = useMemo(() => {
    const items = Array.isArray(displayOrder?.items) ? displayOrder?.items : [];
    let itemsSubtotal = 0;
    for (const it of items) {
      const qty = Number(it.qty || it.quantity || 1);
      const price = Number(it.price || 0);
      itemsSubtotal += price * qty;
    }
    const total = Number(displayOrder?.totalAmount || 0);
    const deliveryFee = Math.max(0, total - itemsSubtotal);
    return { itemsSubtotal, deliveryFee, total };
  }, [displayOrder]);



  const customer = (displayOrder as any)?.userId && typeof (displayOrder as any).userId === 'object' ? (displayOrder as any).userId : (displayOrder as any)?.user;
  const address = (displayOrder as any)?.address;

  console.log('📍 Address data:', {
    hasAddress: !!address,
    addressLine: address?.addressLine,
    city: address?.city,
    state: address?.state,
    pincode: address?.pincode,
    label: address?.label,
    name: address?.name,
    phone: address?.phone,
    landmark: address?.landmark,
  });

  const partner =
    displayOrder?.deliveryPartner ||
    ((displayOrder as any)?.deliveryBoyId && typeof (displayOrder as any).deliveryBoyId === 'object'
      ? {
          name: (displayOrder as any).deliveryBoyId?.name,
          phone: (displayOrder as any).deliveryBoyId?.phone,
          vehicleType: (displayOrder as any).deliveryBoyId?.vehicleType, // Direct field, not nested
        }
      : null);

  console.log('🚚 Delivery partner data:', {
    hasPartner: !!partner,
    partnerName: partner?.name,
    partnerPhone: partner?.phone,
    vehicleType: partner?.vehicleType,
    deliveryBoyId: (displayOrder as any)?.deliveryBoyId,
    deliveryBoyIdType: typeof (displayOrder as any)?.deliveryBoyId,
    rawVehicleType: (displayOrder as any)?.deliveryBoyId?.vehicleType,
  });

  const onCall = async (phone?: string) => {
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  };

  const handleAssignPartner = async (deliveryBoyId: string) => {
    if (!displayOrder?._id) return;
    
    try {
      const response = await assignOrder({
        id: String(displayOrder._id),
        deliveryBoyId,
      }).unwrap();
      
      // Use complete order object from API response to update state
      const updatedOrder = response.order || response;
      setLocalOrder(updatedOrder);
      setShowAssignModal(false);
      dispatch(showToast('Delivery partner assigned successfully'));
    } catch (error: any) {
      console.error('Failed to assign delivery partner:', error);
      dispatch(showToast(error.data?.message || 'Failed to assign delivery partner'));
    }
  };

  const handleCancelOrder = async () => {
    if (!displayOrder?._id) return;
    
    try {
      const response = await cancelOrder(String(displayOrder._id)).unwrap();
      
      // Use complete order object from API response to update state
      const updatedOrder = response.order || response;
      setLocalOrder(updatedOrder);
      setShowCancelModal(false);
      dispatch(showToast('Order cancelled successfully'));
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      dispatch(showToast(error.data?.message || 'Failed to cancel order'));
    }
  };

  const formatPaymentInfo = (): string => {
    if (!displayOrder) return 'Payment Pending';
    
    const method = String(displayOrder.paymentMethod || 'cod').toLowerCase();
    const status = String(displayOrder.paymentStatus || 'pending').toLowerCase();
    
    if (status === 'paid' && displayOrder.paymentReceivedAt) {
      const date = new Date(displayOrder.paymentReceivedAt);
      const formattedDate = date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      if (method === 'cod') {
        return `Paid in cash on delivery on ${formattedDate}`;
      } else if (method === 'upi') {
        return `Paid via UPI on ${formattedDate}`;
      } else {
        return `Paid on ${formattedDate}`;
      }
    } else if (status === 'paid') {
      if (method === 'cod') return 'Paid in cash on delivery';
      if (method === 'upi') return 'Paid via UPI';
      return 'Paid';
    }
    
    return 'Payment Pending';
  };

  if (isFetching && !displayOrder) {
    return (
      <View style={styles.safe}>
        <AdminHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </View>
    );
  }

  if (error || !displayOrder) {
    return (
      <View style={styles.safe}>
        <AdminHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load order</Text>
          <Text style={styles.emptySub}>
          {(error as any)?.data?.message || 'Order not found or you do not have permission to view it'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AdminHeader title="Order Details" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.topRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.h1}>Order #{String(displayOrder.orderNumber || String(displayOrder._id).slice(-6)).toUpperCase()}</Text>
              <Text style={styles.muted}>ID: {String(displayOrder._id)}</Text>
              <Text style={styles.muted}>Date: {formatDate(displayOrder.createdAt)}</Text>
            </View>
            <StatusBadge status={status} />
          </View>

          {/* Action buttons based on allowedActions */}
          {displayOrder.allowedActions && displayOrder.allowedActions.length > 0 && (
            <View style={styles.actionsRow}>
              {displayOrder.allowedActions.includes("CONFIRM") && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnGreen, { marginRight: 8 }]}
                  onPress={async () => {
                    try {
                      const response = await confirmOrder(String(displayOrder._id)).unwrap();
                      const updatedOrder = response.order || response;
                      setLocalOrder(updatedOrder);
                      dispatch(showToast('Order confirmed successfully'));
                    } catch (error: any) {
                      console.error('Failed to confirm order:', error);
                      dispatch(showToast(error.data?.message || 'Failed to confirm order'));
                    }
                  }}
                  disabled={confirming}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>
                    {confirming ? 'Confirming...' : 'Confirm'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {displayOrder.allowedActions.includes("PACK") && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnBlue, { marginRight: 8 }]}
                  onPress={async () => {
                    try {
                      const response = await packOrder(String(displayOrder._id)).unwrap();
                      const updatedOrder = response.order || response;
                      setLocalOrder(updatedOrder);
                      dispatch(showToast('Order packed successfully'));
                    } catch (error: any) {
                      console.error('Failed to pack order:', error);
                      dispatch(showToast(error.data?.message || 'Failed to pack order'));
                    }
                  }}
                  disabled={packing}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>
                    {packing ? 'Packing...' : 'Pack'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {displayOrder.allowedActions.includes("ASSIGN") && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnBlue, { marginRight: 8 }]}
                  onPress={() => setShowAssignModal(true)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>Assign</Text>
                </TouchableOpacity>
              )}
              
              {/* Cancel button - show for CREATED and CONFIRMED statuses */}
              {(status === 'CREATED' || status === 'CONFIRMED' || status === 'PENDING') && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnRed]}
                  onPress={() => setShowCancelModal(true)}
                  disabled={cancelling}
                  activeOpacity={0.9}
                >
                  <Text style={styles.actionText}>
                    {cancelling ? 'Cancelling...' : 'Cancel Order'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}


        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {(displayOrder.items || []).map((it, idx) => {
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
          {address ? (
            <>
              <View style={styles.addressTop}>
                <View style={styles.addressLabel}>
                  <Text style={styles.addressLabelText}>{String(address?.label || 'HOME').toUpperCase()}</Text>
                </View>
              </View>
              
              {/* Recipient Name (if different from customer) */}
              {address?.name && address.name !== customer?.name && (
                <View style={styles.addressRecipient}>
                  <Text style={styles.addressRecipientLabel}>Recipient:</Text>
                  <Text style={styles.addressRecipientValue}>{String(address.name)}</Text>
                </View>
              )}
              
              {/* Recipient Phone (if different from customer) */}
              {address?.phone && address.phone !== customer?.phone && (
                <View style={styles.addressRecipient}>
                  <Text style={styles.addressRecipientLabel}>📱</Text>
                  <Text style={styles.addressRecipientValue}>{String(address.phone)}</Text>
                </View>
              )}
              
              <Text style={styles.addressLine}>{String(address?.addressLine || '-')}</Text>
              
              {/* Landmark */}
              {address?.landmark && (
                <Text style={styles.addressLandmark}>
                  Landmark: {String(address.landmark)}
                </Text>
              )}
              
              <Text style={styles.muted}>
                {String(address?.city || '')}
                {address?.city ? ', ' : ''}
                {String(address?.state || '')} {String(address?.pincode || '')}
              </Text>
            </>
          ) : (
            <View style={styles.noDataBox}>
              <Text style={styles.noDataText}>⚠️ No delivery address provided</Text>
              <Text style={styles.noDataSubtext}>
                This order was created without a delivery address
              </Text>
            </View>
          )}
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
            <Text style={styles.v}>{String(displayOrder.paymentMethod || 'COD').toUpperCase()}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={[styles.k, { marginRight: 10 }]}>Status</Text>
            <Text style={[styles.v, displayOrder.paymentStatus === 'paid' && { color: Colors.success }]}>
              {String(displayOrder.paymentStatus || 'Pending').toUpperCase()}
            </Text>
          </View>
          <View style={[styles.kvRow, { marginTop: 4 }]}>
            <Text style={[styles.k, { marginRight: 10, flex: 1 }]}>Details</Text>
            <Text style={[styles.v, { flex: 2, textAlign: 'right' }]}>
              {formatPaymentInfo()}
            </Text>
          </View>
          
          {/* COD Collection Details */}
          {paymentMethod === 'cod' && (
            <CodCollectionCard
              codCollection={codCollectionData?.codCollection || null}
              isLoading={codLoading}
            />
          )}
        </View>
      </ScrollView>

      {/* Delivery Partner Selection Modal */}
      <DeliveryPartnerSelectionModal
        visible={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSelectPartner={handleAssignPartner}
        isAssigning={assigning}
      />

      {/* Cancel Order Confirmation Modal */}
      <CancelOrderModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelOrder}
        isLoading={cancelling}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  errorText: { fontSize: 14, fontWeight: '700', color: Colors.error, marginBottom: 12 },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  retryBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: Colors.white, fontWeight: '700' },
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
  itemImgWrap: { height: 48, width: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.inputBackground },
  itemImg: { height: '100%', width: '100%' },
  itemImgPlaceholder: { flex: 1, backgroundColor: Colors.inputBackground },
  itemName: { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  itemPrice: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  k: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  v: { fontSize: 12, color: Colors.textPrimary, fontWeight: '900', textAlign: 'right' },
  totalK: { fontSize: 13, color: Colors.textPrimary, fontWeight: '900' },
  totalV: { fontSize: 13, color: Colors.primary, fontWeight: '900' },
  addressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.inputBackground },
  addressLabelText: { fontSize: 11, fontWeight: '900', color: Colors.textSecondary },
  addressRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  addressRecipientLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginRight: 8,
  },
  addressRecipientValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addressLine: { marginTop: 8, fontSize: 12, fontWeight: '900', color: Colors.textPrimary },
  addressLandmark: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  noDataBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    textAlign: 'center',
  },
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
