import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../../hooks/delivery/useOrders';
import { getStatusConfig } from '../../../utils/deliveryUtils';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';

// ─── Canonical Failure Reasons ────────────────────────────────────────────────

export const FAILURE_REASONS = [
  { key: 'CUSTOMER_NOT_AVAILABLE', label: 'Customer Not Available' },
  { key: 'ADDRESS_ISSUE',          label: 'Address Issue' },
  { key: 'CUSTOMER_REJECTED',      label: 'Customer Rejected' },
] as const;

export type FailureReasonKey = typeof FAILURE_REASONS[number]['key'];

// ─── Types ────────────────────────────────────────────────────────────────────

type CodCollection = {
  _id: string;
  orderId: string;
  mode: 'CASH' | 'UPI';
  amount: number;
  currency: string;
  collectedAt: string;
  idempotencyKey: string;
};

interface ActiveOrderCardProps {
  activeOrders: Order[];
  deliveryAttempted: Record<string, boolean>;
  codCollectionByOrderId: Record<string, CodCollection | null | undefined>;
  otpInputs: Record<string, string>;
  onOtpChange: (orderId: string, value: string) => void;
  onPickup: (orderId: string) => void;
  onStartDelivery: (orderId: string) => void;
  onMarkArrived: (orderId: string) => void;
  onStartDeliveryAttempt: (orderId: string) => void;
  onVerifyOtp: (orderId: string, otp: string) => void;
  onCollectCOD: (orderId: string, mode: 'CASH' | 'UPI') => void;
  onFailDelivery: (orderId: string, reason: FailureReasonKey, notes?: string) => void;
  onRefetch?: () => void;
}

interface SingleOrderCardProps extends Omit<ActiveOrderCardProps, 'activeOrders'> {
  order: Order;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const PROGRESS_STEPS = ['Assigned', 'Picked Up', 'In Transit'] as const;

const isSegmentFilled = (segmentIndex: number, status: string): boolean => {
  switch (segmentIndex) {
    case 0: return ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(status);
    case 1: return ['picked_up', 'in_transit', 'out_for_delivery'].includes(status);
    case 2: return ['in_transit', 'out_for_delivery'].includes(status);
    default: return false;
  }
};

// ─── Payment Badge ────────────────────────────────────────────────────────────

const getPaymentBadge = (paymentStatus: string) => {
  const s = (paymentStatus ?? '').toLowerCase();
  if (s === 'paid') return { label: 'Paid', color: DELIVERY_COLORS.success, bg: DELIVERY_COLORS.successBg };
  if (s === 'awaiting_upi_approval') return { label: 'Awaiting UPI Approval', color: DELIVERY_COLORS.warning, bg: DELIVERY_COLORS.warningBg };
  return { label: 'Pending', color: DELIVERY_COLORS.textSecondary, bg: DELIVERY_COLORS.cardElevated };
};

// ─── Navigation ───────────────────────────────────────────────────────────────

const openNavigation = (order: Order) => {
  const lat = order.address?.lat;
  const lng = order.address?.lng;
  if (lat && lng) {
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  } else {
    Alert.alert('Error', 'Location not available for this order');
  }
};

// ─── Syncing Skeleton ─────────────────────────────────────────────────────────

const SyncingSkeleton: React.FC = () => (
  <View style={styles.syncingContainer}>
    <ActivityIndicator size="small" color={DELIVERY_COLORS.primary} />
    <Text style={styles.syncingText}>Syncing state...</Text>
  </View>
);

// ─── Single Order Card ────────────────────────────────────────────────────────

const SingleOrderCard: React.FC<SingleOrderCardProps> = ({
  order,
  deliveryAttempted,
  codCollectionByOrderId,
  otpInputs,
  onOtpChange,
  onPickup,
  onStartDelivery,
  onMarkArrived,
  onStartDeliveryAttempt,
  onVerifyOtp,
  onCollectCOD,
  onFailDelivery,
  onRefetch,
}) => {
  const status = order.orderStatus.toLowerCase();
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const codCollection = codCollectionByOrderId[order._id];
  const isDeliveryAttempted = deliveryAttempted[order._id] ?? false;
  const isCancelled = status === 'cancelled';

  // allowedActions from server — undefined means the field is absent (stale/missing response)
  const allowedActions: string[] | undefined = order.allowedActions;
  const actionsAbsent = allowedActions === undefined;

  // ── Auto-refetch when allowedActions is absent ────────────────────────────
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (actionsAbsent && onRefetch) {
      refetchTimerRef.current = setTimeout(() => {
        onRefetch();
      }, 1500);
    }
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [actionsAbsent, onRefetch]);

