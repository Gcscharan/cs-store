import React, { useState } from 'react'; 
import { 
  View, Text, ScrollView, StyleSheet, 
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, 
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { 
  useGetOrderByIdQuery, useCancelOrderMutation, 
  useRequestRefundMutation, 
} from '../../api/ordersApi'; 
 
function normalizeStatus(status: string): string {
  const s = String(status || '').toUpperCase();
  if (['PENDING', 'PENDING_PAYMENT', 'CREATED'].includes(s)) return 'CREATED';
  if (['CONFIRMED', 'PROCESSING'].includes(s)) return 'CONFIRMED';
  if (['PACKED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s)) return 'IN_TRANSIT';
  if (s === 'DELIVERED') return 'DELIVERED';
  if (['CANCELLED', 'CANCELED'].includes(s)) return 'CANCELLED';
  if (s === 'FAILED') return 'FAILED';
  return s;
} 
 
const STATUS_STEPS = [ 
  { key: 'CREATED', label: 'Order Placed', desc: 'We have received your order' },
  { key: 'CONFIRMED', label: 'Order Confirmed', desc: 'Your order is being prepared' },
  { key: 'IN_TRANSIT', label: 'Out for Delivery', desc: 'Your rider is on the way' },
  { key: 'DELIVERED', label: 'Delivered', desc: 'Order delivered successfully' },
]; 

const CANCEL_REASONS = [ 
  'Changed my mind', 
  'Ordered by mistake', 
  'Found better price elsewhere', 
  'Delivery taking too long', 
  'Other', 
]; 

const formatCurrency = (amount: number | string) => {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN')}`;
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}
 
export default function OrderDetailScreen({ route, navigation }: any) { 
  const { orderId } = route.params || {}; 
  const { data, isLoading, refetch } = useGetOrderByIdQuery(orderId, {
    refetchOnMountOrArgChange: true,
    pollingInterval: 10000, 
  }); 
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation(); 
  const [requestRefund, { isLoading: refunding }] = useRequestRefundMutation(); 
 
  const [showCancelModal, setShowCancelModal] = useState(false); 
  const [showRefundModal, setShowRefundModal] = useState(false); 
  const [cancelReason, setCancelReason] = useState(''); 
  const [refundReason, setRefundReason] = useState(''); 
 
  const order = (data as any)?.order || data; 
 
  if (isLoading) {
    return ( 
      <View style={styles.container}>
        <ScreenHeader title="Order Details" showBackButton />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching order details...</Text>
        </View> 
      </View>
    ); 
  }

  if (!order || !order._id) {
    return ( 
      <View style={styles.container}>
        <ScreenHeader title="Order Details" showBackButton />
        <View style={styles.center}>
          <Feather name="package" size={48} color={Colors.textLight} />
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackTxt}>Go Back</Text>
          </TouchableOpacity>
        </View> 
      </View>
    );
  }
 
  const normalizedStatus = normalizeStatus(order?.status);
  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === normalizedStatus);

  const canCancel = ['CREATED', 'PENDING', 'CONFIRMED'].includes(order?.status); 
  const canRefund = order?.status === 'DELIVERED' && order?.paymentStatus === 'PAID'; 
  const isFailedOrCancelled = ['CANCELLED', 'CANCELED', 'FAILED'].includes(normalizedStatus);

  const handleCancel = async () => { 
    if (!cancelReason) { Alert.alert('Please select a reason'); return; } 
    try { 
      await cancelOrder({ orderId, reason: cancelReason }).unwrap(); 
      setShowCancelModal(false); 
      Alert.alert('✅ Order Cancelled', 'Your order has been cancelled successfully.'); 
      refetch(); 
    } catch (e: any) { 
      Alert.alert('Error', e?.data?.message || 'Cannot cancel order'); 
    } 
  }; 
 
  const handleRefund = async () => { 
    if (!refundReason.trim()) { 
      Alert.alert('Please provide a reason'); return; 
    } 
    try { 
      await requestRefund({ orderId, reason: refundReason }).unwrap(); 
      setShowRefundModal(false); 
      Alert.alert('✅ Refund Requested', 'Your refund request has been submitted. We will process it within 3-5 business days.'); 
      refetch(); 
    } catch (e: any) { 
      Alert.alert('Error', e?.data?.message || 'Cannot request refund'); 
    } 
  }; 
 
  return ( 
    <View style={styles.container}> 
      <ScreenHeader 
        title={`Order #${order?.orderId || (typeof order?._id === 'string' ? order._id.slice(-8).toUpperCase() : '')}`} 
        showBackButton 
      />
 
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}> 
        
        {/* Timeline Tracking Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking Status</Text>

          {isFailedOrCancelled ? (
            <View style={styles.failedBox}>
              <View style={styles.failedRow}>
                <Ionicons name="close-circle" size={24} color={Colors.error} />
                <Text style={styles.failedTitle}>Order Cancelled</Text>
              </View>
              {order.cancelReason ? (
                <Text style={styles.failedDesc}>Reason: {order.cancelReason}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.timelineWrapper}>
              {STATUS_STEPS.map((step, idx) => {
                const isCompleted = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;
                const isLast = idx === STATUS_STEPS.length - 1;

                return (
                  <View key={step.key} style={styles.timelineNode}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, isCompleted && styles.timelineDotCompleted, isCurrent && styles.timelineDotCurrent]}>
                        <Ionicons 
                          name={isCompleted ? 'checkmark' : 'ellipse'} 
                          size={12} 
                          color={isCompleted || isCurrent ? Colors.white : Colors.border} 
                        />
                      </View>
                      {!isLast && <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineNodeLabel, isCompleted && styles.timelineNodeLabelCompleted]}>{step.label}</Text>
                      {isCompleted && (
                        <Text style={styles.timelineNodeDesc}>
                          {isCurrent && order.updatedAt ? formatDate(order.updatedAt) : step.desc}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Items Card */} 
        <View style={styles.card}> 
          <Text style={styles.cardTitle}>Bill Details</Text> 
          
          <View style={styles.itemsList}>
            {order.items?.map((item: any, i: number) => ( 
              <View key={i} style={styles.itemRow}> 
                <View style={styles.itemBullet} />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.name || item.product?.name}</Text>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text> 
                </View>
                <Text style={styles.itemTotal}>{formatCurrency((item.price * item.quantity) || 0)}</Text> 
              </View> 
            ))} 
          </View>

          <View style={styles.dashedLine} />
          
          <View style={styles.billRow}> 
            <Text style={styles.billLabel}>Item Total</Text> 
            <Text style={styles.billValue}>{formatCurrency(order.subtotal || order.totalAmount)}</Text> 
          </View> 
          <View style={styles.billRow}> 
            <Text style={styles.billLabel}>Delivery Fee</Text> 
            <Text style={[styles.billValue, order.deliveryFee === 0 && { color: Colors.success }]}> 
              {order.deliveryFee === 0 ? 'FREE' : formatCurrency(order.deliveryFee || 0)} 
            </Text> 
          </View> 

          <View style={styles.dashedLine} />

          <View style={[styles.billRow, { marginBottom: 0 }]}> 
            <Text style={styles.billTotalLabel}>Grand Total</Text> 
            <Text style={styles.billTotalValue}>{formatCurrency(order.totalAmount)}</Text> 
          </View> 
          
          <View style={styles.paidViaPill}>
            <Ionicons name="card-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.paidViaTxt}>
              {order.paymentStatus === 'PAID' ? 'Paid' : 'Pending Payment'} • {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}
            </Text>
          </View>
        </View> 
 
        {/* Delivery Details Card */} 
        <View style={styles.card}> 
          <Text style={styles.cardTitle}>Delivery Information</Text> 
          
          <View style={styles.deliveryInfoRow}>
            <View style={styles.iconCircle}>
              <Feather name="map-pin" size={18} color={Colors.primary} />
            </View>
            <View style={styles.deliveryTextCol}>
              <Text style={styles.deliveryName}>{order.deliveryAddress?.name || order.address?.name || 'Customer'}</Text> 
              <Text style={styles.deliveryAddressStr}>
                {[
                  order.deliveryAddress?.line1 || order.deliveryAddress?.addressLine || order.address?.address || order.address?.addressLine,
                  order.deliveryAddress?.city || order.address?.city,
                  order.deliveryAddress?.state || order.address?.state,
                  order.deliveryAddress?.pincode || order.address?.pincode
                ].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>

          <View style={styles.deliveryInfoRow}>
            <View style={styles.iconCircle}>
              <Feather name="phone" size={18} color={Colors.primary} />
            </View>
            <View style={styles.deliveryTextCol}>
              <Text style={styles.deliveryName}>Phone Number</Text> 
              <Text style={styles.deliveryAddressStr}>{order.deliveryAddress?.phone || order.address?.phone || 'No phone provided'}</Text> 
            </View>
          </View>
        </View> 

        {/* Support Section */}
        <View style={styles.supportCard}>
          <Text style={styles.supportHeader}>Need help with your order?</Text>
          {(canCancel || canRefund) ? ( 
            <View style={styles.actionRow}> 
              {canCancel && ( 
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowCancelModal(true)}> 
                  <Text style={styles.outlineBtnTxt}>Cancel Order</Text> 
                </TouchableOpacity> 
              )} 
              {canRefund && ( 
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowRefundModal(true)}> 
                  <Text style={styles.outlineBtnTxt}>Request Refund</Text> 
                </TouchableOpacity> 
              )} 
            </View> 
          ) : null} 
          
          <TouchableOpacity style={styles.supportRow}>
            <Feather name="mail" size={18} color={Colors.textSecondary} />
            <Text style={styles.supportTxt}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.supportRight} />
          </TouchableOpacity>
        </View>
 
      </ScrollView> 
 
      {/* Cancel Modal */} 
      <Modal visible={showCancelModal} animationType="fade" transparent> 
        <View style={styles.modalOverlay}> 
          <View style={styles.modalSheet}> 
            <Text style={styles.modalTitle}>Cancel Order?</Text> 
            <Text style={styles.modalSub}>Please let us know why you are cancelling.</Text> 
            
            <View style={styles.reasonsContainer}>
              {CANCEL_REASONS.map(reason => ( 
                <TouchableOpacity 
                  key={reason} 
                  style={[styles.reasonRow, cancelReason === reason && styles.reasonRowActive]} 
                  onPress={() => setCancelReason(reason)} 
                  activeOpacity={0.7}
                > 
                  <View style={[styles.radio, cancelReason === reason && styles.radioActive]}> 
                    {cancelReason === reason && <View style={styles.radioDot} />} 
                  </View> 
                  <Text style={[styles.reasonTxt, cancelReason === reason && styles.reasonTxtActive]}>{reason}</Text> 
                </TouchableOpacity> 
              ))} 
            </View>

            <View style={styles.modalBtns}> 
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCancelModal(false)}> 
                <Text style={styles.modalCancelTxt}>Dismiss</Text> 
              </TouchableOpacity> 
              <TouchableOpacity style={[styles.modalConfirmBtn, cancelling && styles.disabledBtn]} onPress={handleCancel} disabled={cancelling}> 
                <Text style={styles.modalConfirmTxt}>{cancelling ? 'Cancelling...' : 'Confirm Cancel'}</Text> 
              </TouchableOpacity> 
            </View> 
          </View> 
        </View> 
      </Modal> 
 
      {/* Refund Modal */} 
      <Modal visible={showRefundModal} animationType="fade" transparent> 
        <View style={styles.modalOverlay}> 
          <View style={styles.modalSheetBottom}> 
            <Text style={styles.modalTitle}>Request Refund</Text> 
            <Text style={styles.modalSub}>Usually processed within 3-5 business days.</Text> 
            <TextInput 
              style={styles.refundInput} 
              placeholder="Describe your issue..." 
              multiline 
              numberOfLines={4} 
              value={refundReason} 
              onChangeText={setRefundReason} 
              placeholderTextColor={Colors.textMuted}
            /> 
            <View style={styles.modalBtns}> 
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRefundModal(false)}> 
                <Text style={styles.modalCancelTxt}>Cancel</Text> 
              </TouchableOpacity> 
              <TouchableOpacity style={[styles.modalConfirmBtn, refunding && styles.disabledBtn]} onPress={handleRefund} disabled={refunding}> 
                <Text style={styles.modalConfirmTxt}>{refunding ? 'Submitting...' : 'Submit Request'}</Text> 
              </TouchableOpacity> 
            </View> 
          </View> 
        </View> 
      </Modal> 
    </View> 
  ); 
} 
 
