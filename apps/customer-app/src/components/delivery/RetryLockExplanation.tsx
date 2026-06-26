import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
} from '../../constants/deliveryTheme';
import { useDynamicFontSize } from '../../hooks/delivery/useDynamicFontSize';
import { useHighContrastMode } from '../../hooks/delivery/useHighContrastMode';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Props for RetryLockExplanation component
 */
export interface RetryLockExplanationProps {
  /** Order ID for the locked delivery attempt */
  orderId: string;
  /** Number of failed delivery attempts recorded */
  attemptCount: number;
  /** Seconds remaining until retry becomes available */
  remainingSeconds: number;
  /** Whether the retry is currently locked */
  isLocked: boolean;
  /** Callback when driver taps "Retry Now" */
  onRetry: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a duration in seconds to a human-readable string.
 *
 * Examples:
 *   formatTime(90)  → "1m 30s"
 *   formatTime(45)  → "45s"
 *   formatTime(0)   → "0s"
 *
 * Requirements: 4.2
 */
export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) {
    return `${s}s`;
  }
  const minutes = Math.floor(s / 60);
  const remainingSecs = s % 60;
  return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RetryLockExplanation Component
 *
 * Displays plain-language retry guidance when a delivery attempt is locked
 * due to retry backoff. Drivers see why they're locked and when they can
 * retry — no technical jargon.
 *
 * **Display Logic**:
 * - `attemptCount === 0`          → returns null (nothing to show)
 * - `isLocked === true`           → shows reason, countdown, and guidance
 * - `isLocked === false && attemptCount > 0` → shows "Retry Now" button
 *
 * **Countdown Behavior**:
 * - Updates every 1 second via `setInterval`
 * - Auto-enables the "Retry Now" button when the lock expires (no refresh needed)
 *
 * Requirements: 4.1-4.6
 *
 * @example
 * ```tsx
 * <RetryLockExplanation
 *   orderId={order._id}
 *   attemptCount={attemptState?.attemptCount ?? 0}
 *   remainingSeconds={getRemainingSeconds(order._id)}
 *   isLocked={isRetryLocked(order._id)}
 *   onRetry={handleRetry}
 * />
 * ```
 */
