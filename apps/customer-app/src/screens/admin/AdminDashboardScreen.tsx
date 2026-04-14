import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
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
import AdminHeader from '../../components/admin/AdminHeader';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const MenuCard: React.FC<{ item: any; onPress: () => void }> = ({ item, onPress }) => {
  const animatedScale = React.useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.97,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };
  
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        styles.menuCard,
        { opacity: pressed ? 0.9 : 1 }
      ]}
    >
      <Animated.View style={[styles.menuCardContent, { transform: [{ scale: animatedScale }] }]}>
        <View style={styles.menuIconContainer}>
          <Ionicons name={item.iconName} size={24} color={Colors.primary} />
        </View>
        <Text style={styles.menuTitle}>{item.title}</Text>
      </Animated.View>
    </Pressable>
  );
};

const AdminDashboardScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const user = useSelector((state: RootState) => state.auth.user);

  const { data, isFetching, error, refetch } = useGetDashboardStatsQuery(undefined);
  const stats = (data as any) || {};

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const cards = useMemo(
    () => [
      { title: 'Total Products', value: isFetching ? '...' : String(stats.totalProducts ?? 0), iconName: 'cube-outline' as const },
      { title: 'Total Users', value: isFetching ? '...' : String(stats.totalUsers ?? 0), iconName: 'people-outline' as const },
      { title: 'Total Orders', value: isFetching ? '...' : String(stats.totalOrders ?? 0), iconName: 'cart-outline' as const },
      { title: 'Active Delivery', value: isFetching ? '...' : String(stats.totalDeliveryBoys ?? 0), iconName: 'bicycle-outline' as const },
    ],
    [isFetching, stats]
  );

  const menuItems = useMemo(
    () => [
      { title: 'Products Management', screen: 'AdminProducts', iconName: 'cube-outline' as const },
      { title: 'Users Management', screen: 'AdminUsers', iconName: 'people-outline' as const },
      { title: 'Orders Management', screen: 'AdminOrders', iconName: 'cart-outline' as const },
      { title: 'Delivery Partners', screen: 'AdminDeliveryBoys', iconName: 'bicycle-outline' as const },
      { title: 'Sales Analytics', screen: 'AdminAnalytics', iconName: 'stats-chart-outline' as const },
      { title: 'Finance Reports', screen: 'AdminFinance', iconName: 'cash-outline' as const },
      { title: 'Payment Logs', screen: 'AdminPayments', iconName: 'card-outline' as const },
      { title: 'Operations', screen: 'AdminOps', iconName: 'settings-outline' as const },
      { title: 'Logout', screen: 'Logout' as const, iconName: 'log-out-outline' as const },
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

  const renderHeader = () => (
    <>
      <View style={styles.revenueRow}>
        <Text style={styles.revenueLabel}>Total Revenue (Delivered)</Text>
        <Text style={styles.revenueValue}>
          {stats.totalRevenue === 0 || !stats.totalRevenue ? 'No revenue yet' : `₹${Number(stats.totalRevenue).toLocaleString('en-IN')}`}
        </Text>
        {stats.collectedNotDelivered > 0 && (
          <Text style={styles.revenueSubtext}>
            + ₹{Number(stats.collectedNotDelivered).toLocaleString('en-IN')} collected, not yet delivered
          </Text>
        )}
        {stats.codPending > 0 && (
          <Text style={styles.codPendingText}>
            ₹{Number(stats.codPending).toLocaleString('en-IN')} COD pending collection
          </Text>
        )}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Failed to load dashboard stats</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.statsRow, { 
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
          }]}>
            <StatCard title={cards[0].title} value={cards[0].value} iconName={cards[0].iconName} />
            <View style={styles.gap} />
            <StatCard title={cards[1].title} value={cards[1].value} iconName={cards[1].iconName} />
          </Animated.View>
          <Animated.View style={[styles.statsRow, { 
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }]
          }]}>
            <StatCard title={cards[2].title} value={cards[2].value} iconName={cards[2].iconName} />
            <View style={styles.gap} />
            <StatCard title={cards[3].title} value={cards[3].value} iconName={cards[3].iconName} />
          </Animated.View>
        </Animated.View>
      )}
    </>
  );

  return (
    <View style={styles.safe}>
      <AdminHeader 
        title="Admin Dashboard" 
        subtitle={`Hi, ${user?.name || '-'}`}
        rightAction={
          <Pressable 
            onPress={() => navigation.navigate('AdminProfile')}
            style={styles.profileBtn}
          >
            <Ionicons name="person-circle-outline" size={28} color={Colors.white} />
          </Pressable>
        }
      />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <FlatList
          data={menuItems}
          keyExtractor={(item) => item.title}
          numColumns={2}
          columnWrapperStyle={styles.menuRow}
          contentContainerStyle={styles.menuContent}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <MenuCard 
              item={item} 
              onPress={() => {
                if (item.screen === 'Logout') {
                  onLogout();
                  return;
                }
                navigation.navigate(item.screen);
              }}
            />
          )}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#f3f4f6',
  },
  container: { 
    flex: 1,
  },
  header: { marginBottom: 14 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: { marginTop: 4, fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  statsGrid: { 
    marginTop: 20,
    paddingHorizontal: 16,
  },
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  gap: { width: 16 },
  revenueRow: {
    marginTop: 20,
    marginBottom: 24,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 26,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  revenueLabel: { 
    fontSize: 12, 
    color: '#6366f1', 
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  revenueValue: { 
    fontSize: 36, 
    color: '#4f46e5', 
    fontWeight: '800',
    letterSpacing: -1,
  },
  revenueSubtext: {
    marginTop: 12,
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  codPendingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menuContent: { 
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },
  menuRow: { marginBottom: 16 },
  menuCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginHorizontal: 6,
  },
  menuCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  menuTitle: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  errorWrap: {
    marginTop: 28,
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    shadowColor: '#ef4444',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  errorText: { fontSize: 14, fontWeight: '700', color: '#dc2626', letterSpacing: 0.3 },
  retryBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  retryText: { color: Colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdminDashboardScreen;
