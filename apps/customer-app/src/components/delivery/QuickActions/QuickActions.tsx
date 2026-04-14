import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';

interface QuickActionsProps {
  isOnline: boolean;
  onToggleOnline: () => void;
  onSupport: () => void;
  onReportIssue: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  isOnline,
  onToggleOnline,
  onSupport,
  onReportIssue,
}) => {
  return (
    <View style={styles.container}>
      {/* Primary: Go Online / Go Offline */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.primaryButton,
          isOnline ? styles.primaryButtonOnline : styles.primaryButtonOffline,
        ]}
        onPress={onToggleOnline}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isOnline ? 'power' : 'radio-button-on'}
          size={18}
          color={isOnline ? DELIVERY_COLORS.danger : DELIVERY_COLORS.white}
          style={styles.icon}
        />
        <Text
          style={[
            styles.buttonText,
            isOnline ? styles.primaryTextOnline : styles.primaryTextOffline,
          ]}
        >
          {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
        </Text>
      </TouchableOpacity>

      {/* Secondary buttons — only shown when online */}
      {isOnline && (
        <>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onSupport}
            activeOpacity={0.8}
          >
            <Ionicons
              name="call"
              size={18}
              color={DELIVERY_COLORS.textSecondary}
              style={styles.icon}
            />
            <Text style={styles.secondaryText}>HELP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onReportIssue}
            activeOpacity={0.8}
          >
            <Ionicons
              name="warning"
              size={18}
              color={DELIVERY_COLORS.warning}
              style={styles.icon}
            />
            <Text style={styles.secondaryText}>ISSUE</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.card,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.sm,
    gap: DELIVERY_SPACING.sm,
    ...DELIVERY_SHADOW.elevated,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: DELIVERY_RADIUS.md,
    paddingHorizontal: DELIVERY_SPACING.md,
  },
  primaryButton: {
    flex: 1,
  },
  primaryButtonOffline: {
    backgroundColor: DELIVERY_COLORS.primary,
  },
  primaryButtonOnline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.danger,
  },
  secondaryButton: {
    backgroundColor: DELIVERY_COLORS.cardElevated,
    paddingHorizontal: DELIVERY_SPACING.lg,
  },
  icon: {
    marginRight: DELIVERY_SPACING.xs,
  },
  buttonText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryTextOffline: {
    color: DELIVERY_COLORS.white,
  },
  primaryTextOnline: {
    color: DELIVERY_COLORS.danger,
  },
  secondaryText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '600',
    color: DELIVERY_COLORS.textSecondary,
    letterSpacing: 0.5,
  },
});

export default QuickActions;
