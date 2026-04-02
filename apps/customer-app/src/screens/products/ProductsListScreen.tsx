import React, { useCallback, memo, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useGetProductsQuery, useGetCategoriesQuery } from '../../api/productsApi';
import { useAddToCartMutation } from '../../api/cartApi';
import { useDispatch } from 'react-redux';
import { addItem } from '../../store/slices/cartSlice';
import { showToast } from '../../store/slices/uiSlice';
import { Product } from '@vyaparsetu/types';
import { SmartImage } from '../../components/SmartImage';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import FilterBottomSheet, { FilterState } from '../../components/FilterBottomSheet';

const ProductListItem = memo(({ item, onAdd, navigation }: { item: Product; onAdd: (item: Product) => void; navigation: any }) => {
  const handlePress = useCallback(() => {
    navigation.navigate('ProductDetail', { productId: item._id });
  }, [navigation, item._id]);

  const handleAdd = useCallback(() => {
    onAdd(item);
  }, [onAdd, item]);

  // Deterministic pseudo-random number for urgency based on product ID
  const getUrgencyCount = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 20) + 5; // Returns a number between 5 and 24
  };
  const urgencyCount = getUrgencyCount(item._id);

  return (
    <View style={styles.productCard}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <SmartImage uri={item.images?.[0]} style={styles.productImage} />
        <View style={styles.urgencyBadgeSmall}>
          <Text style={styles.urgencyBadgeSmallText}>🔥 {urgencyCount} bought</Text>
        </View>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productPrice}>₹{item.price}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addButton} onPress={handleAdd} activeOpacity={0.8}>
        <Text style={styles.addButtonText}>Add to Cart</Text>
      </TouchableOpacity>
    </View>
  );
});

const ProductsListScreen: React.FC<{ route: { params: { category?: string } }; navigation: any }> = ({ route, navigation }) => {
  const { category: initialCategory } = route.params;
  const dispatch = useDispatch();
  
  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 50000,
    category: initialCategory || null,
    rating: null,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const { data, isLoading, isError, refetch } = useGetProductsQuery({
    category: filters.category || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort: filters.sortBy === 'relevance' ? undefined : `${filters.sortBy}:${filters.sortOrder}`,
  });

  const { data: catData } = useGetCategoriesQuery();
  const categories = catData?.categories || [];

  const [addToCart] = useAddToCartMutation();

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice > 0 || filters.maxPrice < 50000) count++;
    if (filters.category !== initialCategory) count++;
    if (filters.rating) count++;
    if (filters.sortBy !== 'relevance') count++;
    return count;
  }, [filters, initialCategory]);

  const removeFilter = useCallback((key: keyof FilterState) => {
    setFilters(prev => {
      const next = { ...prev };
      if (key === 'minPrice' || key === 'maxPrice') {
        next.minPrice = 0;
        next.maxPrice = 50000;
      } else if (key === 'category') {
        next.category = initialCategory;
      } else if (key === 'rating') {
        next.rating = null;
      } else if (key === 'sortBy') {
        next.sortBy = 'relevance';
        next.sortOrder = 'desc';
      }
      return next;
    });
  }, [initialCategory]);

  useEffect(() => {
    navigation.setOptions({
      title: filters.category || 'Products',
      headerRight: () => (
        <TouchableOpacity 
          style={styles.headerFilterBtn} 
          onPress={() => setIsFilterVisible(true)}
        >
          <Ionicons 
            name={activeFiltersCount > 0 ? "filter" : "filter-outline"} 
            size={22} 
            color={activeFiltersCount > 0 ? Colors.primary : Colors.textPrimary} 
          />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, filters.category, activeFiltersCount]);

  const handleAddToCart = useCallback(async (item: Product) => {
    try {
      // Optimistic update
      dispatch(addItem({
        productId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: item.images?.[0],
      } as any));
      dispatch(showToast(`${item.name} added to cart`));

      await addToCart({ productId: item._id, quantity: 1 }).unwrap();
    } catch (error: any) {
    }
  }, [addToCart, dispatch]);

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <ProductListItem item={item} onAdd={handleAddToCart} navigation={navigation} />
  ), [handleAddToCart, navigation]);

  const products = useMemo(() => data?.products || [], [data]);

  const renderFilterChips = () => {
    if (activeFiltersCount === 0) return null;
    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {filters.sortBy !== 'relevance' && (
            <TouchableOpacity style={styles.chip} onPress={() => removeFilter('sortBy')}>
              <Text style={styles.chipText}>Sort: {filters.sortBy}</Text>
              <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
          {filters.category !== initialCategory && (
            <TouchableOpacity style={styles.chip} onPress={() => removeFilter('category')}>
              <Text style={styles.chipText}>{filters.category}</Text>
              <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
          {filters.rating && (
            <TouchableOpacity style={styles.chip} onPress={() => removeFilter('rating')}>
              <Text style={styles.chipText}>{filters.rating}★ & above</Text>
              <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
          {(filters.minPrice > 0 || filters.maxPrice < 50000) && (
            <TouchableOpacity style={styles.chip} onPress={() => removeFilter('minPrice')}>
              <Text style={styles.chipText}>₹{filters.minPrice} - ₹{filters.maxPrice}</Text>
              <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };



  return (
    <View style={styles.container}>
      {renderFilterChips()}
      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        numColumns={2}
        contentContainerStyle={styles.listPadding}
        onRefresh={refetch}
        refreshing={isLoading}
      />
      <FilterBottomSheet
        isVisible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApply={setFilters}
        onClearAll={() => {
          setFilters({
            minPrice: 0,
            maxPrice: 50000,
            category: initialCategory || null,
            rating: null,
            sortBy: 'relevance',
            sortOrder: 'desc',
          });
        }}
        filters={filters}
        categories={categories}
        mode="filter"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listPadding: {
    padding: 8,
  },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImage: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.background,
  },
  urgencyBadgeSmall: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 251, 235, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  urgencyBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 10,
    marginTop: 10,
    minHeight: 40,
    color: Colors.textPrimary,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    marginHorizontal: 10,
    marginBottom: 5,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    margin: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 40,
    color: Colors.error,
  },
  headerFilterBtn: {
    padding: 8,
    marginRight: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.white,
  },
  filterBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  chipScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

export default ProductsListScreen;
