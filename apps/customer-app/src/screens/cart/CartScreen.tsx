import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { removeFromCart } from '../../store/slices/cartSlice';

export default function CartScreen({ navigation }: any) {
  const { items } = useSelector((s: RootState) => s.cart);
  const dispatch = useDispatch();
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Cart</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Text style={styles.shopLink}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Cart ({items.length})</Text>
      <FlatList
        data={items}
        keyExtractor={i => i.productId}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {item.image && <Image source={{ uri: item.image }} style={styles.img} />}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
            <TouchableOpacity onPress={() => dispatch(removeFromCart(item.productId))}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmt}>₹{total}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate('Checkout')}
        >
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', margin: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 64 },
  emptyText: { fontSize: 18, color: '#666' },
  shopLink: { color: '#E95C1E', fontSize: 16, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    gap: 12,
  },
  img: { width: 70, height: 70, borderRadius: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, color: '#333' },
  itemQty: { fontSize: 13, color: '#888', marginTop: 4 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#E95C1E', marginTop: 4 },
  remove: { fontSize: 18, color: '#ccc', padding: 8 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
  },
  totalLabel: { fontSize: 12, color: '#888' },
  totalAmt: { fontSize: 22, fontWeight: '800', color: '#222' },
  checkoutBtn: {
    backgroundColor: '#E95C1E',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
