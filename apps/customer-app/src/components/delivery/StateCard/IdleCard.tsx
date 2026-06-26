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
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={24} color={DELIVERY_COLORS.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>No Active Orders</Text>
          <Text style={styles.subtitle}>Stay online to receive delivery requests</Text>
        </View>
      </View>

      {/* Earnings row — only when earnings > 0 */}
      {earnings > 0 && (
        <View style={styles.earningsRow}>
          <Ionicons name="cash-outline" size={16} color={DELIVERY_COLORS.earnings} />
          <Text style={styles.earningsText}>₹{earnings} earned today</Text>
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
    backgroundColor: DELIVERY_COLORS.card,       // white card
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.xl,
    gap: DELIVERY_SPACING.lg,
    marginHorizontal: DELIVERY_SPACING.lg,
    marginVertical: DELIVERY_SPACING.sm,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
    ...DELIVERY_SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DELIVERY_SPACING.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0E6',        // light orange tint
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#FFF0E6',
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
    borderRadius: DELIVERY_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  earningsText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
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
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.primary,
    backgroundColor: '#FFF0E6',
  },
  refreshText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '600',
    color: DELIVERY_COLORS.primary,
  },
});
