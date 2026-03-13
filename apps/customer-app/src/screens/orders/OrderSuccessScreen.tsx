import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity,
} from 'react-native';

export default function OrderSuccessScreen({ navigation, route }: any) {
  const orderId = route.params?.orderId;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>✓</Text>
        </View>
        <Text style={s.title}>Order Placed!</Text>
        <Text style={s.subtitle}>Your order has been placed successfully</Text>
        {orderId && (
          <View style={s.orderIdCard}>
            <Text style={s.orderIdLabel}>Order ID</Text>
            <Text style={s.orderIdValue}>#{orderId}</Text>
          </View>
        )}
        <Text style={s.note}>
          You will receive an SMS confirmation shortly with delivery details.
        </Text>

        <TouchableOpacity
          style={s.trackBtn}
          onPress={() => navigation.replace('OrderDetail', { orderId })}
        >
          <Text style={s.trackBtnTxt}>View Order Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
        >
          <Text style={s.homeBtnTxt}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconWrap: { width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center',
    marginBottom: 24 },
  icon: { fontSize: 40, color: '#22c55e', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: '#22c55e', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 },
  orderIdCard: { backgroundColor: '#f5f5f5', paddingHorizontal: 24,
    paddingVertical: 14, borderRadius: 10, marginBottom: 20 },
  orderIdLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  orderIdValue: { fontSize: 18, fontWeight: '700', color: '#333' },
  note: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 32 },
  trackBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  trackBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  homeBtn: { paddingHorizontal: 24, paddingVertical: 14 },
  homeBtnTxt: { color: '#E95C1E', fontWeight: '600', fontSize: 15 },
});
