import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useGetOrderTrackingQuery } from '../../store/api';

export default function OrderTrackingScreen({ navigation, route }: any) {
  const orderId = route.params?.orderId;
  const { data, isLoading } = useGetOrderTrackingQuery(orderId, { skip: !orderId });
  const tracking = data?.tracking || data;

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ margin: 40 }} size="large" color="#E95C1E" />
      </SafeAreaView>
    );
  }

  const eta = tracking?.eta || '30-45 min';
  const status = tracking?.status || 'PROCESSING';
  const deliveryBoy = tracking?.deliveryBoy;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Track Order</Text>
        <View style={s.liveBadge}>
          <Text style={s.liveTxt}>● LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* ETA Banner */}
        <View style={s.etaBanner}>
          <Text style={s.etaEmoji}>🚴</Text>
          <View>
            <Text style={s.etaTitle}>Arriving in {eta}</Text>
            <Text style={s.etaSub}>Your order is on the way</Text>
          </View>
        </View>

        {/* Map Placeholder */}
        <View style={s.mapPlaceholder}>
          <Text style={s.mapEmoji}>🗺️</Text>
          <Text style={s.mapTxt}>Live Map</Text>
          <Text style={s.mapSub}>Google Maps integration requires native build</Text>
        </View>

        {/* Delivery Partner */}
        {deliveryBoy && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>👤 Delivery Partner</Text>
            <View style={s.dbRow}>
              <View style={s.dbAvatar}>
                <Text style={s.dbInitial}>
                  {deliveryBoy.name?.[0]?.toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={s.dbName}>{deliveryBoy.name}</Text>
                <Text style={s.dbVehicle}>{deliveryBoy.vehicleType || 'Bike'}</Text>
              </View>
              <TouchableOpacity style={s.callBtn}>
                <Text style={s.callBtnTxt}>📞 Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status timeline */}
        {tracking?.events && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Order Updates</Text>
            {tracking.events.map((ev: any, i: number) => (
              <View key={i} style={s.eventRow}>
                <View style={s.eventDot} />
                <View>
                  <Text style={s.eventTitle}>{ev.status}</Text>
                  <Text style={s.eventTime}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </Text>
                  {ev.note && <Text style={s.eventNote}>{ev.note}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Default timeline */}
        {(!tracking?.events || tracking.events.length === 0) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Order Updates</Text>
            {[
              { status: 'Order Confirmed', time: new Date().toISOString() },
              { status: 'Processing', time: new Date().toISOString() },
              { status: 'Out for Delivery', time: new Date().toISOString() },
            ].map((ev, i) => (
              <View key={i} style={s.eventRow}>
                <View style={[s.eventDot, i < 2 && s.eventDotActive]} />
                <View>
                  <Text style={[s.eventTitle, i < 2 && s.eventTitleActive]}>{ev.status}</Text>
                  <Text style={s.eventTime}>{new Date(ev.time).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  liveBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12 },
  liveTxt: { color: '#2e7d32', fontWeight: '700', fontSize: 12 },
  etaBanner: { flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#E95C1E', padding: 20, borderRadius: 16, marginBottom: 16 },
  etaEmoji: { fontSize: 40 },
  etaTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  etaSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  mapPlaceholder: { backgroundColor: '#fff', borderRadius: 14,
    height: 180, justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  mapEmoji: { fontSize: 48 },
  mapTxt: { fontSize: 16, fontWeight: '600', color: '#333' },
  mapSub: { fontSize: 13, color: '#888' },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  dbRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dbAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E95C1E',
    justifyContent: 'center', alignItems: 'center' },
  dbInitial: { color: '#fff', fontSize: 20, fontWeight: '700' },
  dbName: { fontSize: 16, fontWeight: '600' },
  dbVehicle: { fontSize: 13, color: '#888', marginTop: 2 },
  callBtn: { marginLeft: 'auto', backgroundColor: '#e8f5e9',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  callBtnTxt: { color: '#2e7d32', fontWeight: '600' },
  eventRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  eventDot: { width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#ddd', marginTop: 4 },
  eventDotActive: { backgroundColor: '#E95C1E' },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#888' },
  eventTitleActive: { color: '#333' },
  eventTime: { fontSize: 12, color: '#888', marginTop: 2 },
  eventNote: { fontSize: 13, color: '#666', marginTop: 2 },
});
