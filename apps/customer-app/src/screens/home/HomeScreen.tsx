import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useGetProductsQuery, useGetUnreadCountQuery } from '../../store/api';

const CATEGORIES = [
  { id: 'fruits', name: 'Fruits & Vegetables', emoji: '🥬' },
  { id: 'dairy', name: 'Dairy & Eggs', emoji: '🥛' },
  { id: 'snacks', name: 'Snacks', emoji: '🍪' },
  { id: 'beverages', name: 'Beverages', emoji: '🧃' },
  { id: 'personal', name: 'Personal Care', emoji: '🧴' },
  { id: 'household', name: 'Household', emoji: '🧹' },
];

export default function HomeScreen({ navigation }: any) {
  const { data, isLoading } = useGetProductsQuery({ limit: 12 });
  const { data: unreadData } = useGetUnreadCountQuery();
  const unreadCount = unreadData?.count || 0;

  return (
    <SafeAreaView style={s.container}>
      {/* Header with search and notification */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={s.searchIcon}>🔍</Text>
          <Text style={s.searchPlaceholder}>Search for Products, Brands...</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={s.notifIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <Text style={s.sectionTitle}>Shop by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={s.catCard}
              onPress={() => navigation.navigate('Search', { category: cat.id })}
            >
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <Text style={s.catName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Top Selling */}
        <Text style={s.sectionTitle}>🔥 Top Selling</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#E95C1E" style={{ margin: 24 }} />
        ) : (
          <View style={s.productsGrid}>
            {data?.products?.map((product: any) => (
              <TouchableOpacity
                key={product._id}
                style={s.productCard}
                onPress={() => navigation.navigate('ProductDetail', { id: product._id })}
              >
                <Image
                  source={{ uri: product.images?.[0] || 'https://via.placeholder.com/150' }}
                  style={s.productImage}
                  resizeMode="cover"
                />
                <Text style={s.productName} numberOfLines={2}>{product.name}</Text>
                <View style={s.priceRow}>
                  <Text style={s.productPrice}>₹{product.price}</Text>
                  {product.mrp > product.price && (
                    <Text style={s.productMrp}>₹{product.mrp}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { color: '#888', fontSize: 14 },
  notifBtn: { position: 'relative', padding: 8 },
  notifIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: 4, right: 4,
    backgroundColor: '#E95C1E', borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '700', margin: 16, marginBottom: 12 },
  catScroll: { paddingLeft: 12, marginBottom: 8 },
  catCard: { width: 100, alignItems: 'center', marginRight: 12,
    backgroundColor: '#fff', padding: 12, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  catEmoji: { fontSize: 28, marginBottom: 6 },
  catName: { fontSize: 11, color: '#333', textAlign: 'center', fontWeight: '500' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  productCard: { width: '48%', margin: '1%', backgroundColor: '#fff', borderRadius: 10,
    padding: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  productImage: { width: '100%', height: 140, borderRadius: 8, backgroundColor: '#f5f5f5' },
  productName: { fontSize: 13, marginTop: 8, color: '#333', lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  productPrice: { fontSize: 15, fontWeight: '700', color: '#E95C1E' },
  productMrp: { fontSize: 12, color: '#bbb', textDecorationLine: 'line-through' },
});
