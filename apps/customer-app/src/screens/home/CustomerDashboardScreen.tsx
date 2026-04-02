import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useGetProductsQuery, useGetCategoriesQuery } from '../../api/productsApi';
import { useAddToCartMutation } from '../../api/cartApi';
import { useDispatch, useSelector } from 'react-redux';
import { addItem } from '../../store/slices/cartSlice';
import { showToast } from '../../store/slices/uiSlice';
import { SmartImage } from '../../components/SmartImage';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Colors } from '../../constants/colors';
import { RootState, AppDispatch } from '../../store';
import { logEvent } from '../../utils/analytics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CATEGORIES = [
  { id: 'all', name: 'For You', emoji: '✨' },
  { id: 'chocolates', name: 'Chocolates', emoji: '🍫' },
  { id: 'biscuits', name: 'Biscuits', emoji: '🍪' },
  { id: 'ladoos', name: 'Ladoos', emoji: '🍬' },
  { id: 'cakes', name: 'Cakes', emoji: '🎂' },
  { id: 'hot_snacks', name: 'Hot Snacks', emoji: '🍟' },
];

const SORT_OPTIONS = [
  { id: 'price_low_high', label: 'Price: Low → High' },
  { id: 'price_high_low', label: 'Price: High → Low' },
  { id: 'name_a_z', label: 'Name: A → Z' },
  { id: 'newest', label: 'Newest First' },
];

const getImageUrl = (images?: any[]): string | undefined => {
  const first = images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return first?.url || first?.variants?.medium || first?.variants?.small || undefined;
};

export default function CustomerDashboardScreen({ navigation }: any) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('price_low_high');
  const [refreshing, setRefreshing] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const [addToCart] = useAddToCartMutation();
  const { data: productsData, isLoading, error, refetch } = useGetProductsQuery({ limit: 100 });

  useEffect(() => {
    logEvent('screen_view', { screen: 'CustomerDashboard' });
  }, []);

  const filteredProducts = useMemo(() => {
    if (!productsData?.products) return [];
    let list = [...productsData.products];

    if (selectedCategory !== 'all') {
      list = list.filter((p: any) => p.category === selectedCategory);
    }

    list.sort((a: any, b: any) => {
      switch (sortBy) {
        case 'price_low_high': return a.price - b.price;
        case 'price_high_low': return b.price - a.price;
        case 'name_a_z': return a.name.localeCompare(b.name);
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });

    return list.map((p: any) => ({
      ...p,
      discount: p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    }));
  }, [productsData?.products, selectedCategory, sortBy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAddToCart = useCallback(async (item: any) => {
    if (addingIds.has(item._id)) return; // debounce

    setAddingIds(prev => new Set(prev).add(item._id));
    logEvent('add_to_cart', { productId: item._id, price: item.price, source: 'dashboard' });

    try {
      dispatch(addItem({
        productId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: getImageUrl(item.images),
      }));
      dispatch(showToast(`${item.name} added to cart`));
      await addToCart({ productId: item._id, quantity: 1 }).unwrap();
    } catch {
      logEvent('add_to_cart_failed', { productId: item._id });
      dispatch(showToast('Failed to add to cart'));
    } finally {
      setTimeout(() => {
        setAddingIds(prev => {
          const next = new Set(prev);
          next.delete(item._id);
          return next;
        });
      }, 500);
    }
  }, [addToCart, dispatch, addingIds]);

  const renderProduct = useCallback(({ item }: { item: any }) => {
    const imageUrl = getImageUrl(item.images);
    return (
      <TouchableOpacity
        style={s.productCard}
        onPress={() => navigation.navigate('ProductDetail', { productId: item._id })}
        activeOpacity={0.8}
      >
        <SmartImage uri={imageUrl} style={s.productImg} />
        {item.discount > 0 && (
          <View style={s.discountBadge}>
            <Text style={s.discountText}>{item.discount}% OFF</Text>
          </View>
        )}
        <View style={s.productInfo}>
          <Text style={s.productName} numberOfLines={2}>{item.name}</Text>
          <View style={s.priceRow}>
            <Text style={s.price}>₹{item.price}</Text>
            {item.mrp > item.price && (
              <Text style={[s.mrp, { marginLeft: 6 }]}>₹{item.mrp}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, addingIds.has(item._id) && s.addBtnDisabled]}
            onPress={() => handleAddToCart(item)}
            disabled={addingIds.has(item._id)}
          >
            <Text style={s.addBtnText}>
              {addingIds.has(item._id) ? 'Adding...' : '🛒 Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, handleAddToCart, addingIds]);

  if (error) {
    return (
      <SafeAreaView style={s.container}>
        <ErrorState
          message="Failed to load products. Please try again."
          onRetry={refetch}
          screenName="CustomerDashboard"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🛍️ For You</Text>
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categoryRow}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[s.categoryChip, selectedCategory === cat.id && s.categoryChipActive]}
            onPress={() => {
              setSelectedCategory(cat.id);
              logEvent('category_filter', { category: cat.id });
            }}
          >
            <Text style={s.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[s.categoryLabel, selectedCategory === cat.id && s.categoryLabelActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.sortRow}
      >
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[s.sortChip, sortBy === opt.id && s.sortChipActive]}
            onPress={() => {
              setSortBy(opt.id);
              logEvent('sort_changed', { sortBy: opt.id });
            }}
          >
            <Text style={[s.sortLabel, sortBy === opt.id && s.sortLabelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products */}
      {isLoading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loaderText}>Loading products...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No Products Found"
          description={selectedCategory !== 'all' ? 'Try a different category' : 'No products available'}
          actionLabel={selectedCategory !== 'all' ? 'Clear Filter' : undefined}
          onAction={selectedCategory !== 'all' ? () => setSelectedCategory('all') : undefined}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          numColumns={2}
          keyExtractor={(p: any) => p._id}
          renderItem={renderProduct}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  categoryRow: { paddingHorizontal: 12, paddingVertical: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryEmoji: { fontSize: 16, marginRight: 6 },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  categoryLabelActive: { color: Colors.white },
  sortRow: { paddingHorizontal: 12, paddingBottom: 8 },
  sortChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    backgroundColor: Colors.backgroundDark, borderWidth: 1, borderColor: Colors.border,
    marginRight: 6,
  },
  sortChipActive: { backgroundColor: Colors.secondaryDark, borderColor: Colors.secondaryDark },
  sortLabel: { fontSize: 11, color: Colors.textSecondary },
  sortLabelActive: { color: Colors.white, fontWeight: '600' },
  grid: { padding: 12 },
  gridRow: { justifyContent: 'space-between' },
  productCard: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 14,
    overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    marginBottom: 12, marginHorizontal: 6,
  },
  productImg: { width: '100%', height: 140, backgroundColor: Colors.backgroundDark },
  discountBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: '#16a34a',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  discountText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500', lineHeight: 18, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  price: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  mrp: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
});
