import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useGetOrderQuery } from '../../store/api';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  OUT_FOR_DELIVERY: '#06b6d4',
  DELIVERED: '#22c55e',
  CANCELLED: '#ef4444',
};

export default function OrderDetailScreen({ navigation, route }: any) {
  const orderId = route.params?.orderId;
  const { data, isLoading, error } = useGetOrderQuery(orderId, { skip: !orderId });
  const order = data?.order || data;

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ margin: 40 }} size="large" color="#E95C1E" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Order Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[order.status] || '#888';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Order #{order.orderId || orderId}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('OrderTracking', { orderId })}>
          <Text style={s.trackBtn}>📍 Track</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Status Banner */}
        <View style={[s.statusBanner, { backgroundColor: statusColor + '20' }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{order.status}</Text>
        </View>

        {/* Items */}
        <Text style={s.sectionTitle}>📦 Items</Text>
        <View style={s.card}>
          {(order.items || []).map((item: any, i: number) => (
            <View key={i} style={[s.itemRow, i < order.items.length - 1 && s.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.name}</Text>
                <Text style={s.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={s.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Delivery Address */}
        <Text style={s.sectionTitle}>📍 Delivery Address</Text>
        <View style={s.card}>
          <Text style={s.addrName}>{order.deliveryAddress?.name}</Text>
          <Text style={s.addrText}>
            {order.deliveryAddress?.line1 || order.deliveryAddress?.addressLine}
          </Text>
          <Text style={s.addrText}>
            {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.pincode}
          </Text>
          <Text style={s.addrPhone}>📞 {order.deliveryAddress?.phone}</Text>
        </View>

        {/* Payment */}
        <Text style={s.sectionTitle}>💳 Payment</Text>
        <View style={s.card}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Method</Text>
            <Text style={s.summaryValue}>{order.paymentMethod?.toUpperCase()}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Status</Text>
            <Text style={[s.summaryValue, { color: order.paymentStatus === 'PAID' ? '#22c55e' : '#f59e0b' }]}>
              {order.paymentStatus}
            </Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>₹{order.totalAmount}</Text>
          </View>
        </View>

        {/* Timeline */}
        {order.timeline && order.timeline.length > 0 && (
          <>
            <Text style={s.sectionTitle}>📋 Order Timeline</Text>
            <View style={s.card}>
              {order.timeline.map((event: any, i: number) => (
                <View key={i} style={s.timelineRow}>
                  <View style={s.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.timelineStatus}>{event.status}</Text>
                    <Text style={s.timelineTime}>
                      {new Date(event.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
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
  trackBtn: { color: '#E95C1E', fontWeight: '600', fontSize: 14 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 12, marginBottom: 16 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333',
    marginTop: 16, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemBorder: { borderBottomWidth: 1, borderColor: '#f0f0f0' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333' },
  itemQty: { fontSize: 13, color: '#888', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: '#E95C1E' },
  addrName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  addrText: { fontSize: 14, color: '#666', lineHeight: 20 },
  addrPhone: { fontSize: 14, color: '#666', marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, color: '#333', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 17, fontWeight: '800', color: '#E95C1E' },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#E95C1E', marginTop: 4 },
  timelineStatus: { fontSize: 14, fontWeight: '600', color: '#333' },
  timelineTime: { fontSize: 12, color: '#888', marginTop: 2 },
});
