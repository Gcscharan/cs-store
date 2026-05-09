import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Order } from '../../../hooks/delivery/useOrders';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
} from '../../../constants/deliveryTheme';

interface RouteProgressHeaderProps {
  completedCount: number;
  remainingCount: number;
  totalStops: number;
  orders: Order[];
  isOrderCurrent: (id: string) => boolean;
  currentIndex: number;
}

export const RouteProgressHeader: React.FC<RouteProgressHeaderProps> = ({
  completedCount,
  remainingCount,
  totalStops,
  orders,
  isOrderCurrent,
  currentIndex,
}) => {
  return (
    <View style={styles.routeProgressHeader}>
      <View style={styles.routeProgressLeft}>
        <Text style={styles.routeProgressTitle}>
          {remainingCount} stop{remainingCount !== 1 ? 's' : ''} remaining
        </Text>
        <Text style={styles.routeProgressSub}>
          {completedCount} of {totalStops} completed
        </Text>
      </View>
      <View style={styles.routeProgressDots}>
        {orders.map((o, i) => {
          const isCurr = isOrderCurrent(o._id);
          const isDone = i < currentIndex;
          return (
            <View
              key={o._id}
              style={[
                styles.routeDot,
                isDone && styles.routeDotDone,
                isCurr && styles.routeDotCurrent,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  routeProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: DELIVERY_SPACING.lg,
    marginBottom: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.cardElevated,
    borderRadius: DELIVERY_RADIUS.md,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
  },
  routeProgressLeft: {
    flex: 1,
  },
  routeProgressTitle: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    color: DELIVERY_COLORS.textPrimary,
    fontWeight: '700',
  },
  routeProgressSub: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textMuted,
    marginTop: 2,
  },
  routeProgressDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: 120,
    justifyContent: 'flex-end',
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DELIVERY_COLORS.border,
  },
  routeDotDone: {
    backgroundColor: DELIVERY_COLORS.success,
  },
  routeDotCurrent: {
    backgroundColor: DELIVERY_COLORS.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
