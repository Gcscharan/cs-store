import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Image, Modal, ScrollView,
} from 'react-native';
import { useGetProductsQuery } from '../../store/api';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';
import { debounce } from '../../utils/debounce';

const SORT_OPTIONS = [
  { label: 'Relevance', value: '' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Newest First', value: 'newest' },
];

const CATEGORIES = [
  'All', 'Fruits & Vegetables', 'Dairy & Eggs', 'Snacks',
  'Beverages', 'Personal Care', 'Household', 'Bakery', 'Meat & Fish',
];

export default function SearchScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSort, setSelectedSort] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const debouncedSet = useCallback(debounce((val: string) => setDebouncedQuery(val), 400), []);

  const { data, isLoading, isFetching } = useGetProductsQuery({
    search: debouncedQuery,
    category: selectedCategory === 'All' ? undefined : selectedCategory,
    sort: selectedSort || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    limit: 20,
  }, { skip: debouncedQuery.length < 1 });

  const products = data?.products || [];

  return (
    <SafeAreaView style={s.container}>
      {/* Search bar */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          placeholder="Search products, brands..."
          placeholderTextColor="#aaa"
          value={query}
          autoFocus
          onChangeText={(v) => { setQuery(v); debouncedSet(v); }}
        />
        <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilters(true)}>
          <Text style={s.filterTxt}>⚙ Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Sort pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sortRow}>
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[s.pill, selectedSort === opt.value && s.pillActive]}
            onPress={() => setSelectedSort(opt.value)}
          >
            <Text style={[s.pillTxt, selectedSort === opt.value && s.pillTxtActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {isLoading || isFetching ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#E95C1E" />
      ) : debouncedQuery.length < 1 ? (
        <View style={s.hint}>
          <Text style={s.hintEmoji}>🔍</Text>
          <Text style={s.hintTxt}>Search for groceries, snacks, and more</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={s.hint}>
          <Text style={s.hintEmoji}>😕</Text>
          <Text style={s.hintTxt}>No results for "{debouncedQuery}"</Text>
          <Text style={s.hintSub}>Try different keywords or remove filters</Text>
        </View>
      ) : (
        <>
          <Text style={s.resultCount}>{data?.total || products.length} results</Text>
          <FlatList
            data={products}
            numColumns={2}
            keyExtractor={(p) => p._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('ProductDetail', { id: item._id })}
              >
                <Image source={{ uri: item.images?.[0] }} style={s.img} resizeMode="cover" />
                <Text style={s.name} numberOfLines={2}>{item.name}</Text>
                <View style={s.priceRow}>
                  <Text style={s.price}>₹{item.price}</Text>
                  {item.mrp > item.price && (
                    <Text style={s.mrp}>₹{item.mrp}</Text>
                  )}
                </View>
                <TouchableOpacity style={s.addBtn} onPress={() =>
                  dispatch(addToCart({ productId: item._id, name: item.name,
                    price: item.price, quantity: 1, image: item.images?.[0] }))
                }>
                  <Text style={s.addBtnTxt}>+ Add</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Filters</Text>
            <Text style={s.filterLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.pill, selectedCategory === cat && s.pillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[s.pillTxt, selectedCategory === cat && s.pillTxtActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.filterLabel}>Price Range</Text>
            <View style={s.priceInputRow}>
              <TextInput
                style={s.priceInput}
                placeholder="Min ₹"
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
              />
              <Text style={{ color: '#888' }}>—</Text>
              <TextInput
                style={s.priceInput}
                placeholder="Max ₹"
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.clearBtn} onPress={() => {
                setSelectedCategory('All'); setMinPrice(''); setMaxPrice('');
              }}>
                <Text style={s.clearBtnTxt}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={() => setShowFilters(false)}>
                <Text style={s.applyBtnTxt}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  backBtn: { padding: 4 },
  backTxt: { fontSize: 24, color: '#333' },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#fff8f5', borderRadius: 8, borderWidth: 1, borderColor: '#E95C1E' },
  filterTxt: { color: '#E95C1E', fontSize: 13, fontWeight: '600' },
  sortRow: { paddingHorizontal: 12, marginBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f5f5f5', marginRight: 8, marginBottom: 8 },
  pillActive: { backgroundColor: '#E95C1E' },
  pillTxt: { fontSize: 13, color: '#666' },
  pillTxtActive: { color: '#fff', fontWeight: '600' },
  resultCount: { paddingHorizontal: 16, paddingBottom: 8, color: '#888', fontSize: 13 },
  hint: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  hintEmoji: { fontSize: 48 },
  hintTxt: { fontSize: 17, color: '#444', textAlign: 'center' },
  hintSub: { fontSize: 14, color: '#999' },
  card: { width: '47%', margin: '1.5%', backgroundColor: '#fff',
    borderRadius: 12, padding: 10, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 },
  img: { width: '100%', height: 130, borderRadius: 8, backgroundColor: '#f5f5f5' },
  name: { fontSize: 13, color: '#333', marginTop: 6, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  price: { fontSize: 15, fontWeight: '700', color: '#E95C1E' },
  mrp: { fontSize: 12, color: '#bbb', textDecorationLine: 'line-through' },
  addBtn: { marginTop: 8, backgroundColor: '#fff8f5', borderWidth: 1,
    borderColor: '#E95C1E', borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  addBtnTxt: { color: '#E95C1E', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  priceInput: { flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 12, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  clearBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1,
    borderColor: '#ddd', alignItems: 'center' },
  clearBtnTxt: { color: '#666', fontWeight: '600' },
  applyBtn: { flex: 2, padding: 14, borderRadius: 10,
    backgroundColor: '#E95C1E', alignItems: 'center' },
  applyBtnTxt: { color: '#fff', fontWeight: '700' },
});
