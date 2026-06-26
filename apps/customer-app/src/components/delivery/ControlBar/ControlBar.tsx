import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
} from '../../../constants/deliveryTheme';

interface ControlBarProps {
  earnings: number;
}

export const ControlBar: React.FC<ControlBarProps> = ({ earnings }) => {
  return (
    <View style={styles.container}>
      {earnings > 0 ? (
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Today</Text>
          <Text style={styles.earningsValue}>₹{earnings.toLocaleString('en-IN')}</Text>
        </View>
      ) : (
        <Text style={styles.earningsPlaceholder}>Ready for deliveries</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DELIVERY_COLORS.card,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: DELIVERY_COLORS.border,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: DELIVERY_SPACING.xs,
  },
  earningsPlaceholder: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  earningsLabel: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  earningsValue: {
    fontSize: DELIVERY_TYPOGRAPHY.md,
    color: DELIVERY_COLORS.earnings,
    fontWeight: '700',
  },
});

export default ControlBar;
