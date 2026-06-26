/**
 * StickyCurrentOrderPanel
 *
 * Always-visible panel showing current order info, eliminating search under pressure.
 * Orange + White theme — matches the Orders page visual identity.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../utils/deliveryUtils';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
} from '../../constants/deliveryTheme';
import { useDynamicFontSize } from '../../hooks/delivery/useDynamicFontSize';
import { useHighContrastMode } from '../../hooks/delivery/useHighContrastMode';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StickyCurrentOrderPanelProps {
  currentOrder: Order | null;
  isArranged: boolean;
  onCallCustomer: (phone: string) => void;
  onNavigate: (order: Order) => void;
}

type NextAction =
  | 'Confirm Pickup'
  | 'Mark Arrived'
  | 'Enter OTP'
  | `Collect ₹${number}`
  | 'Confirm Delivery'
  | null;

interface DerivedOrderInfo {
  nextAction: NextAction;
  hasOtp: boolean;
  hasCod: boolean;
  codAmount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveNextAction(order: Order): NextAction {
  const status = order.orderStatus?.toLowerCase();
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const codAmount = order.totalAmount ?? 0;
  const requiresOtp = order.allowedActions?.includes('verify_otp') ?? false;

  switch (status) {
    case 'assigned':
      return 'Confirm Pickup';
    case 'picked_up':
      return 'Mark Arrived';
    case 'arrived':
      if (requiresOtp) return 'Enter OTP';
      if (isCod && codAmount > 0) return `Collect ₹${codAmount}` as NextAction;
      return 'Confirm Delivery';
    default:
      return null;
  }
}

function deriveOrderInfo(order: Order): DerivedOrderInfo {
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const codAmount = order.totalAmount ?? 0;
  const hasOtp = order.allowedActions?.includes('verify_otp') ?? false;
  const hasCod = isCod && codAmount > 0;
  const nextAction = deriveNextAction(order);
  return { nextAction, hasOtp, hasCod, codAmount };
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  color: string;
  bgColor: string;
}

const Badge: React.FC<BadgeProps> = ({ label, color, bgColor }) => (
  <View style={[styles.badge, { backgroundColor: bgColor }]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

// ─── Component ────────────────────────────────────────────────────────────────

const StickyCurrentOrderPanelInner: React.FC<StickyCurrentOrderPanelProps> = ({
  currentOrder,
  isArranged,
  onCallCustomer,
  onNavigate,
}) => {
  const customerNameFontSize = useDynamicFontSize(18);
  const addressFontSize = useDynamicFontSize(14);
  const isHighContrast = useHighContrastMode();

  const derivedInfo = useMemo(
    () => (currentOrder ? deriveOrderInfo(currentOrder) : null),
    [
      currentOrder?._id,
      currentOrder?.orderStatus,
      currentOrder?.allowedActions,
      currentOrder?.paymentMethod,
      currentOrder?.totalAmount,
    ],
  );

  if (!currentOrder || !derivedInfo) return null;

  const { nextAction, hasOtp, hasCod, codAmount } = derivedInfo;

  const customerName = currentOrder.userId?.name ?? 'Customer';
  const customerPhone = currentOrder.userId?.phone ?? '';
  const addressLine = currentOrder.address?.addressLine ?? '';
  const city = currentOrder.address?.city ?? '';
  const fullAddress = [addressLine, city].filter(Boolean).join(', ');

  const addressColor = isHighContrast ? DELIVERY_COLORS.textPrimary : DELIVERY_COLORS.textSecondary;

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`Current order for ${customerName}`}
    >
      {/* Top row: customer name + call button */}
      <View style={styles.topRow}>
        <View style={styles.nameAndBadges}>
          <Text
            style={[styles.customerName, { fontSize: customerNameFontSize }]}
            numberOfLines={1}
            accessibilityLabel={`Customer: ${customerName}`}
          >
            {customerName}
          </Text>

          <View style={styles.badgeRow}>
            {hasOtp && (
              <Badge
                label="OTP Required"
                color={DELIVERY_COLORS.info}
                bgColor="#EBF8FF"
              />
            )}
            {hasCod && (
              <Badge
                label={`COD ₹${codAmount}`}
                color={DELIVERY_COLORS.warning}
                bgColor={DELIVERY_COLORS.warningBg}
              />
            )}
          </View>
        </View>

        {/* Call button — green, 48x48dp */}
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => customerPhone && onCallCustomer(customerPhone)}
          disabled={!customerPhone}
          accessibilityLabel={`Call ${customerName}`}
          accessibilityRole="button"
        >
          <Ionicons name="call" size={20} color={DELIVERY_COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Address */}
      <TouchableOpacity
        onPress={() => onNavigate(currentOrder)}
        accessibilityLabel={`Navigate to ${fullAddress}`}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <Text
          style={[styles.address, { fontSize: addressFontSize, color: addressColor }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {fullAddress || 'Address not available'}
        </Text>
      </TouchableOpacity>

      {/* Next action — orange button */}
      {nextAction !== null && (
        <TouchableOpacity
          style={styles.nextActionContainer}
          onPress={() => onNavigate(currentOrder)}
          accessibilityLabel={`Next action: ${nextAction}`}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.nextActionText}>{nextAction}</Text>
          <Ionicons name="arrow-forward" size={14} color={DELIVERY_COLORS.white} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export const StickyCurrentOrderPanel = React.memo(
  StickyCurrentOrderPanelInner,
  (prev, next) => {
    if (prev.currentOrder === null && next.currentOrder === null) return true;
    if (prev.currentOrder === null || next.currentOrder === null) return false;
    return (
      prev.currentOrder._id === next.currentOrder._id &&
      prev.currentOrder.orderStatus === next.currentOrder.orderStatus &&
      prev.currentOrder.paymentMethod === next.currentOrder.paymentMethod &&
      prev.currentOrder.totalAmount === next.currentOrder.totalAmount &&
      JSON.stringify(prev.currentOrder.allowedActions) ===
        JSON.stringify(next.currentOrder.allowedActions) &&
      prev.isArranged === next.isArranged
    );
  },
);

StickyCurrentOrderPanel.displayName = 'StickyCurrentOrderPanel';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: DELIVERY_COLORS.card,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: DELIVERY_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameAndBadges: {
    flex: 1,
    marginRight: DELIVERY_SPACING.sm,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: DELIVERY_RADIUS.sm,
  },
  badgeText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '600',
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  address: {
    fontSize: 14,
    fontWeight: '400',
    color: DELIVERY_COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  nextActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DELIVERY_COLORS.primary,   // Orange — matches Orders page
    borderRadius: DELIVERY_RADIUS.md,
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
    alignSelf: 'flex-start',
  },
  nextActionText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    fontWeight: '700',
    color: DELIVERY_COLORS.white,
    lineHeight: 22,
  },
});
