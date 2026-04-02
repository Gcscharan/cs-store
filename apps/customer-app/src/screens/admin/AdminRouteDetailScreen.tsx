import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useGetAdminRoutesQuery, AdminRoute } from '../../api/settingsApi';
import { ErrorState } from '../../components/common/ErrorState';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  CREATED: { bg: '#eff6ff', text: '#1d4ed8' },
  ASSIGNED: { bg: '#eef2ff', text: '#4338ca' },
  IN_PROGRESS: { bg: '#faf5ff', text: '#7c3aed' },
  COMPLETED: { bg: '#f0fdf4', text: '#16a34a' },
};

export default function AdminRouteDetailScreen({ route, navigation }: any) {
  const routeId = route?.params?.routeId || '';
  const { data, isLoading, error, refetch } = useGetAdminRoutesQuery();

  useEffect(() => { logEvent('screen_view', { screen: 'AdminRouteDetail', routeId }); }, []);

  const r: AdminRoute | undefined = data?.routes?.find((r: AdminRoute) => r.routeId === routeId);

  if (isLoading) return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={s.container}><ErrorState message="Failed to load route" onRetry={refetch} screenName="AdminRouteDetail" /></SafeAreaView>;
  if (!r) return <SafeAreaView style={s.container}><View style={s.center}><Text style={s.noData}>Route not found</Text></View></SafeAreaView>;

  const sc = STATUS_COLORS[r.status] || STATUS_COLORS.CREATED;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Route Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={s.content}>
        {/* Route ID + Status */}
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.routeId}>{r.routeId}</Text>
            <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[s.statusText, { color: sc.text }]}>{r.status}</Text>
            </View>
          </View>
          {r.computedAt && <Text style={s.computed}>Computed: {new Date(r.computedAt).toLocaleString()}</Text>}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { icon: '📦', label: 'Total Orders', value: `${r.totalOrders}` },
            { icon: '📏', label: 'Distance', value: `${(r.totalDistanceKm || 0).toFixed(1)} km` },
            { icon: '⏱', label: 'ETA', value: `${Math.round(r.estimatedTimeMin || 0)} min` },
            { icon: '✅', label: 'Delivered', value: `${r.deliveredCount || 0}` },
            { icon: '❌', label: 'Failed', value: `${r.failedCount || 0}` },
          ].map((stat, i) => (
            <View key={i} style={[s.statCard, { marginRight: 8, marginBottom: 8 }]}>
              <Text style={s.statIcon}>{stat.icon}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Assignment */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>🚚 Assignment</Text>
          <Text style={s.assignText}>
            {r.deliveryBoyId ? `Assigned to: ${r.deliveryBoyId.slice(0, 12)}…` : 'Not yet assigned'}
          </Text>
          <Text style={s.vehicleText}>Vehicle: {r.vehicleType || 'N/A'}</Text>
        </View>

        {/* Delivery Sequence */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>🗺️ Delivery Sequence</Text>
          {(r.routePath || []).filter(x => x.toUpperCase() !== 'WAREHOUSE').map((id, i) => (
            <View key={i} style={s.seqRow}>
              <View style={s.seqNum}><Text style={s.seqNumText}>{i + 1}</Text></View>
              <Text style={s.seqId}>{id.slice(0, 20)}…</Text>
            </View>
          ))}
          {(!r.routePath?.length) && <Text style={s.noData}>No sequence</Text>}
        </View>

        {/* Order IDs */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>📦 Order IDs ({r.orderIds?.length || 0})</Text>
          {(r.orderIds || []).map((id, i) => (
            <Text key={i} style={s.orderId}>• {id}</Text>
          ))}
          {(!r.orderIds?.length) && <Text style={s.noData}>No orders</Text>}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeId: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700' },
  computed: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  statCard: { flex: 1, minWidth: '28%', backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  assignText: { fontSize: 13, color: Colors.textSecondary },
  vehicleText: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  seqRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  seqNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  seqNumText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  seqId: { fontSize: 13, color: Colors.textSecondary },
  orderId: { fontSize: 12, color: Colors.textSecondary, lineHeight: 20 },
  noData: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
});
