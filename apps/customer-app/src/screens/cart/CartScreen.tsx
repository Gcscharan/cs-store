import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

export default function CartScreen() {
  const { items, total } = useSelector((s: RootState) => s.cart);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Cart</Text>
      {items.length === 0 ? (
        <Text style={styles.placeholder}>Your cart is empty</Text>
      ) : (
        <>
          <Text>{items.length} items</Text>
          <Text>Total: ₹{total}</Text>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  placeholder: { color: '#888', textAlign: 'center', marginTop: 40 },
});
