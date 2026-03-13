import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

export default function CheckoutScreen({ navigation }: any) {
  const { items } = useSelector((s: RootState) => s.cart);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <ScrollView>
        <Text style={styles.title}>Checkout</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <Text style={styles.itemCount}>{items.length} items</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Subtotal</Text>
            <Text style={styles.value}>₹{total}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery</Text>
            <Text style={styles.value}>₹0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{total}</Text>
          </View>
        </View>
        <Text style={styles.note}>Full checkout with Razorpay coming in next session</Text>
      </ScrollView>
      <TouchableOpacity
        style={styles.placeBtn}
        onPress={() => navigation.navigate('OrderSuccess')}
      >
        <Text style={styles.placeBtnText}>Place Order • ₹{total}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  back: { padding: 16 },
  backText: { color: '#E95C1E', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  summary: { margin: 16, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 12 },
  summaryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  itemCount: { fontSize: 14, color: '#888', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 15, color: '#666' },
  value: { fontSize: 15, color: '#333' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#E95C1E' },
  note: { textAlign: 'center', color: '#888', marginTop: 16, paddingHorizontal: 16 },
  placeBtn: {
    backgroundColor: '#E95C1E',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
