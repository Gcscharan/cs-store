import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Modal,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import {
  useGetAdminRoutesQuery,
  useAssignRouteMutation,
  AdminRoute,
} from '../../api/settingsApi';
import { useGetDeliveryBoysQuery } from '../../api/adminApi';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CREATED: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  ASSIGNED: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  IN_PROGRESS: { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' },
  COMPLETED: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
};

export default function AdminRoutesScreen({ navigation }: any) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [assigningRouteId, setAssigningRouteId] = useState('');
  const [selectedDbId, setSelectedDbId] = useState('');

  const { data: routesData, isLoading, error, refetch } = useGetAdminRoutesQuery();
  const { data: dbData, isLoading: loadingDb, refetch: refetchDb } = useGetDeliveryBoysQuery(undefined);
  const [assignRoute, { isLoading: isAssigning }] = useAssignRouteMutation();

  const routes = routesData?.routes || [];

  useEffect(() => { logEvent('screen_view', { screen: 'AdminRoutes' }); }, []);

  // Compute active delivery boy IDs (already assigned to non-completed routes)
  const activeDbIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of routes) {
      if (r.deliveryBoyId && (r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS')) {
        s.add(String(r.deliveryBoyId));
      }
    }
    return s;
  }, [routes]);

  // Filter eligible delivery boys
  const eligible = useMemo(() => {
    const list = (dbData as any)?.deliveryBoys || [];
    return list.filter((b: any) => {
      const boy = b?.deliveryBoy;
      const u = b?.user;
      if (!boy || !u) return false;
      if (!boy.isActive || u.status !== 'active') return false;
      if (boy.availability !== 'available') return false;
      if (activeDbIds.has(String(boy._id))) return false;
      return true;
    });
  }, [dbData, activeDbIds]);

  const openAssign = useCallback((routeId: string) => {
    setAssigningRouteId(routeId);
    setSelectedDbId('');
    setShowModal(true);
    refetchDb();
    logEvent('route_assign_opened', { routeId });
  }, [refetchDb]);

  const confirmAssign = async () => {
    if (!selectedDbId) { Alert.alert('Select', 'Please select a delivery boy'); return; }
    try {
      await assignRoute({ routeId: assigningRouteId, deliveryBoyId: selectedDbId }).unwrap();
      logEvent('route_assign_confirmed', { routeId: assigningRouteId, deliveryBoyId: selectedDbId });
      setShowModal(false);
      refetch();
    } catch (err: any) {
      logEvent('route_assign_failed', { routeId: assigningRouteId, error: err?.data?.error });
      Alert.alert('Failed', err?.data?.message || err?.data?.error || 'Route already assigned');
    }
  };

  const renderRoute = ({ item }: { item: AdminRoute }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.CREATED;
    const isExpanded = expandedId === item.routeId;
    const isLocked = item.status !== 'CREATED';

    return (
      <View style={s.routeCard}>
        <View style={s.routeHeader}>
          <View style={s.routeMain}>
            <View style={s.routeIdRow}>
              <Text style={s.routeId}>{item.routeId.slice(0, 8)}…</Text>
              <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                <Text style={[s.statusText, { color: sc.text }]}>{item.status}</Text>
              </View>
            </View>
            <View style={s.metaRow}>
              <Text style={[s.metaItem, { marginRight: 12 }]}>📦 {item.totalOrders} orders</Text>
              <Text style={[s.metaItem, { marginRight: 12 }]}>📏 {(item.totalDistanceKm || 0).toFixed(1)} km</Text>
              <Text style={s.metaItem}>⏱ {Math.round(item.estimatedTimeMin || 0)} min</Text>
            </View>
            <Text style={s.assignedText}>
              Assigned: {item.deliveryBoyId ? '✅ YES' : '❌ NO'}
            </Text>
          </View>
          <View style={s.routeActions}>
            <TouchableOpacity style={[s.detailBtn, { marginRight: 8 }]} onPress={() => setExpandedId(isExpanded ? null : item.routeId)}>
              <Text style={s.detailBtnText}>{isExpanded ? '▲ Hide' : '▼ Details'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.assignBtn, isLocked && s.assignBtnDisabled]}
              onPress={() => openAssign(item.routeId)}
              disabled={isLocked}
            >
              <Text style={s.assignBtnText}>🚚 Assign</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View style={s.expandedSection}>
            <Text style={s.expandedTitle}>Delivery Sequence</Text>
            <View style={s.seqBox}>
              {(item.routePath || []).filter(x => x.toUpperCase() !== 'WAREHOUSE').map((id, i) => (
                <Text key={`${item.routeId}-seq-${i}`} style={s.seqItem}>{i + 1}. {id.slice(0, 12)}…</Text>
              ))}
              {(!item.routePath || item.routePath.length === 0) && <Text style={s.noData}>No sequence</Text>}
            </View>
            <Text style={s.expandedTitle}>Order IDs</Text>
            <View style={s.seqBox}>
              {(item.orderIds || []).map((id, i) => (
                <Text key={`${item.routeId}-oid-${i}`} style={s.seqItem}>• {id.slice(0, 12)}…</Text>
              ))}
              {(!item.orderIds || item.orderIds.length === 0) && <Text style={s.noData}>No orders</Text>}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (error) return <SafeAreaView style={s.container}><ErrorState message="Failed to load routes" onRetry={refetch} screenName="AdminRoutes" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Routes / Clusters</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminOrders')}>
          <Text style={s.clusterBtn}>Cluster Orders</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : routes.length === 0 ? (
        <EmptyState icon="🗺️" title="No Routes Yet" description="Click 'Cluster Orders' to generate delivery routes." actionLabel="Go to Orders" onAction={() => navigation.navigate('AdminOrders')} />
      ) : (
        <FlatList data={routes} keyExtractor={r => r.routeId} renderItem={renderRoute} contentContainerStyle={s.list} />
      )}

      {/* Assign Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Assign Delivery Boy</Text>
            <Text style={s.modalSubtitle}>Route: {assigningRouteId.slice(0, 12)}…</Text>

            {loadingDb ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
            ) : eligible.length === 0 ? (
              <View style={s.noEligible}>
                <Text style={s.noEligibleTitle}>No Eligible Delivery Boys</Text>
                <Text style={s.noEligibleDesc}>Only available, active delivery boys with no active route are shown.</Text>
              </View>
            ) : (
              <ScrollView style={s.dbList}>
                {eligible.map((item: any) => {
                  const u = item.user;
                  const b = item.deliveryBoy;
                  return (
                    <TouchableOpacity
                      key={b._id}
                      style={[s.dbItem, selectedDbId === b._id && s.dbItemActive]}
                      onPress={() => setSelectedDbId(b._id)}
                    >
                      <View style={s.dbRadio}>
                        <View style={[s.radioOuter, selectedDbId === b._id && s.radioActive]}>
                          {selectedDbId === b._id && <View style={s.radioInner} />}
                        </View>
                      </View>
                      <View style={s.dbInfo}>
                        <Text style={s.dbName}>{u?.name || 'Unknown'}</Text>
                        <Text style={s.dbPhone}>{u?.phone || ''}</Text>
                      </View>
                      <View style={s.dbMeta}>
                        <View style={s.vehicleBadge}>
                          <Text style={s.vehicleText}>{(b.vehicleType || '').toUpperCase()}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.cancelBtn, { marginRight: 10 }]} onPress={() => setShowModal(false)} disabled={isAssigning}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, (isAssigning || !selectedDbId) && s.confirmBtnDisabled]} onPress={confirmAssign} disabled={isAssigning || !selectedDbId}>
                <Text style={s.confirmBtnText}>{isAssigning ? 'Assigning…' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  clusterBtn: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  routeCard: { backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, overflow: 'hidden' },
  routeHeader: { padding: 16 },
  routeMain: { marginBottom: 12 },
  routeIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeId: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', marginBottom: 6 },
  metaItem: { fontSize: 12, color: Colors.textSecondary },
  assignedText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  routeActions: { flexDirection: 'row' },
  detailBtn: { flex: 1, backgroundColor: Colors.backgroundDark, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  detailBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  assignBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  assignBtnDisabled: { backgroundColor: Colors.border },
  assignBtnText: { fontSize: 13, color: Colors.white, fontWeight: '600' },
  expandedSection: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  expandedTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  seqBox: { backgroundColor: Colors.background, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 10, marginBottom: 12, maxHeight: 160 },
  seqItem: { fontSize: 12, color: Colors.textSecondary, lineHeight: 20 },
  noData: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.background, borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 16 },
  noEligible: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 16, marginVertical: 16 },
  noEligibleTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  noEligibleDesc: { fontSize: 12, color: '#a16207', marginTop: 4 },
  dbList: { maxHeight: 300, marginVertical: 12 },
  dbItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, marginBottom: 8 },
  dbItemActive: { borderColor: Colors.success, backgroundColor: '#f0fdf4' },
  dbRadio: { marginRight: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: Colors.success },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  dbInfo: { flex: 1 },
  dbName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  dbPhone: { fontSize: 12, color: Colors.textSecondary },
  dbMeta: {},
  vehicleBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vehicleText: { fontSize: 10, fontWeight: '700', color: '#1e40af' },
  modalActions: { flexDirection: 'row', marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: Colors.backgroundDark, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { fontSize: 14, fontWeight: '600', color: Colors.white },
});
