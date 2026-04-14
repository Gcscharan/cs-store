import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';

interface IdleCardProps {
  earnings: number;
  onRefresh: () => void;
}

export const IdleCard: React.FC<IdleCardProps> = ({ earnings, onRefresh }) => {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="time-outline" size={24} color={DELIVERY_COLORS.textSecondary} />
        <View style={styles.headerText}>
          <Text style={styles.title}>No Active Orders</Text>
          <Text style={styles.subtitle}>Stay online to receive delivery requests</Text>
        </View>
      </View>

      {/* Earnings row — only when earnings > 0 */}
      {earnings > 0 && (
        <View style={styles.earningsRow}>
          <Ionicons name="cash-outline" size={16} color={DELIVERY_COLORS.earnings} />
          <Text style={styles.earningsText}>₹{earnings}</Text>
        </View>
      )}

      {/* Refresh button */}
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
        <Ionicons name="refresh-outline" size={16} color={DELIVERY_COLORS.primary} />
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.xl,
    gap: DELIVERY_SPACING.lg,
    ...DELIVERY_SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DELIVERY_SPACING.md,
  },
  headerText: {
    flex: 1,
    gap: DELIVERY_SPACING.xs,
  },
  title: {
    fontSize: DELIVERY_TYPOGRAPHY.lg,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.textSecondary,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
  },
  earningsText: {
    fontSize: DELIVERY_TYPOGRAPHY.md,
    fontWeight: '700',
    color: DELIVERY_COLORS.earnings,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: DELIVERY_SPACING.xs,
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.primary,
  },
  refreshText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '600',
    color: DELIVERY_COLORS.primary,
  },
});
