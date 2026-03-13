import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function OrderSuccessScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Order Placed!</Text>
      <Text style={styles.success}>Your order has been placed successfully.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#22C55E', marginBottom: 16 },
  success: { color: '#666', textAlign: 'center' },
});
