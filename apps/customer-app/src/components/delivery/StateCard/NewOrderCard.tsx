import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Order } from '../../../hooks/delivery/useOrders';
import { getCustomerDisplayName } from '../../../utils/deliveryUtils';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';

interface NewOrderCardProps {
  availableOrders: Order[];
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
}

export const NewOrderCard: React.FC<NewOrderCardProps> = ({ availableOrders, onAccept, onReject }) => {
  if (!availableOrders || availableOrders.length === 0) return null;

  return (
    <View style={styles.container}>
      {availableOrders.map(order => {
        const phone = order.userId?.phone?.trim() ?? '';
        const displayName = getCustomerDisplayName(order.userId?.name, phone);
        return (
        <View key={order._id} style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="bicycle" size={20} color={DELIVERY_COLORS.primary} />
            <Text style={styles.headerTitle}>New Order</Text>
            <Text style={styles.orderId}>#{order._id.slice(-6)}</Text>
          </View>

          {/* Amount */}
          <Text style={styles.amount}>
            ₹{(order.totalAmount ?? 0).toLocaleString('en-IN')}
          </Text>

          {/* Customer Info */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color={DELIVERY_COLORS.textSecondary} />
              <Text style={styles.infoText}>{displayName}</Text>
            </View>
            {phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color={DELIVERY_COLORS.textSecondary} />
              <Text style={styles.infoText}>{phone}</Text>
            </View>
            ) : null}
          </View>

          {/* Address */}
          <View style={styles.addressSection}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={DELIVERY_COLORS.info} />
              <Text style={styles.addressText} numberOfLines={2}>
                {order.address?.addressLine}{order.address?.city ? `, ${order.address.city}` : ''}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => onAccept(order._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={18} color={DELIVERY_COLORS.white} />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => onReject(order._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color={DELIVERY_COLORS.danger} />
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingTop: DELIVERY_SPACING.sm,
  },
  card: {
    backgroundColor: DELIVERY_COLORS.card,
    borderRadius: DELIVERY_RADIUS.lg,
    padding: DELIVERY_SPACING.lg,
    marginBottom: DELIVERY_SPACING.md,
    ...DELIVERY_SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.sm,
    marginBottom: DELIVERY_SPACING.sm,
  },
  headerTitle: {
    color: DELIVERY_COLORS.textPrimary,
    fontSize: DELIVERY_TYPOGRAPHY.base,
    fontWeight: '700',
    flex: 1,
  },
  orderId: {
    color: DELIVERY_COLORS.textMuted,
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '500',
  },
  amount: {
    color: DELIVERY_COLORS.earnings,
    fontSize: DELIVERY_TYPOGRAPHY.xl,
    fontWeight: '800',
    marginBottom: DELIVERY_SPACING.md,
  },
  infoSection: {
    gap: DELIVERY_SPACING.xs,
    marginBottom: DELIVERY_SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.sm,
  },
  infoText: {
    color: DELIVERY_COLORS.textSecondary,
    fontSize: DELIVERY_TYPOGRAPHY.sm,
  },
  addressSection: {
    marginBottom: DELIVERY_SPACING.lg,
  },
  addressText: {
    color: DELIVERY_COLORS.textPrimary,
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: DELIVERY_SPACING.md,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: DELIVERY_COLORS.success,
    borderRadius: DELIVERY_RADIUS.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
  },
  acceptText: {
    color: DELIVERY_COLORS.white,
    fontSize: DELIVERY_TYPOGRAPHY.base,
    fontWeight: '700',
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.danger,
    borderRadius: DELIVERY_RADIUS.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    backgroundColor: 'transparent',
  },
  declineText: {
    color: DELIVERY_COLORS.danger,
    fontSize: DELIVERY_TYPOGRAPHY.base,
    fontWeight: '600',
  },
});

export default NewOrderCard;
