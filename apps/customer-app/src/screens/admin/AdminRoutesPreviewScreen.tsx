import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useGetAdminRoutesQuery, AdminRoute } from '../../api/settingsApi';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

export default function AdminRoutesPreviewScreen({ navigation }: any) {
  const { data, isLoading, error, refetch } = useGetAdminRoutesQuery();

  useEffect(() => { logEvent('screen_view', { screen: 'AdminRoutesPreview' }); }, []);

  const routes = (data?.routes || []).filter((r: AdminRoute) => r.status === 'CREATED');

  if (isLoading) return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={s.container}><ErrorState message="Failed to load routes" onRetry={refetch} screenName="AdminRoutesPreview" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Routes Preview</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Summary Card */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>📊 Preview Summary</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{routes.length}</Text>
            <Text style={s.summaryLabel}>Routes</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{routes.reduce((s: number, r: AdminRoute) => s + r.totalOrders, 0)}</Text>
            <Text style={s.summaryLabel}>Orders</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{routes.reduce((s: number, r: AdminRoute) => s + (r.totalDistanceKm || 0), 0).toFixed(1)}</Text>
            <Text style={s.summaryLabel}>Total km</Text>
          </View>
        </View>
      </View>

      {routes.length === 0 ? (
        <EmptyState icon="📋" title="No Pending Routes" description="All routes have been assigned or completed." actionLabel="View All Routes" onAction={() => navigation.navigate('AdminRoutes')} />
      ) : (
        <FlatList
          data={routes}
          keyExtractor={r => r.routeId}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.previewCard} onPress={() => navigation.navigate('AdminRouteDetail', { routeId: item.routeId })}>
              <View style={s.previewHeader}>
                <Text style={s.previewId}>{item.routeId.slice(0, 10)}…</Text>
                <View style={s.badge}><Text style={s.badgeText}>PENDING</Text></View>
              </View>
              <View style={s.previewMeta}>
                <Text style={[s.metaText, { marginRight: 10 }]}>📦 {item.totalOrders} orders</Text>
                <Text style={[s.metaText, { marginRight: 10 }]}>📏 {(item.totalDistanceKm || 0).toFixed(1)} km</Text>
                <Text style={s.metaText}>⏱ {Math.round(item.estimatedTimeMin || 0)} min</Text>
              </View>
              <Text style={s.tapHint}>Tap to view details →</Text>
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
  summaryCard: { backgroundColor: '#eef2ff', margin: 16, marginBottom: 8, borderRadius: 14, padding: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#3730a3', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#4338ca' },
  summaryLabel: { fontSize: 11, color: '#6366f1', marginTop: 2 },
  list: { padding: 16, paddingTop: 8 },
  previewCard: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewId: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  badge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#92400e' },
  previewMeta: { flexDirection: 'row' },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  tapHint: { fontSize: 11, color: Colors.secondary, fontWeight: '500', marginTop: 8, textAlign: 'right' },
});
