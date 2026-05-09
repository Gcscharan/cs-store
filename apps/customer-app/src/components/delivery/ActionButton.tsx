/**
 * ActionButton
 *
 * Unified button component with explicit state feedback for all driver actions.
 * This is a **pure presentation component** — all state comes from props.
 * The caller is responsible for wiring up `useActionFeedback` and passing
 * the resulting `state` down.
 *
 * **State Transition Chain** (the single most important UX improvement):
 *   Idle → Processing… → Queued Offline → Synced → Failed — Retry
 *
 * **Critical Pattern** (IMPLEMENTATION_GUIDE.md Risk A):
 * - No local state in this component — all state comes from props
 * - Queue state is authoritative (managed by useActionFeedback hook)
 * - Button is pure presentation
 *
 * Requirements: 3.1-3.7, 5.1-5.7, 15.1-15.4, 15.6, 15.7
 */

import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  AccessibilityInfo,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  UX_COLORS,
  UX_TYPOGRAPHY,
  UX_SPACING,
} from '../../delivery/constants/UXDesignSystem';
import { ActionButtonState } from '../../hooks/delivery/useActionFeedback';
import { useDynamicFontSize } from '../../hooks/delivery/useDynamicFontSize';
import { useHighContrastMode } from '../../hooks/delivery/useHighContrastMode';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Props for the ActionButton component.
 *
 * The `state` prop is the output of `useActionFeedback` — the button
 * renders it without managing any state of its own.
 */
export interface ActionButtonProps {
  /** Button label text shown in the idle state */
  label: string;
  /** Callback invoked when the button is pressed (idle or failed states only) */
  onPress: () => void;
  /** Visual state from useActionFeedback hook — drives all rendering */
  state: ActionButtonState;
  /** Visual variant controlling idle-state background color */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Prevents interaction regardless of state */
  disabled?: boolean;
  /** Accessibility label for screen readers (Requirement 15.1) */
  accessibilityLabel?: string;
  /** Accessibility hint for screen readers (Requirement 15.1) */
  accessibilityHint?: string;
}

// ─── State Config ─────────────────────────────────────────────────────────────

/**
 * Visual configuration derived from ActionButtonState.
 * Keeps rendering logic declarative and easy to audit.
 */
interface StateConfig {
  displayLabel: string;
  /** Emoji/text icon shown to the left of the label */
  displayIcon: string | null;
  backgroundColor: string;
  textColor: string;
  /** When true, renders an ActivityIndicator instead of displayIcon */
  showSpinner: boolean;
  /** When true, the button is interactive (tappable) */
  interactive: boolean;
  /** Accessibility announcement for state changes (Requirement 15.4) */
  announcement: string;
}

const IDLE_VARIANT_COLORS: Record<
  NonNullable<ActionButtonProps['variant']>,
  { backgroundColor: string; textColor: string }
> = {
  primary: {
    backgroundColor: UX_COLORS.primaryAction, // #2B6CB0 — dark blue (Requirement 5.2)
    textColor: '#FFFFFF',
  },
  secondary: {
    backgroundColor: '#718096', // gray
    textColor: '#FFFFFF',
  },
  danger: {
    backgroundColor: UX_COLORS.dangerAction, // #C53030 — dark red (Requirement 5.2)
    textColor: '#FFFFFF',
  },
};

