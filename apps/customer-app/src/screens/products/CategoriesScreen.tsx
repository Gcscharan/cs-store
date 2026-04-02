import React, { useState, useCallback, memo, useMemo, useEffect } from 'react'; 
import { 
  View, Text, StyleSheet, FlatList, 
  TouchableOpacity, ActivityIndicator, Image, 
  ScrollView, TextInput, Alert, Platform, Dimensions, Pressable,
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetCategoriesQuery, useGetProductsQuery } from '../../api/productsApi'; 
import { useAddToCartMutation } from '../../api/cartApi';
import { useDispatch } from 'react-redux'; 
import { addItem } from '../../store/slices/cartSlice'; 
import { showToast } from '../../store/slices/uiSlice';
import { SmartImage } from '../../components/SmartImage'; 
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import FilterBottomSheet, { FilterState } from '../../components/FilterBottomSheet';

import { CURATED_CATEGORIES } from '../../constants/categories';

const DEFAULT_CATEGORY_IMAGE = { uri: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?q=80&w=200&auto=format&fit=crop" }; // Fallback

const getImageUrl = (images?: any[]): string | undefined => {
  const first = images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  
  // Try direct properties first, then look inside variants
  return (
    first?.url ||
    first?.thumb ||
    first?.small ||
    first?.medium ||
    first?.variants?.medium ||
    first?.variants?.small ||
    first?.variants?.thumb ||
    first?.variants?.original ||
    first?.large ||
    first?.original ||
    null
  ) || undefined;
};

// Optimized Product Card for Categories
const CategoryProductCard = memo(({ item, onAdd, navigation }: any) => {
  const discount = item.mrp > item.price 
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100) 
    : 0;

  const handlePress = useCallback(() => {
    navigation.navigate('ProductDetail', { productId: item._id });
  }, [navigation, item._id]);

  const handleAdd = useCallback(() => {
    onAdd(item);
  }, [onAdd, item]);

  return (
    <TouchableOpacity 
      style={s.productCard} 
      onPress={handlePress} 
      activeOpacity={0.8} 
    > 
      <SmartImage 
        uri={getImageUrl(item.images)} 
        style={s.productImg} 
        fallbackEmoji="📦" 
      /> 
      {discount > 0 && ( 
        <View style={s.discountBadge}> 
          <Text style={s.discountTxt}>{discount}% off</Text> 
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
          style={s.addBtn} 
          onPress={handleAdd}
        > 
          <Text style={s.addBtnTxt}>+ Add</Text> 
        </TouchableOpacity> 
      </View> 
    </TouchableOpacity>
  );
});

// ─── Responsive Grid Constants ─────────────────────────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const H_PAD = 16;
const GRID_GAP = 16;
const CAT_ITEM_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// Optimized Category Card
const CategoryCard = memo(({ item, onSelect }: any) => {
  const handlePress = useCallback(() => {
    onSelect(item.name);
  }, [onSelect, item.name]);

  const isTextTile = item.isTextTile === true;

  return (
    <Pressable 
      onPress={handlePress} 
      style={({ pressed }) => [
        s.categoryCard,
        pressed && s.categoryCardPressed,
      ]}
      android_ripple={{
        color: 'rgba(255, 106, 0, 0.08)',
        borderless: false,
      }}
    > 
      <View style={[
        s.catImageContainer,
        isTextTile && { backgroundColor: item.tileBg || '#F0F9FF' },
      ]}>
        {isTextTile ? (
          <View style={s.textTileInner}>
            <Text style={[s.tileMainText, item.tileColor ? { color: item.tileColor } : null]}>
              {item.tileText || item.name}
            </Text>
            {item.tileSubtext && (
              <Text style={[s.tileSubText, item.tileColor ? { color: item.tileColor, opacity: 0.7 } : null]}>
                {item.tileSubtext}
              </Text>
            )}
          </View>
        ) : (
          <Image 
            source={item.image || DEFAULT_CATEGORY_IMAGE} 
            style={s.catImage} 
            resizeMode="contain" 
          />
        )}
      </View>
      <Text style={s.categoryName} numberOfLines={2}> 
        {item.name} 
      </Text> 
    </Pressable>
  );
});

export default function CategoriesScreen({ navigation, route }: any) { 
  const dispatch = useDispatch(); 
  const [selectedCategory, setSelectedCategory] = useState<string | null>(route?.params?.preselect || null); 
  const [search, setSearch] = useState(''); 
  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 50000,
    category: route?.params?.preselect || null,
    rating: null,
    sortBy: 'newest',
    sortOrder: 'desc',
  });
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterMode, setFilterMode] = useState<'filter' | 'sort'>('filter');
  const [addToCart] = useAddToCartMutation();
  const [previousProducts, setPreviousProducts] = useState<any[]>([]);
 
  const { data: catData, isLoading: loadingCats } = useGetCategoriesQuery(); 
  const { data: productsData, isLoading: loadingProducts, isFetching } = useGetProductsQuery( 
    { ...filters, category: selectedCategory!, limit: 50, search }, 
    { skip: !selectedCategory } 
  ); 
 
  useEffect(() => {
    if (route?.params?.preselect) {
      setSelectedCategory(route.params.preselect);
      setFilters(prev => ({ ...prev, category: route.params.preselect }));
    }
  }, [route?.params?.preselect]);

  // Keep track of previous products to avoid flickering during filter changes
  useEffect(() => {
    if (productsData?.products) {
      setPreviousProducts(productsData.products);
    }
  }, [productsData]);
 
  // Use curated categories instead of API data
  const categories = CURATED_CATEGORIES;

  const products = useMemo(() => {
    if (isFetching && previousProducts.length > 0) {
      return previousProducts;
    }
    const raw = productsData?.products || [];
    if (search.length < 2) return raw;
    return raw.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [productsData, search, isFetching, previousProducts]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice > 0 || filters.maxPrice < 50000) count++;
    if (filters.rating) count++;
    if (filters.sortBy !== 'newest') count++;
    return count;
  }, [filters]);
 

  const handleAddToCart = useCallback(async (item: any) => {
    try {
      // Optimistic update
      dispatch(addItem({ 
        productId: item._id, 
        name: item.name, 
        price: item.price, 
        quantity: 1, 
        image: getImageUrl(item.images), 
      })); 
      dispatch(showToast(`${item.name} added to cart`));

      await addToCart({ productId: item._id, quantity: 1 }).unwrap();
    } catch (error: any) {
    }
  }, [addToCart, dispatch]);

  const clearAllFilters = useCallback(() => {
    setFilters({
      minPrice: 0,
      maxPrice: 50000,
      category: selectedCategory,
      rating: null,
      sortBy: 'newest',
      sortOrder: 'desc',
    });
  }, [selectedCategory]);

  const removeFilter = useCallback((key: keyof FilterState) => {
    setFilters(prev => {
      const next = { ...prev };
      if (key === 'minPrice' || key === 'maxPrice') {
        next.minPrice = 0;
        next.maxPrice = 50000;
      } else if (key === 'rating') {
        next.rating = null;
      } else if (key === 'sortBy') {
        next.sortBy = 'newest';
        next.sortOrder = 'desc';
      }
      return next;
    });
  }, []);

  const renderProductItem = useCallback(({ item }: any) => (
    <CategoryProductCard 
      item={item} 
      onAdd={handleAddToCart} 
      navigation={navigation} 
    />
  ), [handleAddToCart, navigation]);

  const renderCategoryItem = useCallback(({ item }: any) => (
    <CategoryCard 
      item={item} 
      onSelect={setSelectedCategory} 
    />
  ), []);

  const renderFilterChips = () => {
    if (activeFiltersCount === 0) return null;
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={s.chipScroll}
      >
        {filters.sortBy !== 'newest' && (
          <TouchableOpacity style={s.chip} onPress={() => removeFilter('sortBy')}>
            <Text style={s.chipText}>Sort: {filters.sortBy}</Text>
            <Ionicons name="close-circle" size={14} color="#999" />
          </TouchableOpacity>
        )}
        {filters.rating && (
          <TouchableOpacity style={s.chip} onPress={() => removeFilter('rating')}>
            <Text style={s.chipText}>{filters.rating}★ & above</Text>
            <Ionicons name="close-circle" size={14} color="#999" />
          </TouchableOpacity>
        )}
        {(filters.minPrice > 0 || filters.maxPrice < 50000) && (
          <TouchableOpacity style={s.chip} onPress={() => removeFilter('minPrice')}>
            <Text style={s.chipText}>₹{filters.minPrice} - ₹{filters.maxPrice}</Text>
            <Ionicons name="close-circle" size={14} color="#999" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.chip, s.clearAllChip]} onPress={clearAllFilters}>
          <Text style={[s.chipText, s.clearAllChipText]}>Clear All</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderFilterBar = () => {
    return (
      <View style={s.stickyFilterBar}>
        <View style={s.filterBarRow}>
          <TouchableOpacity 
            style={s.filterBarBtn} 
            onPress={() => {
              setFilterMode('filter');
              setIsFilterVisible(true);
            }}
          >
            <Ionicons name="funnel-outline" size={18} color="#333" />
            <Text style={s.filterBarBtnText}>
              Filter {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
            </Text>
          </TouchableOpacity>
          <View style={s.filterBarDivider} />
          <TouchableOpacity 
            style={s.filterBarBtn} 
            onPress={() => {
              setFilterMode('sort');
              setIsFilterVisible(true);
            }}
          >
            <Ionicons name="swap-vertical" size={18} color="#333" />
            <Text style={s.filterBarBtnText}>
              Sort {filters.sortBy !== 'newest' ? `(${filters.sortBy})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
        {renderFilterChips()}
      </View>
    );
  };

  // PRODUCTS VIEW - when category selected 
  if (selectedCategory) { 
    const categoryInfo = CURATED_CATEGORIES.find(c => c.name === selectedCategory) || { name: selectedCategory, image: DEFAULT_CATEGORY_IMAGE };
    
    return ( 
      <View style={s.container}> 
        {/* Header */} 
        <ScreenHeader 
          title={categoryInfo.name} 
          showBackButton 
          onBack={() => { setSelectedCategory(null); setSearch(''); }}
        /> 
 
        {/* Search */}
        <View style={s.searchBarWrapper}>
          <View style={s.searchRow}> 
            <Ionicons name="search" size={18} color="#aaa" style={{ marginRight: 8 }} />
            <TextInput 
              style={s.searchInput} 
              placeholder={`Search in ${categoryInfo.name}...`} 
              placeholderTextColor="#aaa" 
              value={search} 
              onChangeText={setSearch} 
            /> 
            {search.length > 0 && ( 
              <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}> 
                <Ionicons name="close-circle" size={18} color="#aaa" />
              </TouchableOpacity> 
            )} 
          </View> 
        </View>

        {renderFilterBar()}
 
        {loadingProducts && products.length === 0 ? ( 
          <ActivityIndicator size="large" color="#E95C1E" style={{ margin: 40 }} /> 
        ) : products.length === 0 ? ( 
          <View style={s.emptyState}> 
            <Ionicons name="search-outline" size={56} color={Colors.textMuted} />
            <Text style={s.emptyTxt}> 
              {activeFiltersCount > 0 
                ? "No products matching these filters"
                : search.length > 0 
                  ? `No results for "${search}"` 
                  : `No products in ${categoryInfo.name}`} 
            </Text> 
            {activeFiltersCount > 0 && (
              <TouchableOpacity style={s.clearFiltersBtn} onPress={clearAllFilters}>
                <Text style={s.clearFiltersBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View> 
        ) : ( 
          <FlatList 
            data={products} 
            numColumns={2} 
            keyExtractor={(p) => p._id} 
            contentContainerStyle={s.productGrid} 
            showsVerticalScrollIndicator={false} 
            renderItem={renderProductItem} 
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            ListHeaderComponent={
              isFetching && products.length > 0 ? (
                <View style={s.topLoader}>
                  <ActivityIndicator size="small" color="#E95C1E" />
                  <Text style={s.topLoaderText}>Updating results...</Text>
                </View>
              ) : null
            }
          /> 
         )} 

        <FilterBottomSheet
          isVisible={isFilterVisible}
          onClose={() => setIsFilterVisible(false)}
          onApply={setFilters}
          onClearAll={clearAllFilters}
          filters={filters}
          categories={[]} // Categories are fixed in this view
          mode={filterMode}
        />
       </View> 
     ); 
   } 
 
   // CATEGORIES VIEW - main screen 
   return ( 
     <View style={s.container}> 
       <ScreenHeader title="Categories" />
 
       {loadingCats ? ( 
         <View style={s.skeletonGrid}> 
           {[1,2,3,4,5,6,7,8,9].map(i => ( 
             <View key={i} style={s.skeletonCard} /> 
           ))} 
         </View> 
       ) : categories.length === 0 ? ( 
         <View style={s.emptyState}> 
           <Ionicons name="cart-outline" size={56} color={Colors.textMuted} />
           <Text style={s.emptyTxt}>No categories found</Text> 
         </View> 
       ) : ( 
         <FlatList 
           data={categories} 
           numColumns={NUM_COLUMNS} 
           keyExtractor={(c) => c.name} 
           contentContainerStyle={s.categoryGrid} 
           columnWrapperStyle={{ justifyContent: 'space-between' }}
           showsVerticalScrollIndicator={false}
           renderItem={renderCategoryItem} 
           initialNumToRender={12}
           maxToRenderPerBatch={12}
           windowSize={3}
           removeClippedSubviews
         /> 
       )} 
     </View> 
   ); 
 } 
 
 const s = StyleSheet.create({ 
   container: { flex: 1, backgroundColor: Colors.background }, 
   title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, 
     paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }, 
 
   // Category grid 
  categoryGrid: { paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 28 }, 
  categoryCard: { 
    width: CAT_ITEM_WIDTH,
    alignItems: 'center', 
    marginBottom: 16,
  },
  categoryCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  catImageContainer: {
    width: CAT_ITEM_WIDTH,
    height: CAT_ITEM_WIDTH,
    backgroundColor: '#FFF7F2',
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: '#F0EAE5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 10,
  },
  catImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  textTileInner: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMainText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  tileSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
    opacity: 0.55,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  categoryName: { 
    marginTop: 10, fontSize: 13, fontWeight: '600', color: '#2A2A2A', 
    textAlign: 'center', lineHeight: 17,
  }, 
  // Skeleton 
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', 
    paddingHorizontal: H_PAD, paddingTop: 12 }, 
   skeletonCard: { width: CAT_ITEM_WIDTH, height: CAT_ITEM_WIDTH + 32, backgroundColor: Colors.border, 
     borderRadius: 20, marginRight: GRID_GAP, marginBottom: GRID_GAP }, 
 
   // Header for product view 
   header: { flexDirection: 'row', alignItems: 'center', 
     padding: 16, backgroundColor: Colors.white, 
     borderBottomWidth: 1, borderColor: Colors.border }, 
   backBtn: { padding: 4, marginRight: 12 }, 
   headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, flex: 1 }, 
 
   // Search 
   searchBarWrapper: { flexDirection: 'row', alignItems: 'center', margin: 12, marginBottom: 4 },
   searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', 
     backgroundColor: Colors.inputBackground, borderRadius: 12, 
     paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border }, 
   searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary }, 
   clearBtn: { padding: 8 }, 
 
   // Product grid 
   productGrid: { padding: 12 }, 
   productCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, 
     overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, margin: 5 }, 
   productImg: { width: '100%', aspectRatio: 1, backgroundColor: Colors.white }, 
   discountBadge: { position: 'absolute', top: 8, left: 8, 
     backgroundColor: Colors.primary, paddingHorizontal: 6, 
     paddingVertical: 4, borderRadius: 6 }, 
   discountTxt: { color: Colors.white, fontSize: 10, fontWeight: '800' }, 
   productInfo: { padding: 12, borderTopWidth: 1, borderColor: Colors.border }, 
   productName: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18, marginBottom: 6, fontWeight: '600' }, 
   priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, 
   price: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary }, 
   mrp: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' }, 
   addBtn: { backgroundColor: '#FFF5F0', borderWidth: 1, 
     borderColor: Colors.primary, borderRadius: 10, 
     paddingVertical: 8, alignItems: 'center' }, 
   addBtnTxt: { color: Colors.primary, fontWeight: '800', fontSize: 13 }, 
 
   // Empty state 
   emptyState: { flex: 1, justifyContent: 'center', 
     alignItems: 'center', padding: 40 }, 
   emptyTxt: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 12 }, 
   clearFiltersBtn: {
     marginTop: 10,
     paddingHorizontal: 20,
     paddingVertical: 10,
     backgroundColor: Colors.primary,
     borderRadius: 10,
   },
   clearFiltersBtnText: { color: Colors.white, fontWeight: '700' },
 
   // Filter Bar
   stickyFilterBar: {
     backgroundColor: Colors.white,
     borderBottomWidth: 1,
     borderColor: Colors.border,
     paddingBottom: 4,
   },
   filterBarRow: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 12,
   },
   filterBarBtn: {
     flex: 1,
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
   },
   filterBarBtnText: {
     fontSize: 14,
     color: Colors.textPrimary,
     fontWeight: '700',
     marginLeft: 8,
   },
   filterBarDivider: {
     width: 1,
     height: 20,
     backgroundColor: Colors.border,
   },
   chipScroll: {
     paddingHorizontal: 12,
     paddingBottom: 8,
   },
   chip: {
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: Colors.inputBackground,
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
     marginRight: 6,
   },
   clearAllChip: {
     backgroundColor: Colors.white,
     borderColor: Colors.primary,
   },
   clearAllChipText: {
     color: Colors.primary,
   },
   topLoader: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     paddingVertical: 8,
     backgroundColor: Colors.background,
   },
   topLoaderText: {
     fontSize: 12,
     color: Colors.textSecondary,
     fontWeight: '600',
     marginLeft: 8,
   },
 }); 
