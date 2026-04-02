import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useGetAdminRoutesQuery, AdminRoute } from '../../api/settingsApi';
import { ErrorState } from '../../components/common/ErrorState';

const { width } = Dimensions.get('window');

export default function AdminRouteMapScreen({ route, navigation }: any) {
  const routeId = route?.params?.routeId || '';
  const { data, isLoading, error, refetch } = useGetAdminRoutesQuery();

  useEffect(() => { logEvent('screen_view', { screen: 'AdminRouteMap', routeId }); }, []);

  const r: AdminRoute | undefined = data?.routes?.find((r: AdminRoute) => r.routeId === routeId);

  if (isLoading) return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={s.container}><ErrorState message="Failed to load route" onRetry={refetch} screenName="AdminRouteMap" /></SafeAreaView>;
  if (!r) return <SafeAreaView style={s.container}><View style={s.center}><Text style={s.noData}>Route not found</Text></View></SafeAreaView>;

  const stops = (r.routePath || []).filter(x => x.toUpperCase() !== 'WAREHOUSE');

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Route Map</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Map Placeholder */}
      <View style={s.mapPlaceholder}>
        <Text style={s.mapIcon}>🗺️</Text>
        <Text style={s.mapTitle}>Map View</Text>
        <Text style={s.mapDesc}>
          Requires Google Maps API key in app.json.{'\n'}
          Install react-native-maps to enable.
        </Text>
        <View style={s.mapInfo}>
          <Text style={[s.mapInfoText, { marginRight: 16 }]}>Route: {r.routeId.slice(0, 12)}…</Text>
          <Text style={[s.mapInfoText, { marginRight: 16 }]}>Stops: {stops.length}</Text>
          <Text style={s.mapInfoText}>Distance: {(r.totalDistanceKm || 0).toFixed(1)} km</Text>
        </View>
      </View>

      {/* Visual Route Preview */}
      <View style={s.routePreview}>
        <Text style={s.previewTitle}>📍 Route Stops ({stops.length})</Text>
        <View style={s.stopsContainer}>
          {/* Warehouse start */}
          <View style={s.stopItem}>
            <View style={[s.stopDot, { backgroundColor: Colors.success }]} />
            <View style={s.stopLine} />
            <Text style={s.stopLabel}>🏭 Warehouse (Start)</Text>
          </View>
          {stops.map((id, i) => (
            <View key={i} style={s.stopItem}>
              <View style={[s.stopDot, i === stops.length - 1 ? { backgroundColor: Colors.error } : {}]} />
              {i < stops.length - 1 && <View style={s.stopLine} />}
              <Text style={s.stopLabel}>📍 Stop {i + 1}: {id.slice(0, 10)}…</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noData: { fontSize: 14, color: Colors.textMuted },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  mapPlaceholder: { height: 220, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', padding: 20 },
  mapIcon: { fontSize: 40, marginBottom: 8 },
  mapTitle: { fontSize: 18, fontWeight: '700', color: '#3730a3' },
  mapDesc: { fontSize: 12, color: '#6366f1', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  mapInfo: { flexDirection: 'row', marginTop: 14 },
  mapInfoText: { fontSize: 11, fontWeight: '600', color: '#4338ca', backgroundColor: '#c7d2fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  routePreview: { flex: 1, padding: 16 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  stopsContainer: {},
  stopItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  stopDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.secondary, marginRight: 12, marginTop: 3 },
  stopLine: { position: 'absolute', left: 6, top: 17, width: 2, height: 20, backgroundColor: Colors.border },
  stopLabel: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});
