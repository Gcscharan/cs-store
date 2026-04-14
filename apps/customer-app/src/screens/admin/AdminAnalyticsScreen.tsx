import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatCard from '../../components/admin/StatCard';
import StatusBadge from '../../components/admin/StatusBadge';
import { useGetAnalyticsQuery } from '../../api/adminApi';

// FIX 5: Strict types — no more "any" in frontend
type MonthlyRevenue = { month: string; revenue: number; orders: number };
type TopProduct     = { name: string; totalQuantity: number; totalRevenue: number };
type RecentOrder    = { id: string; customerName: string; totalAmount: number; orderStatus: string; createdAt: string };

type AnalyticsResponse = {
  totalRevenue:    number;
  totalOrders:     number;
  totalUsers:      number;
  avgOrderValue:   number;
  deliveredOrders: number;
  monthlyRevenue:  MonthlyRevenue[];
  topProducts:     TopProduct[];
  recentOrders:    RecentOrder[];
};

const AdminAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { data, isFetching, error, refetch } = useGetAnalyticsQuery(undefined);

  // FIX 5: Typed destructure — backend is the brain, frontend only renders
  const {
    totalRevenue    = 0,
    totalOrders     = 0,
    totalUsers      = 0,
    avgOrderValue   = 0,
    monthlyRevenue  = [],
    topProducts     = [],
    recentOrders    = [],
  } = (data as AnalyticsResponse | undefined) ?? {};

  const maxMonthly = Math.max(1, ...monthlyRevenue.map((m) => m.revenue));

  if (isFetching && !data) {
    return (
      <View style={styles.safe}>
        <AdminHeader title="Sales Analytics" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.safe}>
        <AdminHeader title="Sales Analytics" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AdminHeader title="Sales Analytics" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* FIX 6: Time context label */}
        <View style={styles.periodBadge}>
          <Text style={styles.periodText}>📅 All Time · Revenue from Delivered Orders</Text>
        </View>

        {/* ── Summary Cards ── */}
        <View style={styles.gridRow}>
          <StatCard
            title="Total Revenue"
            value={`₹${totalRevenue.toLocaleString('en-IN')}`}
            iconName="cash-outline"
          />
          <View style={styles.gap} />
          <StatCard
            title="Total Orders"
            value={totalOrders}
            iconName="cart-outline"
          />
        </View>
        <View style={[styles.gridRow, { marginBottom: 16 }]}>
          <StatCard
            title="Total Users"
            value={totalUsers}
            iconName="people-outline"
          />
          <View style={styles.gap} />
          <StatCard
            title="Avg Order Value"
            value={`₹${avgOrderValue.toLocaleString('en-IN')}`}
            iconName="trending-up-outline"
          />
        </View>

        {/* ── Monthly Revenue ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Monthly Revenue</Text>
          {monthlyRevenue.length === 0 ? (
            <Text style={styles.muted}>No revenue data available</Text>
          ) : (
            monthlyRevenue.map((m: MonthlyRevenue) => {
              const pct = (m.revenue / maxMonthly) * 100;
              return (
                <View key={m.month} style={styles.monthRow}>
                  <Text style={styles.monthLabel}>{m.month}</Text>
                  <View style={styles.barWrap}>
                    <View style={[styles.bar, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.monthValue}>
                    ₹{m.revenue.toLocaleString('en-IN')}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Top Products ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          {topProducts.length === 0 ? (
            <Text style={styles.muted}>No product data available</Text>
          ) : (
            topProducts.map((p: TopProduct, idx: number) => (
              <View key={`${p.name}-${idx}`} style={styles.topProductRow}>
                <Text style={styles.rank}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.muted}>
                    {p.totalQuantity} sold · ₹{p.totalRevenue.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Recent Orders ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {recentOrders.length === 0 ? (
            <Text style={styles.muted}>No recent orders</Text>
          ) : (
            recentOrders.map((o: RecentOrder) => (
              <View key={o.id} style={styles.recentRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.recentCustomer} numberOfLines={1}>
                    {o.customerName}
                  </Text>
                  <Text style={styles.muted}>
                    ₹{o.totalAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <StatusBadge status={String(o.orderStatus || '').toUpperCase()} />
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.background },
  scroll:          { flex: 1 },
  content:         { padding: 16, paddingBottom: 32 },
  periodBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  periodText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },
  gridRow:         { flexDirection: 'row', marginBottom: 12 },
  gap:             { width: 12 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle:    { fontSize: 14, fontWeight: '900', color: Colors.textPrimary, marginBottom: 12 },
  muted:           { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  monthRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  monthLabel:      { width: 64, fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  barWrap:         { flex: 1, height: 8, borderRadius: 999, backgroundColor: Colors.background, overflow: 'hidden' },
  bar:             { height: '100%', borderRadius: 999, backgroundColor: Colors.primary },
  monthValue:      { width: 90, textAlign: 'right', fontSize: 11, fontWeight: '900', color: Colors.textPrimary },
  topProductRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rank:            { width: 32, fontSize: 12, fontWeight: '900', color: Colors.textSecondary },
  topName:         { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  recentRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  recentCustomer:  { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText:     { marginTop: 12, fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  errorText:       { fontSize: 14, fontWeight: '900', color: Colors.error },
  retryBtn:        { marginTop: 12, height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  retryText:       { color: Colors.white, fontWeight: '900' },
});

export default AdminAnalyticsScreen;