export const RetryLockExplanation: React.FC<RetryLockExplanationProps> = ({
  orderId,
  attemptCount,
  remainingSeconds,
  isLocked,
  onRetry,
}) => {
  // ── Accessibility hooks (must be called before any early returns) ──────────

  // Dynamic font sizing for countdown and guidance text (Requirement 15.2)
  const countdownFontSize = useDynamicFontSize(DELIVERY_TYPOGRAPHY.sm);
  const guidanceFontSize = useDynamicFontSize(DELIVERY_TYPOGRAPHY.xs);
  const titleFontSize = useDynamicFontSize(DELIVERY_TYPOGRAPHY.base);
  const retryFontSize = useDynamicFontSize(DELIVERY_TYPOGRAPHY.base);

  // High contrast mode (Requirement 15.7)
  const isHighContrast = useHighContrastMode();

  // ── Local countdown state ──────────────────────────────────────────────────

  // Mirror remainingSeconds into local state so the interval can tick it down
  // independently of the parent re-render cycle.
  const [countdown, setCountdown] = useState<number>(remainingSeconds);

  // Track whether the lock has expired locally (auto-enables button without
  // requiring a screen refresh — Requirement 4.6)
  const [locallyUnlocked, setLocallyUnlocked] = useState<boolean>(!isLocked);

  // Keep a ref to the interval so we can clear it on unmount / prop change.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync external prop changes into local state (e.g., parent re-derives lock)
  useEffect(() => {
    setCountdown(remainingSeconds);
    setLocallyUnlocked(!isLocked);
  }, [remainingSeconds, isLocked, orderId]);

  // Tick the countdown every second while locked (Requirement 4.4)
  useEffect(() => {
    if (!isLocked || locallyUnlocked) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          // Lock has expired — auto-enable without screen refresh (Req 4.6)
          setLocallyUnlocked(true);
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          // Announce to screen readers (Requirement 15.4)
          AccessibilityInfo.announceForAccessibility(
            'Retry is now available. Tap Retry Now to try again.',
          );
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // Re-run only when the locked state or orderId changes, not on every countdown tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, locallyUnlocked, orderId]);

  // ── Early exit: nothing to show on first attempt ───────────────────────────

  // Requirement 4.1 / display logic: return null when no attempts have been made
  if (attemptCount === 0) {
    return null;
  }

  // ── Locked state ───────────────────────────────────────────────────────────

  if (isLocked && !locallyUnlocked) {
    // High contrast text colors (Requirement 15.7)
    const titleColor = isHighContrast ? DELIVERY_COLORS.textPrimary : DELIVERY_COLORS.textPrimary;
    const countdownColor = isHighContrast ? DELIVERY_COLORS.textPrimary : DELIVERY_COLORS.textMuted;
    const guidanceColor = isHighContrast ? DELIVERY_COLORS.textPrimary : DELIVERY_COLORS.textMuted;

    return (
      <View
        style={styles.lockedContainer}
        accessibilityRole="alert"
        accessibilityLabel={`Delivery attempt failed. Retry available in ${formatTime(countdown)}. Continue with other deliveries while you wait.`}
      >
        {/* Title row */}
        <View style={styles.titleRow}>
          <Ionicons
            name="time-outline"
            size={20}
            color={DELIVERY_COLORS.textMuted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.titleText, { fontSize: titleFontSize, color: titleColor }]}>
            Delivery attempt failed
          </Text>
        </View>

        {/* Countdown — Requirement 4.2 */}
        <Text
          style={[styles.countdownText, { fontSize: countdownFontSize, color: countdownColor }]}
          accessibilityLabel={`Retry available in ${formatTime(countdown)}`}
        >
          Retry available in{' '}
          <Text style={[styles.countdownHighlight, { fontSize: countdownFontSize }]}>
            {formatTime(countdown)}
          </Text>
        </Text>

        {/* Guidance — Requirement 4.4 */}
        <View style={styles.guidanceRow}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={DELIVERY_COLORS.textMuted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.guidanceText, { fontSize: guidanceFontSize, color: guidanceColor }]}>
            Continue with other deliveries while you wait
          </Text>
        </View>
      </View>
    );
  }

  // ── Unlocked state (attemptCount > 0 and lock has expired) ────────────────

  // Requirement 4.3: show "Retry Now" button when retry becomes available
  return (
    <TouchableOpacity
      style={styles.retryButton}
      onPress={onRetry}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Retry Now"
      accessibilityHint="Attempts the delivery again"
    >
      <Ionicons
        name="refresh-circle-outline"
        size={20}
        color="#FFFFFF"
        style={styles.retryIcon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.retryText, { fontSize: retryFontSize }]}>Retry Now</Text>
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Locked container ────────────────────────────────────────────────────────
  lockedContainer: {
    backgroundColor: DELIVERY_COLORS.textMutedBg,
    borderRadius: 8,
    padding: DELIVERY_SPACING.lg,
    marginHorizontal: DELIVERY_SPACING.lg,
    marginVertical: DELIVERY_SPACING.md,
    gap: 8,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  titleText: {
    fontSize: DELIVERY_TYPOGRAPHY.base, fontWeight: '700', lineHeight: 20,
    color: DELIVERY_COLORS.textPrimary,
  },

  countdownText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm, fontWeight: '500', lineHeight: 18,
    color: DELIVERY_COLORS.textMuted,
  },

  countdownHighlight: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '700',
    lineHeight: 18,
    color: DELIVERY_COLORS.textPrimary,
  },

  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },

  guidanceText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs, fontWeight: '400', lineHeight: 16,
    color: DELIVERY_COLORS.textMuted,
    flex: 1,
  },

  // ── Retry button ────────────────────────────────────────────────────────────
  retryButton: {
    // Minimum 48x48dp touch target (Requirements 5.1, 15.5)
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DELIVERY_COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: DELIVERY_SPACING.lg,
    marginHorizontal: DELIVERY_SPACING.lg,
    marginVertical: DELIVERY_SPACING.md,
  },

  retryIcon: {
    marginRight: 8,
  },

  retryText: {
    fontSize: DELIVERY_TYPOGRAPHY.base, fontWeight: '700', lineHeight: 20,
    color: '#FFFFFF',
  },
});
