import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../../utils/deliveryUtils';
import { DELIVERY_COLORS, DELIVERY_SPACING, DELIVERY_TYPOGRAPHY, DELIVERY_RADIUS } from '../../../constants/deliveryTheme';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StickyCurrentOrderPanelProps {
  currentOrder: Order | null;
  isArranged: boolean;
  onCallCustomer: (phone: string) => void;
  onNavigate: (order: Order) => void;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Derives the next action text based on order status and payment requirements.
 * Returns action-oriented language (e.g., "Collect OTP", "Confirm Pickup").
 */
const deriveNextAction = (order: Order): string => {
  const status = (order.orderStatus ?? '').toLowerCase();
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const hasArrived = !!order.arrivedAt;

  switch (status) {
    case 'assigned':
      return 'Confirm Pickup';
    case 'picked_up':
      return 'Start Delivery';
    case 'in_transit':
      return 'Mark Arrived';
    case 'arrived':
      if (isCod && hasArrived) {
        return `Collect ₹${order.totalAmount}`;
      }
      return 'Collect OTP';
    default:
      return 'View Details';
  }
};

/**
 * Truncates address to 2 lines max (approximately 60 characters).
 */
const truncateAddress = (address: string, maxLength: number = 60): string => {
  if (address.length <= maxLength) return address;
  return address.substring(0, maxLength) + '...';
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StickyCurrentOrderPanel
 * 
 * Always-visible panel showing current order info, eliminating search under pressure.
 * 
 * **Requirements**: 1.1-1.8
 * **Design**: Fixed at top, 120dp height, displays customer name, address, call button,
 *             OTP/COD badges, and next action.
 * **Performance**: Uses React.memo and memoization to prevent jitter on low-end Android.
 */
export const StickyCurrentOrderPanel = React.memo<StickyCurrentOrderPanelProps>(
  ({ currentOrder, isArranged, onCallCustomer, onNavigate }) => {
    // Hide when no current order exists (Requirement 1.8)
    if (!currentOrder || !isArranged) {
      return null;
    }

    // Memoize derived values to prevent unnecessary recalculations
    const nextAction = useMemo(() => deriveNextAction(currentOrder), [
      currentOrder.orderStatus,
      currentOrder.paymentMethod,
      currentOrder.arrivedAt,
      currentOrder.totalAmount,
    ]);

    const customerName = currentOrder.userId?.name || 'Customer';
    const customerPhone = currentOrder.userId?.phone || '';
    const addressText = truncateAddress(
      `${currentOrder.address.addressLine}, ${currentOrder.address.city}${
        currentOrder.address.pincode ? ` - ${currentOrder.address.pincode}` : ''
      }`
    );

    const isCod = currentOrder.paymentMethod?.toLowerCase() === 'cod';
    const hasArrived = !!currentOrder.arrivedAt;
    const showOtpBadge = hasArrived && !isCod;
    const showCodBadge = hasArrived && isCod;

    const handleCallPress = () => {
      if (customerPhone) {
        onCallCustomer(customerPhone);
      }
    };

    const handleNavigatePress = () => {
      onNavigate(currentOrder);
    };

    return (
      <View style={styles.container}>
        {/* Top Row: Customer Name + Call Button */}
        <View style={styles.topRow}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customerName}
          </Text>
          {customerPhone && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallPress}
              accessibilityLabel="Call customer"
              accessibilityHint="Opens phone dialer to call the customer"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={20} color={DELIVERY_COLORS.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Address Row */}
        <Text style={styles.address} numberOfLines={2}>
          {addressText}
        </Text>

        {/* Bottom Row: Badges + Next Action */}
        <View style={styles.bottomRow}>
          {/* Badges */}
          <View style={styles.badgeContainer}>
            {showOtpBadge && (
              <View style={styles.otpBadge}>
                <Ionicons name="key" size={12} color={DELIVERY_COLORS.white} />
                <Text style={styles.badgeText}>OTP Required</Text>
              </View>
            )}
            {showCodBadge && (
              <View style={styles.codBadge}>
                <Ionicons name="cash" size={12} color={DELIVERY_COLORS.white} />
                <Text style={styles.badgeText}>COD ₹{currentOrder.totalAmount}</Text>
              </View>
            )}
          </View>

          {/* Next Action Button */}
          <TouchableOpacity
            style={styles.nextActionButton}
            onPress={handleNavigatePress}
            accessibilityLabel={nextAction}
            accessibilityHint="Opens navigation to customer location"
            accessibilityRole="button"
          >
            <Text style={styles.nextActionText}>{nextAction}</Text>
            <Ionicons name="arrow-forward" size={16} color={DELIVERY_COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  // Custom comparison to prevent unnecessary rerenders (Risk B mitigation)
  (prevProps, nextProps) => {
    // Only rerender if current order ID or status changes
    return (
      prevProps.currentOrder?._id === nextProps.currentOrder?._id &&
      prevProps.currentOrder?.orderStatus === nextProps.currentOrder?.orderStatus &&
      prevProps.currentOrder?.arrivedAt === nextProps.currentOrder?.arrivedAt &&
      prevProps.isArranged === nextProps.isArranged
    );
  }
);

StickyCurrentOrderPanel.displayName = 'StickyCurrentOrderPanel';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 120,
    backgroundColor: DELIVERY_COLORS.cardElevated,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: DELIVERY_COLORS.border,
    // Fixed position is handled by parent container in DeliveryHomeTab
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DELIVERY_SPACING.xs,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
    flex: 1,
    marginRight: DELIVERY_SPACING.sm,
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: DELIVERY_RADIUS.full,
    backgroundColor: DELIVERY_COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    // 48x48dp touch target (Requirement 5.1)
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
    color: DELIVERY_COLORS.textSecondary,
    marginBottom: DELIVERY_SPACING.sm,
    // 2 lines max with ellipsis (Requirement 1.2)
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: DELIVERY_SPACING.xs,
    flex: 1,
  },
  otpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.info,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.sm,
    gap: 4,
  },
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.warning,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.sm,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: DELIVERY_COLORS.white,
  },
  nextActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.primary,
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
    borderRadius: DELIVERY_RADIUS.sm,
    gap: DELIVERY_SPACING.xs,
    minHeight: 36, // Ensure adequate touch target
  },
  nextActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: DELIVERY_COLORS.white,
  },
});
