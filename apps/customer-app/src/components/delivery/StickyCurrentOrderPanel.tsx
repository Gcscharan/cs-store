/**
 * StickyCurrentOrderPanel
 *
 * Always-visible panel showing current order info, eliminating search under pressure.
 * Drivers on bikes can't scroll to find info — this panel ensures critical data is
 * always visible at the top of the screen.
 *
 * Requirements: 1.1-1.8, 8.1-8.7
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Order } from '../../utils/deliveryUtils';
import {
  UX_COLORS,
  UX_TYPOGRAPHY,
  UX_SPACING,
} from '../../delivery/constants/UXDesignSystem';
import { useDynamicFontSize } from '../../hooks/delivery/useDynamicFontSize';
import { useHighContrastMode } from '../../hooks/delivery/useHighContrastMode';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StickyCurrentOrderPanelProps {
  currentOrder: Order | null;
  isArranged: boolean;
  onCallCustomer: (phone: string) => void;
  onNavigate: (order: Order) => void;
}

/** Derived next action label for the current order. */
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

/**
 * Derives the next action label from the order's current status.
 *
 * Derivation logic (Requirement 8.1-8.4):
 *   assigned          → "Confirm Pickup"
 *   picked_up         → "Mark Arrived"
 *   arrived + OTP     → "Enter OTP"
 *   arrived + COD     → "Collect ₹{amount}"
 *   arrived           → "Confirm Delivery"
 *   otherwise         → null
 */
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

// ─── Phone icon (inline SVG-free, text-based) ─────────────────────────────────

const PhoneIcon: React.FC = () => (
  <Text style={styles.phoneIconText} accessibilityElementsHidden>
    📞
  </Text>
);

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
  // Dynamic font sizing (Requirement 15.2) — must be called before any early returns
  const customerNameFontSize = useDynamicFontSize(18);
  const addressFontSize = useDynamicFontSize(14);

  // High contrast mode (Requirement 15.7) — must be called before any early returns
  const isHighContrast = useHighContrastMode();

  // Memoize derived values to prevent jitter on low-end Android (Requirement 14.1)
  const derivedInfo = useMemo(
    () => (currentOrder ? deriveOrderInfo(currentOrder) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentOrder?._id,
      currentOrder?.orderStatus,
      currentOrder?.allowedActions,
      currentOrder?.paymentMethod,
      currentOrder?.totalAmount,
    ],
  );

  // Return null when no current order (Requirement 1.8)
  if (!currentOrder || !derivedInfo) return null;

  const { nextAction, hasOtp, hasCod, codAmount } = derivedInfo;

  const customerName = currentOrder.userId?.name ?? 'Customer';
  const customerPhone = currentOrder.userId?.phone ?? '';
  const addressLine = currentOrder.address?.addressLine ?? '';
  const city = currentOrder.address?.city ?? '';
  const fullAddress = [addressLine, city].filter(Boolean).join(', ');

  // Apply high contrast text colors (Requirement 15.7)
  const nameColor = UX_COLORS.textHighContrast; // always high contrast for name
  const addressColor = isHighContrast ? UX_COLORS.textHighContrast : '#4A5568';

  const handleCallPress = () => {
    if (customerPhone) {
      onCallCustomer(customerPhone);
    }
  };

  const handleNavigatePress = () => {
    onNavigate(currentOrder);
  };

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`Current order for ${customerName}`}
    >
      {/* Top row: customer name + call button */}
      <View style={styles.topRow}>
        <View style={styles.nameAndBadges}>
          {/* Customer name — 18sp bold (Requirement 1.1, 5.3) */}
          <Text
            style={[styles.customerName, { fontSize: customerNameFontSize, color: nameColor }]}
            numberOfLines={1}
            accessibilityLabel={`Customer: ${customerName}`}
          >
            {customerName}
          </Text>

          {/* State badges (Requirements 1.4, 1.5) */}
          <View style={styles.badgeRow}>
            {hasOtp && (
              <Badge
                label="OTP Required"
                color={UX_COLORS.processing}
                bgColor="#EBF8FF"
              />
            )}
            {hasCod && (
              <Badge
                label={`COD ₹${codAmount}`}
                color={UX_COLORS.syncing}
                bgColor={UX_COLORS.syncingBg}
              />
            )}
          </View>
        </View>

        {/* Call button — 48x48dp touch target (Requirements 1.3, 5.1, 15.1) */}
        <TouchableOpacity
          style={styles.callButton}
          onPress={handleCallPress}
          disabled={!customerPhone}
          accessibilityLabel={`Call ${customerName}`}
          accessibilityHint="Opens phone dialer to call the customer"
          accessibilityRole="button"
        >
          <PhoneIcon />
        </TouchableOpacity>
      </View>

      {/* Delivery address — 14sp, 2 lines max (Requirement 1.2) */}
      <TouchableOpacity
        onPress={handleNavigatePress}
        accessibilityLabel={`Navigate to ${fullAddress}`}
        accessibilityHint="Opens navigation to the delivery address"
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

      {/* Next action — 16sp bold, distinct background (Requirements 1.6, 8.1) */}
      {nextAction !== null && (
        <View style={styles.nextActionContainer}>
          <Text
            style={styles.nextActionText}
            accessibilityLabel={`Next action: ${nextAction}`}
          >
            {nextAction}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Wrap with React.memo using custom comparison that only re-renders when
 * _id or status changes — prevents jitter on low-end Android devices
 * caused by frequent socket/polling updates to unrelated order fields.
 *
 * Requirements: 14.1, 14.4
 */
export const StickyCurrentOrderPanel = React.memo(
  StickyCurrentOrderPanelInner,
  (prev, next) => {
    // If both are null, no re-render needed
    if (prev.currentOrder === null && next.currentOrder === null) return true;
    // If one became null, re-render
    if (prev.currentOrder === null || next.currentOrder === null) return false;
    // Only re-render when _id, status, allowedActions, or payment info changes
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
  /**
   * Fixed/absolute position at top of screen.
   * minHeight: 120 ensures the panel is always readable (Requirement 1.7).
   * zIndex ensures it floats above scroll content.
   */
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    minHeight: 120,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: UX_SPACING.edgePadding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    // Subtle shadow for visual separation from scroll content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
    marginRight: UX_SPACING.componentGap,
  },

  /** Customer name — 18sp bold (Requirement 1.1) */
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: UX_COLORS.textHighContrast,
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
    borderRadius: 4,
  },

  badgeText: {
    ...UX_TYPOGRAPHY.secondary,
    fontSize: 12,
  },

  /**
   * Call button — 48x48dp minimum touch target (Requirements 1.3, 5.1, 15.5).
   * Centered content, rounded for visual affordance.
   */
  callButton: {
    width: UX_SPACING.touchTarget,
    height: UX_SPACING.touchTarget,
    borderRadius: 24,
    backgroundColor: UX_COLORS.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  phoneIconText: {
    fontSize: 20,
  },

  /**
   * Delivery address — 14sp, 2 lines max (Requirement 1.2).
   * numberOfLines={2} is set on the Text element above.
   */
  address: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 8,
  },

  /**
   * Next action container — distinct background color (Requirements 1.6, 8.1).
   * Uses primaryAction color for high contrast in sunlight (Requirement 5.2).
   */
  nextActionContainer: {
    backgroundColor: UX_COLORS.primaryAction,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },

  /** Next action text — 16sp bold (Requirement 8.1) */
  nextActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
});
