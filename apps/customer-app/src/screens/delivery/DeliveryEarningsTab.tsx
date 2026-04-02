import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useGetEarningsQuery } from '../../api/deliveryApi';

interface EarningsOrder {
  _id: string;
  amount: number;
  deliveryFee: number;
  tip: number;
  createdAt: string;
  address?: {
    addressLine?: string;
    city?: string;
  };
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const DeliveryEarningsTab: React.FC = () => {
  const { data, isLoading, isFetching, refetch, error } = useGetEarningsQuery();

  const earnings = data?.earnings || {};
  const orders: EarningsOrder[] = data?.orders || [];

  const totalEarnings = earnings.total || 0;
  const deliveryFees = earnings.deliveryFees || 0;
  const tips = earnings.tips || 0;
  const completedOrders = earnings.completedOrders || 0;

  const renderOrder = ({ item }: { item: EarningsOrder }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>Order #{String(item._id || '').slice(-6)}</Text>
          <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.deliveredBadge}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} style={{ marginRight: 4 }} />
          <Text style={styles.deliveredText}>Delivered</Text>
        </View>
      </View>

      <View style={styles.orderEarnings}>
        <View style={styles.earningRow}>
          <Text style={styles.earningLabel}>Delivery Fee</Text>
          <Text style={styles.earningValue}>₹{item.deliveryFee}</Text>
        </View>
        {item.tip > 0 && (
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>Tip</Text>
            <Text style={[styles.earningValue, styles.tipValue]}>₹{item.tip}</Text>
          </View>
        )}
        <View style={styles.earningDivider} />
        <View style={styles.earningRow}>
          <Text style={styles.totalLabel}>Total Earned</Text>
          <Text style={styles.totalValue}>₹{item.deliveryFee + item.tip}</Text>
        </View>
      </View>

      {item.address && (
        <View style={styles.orderAddress}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.addressText}>
            {item.address.addressLine}, {item.address.city}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No Earnings Yet</Text>
      <Text style={styles.emptySubtitle}>
        Complete deliveries to start earning
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Failed to load earnings</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Total Earnings Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalCardLabel}>Total Earnings</Text>
        <Text style={styles.totalAmount}>₹{totalEarnings.toLocaleString('en-IN')}</Text>
      </View>

      {/* Earnings Breakdown */}
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <View style={[styles.breakdownIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="bicycle" size={20} color={Colors.info} />
          </View>
          <Text style={styles.breakdownValue}>₹{deliveryFees}</Text>
          <Text style={styles.breakdownLabel}>Delivery Fees</Text>
        </View>

        <View style={styles.breakdownItem}>
          <View style={[styles.breakdownIcon, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="heart" size={20} color={Colors.success} />
          </View>
          <Text style={styles.breakdownValue}>₹{tips}</Text>
          <Text style={styles.breakdownLabel}>Tips</Text>
        </View>

        <View style={styles.breakdownItem}>
          <View style={[styles.breakdownIcon, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="checkmark-done" size={20} color={Colors.warning} />
          </View>
          <Text style={styles.breakdownValue}>{completedOrders}</Text>
          <Text style={styles.breakdownLabel}>Deliveries</Text>
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Deliveries</Text>
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              colors={[Colors.primary]}
            />
          }
          scrollEnabled={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  totalCard: {
    backgroundColor: Colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  totalCardLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveredText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  orderEarnings: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  earningLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  earningValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tipValue: {
    color: Colors.success,
  },
  earningDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  orderAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addressText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});

export default DeliveryEarningsTab;
