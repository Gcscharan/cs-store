import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, FlatList, TextInput, Alert,
} from 'react-native';
import { useGetProductQuery } from '../../store/api';
import { useDispatch } from 'react-redux';
import { addToCartWithSync } from '../../store/slices/cartSlice';
import { SmartImage } from '../../components/SmartImage';

export default function ProductDetailScreen({ route, navigation }: any) {
  const { id } = route.params || {};
  const { data: product, isLoading } = useGetProductQuery(id, { skip: !id });
  const dispatch = useDispatch<any>();
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [pincode, setPincode] = useState('');

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#E95C1E" /></View>;
  if (!product) return (
    <SafeAreaView style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <View style={s.center}><Text>Product not found</Text></View>
    </SafeAreaView>
  );

  const images = product.images?.length ? product.images : [null];
  const discount = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  const handleAddToCart = () => {
    dispatch(addToCartWithSync({
      productId: product._id, name: product.name,
      price: product.price, quantity: qty, image: images[0],
    }));
    Alert.alert('Added to cart!', product.name, [
      { text: 'Continue Shopping', style: 'cancel', onPress: () => navigation.goBack() },
      { text: 'Go to Cart', onPress: () => navigation.navigate('Cart') },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
        <Text style={s.backTxt}>←</Text>
      </TouchableOpacity>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SmartImage uri={images[selectedImage]} style={s.mainImage} fallbackEmoji="🛒" />
        {images.length > 1 && (
          <FlatList data={images} horizontal keyExtractor={(_, i) => String(i)}
            contentContainerStyle={s.thumbRow}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => setSelectedImage(index)}>
                <SmartImage uri={item} style={selectedImage === index ? { ...s.thumb, ...s.thumbActive } : s.thumb} />
              </TouchableOpacity>
            )}
          />
        )}
        <View style={s.info}>
          <Text style={s.name}>{product.name}</Text>
          <View style={s.priceRow}>
            <Text style={s.price}>₹{product.price}</Text>
            {discount > 0 && <>
              <Text style={s.mrp}>₹{product.mrp}</Text>
              <View style={s.badge}><Text style={s.badgeTxt}>{discount}% off</Text></View>
            </>}
          </View>
          <Text style={product.stock > 0 ? s.inStock : s.outStock}>
            {product.stock > 0 ? `✓ In stock (${product.stock} left)` : '✗ Out of stock'}
          </Text>
          {product.description && <Text style={s.desc}>{product.description}</Text>}
          <View style={s.pincodeSection}>
            <Text style={s.pincodeTitle}>🚚 Check delivery</Text>
            <View style={s.pincodeRow}>
              <TextInput style={s.pincodeInput} placeholder="Enter pincode"
                placeholderTextColor="#aaa" keyboardType="numeric" maxLength={6}
                value={pincode} onChangeText={setPincode} />
              <TouchableOpacity style={s.checkBtn}><Text style={s.checkBtnTxt}>Check</Text></TouchableOpacity>
            </View>
          </View>
          <View style={s.highlights}>
            {['🔒 100% Secure Payments', '↩️ Easy Returns', '⚡ Fast Delivery'].map(h => (
              <Text key={h} style={s.highlightTxt}>{h}</Text>
            ))}
          </View>
        </View>
      </ScrollView>
      {product.stock > 0 && (
        <View style={s.footer}>
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(q => Math.max(1, q - 1))}>
              <Text style={s.qtyBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={s.qty}>{qty}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(q => Math.min(product.stock, q + 1))}>
              <Text style={s.qtyBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={handleAddToCart}>
            <Text style={s.addBtnTxt}>Add to Cart • ₹{product.price * qty}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  back: { position: 'absolute', top: 48, left: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 8 },
  backTxt: { fontSize: 20, color: '#333' },
  mainImage: { width: '100%', height: 300, backgroundColor: '#f5f5f5' },
  thumbRow: { padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#f5f5f5', marginRight: 8 },
  thumbActive: { borderWidth: 2, borderColor: '#E95C1E' },
  info: { padding: 16 },
  name: { fontSize: 20, fontWeight: '700', color: '#222', lineHeight: 28 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  price: { fontSize: 26, fontWeight: '800', color: '#E95C1E' },
  mrp: { fontSize: 16, color: '#bbb', textDecorationLine: 'line-through' },
  badge: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#2e7d32', fontWeight: '700', fontSize: 13 },
  inStock: { color: '#2e7d32', fontWeight: '600', marginTop: 8, fontSize: 14 },
  outStock: { color: '#c62828', fontWeight: '600', marginTop: 8, fontSize: 14 },
  desc: { fontSize: 14, color: '#666', lineHeight: 24, marginTop: 14 },
  pincodeSection: { marginTop: 20, backgroundColor: '#f8f8f8', borderRadius: 12, padding: 14 },
  pincodeTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  pincodeRow: { flexDirection: 'row', gap: 10 },
  pincodeInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15 },
  checkBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8 },
  checkBtnTxt: { color: '#fff', fontWeight: '700' },
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  highlightTxt: { fontSize: 13, color: '#555', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderColor: '#f0f0f0', gap: 16, backgroundColor: '#fff' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  qtyBtnTxt: { fontSize: 22, color: '#333', fontWeight: '600' },
  qty: { fontSize: 20, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  addBtn: { flex: 1, backgroundColor: '#E95C1E', padding: 16, borderRadius: 12, alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
