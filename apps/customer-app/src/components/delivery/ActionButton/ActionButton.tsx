import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { UX_COLORS, UX_SPACING, UX_ANIMATIONS } from '../../../delivery/constants/UXDesignSystem';
import { useActionFeedback, ActionButtonState } from '../../../hooks/delivery/useActionFeedback';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Icon names from Ionicons library
 */
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Button variant types
 */
type ButtonVariant = 'primary' | 'secondary' | 'danger';

/**
 * Props for ActionButton component
 */
export interface ActionButtonProps {
  /** Button label text */
  label: string;
  /** Icon name from Ionicons */
  icon: IoniconsName;
  /** Callback when button is pressed */
  onPress: () => void;
  /** Order ID for state tracking */
  orderId: string;
  /** Action type for state tracking (e.g., 'pickup', 'deliver') */
  actionType: string;
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether to trigger haptic feedback on press */
  enableHaptics?: boolean;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Accessibility hint for screen readers */
  accessibilityHint?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ActionButton Component
 * 
 * Unified button component with state feedback for all driver actions.
 * 
 * **Features**:
 * - Visual states: idle, processing, queued, synced, failed
 * - Spinner for processing state
 * - Offline icon for queued state
 * - Checkmark for synced state (2s duration)
 * - Error icon for failed state
 * - 48x48dp minimum touch target (Requirement 5.1)
 * - High-contrast colors (Requirement 5.2)
 * - Haptic feedback for critical actions (Requirement 15.6)
 * - Accessibility labels (Requirement 15.1)
 * 
 * **State Flow**:
 * ```
 * idle → processing → queued (if offline) → synced (2s) → idle
 *                  → synced (if online, 2s) → idle
 *                  → failed → idle (manual reset)
 * ```
 * 
 * **Critical Pattern** (from IMPLEMENTATION_GUIDE.md):
 * - Queue state is authoritative for 'queued'
 * - Local transient state ONLY for: processing, synced flash, failed flash
 * 
 * @example
 * ```tsx
 * <ActionButton
 *   label="Mark as Picked Up"
 *   icon="checkmark-circle"
 *   onPress={handlePickup}
 *   orderId={order._id}
 *   actionType="pickup"
 *   variant="primary"
 *   enableHaptics
 *   accessibilityLabel="Mark as picked up"
 *   accessibilityHint="Confirms you have collected the order from the warehouse"
 * />
 * ```
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  orderId,
  actionType,
  variant = 'primary',
  disabled = false,
  enableHaptics = true,
  accessibilityLabel,
  accessibilityHint,
}) => {
  // ── State Management ───────────────────────────────────────────────────────
  
  const { state } = useActionFeedback(orderId, actionType);

  // ── Handlers ───────────────────────────────────────────────────────────────
  
  const handlePress = () => {
    if (disabled || state.type === 'processing') {
      return;
    }

    // Trigger haptic feedback for critical actions (Requirement 15.6)
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onPress();
  };

  // ── Visual State Derivation ────────────────────────────────────────────────
  
  const getStateConfig = (
    buttonState: ActionButtonState
  ): {
    displayLabel: string;
    displayIcon: IoniconsName;
    backgroundColor: string;
    textColor: string;
    showSpinner: boolean;
  } => {
    switch (buttonState.type) {
      case 'processing':
        return {
          displayLabel: 'Processing…',
          displayIcon: icon,
          backgroundColor: UX_COLORS.processing,
          textColor: '#FFFFFF',
          showSpinner: true,
        };
      
      case 'queued':
        return {
          displayLabel: 'Queued Offline',
          displayIcon: 'cloud-offline',
          backgroundColor: UX_COLORS.queued,
          textColor: '#1A202C',
          showSpinner: false,
        };
      
      case 'synced':
        return {
          displayLabel: 'Synced',
          displayIcon: 'checkmark-circle',
          backgroundColor: UX_COLORS.synced,
          textColor: '#FFFFFF',
          showSpinner: false,
        };
      
      case 'failed':
        return {
          displayLabel: 'Failed — Retry',
          displayIcon: 'alert-circle',
          backgroundColor: UX_COLORS.failed,
          textColor: '#FFFFFF',
          showSpinner: false,
        };
      
      case 'idle':
      default:
        // Variant-based styling for idle state
        const variantColors = {
          primary: {
            backgroundColor: UX_COLORS.primaryAction,
            textColor: '#FFFFFF',
          },
          secondary: {
            backgroundColor: '#E2E8F0',
            textColor: '#1A202C',
          },
          danger: {
            backgroundColor: UX_COLORS.dangerAction,
            textColor: '#FFFFFF',
          },
        };
        
        return {
          displayLabel: label,
          displayIcon: icon,
          backgroundColor: variantColors[variant].backgroundColor,
          textColor: variantColors[variant].textColor,
          showSpinner: false,
        };
    }
  };

  const stateConfig = getStateConfig(state);
  const isDisabled = disabled || state.type === 'processing';

  // ── Styles ─────────────────────────────────────────────────────────────────
  
  const buttonStyle: ViewStyle = {
    ...styles.button,
    backgroundColor: isDisabled ? UX_COLORS.locked : stateConfig.backgroundColor,
    opacity: isDisabled ? 0.6 : 1,
  };

  const textStyle: TextStyle = {
    ...styles.text,
    color: isDisabled ? UX_COLORS.textHighContrast : stateConfig.textColor,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  
  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: isDisabled,
        busy: state.type === 'processing',
      }}
    >
      <View style={styles.content}>
        {/* Icon or Spinner */}
        {stateConfig.showSpinner ? (
          <ActivityIndicator
            size="small"
            color={stateConfig.textColor}
            style={styles.icon}
          />
        ) : (
          <Ionicons
            name={stateConfig.displayIcon}
            size={20}
            color={stateConfig.textColor}
            style={styles.icon}
          />
        )}
        
        {/* Label */}
        <Text style={textStyle} numberOfLines={1}>
          {stateConfig.displayLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    // Minimum 48x48dp touch target (Requirements 5.1, 15.5)
    minHeight: UX_SPACING.touchTarget,
    minWidth: UX_SPACING.touchTarget,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    // Avoid accidental touches (Requirement 5.6)
    marginHorizontal: UX_SPACING.edgePadding,
    // Smooth transitions (Requirement 3.6, 3.7)
    transitionDuration: `${UX_ANIMATIONS.buttonTransition}ms`,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
