import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
} from '../../../constants/deliveryTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttemptBadgeProps {
  /** Number of failed attempts already recorded (1-indexed after first failure) */
  attemptCount: number;
  /** Maximum allowed attempts before escalation */
  maxAttempts: number;
  /** Whether the order is currently in retry backoff */
  isRetryLocked: boolean;
  /** Remaining seconds until retry becomes available (used when isRetryLocked) */
  remainingSeconds: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AttemptBadge
 *
 * Displays the current attempt status on an order card.
 *
 * Text logic:
 *   - isRetryLocked          → "Retry in {remainingSeconds}s"
 *   - attemptCount === maxAttempts - 1  → "Final Attempt"
 *   - otherwise              → "Attempt {attemptCount} of {maxAttempts}"
 *
 * Color logic:
 *   - Final attempt          → DELIVERY_COLORS.danger / dangerBg
 *   - Otherwise              → DELIVERY_COLORS.warning / warningBg
 *
 * Icon:
 *   - Final attempt          → "alert-circle"
 *   - Otherwise              → "refresh-circle"
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 6.4
 */
export const AttemptBadge: React.FC<AttemptBadgeProps> = ({
  attemptCount,
  maxAttempts,
  isRetryLocked,
  remainingSeconds,
}) => {
  const isFinalAttempt = attemptCount === maxAttempts - 1;

  const badgeColor = isFinalAttempt ? DELIVERY_COLORS.danger : DELIVERY_COLORS.warning;
  const badgeBg = isFinalAttempt ? DELIVERY_COLORS.dangerBg : DELIVERY_COLORS.warningBg;

  const iconName: React.ComponentProps<typeof Ionicons>['name'] = isFinalAttempt
    ? 'alert-circle'
    : 'refresh-circle';

  const badgeText = isRetryLocked
    ? `Retry in ${remainingSeconds}s`
    : isFinalAttempt
      ? 'Final Attempt'
      : `Attempt ${attemptCount} of ${maxAttempts}`;

  return (
    <View
      style={[styles.badge, { backgroundColor: badgeBg }]}
      testID="attempt-badge"
      accessibilityLabel={badgeText}
    >
      <Ionicons name={iconName} size={12} color={badgeColor} />
      <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: 3,
    borderRadius: DELIVERY_RADIUS.sm,
  },
  badgeText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '700',
  },
});

export default AttemptBadge;