const styles = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: Colors.background }, 
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontWeight: '500' },
  errorText: { marginTop: 16, fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  goBackBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.primary, borderRadius: 12 },
  goBackTxt: { color: Colors.white, fontWeight: '700', fontSize: 16 },

  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white, 
  }, 
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitleText: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  headerSubText: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '500' },
  spacer: { width: 40 },

  scrollContent: { padding: 16, paddingBottom: 40 },

  // Generic Card
  card: { 
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1,
  }, 
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 }, 

  // Timeline
  timelineWrapper: { marginTop: 8 },
  timelineNode: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLeft: { width: 40, alignItems: 'center' },
  timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  timelineDotCompleted: { backgroundColor: Colors.success },
  timelineDotCurrent: { backgroundColor: Colors.primary },
  timelineLine: { width: 2, height: 32, backgroundColor: '#F3F4F6', marginVertical: 4 },
  timelineLineCompleted: { backgroundColor: Colors.success },
  timelineContent: { flex: 1, paddingBottom: 24, paddingTop: 2 },
  timelineNodeLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  timelineNodeLabelCompleted: { color: Colors.textPrimary, fontWeight: '700' },
  timelineNodeDesc: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  failedBox: { backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FEE2E2' },
  failedRow: { flexDirection: 'row', alignItems: 'center' },
  failedTitle: { color: Colors.error, fontWeight: '700', fontSize: 15, marginLeft: 8 },
  failedDesc: { color: Colors.textSecondary, marginTop: 8, fontSize: 13 },

  // Bill Details
  itemsList: { marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }, 
  itemBullet: { width: 14, height: 14, borderRadius: 4, backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#D1D5DB', marginTop: 3 },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 }, 
  itemQty: { fontSize: 13, color: Colors.textMuted, marginTop: 4, fontWeight: '500' }, 
  itemTotal: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary }, 
  
  dashedLine: { height: 1, width: '100%', borderColor: '#E5E7EB', borderStyle: 'dashed', borderWidth: 1, marginVertical: 16 },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, 
  billLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' }, 
  billValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary }, 
  billTotalLabel: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary }, 
  billTotalValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary }, 
  
  paidViaPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 16 },
  paidViaTxt: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginLeft: 6 },

  // Delivery Info
  deliveryInfoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
  deliveryTextCol: { flex: 1, paddingTop: 2, marginLeft: 12 },
  deliveryName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 }, 
  deliveryAddressStr: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 }, 

  // Support Card
  supportCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 24 },
  supportHeader: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  
  actionRow: { flexDirection: 'row', marginBottom: 16 }, 
  outlineBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', marginHorizontal: 6 }, 
  outlineBtnTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 }, 
  
  supportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  supportTxt: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginLeft: 12 },
  supportRight: { marginLeft: 'auto' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }, 
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }, 
  modalSheetBottom: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 60 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 }, 
  modalSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 }, 
  
  reasonsContainer: { marginBottom: 24 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 }, 
  reasonRowActive: { borderColor: Colors.primary, backgroundColor: '#FFF7ED' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' }, 
  radioActive: { borderColor: Colors.primary }, 
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }, 
  reasonTxt: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500', marginLeft: 12 }, 
  reasonTxtActive: { fontWeight: '700', color: Colors.primary },

  refundInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 15, minHeight: 120, textAlignVertical: 'top', marginBottom: 24, backgroundColor: '#F9FAFB', color: Colors.textPrimary }, 
  
  modalBtns: { flexDirection: 'row' }, 
  modalCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', marginRight: 6 }, 
  modalCancelTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 }, 
  modalConfirmBtn: { flex: 2, paddingVertical: 16, borderRadius: 12, backgroundColor: Colors.error, alignItems: 'center', marginLeft: 6 }, 
  modalConfirmTxt: { color: Colors.white, fontWeight: '800', fontSize: 15 }, 
  disabledBtn: { opacity: 0.7 }
}); 
