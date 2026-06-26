import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DELIVERY_COLORS, DELIVERY_TYPOGRAPHY, DELIVERY_SPACING, DELIVERY_RADIUS } from '../../constants/deliveryTheme';
import { AppHeader } from '../../components/delivery/AppHeader/AppHeader';
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
          <Ionicons name="checkmark-circle" size={16} color={DELIVERY_COLORS.success} style={{ marginRight: 4 }} />
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
          <Ionicons name="location-outline" size={14} color={DELIVERY_COLORS.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.addressText}>
            {item.address.addressLine}, {item.address.city}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="wallet-outline" size={40} color={DELIVERY_COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No Earnings Yet</Text>
      <Text style={styles.emptySubtitle}>
        Complete deliveries to start earning
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={DELIVERY_COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top', 'bottom']}>
        <Ionicons name="alert-circle" size={48} color={DELIVERY_COLORS.danger} />
        <Text style={styles.errorText}>Failed to load earnings</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <AppHeader title="Earnings" />
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <>
            {/* Orange total card — matches Orders page hero card */}
            <View style={styles.totalCard}>
              <Text style={styles.totalCardLabel}>Total Earnings</Text>
              <Text style={styles.totalAmount}>₹{totalEarnings.toLocaleString('en-IN')}</Text>
            </View>

            {/* Breakdown row */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#FFF0E6' }]}>
                  <Ionicons name="bicycle" size={20} color={DELIVERY_COLORS.primary} />
                </View>
                <Text style={styles.breakdownValue}>₹{deliveryFees}</Text>
                <Text style={styles.breakdownLabel}>Delivery Fees</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: DELIVERY_COLORS.successBg }]}>
                  <Ionicons name="heart" size={20} color={DELIVERY_COLORS.success} />
                </View>
                <Text style={styles.breakdownValue}>₹{tips}</Text>
                <Text style={styles.breakdownLabel}>Tips</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: DELIVERY_COLORS.warningBg }]}>
                  <Ionicons name="checkmark-done" size={20} color={DELIVERY_COLORS.warning} />
                </View>
                <Text style={styles.breakdownValue}>{completedOrders}</Text>
                <Text style={styles.breakdownLabel}>Deliveries</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Recent Deliveries</Text>
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[DELIVERY_COLORS.primary]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DELIVERY_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: DELIVERY_COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: DELIVERY_COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: DELIVERY_SPACING.lg,
    backgroundColor: DELIVERY_COLORS.primary,
    paddingHorizontal: DELIVERY_SPACING.xl,
    paddingVertical: DELIVERY_SPACING.md,
    borderRadius: DELIVERY_RADIUS.md,
  },
  retryBtnText: {
    color: DELIVERY_COLORS.white,
    fontWeight: '700',
    fontSize: DELIVERY_TYPOGRAPHY.base,
  },
  totalCard: {
    backgroundColor: DELIVERY_COLORS.primary,   // orange hero card
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: DELIVERY_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  totalCardLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: DELIVERY_COLORS.white,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  breakdownItem: {
    flex: 1,
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
    color: DELIVERY_COLORS.textPrimary,
  },
  breakdownLabel: {
    fontSize: 12,
    color: DELIVERY_COLORS.textMuted,
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: DELIVERY_COLORS.card,       // white card
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DELIVERY_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: DELIVERY_COLORS.textPrimary,
  },
  orderDate: {
    fontSize: 12,
    color: DELIVERY_COLORS.textMuted,
    marginTop: 2,
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveredText: {
    fontSize: 12,
    fontWeight: '600',
    color: DELIVERY_COLORS.success,
  },
  orderEarnings: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DELIVERY_COLORS.border,
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  earningLabel: {
    fontSize: 14,
    color: DELIVERY_COLORS.textSecondary,
  },
  earningValue: {
    fontSize: 14,
    fontWeight: '600',
    color: DELIVERY_COLORS.textPrimary,
  },
  tipValue: {
    color: DELIVERY_COLORS.success,
  },
  earningDivider: {
    height: 1,
    backgroundColor: DELIVERY_COLORS.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DELIVERY_COLORS.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: DELIVERY_COLORS.primary,
  },
  orderAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addressText: {
    fontSize: 12,
    color: DELIVERY_COLORS.textMuted,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DELIVERY_COLORS.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: DELIVERY_COLORS.textSecondary,
  },
});

export default DeliveryEarningsTab;
