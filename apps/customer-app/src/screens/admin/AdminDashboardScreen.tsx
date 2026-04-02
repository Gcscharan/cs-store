import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { storage } from '../../utils/storage';
import { useGetDashboardStatsQuery } from '../../api/adminApi';
import StatCard from '../../components/admin/StatCard';
import { persistor } from '../../store';
import { baseApi } from '../../api/baseApi';

const AdminDashboardScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const user = useSelector((state: RootState) => state.auth.user);

  const { data, isFetching, error, refetch } = useGetDashboardStatsQuery(undefined);
  const stats = (data as any) || {};

  const cards = useMemo(
    () => [
      { title: 'Total Products', value: isFetching ? '...' : String(stats.totalProducts ?? 0), icon: '📦' },
      { title: 'Total Users', value: isFetching ? '...' : String(stats.totalUsers ?? 0), icon: '👥' },
      { title: 'Total Orders', value: isFetching ? '...' : String(stats.totalOrders ?? 0), icon: '🛍️' },
      { title: 'Delivery Boys', value: isFetching ? '...' : String(stats.totalDeliveryBoys ?? 0), icon: '🚴' },
    ],
    [isFetching, stats.totalProducts, stats.totalUsers, stats.totalOrders, stats.totalDeliveryBoys]
  );

  const menuItems = useMemo(
    () => [
      { title: '📦 Products Management', screen: 'AdminProducts' },
      { title: '👥 Users Management', screen: 'AdminUsers' },
      { title: '🛍️ Orders Management', screen: 'AdminOrders' },
      { title: '🚴 Delivery Partners', screen: 'AdminDeliveryBoys' },
      { title: '📊 Sales Analytics', screen: 'AdminAnalytics' },
      { title: '💰 Finance Reports', screen: 'AdminFinance' },
      { title: '💳 Payment Logs', screen: 'AdminPayments' },
      { title: '⚙️ Operations', screen: 'AdminOps' },
      { title: '🚪 Logout', screen: 'Logout' as const },
    ],
    []
  );

  const onLogout = async () => {
    // 1. Clear RTK Query cache
    dispatch(baseApi.util.resetApiState());
    
    // 2. Clear AsyncStorage persisted state
    await persistor.purge();
    
    // 3. Clear Redux state
    dispatch(logout());
    
    // 4. Remove tokens (existing - keep it)
    await storage.removeItem('accessToken');
    await storage.removeItem('refreshToken');
    
    // 5. Minimal logging
    console.log("🚪 LOGOUT COMPLETE", {userId: user?.id, time: Date.now()});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Hi, {user?.name || '-'}</Text>
        </View>

        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>Failed to load dashboard stats</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard title={cards[0].title} value={cards[0].value} icon={cards[0].icon} />
              <View style={styles.gap} />
              <StatCard title={cards[1].title} value={cards[1].value} icon={cards[1].icon} />
            </View>
            <View style={styles.statsRow}>
              <StatCard title={cards[2].title} value={cards[2].value} icon={cards[2].icon} />
              <View style={styles.gap} />
              <StatCard title={cards[3].title} value={cards[3].value} icon={cards[3].icon} />
            </View>
          </View>
        )}

        <View style={styles.revenueRow}>
          <Text style={styles.revenueText}>
            Total Revenue: <Text style={styles.revenueValue}>₹{Number(stats.totalRevenue ?? 0).toLocaleString('en-IN')}</Text>
          </Text>
        </View>

        <FlatList
          data={menuItems}
          keyExtractor={(item) => item.title}
          numColumns={2}
          columnWrapperStyle={styles.menuRow}
          contentContainerStyle={styles.menuContent}
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                style={[styles.menuCard, { marginRight: 12 }]}
                onPress={() => {
                  if (item.screen === 'Logout') {
                    onLogout();
                    return;
                  }
                  navigation.navigate(item.screen);
                }}
                activeOpacity={0.9}
              >
                <View style={styles.menuCardTop}>
                  <Text style={[styles.menuTitle, { marginRight: 10 }]}>{item.title}</Text>
                  <Text style={styles.menuArrow}>→</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  header: { marginBottom: 14 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: { marginTop: 4, fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  statsGrid: { marginTop: 8 },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  gap: { width: 12 },
  revenueRow: {
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  revenueText: { color: Colors.textSecondary, fontWeight: '800' },
  revenueValue: { color: Colors.textPrimary, fontWeight: '900' },
  menuContent: { paddingBottom: 24 },
  menuRow: { marginBottom: 12 },
  menuCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  menuCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  menuArrow: { fontSize: 16, fontWeight: '900', color: Colors.textMuted },
  errorWrap: {
    marginTop: 10,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorText: { fontSize: 13, fontWeight: '900', color: Colors.error },
  retryBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.white, fontWeight: '900' },
});

export default AdminDashboardScreen;
