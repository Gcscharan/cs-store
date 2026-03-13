import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useGetProductQuery } from '../../store/api';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';

export default function ProductDetailScreen({ route, navigation }: any) {
  const { id } = route.params || {};
  const { data: product, isLoading } = useGetProductQuery(id, { skip: !id });
  const dispatch = useDispatch();
  const [qty, setQty] = useState(1);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E95C1E" />
      </View>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const discount =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <ScrollView>
        <Image
          source={{ uri: product.images?.[0] || 'https://via.placeholder.com/300' }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.info}>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{product.price}</Text>
            {discount > 0 && (
              <>
                <Text style={styles.mrp}>₹{product.mrp}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{discount}% off</Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.desc}>{product.description}</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQty(q => Math.max(1, q - 1))}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qty}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(q => q + 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          dispatch(
            addToCart({
              productId: product._id,
              name: product.name,
              price: product.price,
              quantity: qty,
              image: product.images?.[0],
            })
          );
          navigation.goBack();
        }}
      >
        <Text style={styles.addBtnText}>Add to Cart • ₹{product.price * qty}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { padding: 16 },
  backText: { fontSize: 16, color: '#E95C1E' },
  image: { width: '100%', height: 280 },
  info: { padding: 16 },
  name: { fontSize: 20, fontWeight: '700', color: '#222' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  price: { fontSize: 24, fontWeight: '800', color: '#E95C1E' },
  mrp: { fontSize: 16, color: '#999', textDecorationLine: 'line-through' },
  badge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: { color: '#2e7d32', fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 14, color: '#666', marginTop: 12, lineHeight: 22 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 22, color: '#333' },
  qty: { fontSize: 20, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  addBtn: {
    backgroundColor: '#E95C1E',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
