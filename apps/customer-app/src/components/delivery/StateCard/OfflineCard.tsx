import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryBoy } from '../../../hooks/delivery/useOrders';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';

interface OfflineCardProps {
  deliveryBoy: DeliveryBoy | null;
  motivation: string;
  onToggleOnline: () => void;
}

export const OfflineCard: React.FC<OfflineCardProps> = ({
  deliveryBoy,
  motivation,
  onToggleOnline,
}) => {
  const earnings = deliveryBoy?.earnings ?? 0;
  const deliveries = deliveryBoy?.completedOrdersCount ?? 0;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="ellipse" size={18} color={DELIVERY_COLORS.danger} />
        <View style={styles.headerText}>
          <Text style={styles.title}>YOU'RE OFFLINE</Text>
          <Text style={styles.subtitle}>Go online to start receiving orders</Text>
        </View>
      </View>

      {/* Today's summary */}
      <Text style={styles.summary}>
        Today so far:{' '}
        <Text style={styles.summaryHighlight}>₹{earnings} earned</Text>
        {' · '}
        <Text style={styles.summaryHighlight}>{deliveries} deliveries</Text>
      </Text>

      {/* Motivation */}
      {motivation ? <Text style={styles.motivation}>{motivation}</Text> : null}

      {/* Go Online CTA */}
      <TouchableOpacity style={styles.button} onPress={onToggleOnline} activeOpacity={0.85}>
        <Text style={styles.buttonText}>GO ONLINE</Text>
        <Ionicons name="arrow-forward" size={20} color={DELIVERY_COLORS.white} />
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
    fontWeight: '800',
    color: DELIVERY_COLORS.danger,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.textSecondary,
  },
  summary: {
    fontSize: DELIVERY_TYPOGRAPHY.base,
    color: DELIVERY_COLORS.textSecondary,
  },
  summaryHighlight: {
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '600',
  },
  motivation: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textMuted,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DELIVERY_COLORS.primary,
    borderRadius: DELIVERY_RADIUS.md,
    minHeight: 56,
    gap: DELIVERY_SPACING.sm,
  },
  buttonText: {
    fontSize: DELIVERY_TYPOGRAPHY.md,
    fontWeight: '800',
    color: DELIVERY_COLORS.white,
    letterSpacing: 1,
  },
});