  // ── Failure reason modal state ────────────────────────────────────────────
  const [failModalVisible, setFailModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FailureReasonKey | ''>('');
  const [failNotes, setFailNotes] = useState('');

  const handleOpenFailModal = () => {
    setSelectedReason('');
    setFailNotes('');
    setFailModalVisible(true);
  };

  const handleConfirmFail = () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }
    setFailModalVisible(false);
    onFailDelivery(order._id, selectedReason, failNotes.trim() || undefined);
  };

  const statusConfig = getStatusConfig(status);
  const paymentBadge = getPaymentBadge(order.paymentStatus ?? '');

  // ── Progress Bar ─────────────────────────────────────────────────────────
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        {PROGRESS_STEPS.map((label, i) => {
          const filled = isSegmentFilled(i, status);
          return (
            <React.Fragment key={label}>
              <View style={styles.progressStepWrapper}>
                <View style={[styles.progressDot, filled && styles.progressDotFilled]}>
                  <Ionicons
                    name={filled ? 'checkmark' : 'ellipse-outline'}
                    size={12}
                    color={filled ? DELIVERY_COLORS.white : DELIVERY_COLORS.textMuted}
                  />
                </View>
                <Text style={[styles.progressLabel, filled && styles.progressLabelFilled]}>
                  {label}
                </Text>
              </View>
              {i < PROGRESS_STEPS.length - 1 && (
                <View style={[styles.progressLine, filled && styles.progressLineFilled]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  // ── Customer Info ─────────────────────────────────────────────────────────
  const renderCustomerInfo = () => (
    <View style={styles.customerRow}>
      <View style={styles.customerDetails}>
        <View style={styles.customerNameRow}>
          <Ionicons name="person-circle" size={16} color={DELIVERY_COLORS.info} />
          <Text style={styles.customerName}>{order.userId?.name || 'Customer'}</Text>
        </View>
        {order.userId?.phone ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${order.userId!.phone}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.customerPhone}>{order.userId.phone}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.addressText} numberOfLines={2}>
          {[order.address?.addressLine, order.address?.city, order.address?.pincode]
            .filter(Boolean)
            .join(', ')}
        </Text>
      </View>
      {allowedActions?.includes('NAVIGATE') ? (
        <TouchableOpacity
          style={styles.navigateBtn}
          onPress={() => openNavigation(order)}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={16} color={DELIVERY_COLORS.white} />
          <Text style={styles.navigateBtnText}>Navigate</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ── COD Section ───────────────────────────────────────────────────────────
  // Informational only — visibility driven by allowedActions.includes("COLLECT_COD")
  const renderCodSection = () => {
    if (!allowedActions?.includes('COLLECT_COD')) {
      // Show collected confirmation if COD was collected (informational)
      if (isCod && codCollection) {
        return (
          <View style={styles.codCollectedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={DELIVERY_COLORS.success} />
            <Text style={styles.codCollectedText}>
              Payment Collected ({codCollection.mode === 'CASH' ? 'Cash' : 'UPI'})
            </Text>
          </View>
        );
      }
      return null;
    }
    return (
      <View style={styles.codBanner}>
        <View style={styles.codBannerHeader}>
          <Ionicons name="warning" size={16} color={DELIVERY_COLORS.warning} />
          <Text style={styles.codBannerTitle}>Collect Payment Before Delivery</Text>
        </View>
        <Text style={styles.codAmount}>Amount: ₹{order.totalAmount.toLocaleString('en-IN')}</Text>
        <View style={styles.codBtnRow}>
          <TouchableOpacity
            style={[styles.codMethodBtn, styles.codCashBtn]}
            onPress={() => onCollectCOD(order._id, 'CASH')}
            activeOpacity={0.8}
          >
            <Ionicons name="cash" size={16} color={DELIVERY_COLORS.success} />
            <Text style={styles.codMethodText}>Collect Cash</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.codMethodBtn, styles.codUpiBtn]}
            onPress={() => onCollectCOD(order._id, 'UPI')}
            activeOpacity={0.8}
          >
            <Ionicons name="phone-portrait" size={16} color={DELIVERY_COLORS.info} />
            <Text style={styles.codMethodText}>Collect UPI</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── OTP Section ───────────────────────────────────────────────────────────
  const renderOtpSection = () => {
    if (!allowedActions?.includes('VERIFY_OTP') && !isDeliveryAttempted) return null;
    const otpValue = otpInputs[order._id] ?? '';
    const isComplete = otpValue.length === 4;
    return (
      <View style={styles.otpContainer}>
        <Text style={styles.otpTitle}>Enter OTP sent to customer</Text>
        <TextInput
          style={styles.otpInput}
          value={otpValue}
          onChangeText={(val) => onOtpChange(order._id, val.replace(/\D/g, ''))}
          keyboardType="numeric"
          maxLength={4}
          placeholder="4-digit OTP"
          placeholderTextColor={DELIVERY_COLORS.textMuted}
          textAlign="center"
        />
        <TouchableOpacity
          style={[styles.verifyBtn, !isComplete && styles.verifyBtnDisabled]}
          disabled={!isComplete}
          onPress={() => onVerifyOtp(order._id, otpValue)}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={18} color={DELIVERY_COLORS.white} />
          <Text style={styles.verifyBtnText}>Verify OTP &amp; Complete Delivery</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Action Buttons ────────────────────────────────────────────────────────
  const renderActionButtons = () => {
    if (isCancelled) return null;

    // If allowedActions is absent, show syncing skeleton (task 10.3)
    if (actionsAbsent) {
      return <SyncingSkeleton />;
    }

    const actions = allowedActions!;

    return (
      <View style={styles.actionsContainer}>
        {actions.includes('PICKUP') && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onPickup(order._id)} activeOpacity={0.85}>
            <Ionicons name="cube" size={18} color={DELIVERY_COLORS.white} />
            <Text style={styles.primaryBtnText}>Mark as Picked Up</Text>
          </TouchableOpacity>
        )}
        {actions.includes('START_DELIVERY') && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onStartDelivery(order._id)} activeOpacity={0.85}>
            <Ionicons name="navigate" size={18} color={DELIVERY_COLORS.white} />
            <Text style={styles.primaryBtnText}>Start Delivery</Text>
          </TouchableOpacity>
        )}
        {actions.includes('MARK_ARRIVED') && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onMarkArrived(order._id)} activeOpacity={0.85}>
            <Ionicons name="location" size={18} color={DELIVERY_COLORS.white} />
            <Text style={styles.primaryBtnText}>Mark as Arrived</Text>
          </TouchableOpacity>
        )}
        {actions.includes('SEND_OTP') && !isDeliveryAttempted && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onStartDeliveryAttempt(order._id)} activeOpacity={0.85}>
            <Ionicons name="send" size={18} color={DELIVERY_COLORS.white} />
            <Text style={styles.primaryBtnText}>Start Delivery Attempt</Text>
          </TouchableOpacity>
        )}
        {(actions.includes('VERIFY_OTP') || isDeliveryAttempted) && renderOtpSection()}
        {actions.includes('CUSTOMER_NOT_AVAILABLE') && (
          <TouchableOpacity style={styles.failBtn} onPress={handleOpenFailModal} activeOpacity={0.85}>
            <Ionicons name="close-circle" size={18} color={DELIVERY_COLORS.white} />
            <Text style={styles.failBtnText}>Customer Not Available</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Cancellation Summary ──────────────────────────────────────────────────
  const renderCancellationSummary = () => (
    <View style={styles.cancelledBanner}>
      <Ionicons name="close-circle" size={18} color={DELIVERY_COLORS.danger} />
      <View style={styles.cancelledDetails}>
        <Text style={styles.cancelledTitle}>Order Cancelled</Text>
        {order.cancelReason ? <Text style={styles.cancelledReason}>{order.cancelReason}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>Order #{order._id.slice(-6).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      {/* Amount + Payment */}
      <View style={styles.amountRow}>
        <Text style={styles.orderAmount}>₹{order.totalAmount.toLocaleString('en-IN')}</Text>
        <View style={styles.paymentBadgesRow}>
          <View style={[styles.paymentBadge, { backgroundColor: paymentBadge.bg }]}>
            <Text style={[styles.paymentBadgeText, { color: paymentBadge.color }]}>{paymentBadge.label}</Text>
          </View>
          <View style={styles.paymentMethodBadge}>
            <Text style={styles.paymentMethodText}>{isCod ? 'COD' : 'Prepaid'}</Text>
          </View>
        </View>
      </View>

      {/* 3-Segment Progress Bar */}
      {renderProgressBar()}

      {/* Customer Info + Navigate */}
      {renderCustomerInfo()}

      {/* COD Gate */}
      {renderCodSection()}

      {/* Cancellation or Actions */}
      {isCancelled ? renderCancellationSummary() : renderActionButtons()}

      {/* Failure Reason Modal */}
      <Modal visible={failModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Failure Reason</Text>
            {FAILURE_REASONS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.reasonOption, selectedReason === key && styles.reasonOptionSelected]}
                onPress={() => setSelectedReason(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.reasonText, selectedReason === key && styles.reasonTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.notesInput}
              value={failNotes}
              onChangeText={setFailNotes}
              placeholder="Additional notes (optional)"
              placeholderTextColor={DELIVERY_COLORS.textMuted}
              maxLength={200}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { marginRight: DELIVERY_SPACING.sm }]}
                onPress={() => setFailModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !selectedReason && styles.modalConfirmBtnDisabled]}
                onPress={handleConfirmFail}
                disabled={!selectedReason}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────

export const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({ activeOrders, ...props }) => (
  <View>
    {activeOrders.map(order => (
      <SingleOrderCard key={order._id} order={order} {...props} />
    ))}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.lg,
    marginHorizontal: DELIVERY_SPACING.lg,
    marginVertical: DELIVERY_SPACING.sm,
    ...DELIVERY_SHADOW.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DELIVERY_SPACING.sm,
  },
  orderId: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
  },
  statusBadgeText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DELIVERY_SPACING.md,
  },
  orderAmount: {
    fontSize: DELIVERY_TYPOGRAPHY.md,
    color: DELIVERY_COLORS.earnings,
    fontWeight: '700',
  },
  paymentBadgesRow: {
    flexDirection: 'row',
    gap: DELIVERY_SPACING.xs,
    alignItems: 'center',
  },
  paymentBadge: {
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
  },
  paymentBadgeText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '600',
  },
  paymentMethodBadge: {
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.cardElevated,
  },
  paymentMethodText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: DELIVERY_SPACING.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStepWrapper: {
    alignItems: 'center',
    width: 64,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DELIVERY_SPACING.xs,
  },
  progressDotFilled: {
    backgroundColor: DELIVERY_COLORS.success,
  },
  progressLabel: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textMuted,
    textAlign: 'center',
  },
  progressLabelFilled: {
    color: DELIVERY_COLORS.success,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: DELIVERY_COLORS.border,
    marginTop: 13,
    marginHorizontal: -4,
  },
  progressLineFilled: {
    backgroundColor: DELIVERY_COLORS.success,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
    gap: DELIVERY_SPACING.sm,
  },
  customerDetails: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.xs,
  },
  customerName: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.info,
    textDecorationLine: 'underline',
    marginBottom: DELIVERY_SPACING.xs,
  },
  addressText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    lineHeight: 18,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: DELIVERY_COLORS.primary,
    borderRadius: DELIVERY_RADIUS.sm,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    alignSelf: 'flex-start',
  },
  navigateBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.white,
    fontWeight: '600',
  },
  codBanner: {
    backgroundColor: DELIVERY_COLORS.warningBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.warning,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
  },
  codBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.xs,
  },
  codBannerTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.warning,
    fontWeight: '700',
  },
  codAmount: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: DELIVERY_SPACING.md,
  },
  codBtnRow: {
    flexDirection: 'row',
    gap: DELIVERY_SPACING.sm,
  },
  codMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.xs,
    paddingVertical: DELIVERY_SPACING.sm,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1.5,
  },
  codCashBtn: {
    borderColor: DELIVERY_COLORS.success,
    backgroundColor: DELIVERY_COLORS.successBg,
  },
  codUpiBtn: {
    borderColor: DELIVERY_COLORS.info,
    backgroundColor: DELIVERY_COLORS.card,
  },
  codMethodText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '600',
  },
  codCollectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: DELIVERY_COLORS.successBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.success,
    padding: DELIVERY_SPACING.md,
    marginBottom: DELIVERY_SPACING.md,
  },
  codCollectedText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.success,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: DELIVERY_SPACING.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.primary,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
  },
  primaryBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  failBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.danger,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
  },
  failBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  otpContainer: {
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
    padding: DELIVERY_SPACING.md,
    gap: DELIVERY_SPACING.sm,
  },
  otpTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  otpInput: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.border,
    color: DELIVERY_COLORS.textPrimary,
    fontSize: DELIVERY_TYPOGRAPHY.xl,
    fontWeight: '700',
    paddingVertical: DELIVERY_SPACING.sm,
    letterSpacing: 8,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.success,
    borderRadius: DELIVERY_RADIUS.md,
    paddingVertical: DELIVERY_SPACING.md,
  },
  verifyBtnDisabled: {
    backgroundColor: DELIVERY_COLORS.border,
  },
  verifyBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.dangerBg,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.danger,
    padding: DELIVERY_SPACING.md,
  },
  cancelledDetails: {
    flex: 1,
  },
  cancelledTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.danger,
    fontWeight: '700',
    marginBottom: DELIVERY_SPACING.xs,
  },
  cancelledReason: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.md,
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
  },
  syncingText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  // ── Failure Reason Modal ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DELIVERY_SPACING.lg,
  },
  modalContent: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.lg,
    width: '100%',
    gap: DELIVERY_SPACING.sm,
  },
  modalTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: DELIVERY_SPACING.xs,
  },
  reasonOption: {
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.border,
  },
  reasonOptionSelected: {
    borderColor: DELIVERY_COLORS.primary,
    backgroundColor: DELIVERY_COLORS.cardElevated,
  },
  reasonText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: DELIVERY_COLORS.primary,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
    color: DELIVERY_COLORS.textPrimary,
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    padding: DELIVERY_SPACING.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: DELIVERY_SPACING.xs,
  },
  modalCancelBtn: {
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
  },
  modalCancelText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    backgroundColor: DELIVERY_COLORS.danger,
  },
  modalConfirmBtnDisabled: {
    backgroundColor: DELIVERY_COLORS.border,
  },
  modalConfirmText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
  },
});

export default ActiveOrderCard;
