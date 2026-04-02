import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatCard from '../../components/admin/StatCard';
import StatusBadge from '../../components/admin/StatusBadge';
import { useGetAnalyticsQuery } from '../../api/adminApi';

const AdminAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { data, isFetching, error, refetch } = useGetAnalyticsQuery(undefined);

  const derived = useMemo(() => {
    const d: any = data || {};
    const totalRevenue = (d.salesData || []).reduce((sum: number, it: any) => sum + (it.totalSales || 0), 0);
    const totalOrders = (d.ordersByStatus || []).reduce((sum: number, it: any) => sum + (it.count || 0), 0);
    const totalUsers = d.userStats?.totalUsers || 0;

    const monthlyRevenue = (d.monthlySales || []).map((it: any) => ({
      month: String(it._id || ''),
      revenue: Number(it.totalSales || 0),
    }));

    const topProducts = (d.topProducts || []).map((it: any) => ({
      name: String(it._id || 'Unknown'),
      sales: Number(it.totalQuantity || 0),
      revenue: Number(it.totalRevenue || 0),
    }));

    const recentOrders = (d.recentOrders || []).map((o: any) => ({
      id: String(o._id || ''),
      customer: String(o.userId?.name || o.userId?.phone || 'Unknown'),
      amount: Number(o.totalAmount || 0),
      status: String(o.orderStatus || 'Unknown'),
    }));

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return { totalRevenue, totalOrders, totalUsers, avgOrderValue, monthlyRevenue, topProducts, recentOrders };
  }, [data]);

  const maxMonthly = useMemo(() => {
    return Math.max(1, ...derived.monthlyRevenue.map((m) => m.revenue));
  }, [derived.monthlyRevenue]);

  if (isFetching && !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <AdminHeader title="Sales Analytics" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <AdminHeader title="Sales Analytics" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Sales Analytics" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard title="Total Revenue" value={`₹${derived.totalRevenue.toLocaleString('en-IN')}`} icon="💰" />
            <View style={styles.gap} />
            <StatCard title="Total Orders" value={derived.totalOrders} icon="🛍️" color={Colors.secondary} />
          </View>
          <View style={styles.gridRow}>
            <StatCard title="Total Users" value={derived.totalUsers} icon="👥" color="#7c3aed" />
            <View style={styles.gap} />
            <StatCard title="Avg Order Value" value={`₹${derived.avgOrderValue}`} icon="📈" color="#16a34a" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Monthly Revenue</Text>
          {derived.monthlyRevenue.length === 0 ? (
            <Text style={styles.muted}>No revenue data available</Text>
          ) : (
            derived.monthlyRevenue.map((m) => {
              const pct = (m.revenue / maxMonthly) * 100;
              return (
                <View key={m.month} style={styles.monthRow}>
                  <Text style={[styles.monthLabel, { marginRight: 10 }]}>{m.month}</Text>
                  <View style={styles.barWrap}>
                    <View style={[styles.bar, { width: `${pct}%` }]} />
                  </View>
                  <Text style={[styles.monthValue, { marginLeft: 10 }]}>₹{m.revenue.toLocaleString('en-IN')}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top Selling Products</Text>
          {derived.topProducts.length === 0 ? (
            <Text style={styles.muted}>No product data available</Text>
          ) : (
            derived.topProducts.map((p, idx) => (
              <View key={`${p.name}-${idx}`} style={styles.topProductRow}>
                <Text style={[styles.rank, { marginRight: 10 }]}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.muted}>{p.sales} sales · ₹{p.revenue.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {derived.recentOrders.length === 0 ? (
            <Text style={styles.muted}>No recent orders</Text>
          ) : (
            derived.recentOrders.map((o) => (
              <View key={o.id} style={styles.recentRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.recentCustomer} numberOfLines={1}>
                    {o.customer}
                  </Text>
                  <Text style={styles.muted}>₹{o.amount.toLocaleString('en-IN')}</Text>
                </View>
                <StatusBadge status={String(o.status || '').toUpperCase()} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 12, paddingBottom: 24 },
  grid: { marginBottom: 12 },
  gridRow: { flexDirection: 'row', marginBottom: 12 },
  gap: { width: 12 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary, marginBottom: 10 },
  muted: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  monthLabel: { width: 52, fontSize: 12, fontWeight: '900', color: Colors.textSecondary },
  barWrap: { flex: 1, height: 8, borderRadius: 999, backgroundColor: Colors.backgroundDark, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999, backgroundColor: Colors.secondary },
  monthValue: { width: 86, textAlign: 'right', fontSize: 12, fontWeight: '900', color: Colors.textPrimary },
  topProductRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rank: { width: 32, fontSize: 12, fontWeight: '900', color: Colors.textSecondary },
  topName: { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  recentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  recentCustomer: { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '900', color: Colors.error },
  retryBtn: { marginTop: 12, height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: Colors.white, fontWeight: '900' },
});

export default AdminAnalyticsScreen;
