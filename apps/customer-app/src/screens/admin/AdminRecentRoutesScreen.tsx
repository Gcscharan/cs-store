import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useGetAdminRoutesQuery, AdminRoute } from '../../api/settingsApi';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

export default function AdminRecentRoutesScreen({ navigation }: any) {
  const { data, isLoading, error, refetch } = useGetAdminRoutesQuery();

  useEffect(() => { logEvent('screen_view', { screen: 'AdminRecentRoutes' }); }, []);

  const routes = (data?.routes || []).filter((r: AdminRoute) => r.status === 'COMPLETED')
    .sort((a: AdminRoute, b: AdminRoute) => new Date(b.computedAt || 0).getTime() - new Date(a.computedAt || 0).getTime());

  if (isLoading) return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={s.container}><ErrorState message="Failed to load routes" onRetry={refetch} screenName="AdminRecentRoutes" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Recent Routes</Text>
        <View style={{ width: 50 }} />
      </View>

      {routes.length === 0 ? (
        <EmptyState icon="📜" title="No Completed Routes" description="Completed delivery routes will appear here." />
      ) : (
        <FlatList
          data={routes}
          keyExtractor={r => r.routeId}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => navigation.navigate('AdminRouteDetail', { routeId: item.routeId })}>
              <View style={s.cardHeader}>
                <Text style={s.routeId}>{item.routeId.slice(0, 10)}…</Text>
                <View style={s.completedBadge}>
                  <Text style={s.completedText}>✅ COMPLETED</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <Text style={[s.stat, { marginRight: 12 }]}>📦 {item.totalOrders} orders</Text>
                <Text style={[s.stat, { marginRight: 12 }]}>✅ {item.deliveredCount || 0} delivered</Text>
                <Text style={s.stat}>❌ {item.failedCount || 0} failed</Text>
              </View>
              <View style={s.statsRow}>
                <Text style={[s.stat, { marginRight: 12 }]}>📏 {(item.totalDistanceKm || 0).toFixed(1)} km</Text>
                <Text style={s.stat}>⏱ {Math.round(item.estimatedTimeMin || 0)} min</Text>
              </View>
              {item.computedAt && (
                <Text style={s.date}>Completed: {new Date(item.computedAt).toLocaleDateString()}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  list: { padding: 16 },
  card: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeId: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  completedBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' },
  completedText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  statsRow: { flexDirection: 'row', marginBottom: 4 },
  stat: { fontSize: 12, color: Colors.textSecondary },
  date: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
});