function getStateConfig(
  state: ActionButtonState,
  variant: NonNullable<ActionButtonProps['variant']>,
  label: string,
): StateConfig {
  switch (state.type) {
    // ── Processing (Requirement 3.1) ─────────────────────────────────────────
    case 'processing':
      return {
        displayLabel: 'Processing…',
        displayIcon: null,
        backgroundColor: UX_COLORS.processing, // #3182CE — blue
        textColor: '#FFFFFF',
        showSpinner: true,
        interactive: false,
        announcement: `${label} is processing`,
      };

    // ── Queued Offline (Requirement 3.2) ─────────────────────────────────────
    case 'queued':
      return {
        displayLabel: 'Queued Offline',
        displayIcon: '📶',
        backgroundColor: UX_COLORS.queued, // #D69E2E — yellow
        textColor: '#1A202C', // dark text for yellow bg contrast
        showSpinner: false,
        interactive: false,
        announcement: `${label} queued offline. Will sync when connected.`,
      };

    // ── Synced (Requirement 3.3, 3.6) ────────────────────────────────────────
    case 'synced':
      return {
        displayLabel: 'Synced',
        displayIcon: '✓',
        backgroundColor: UX_COLORS.synced, // #38A169 — green
        textColor: '#FFFFFF',
        showSpinner: false,
        interactive: false,
        announcement: `${label} synced successfully`,
      };

    // ── Failed — Retry (Requirement 3.4, 3.7) ────────────────────────────────
    case 'failed':
      return {
        displayLabel: 'Failed — Retry',
        displayIcon: '✕',
        backgroundColor: UX_COLORS.failed, // #E53E3E — red
        textColor: '#FFFFFF',
        showSpinner: false,
        interactive: true, // allows retry (Requirement 3.4)
        announcement: `${label} failed. Tap to retry.`,
      };

    // ── Idle (default) ────────────────────────────────────────────────────────
    case 'idle':
    default: {
      const colors = IDLE_VARIANT_COLORS[variant];
      return {
        displayLabel: '', // caller's label is used directly
        displayIcon: null,
        backgroundColor: colors.backgroundColor,
        textColor: colors.textColor,
        showSpinner: false,
        interactive: true,
        announcement: '',
      };
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ActionButton — pure presentation component.
 *
 * @example
 * ```tsx
 * // In the parent component:
 * const { state, onActionStart, onActionSuccess, onActionFailure } =
 *   useActionFeedback(order._id, 'pickup');
 *
 * const handlePickup = async () => {
 *   onActionStart();
 *   try {
 *     await pickupOrder(order._id);
 *     onActionSuccess();
 *   } catch {
 *     onActionFailure();
 *   }
 * };
 *
 * <ActionButton
 *   label="Mark as Picked Up"
 *   onPress={handlePickup}
 *   state={state}
 *   variant="primary"
 *   accessibilityLabel="Mark as picked up"
 *   accessibilityHint="Confirms you have collected the order from the warehouse"
 * />
 * ```
 */
const ActionButtonInner: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  state,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}) => {
  // Dynamic font sizing for button label (Requirement 15.2)
  const labelFontSize = useDynamicFontSize(UX_TYPOGRAPHY.critical.fontSize);

  // High contrast mode (Requirement 15.7)
  const isHighContrast = useHighContrastMode();

  // ── Derive visual config from state ───────────────────────────────────────

  const config = getStateConfig(state, variant, label);

  // The button is interactive only when the state allows it AND not externally disabled
  const isInteractive = config.interactive && !disabled;

  // ── Announce state changes to screen readers (Requirement 15.4) ───────────

  const prevStateTypeRef = useRef<string>(state.type);

  useEffect(() => {
    if (prevStateTypeRef.current !== state.type && config.announcement) {
      AccessibilityInfo.announceForAccessibility(config.announcement);
    }
    prevStateTypeRef.current = state.type;
  }, [state.type, config.announcement]);

  // ── Press handler ─────────────────────────────────────────────────────────

  const handlePress = () => {
    if (!isInteractive) return;

    // Haptic feedback for critical actions (Requirement 15.6)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      // Haptics may not be available on all devices — fail silently
    });

    onPress();
  };

  // ── Resolved label ────────────────────────────────────────────────────────

  // In idle state, use the caller-provided label; all other states override it
  const resolvedLabel = state.type === 'idle' ? label : config.displayLabel;

  // ── Dynamic styles ────────────────────────────────────────────────────────

  const resolvedBg = disabled ? UX_COLORS.locked : config.backgroundColor;

  // Apply high contrast text color when enabled (Requirement 15.7)
  const resolvedTextColor = (() => {
    if (disabled) return '#718096';
    if (isHighContrast && config.textColor === '#FFFFFF') return '#FFFFFF'; // keep white on colored bg
    if (isHighContrast && config.textColor !== '#FFFFFF') return UX_COLORS.textHighContrast;
    return config.textColor;
  })();

  const buttonStyle: ViewStyle = {
    ...styles.button,
    backgroundColor: resolvedBg,
    opacity: disabled ? 0.6 : 1,
  };

  const textStyle: TextStyle = {
    ...styles.label,
    color: resolvedTextColor,
    fontSize: labelFontSize,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? resolvedLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: !isInteractive,
        busy: state.type === 'processing',
      }}
    >
      <View style={styles.content}>
        {/* Spinner (processing state) or icon (all other non-idle states) */}
        {config.showSpinner ? (
          <ActivityIndicator
            size="small"
            color={resolvedTextColor}
            style={styles.iconSlot}
            accessibilityElementsHidden
          />
        ) : config.displayIcon !== null ? (
          <Text
            style={[styles.iconText, { color: resolvedTextColor }]}
            accessibilityElementsHidden
          >
            {config.displayIcon}
          </Text>
        ) : null}

        {/* Label */}
        <Text style={textStyle} numberOfLines={1}>
          {resolvedLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Wrap with React.memo to prevent unnecessary re-renders.
 * Only re-renders when props that affect visual output change.
 *
 * Requirements: 14.1, 14.4
 */
export const ActionButton = React.memo(
  ActionButtonInner,
  (prev, next) =>
    prev.label === next.label &&
    prev.state.type === next.state.type &&
    prev.variant === next.variant &&
    prev.disabled === next.disabled &&
    prev.accessibilityLabel === next.accessibilityLabel &&
    prev.accessibilityHint === next.accessibilityHint &&
    prev.onPress === next.onPress,
);

ActionButton.displayName = 'ActionButton';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /**
   * Minimum 48×48dp touch target (Requirements 5.1, 15.5).
   * Edge padding avoids accidental touches near screen edges (Requirement 5.6).
   * Distinct visual states are achieved via dynamic backgroundColor + opacity.
   */
  button: {
    minHeight: UX_SPACING.touchTarget,   // 48dp
    minWidth: UX_SPACING.touchTarget,    // 48dp
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: UX_SPACING.edgePadding, // 16dp edge padding (Requirement 5.6)
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconSlot: {
    marginRight: 8,
  },

  iconText: {
    fontSize: 16,
    marginRight: 6,
    lineHeight: 20,
  },

  /**
   * Label — 16sp semibold for critical readability (Requirement 5.3).
   * fontSize is overridden dynamically via useDynamicFontSize (Requirement 15.2).
   */
  label: {
    lineHeight: UX_TYPOGRAPHY.critical.lineHeight,
    fontWeight: UX_TYPOGRAPHY.critical.fontWeight,
    textAlign: 'center',
  },
});
