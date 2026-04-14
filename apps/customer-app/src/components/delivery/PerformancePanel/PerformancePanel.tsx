import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';
import { DeliveryBoy } from '../../../hooks/delivery/useOrders';

interface PerformancePanelProps {
  deliveryBoy: DeliveryBoy | null;
  motivation: string;
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  deliveryBoy,
  motivation,
}) => {
  const earnings = deliveryBoy?.earnings ?? 0;
  const deliveries = deliveryBoy?.completedOrdersCount ?? 0;
  const rating = deliveryBoy?.rating ?? null;

  // FIX 6: Never show raw ₹0 — show motivation message instead
  const earningsDisplay = earnings > 0
    ? `₹${earnings.toLocaleString('en-IN')}`
    : null;

  const ratingDisplay = rating != null && rating > 0
    ? rating.toFixed(1)
    : 'New';

  // Weekly data — DeliveryBoy doesn't expose weekly fields yet; show dash as graceful fallback
  const weeklyEarnings: number | null = (deliveryBoy as any)?.weeklyEarnings ?? null;
  const weeklyDeliveries: number | null = (deliveryBoy as any)?.weeklyDeliveries ?? null;
  const hasWeeklyData = weeklyEarnings != null && weeklyDeliveries != null;

  return (
    <View style={styles.container}>
      {/* TODAY section */}
      <Text style={styles.sectionLabel}>TODAY</Text>

      <View style={styles.statsRow}>
        {/* Earnings */}
        <View style={styles.statItem}>
          {earningsDisplay ? (
            <Text style={styles.earningsValue}>{earningsDisplay}</Text>
          ) : (
            <Ionicons name="rocket-outline" size={22} color={DELIVERY_COLORS.earnings} />
          )}
          <Text style={styles.statLabel}>Earnings</Text>
        </View>

        <View style={styles.divider} />

        {/* Deliveries */}
        <View style={styles.statItem}>
          <View style={styles.statWithIcon}>
            <Ionicons name="car-outline" size={18} color={DELIVERY_COLORS.textSecondary} style={styles.statIcon} />
            <Text style={styles.statValue}>{deliveries}</Text>
          </View>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>

        <View style={styles.divider} />

        {/* Rating */}
        <View style={styles.statItem}>
          <View style={styles.statWithIcon}>
            <Ionicons name="star" size={16} color={DELIVERY_COLORS.warning} style={styles.statIcon} />
            <Text style={styles.statValue}>{ratingDisplay}</Text>
          </View>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Weekly summary */}
      <View style={styles.separator} />
      <Text style={styles.sectionLabel}>THIS WEEK</Text>
      {hasWeeklyData ? (
        <Text style={styles.weeklyText}>
          ₹{(weeklyEarnings as number).toLocaleString('en-IN')} earned · {weeklyDeliveries} deliveries
        </Text>
      ) : (
        <Text style={styles.weeklyText}>
          {deliveries > 0
            ? `${deliveries} deliveries today`
            : 'No deliveries yet this week'}
        </Text>
      )}

      {/* Motivation message */}
      <Text style={styles.motivationText}>{motivation}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.lg,
    marginHorizontal: DELIVERY_SPACING.lg,
    marginVertical: DELIVERY_SPACING.sm,
    ...DELIVERY_SHADOW.card,
  },
  sectionLabel: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '700',
    color: DELIVERY_COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: DELIVERY_SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DELIVERY_SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: DELIVERY_SPACING.xs,
  },
  earningsValue: {
    fontSize: DELIVERY_TYPOGRAPHY.lg,
    fontWeight: '800',
    color: DELIVERY_COLORS.earnings,
  },
  statValue: {
    fontSize: DELIVERY_TYPOGRAPHY.lg,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
  },
  statLabel: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    marginTop: DELIVERY_SPACING.xs,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: DELIVERY_COLORS.border,
  },
  separator: {
    height: 1,
    backgroundColor: DELIVERY_COLORS.border,
    marginBottom: DELIVERY_SPACING.md,
  },
  weeklyText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    marginBottom: DELIVERY_SPACING.sm,
  },
  motivationText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: DELIVERY_SPACING.xs,
  },
});
