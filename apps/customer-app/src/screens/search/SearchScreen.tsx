import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Image,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { useGetProductsQuery, useLazySearchProductsQuery, useGetCategoriesQuery } from '../../api/productsApi';
import type { HomeNavigationProp, HomeStackParamList } from '../../navigation/types';
import type { Product } from '../../types';
import { SmartImage } from '../../components/SmartImage';
import { storage } from '../../utils/storage';
import FilterBottomSheet, { FilterState } from '../../components/FilterBottomSheet';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import VoiceListeningModal from '../../components/VoiceListeningModal';
import VoiceCartConfirmation from '../../components/VoiceCartConfirmation';
import { 
  processVoiceInput, 
  resolveItems, 
  voiceContext,
  type ResolvedItem 
} from '../../utils/voiceToCartEngine';
import { correctionEngine } from '../../utils/voiceCorrection';

import { logEvent } from '../../utils/analytics';
import { useDispatch } from 'react-redux';
import { addItem as addToCart } from '../../store/slices/cartSlice';
import { ToastAndroid, Alert } from 'react-native';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

// Optimized Product Card for Search
const SearchProductCard = memo(({ item, onPress }: { item: Product; onPress: (id: string) => void }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        {
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        }
      ]}
      onPress={() => onPress(item._id)}
    >
      <SmartImage uri={item.images?.[0]} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          {item.mrp && item.mrp > item.price && (
            <Text style={styles.productMrp}>₹{item.mrp}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

// Recent searches storage helpers
const RECENT_SEARCHES_KEY = 'recent_searches';
const getRecentSearches = async (): Promise<string[]> => {
  const data = await storage.getItem(RECENT_SEARCHES_KEY);
  return data ? JSON.parse(data) : [];
};
const addRecentSearch = async (query: string) => {
  const recent = await getRecentSearches();
  const updated = [query, ...recent.filter(q => q !== query)].slice(0, 10);
  await storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  return updated;
};
const clearRecentSearches = async () => {
  await storage.removeItem(RECENT_SEARCHES_KEY);
};

const SearchScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const route = useRoute<RouteProp<HomeStackParamList, 'Search'>>();
  const initialQuery = route.params?.initialQuery ?? '';
  const dispatch = useDispatch();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    minPrice: 0,
    maxPrice: 50000,
    category: null,
    rating: null,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterMode, setFilterMode] = useState<'filter' | 'sort'>('filter');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [previousProducts, setPreviousProducts] = useState<any[]>([]);
  
  // 🚀 NEW: Voice-to-Cart State
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);

  // Local instant search data
  const { data: allProducts } = useGetProductsQuery({ limit: 40 });
  const { data: catData } = useGetCategoriesQuery();
  const categories = catData?.categories || [];

  const [triggerSearch, { data: searchResults, isLoading, isFetching, error }] = useLazySearchProductsQuery();

  const lastQueryRef = React.useRef('');

  // 🚀 Build dynamic dictionary from local products
  useEffect(() => {
    if (allProducts?.products && allProducts.products.length > 0) {
      if (correctionEngine.getDictionary().length === 0 || correctionEngine.needsRefresh()) {
        console.log('[SearchScreen] Building dictionary from', allProducts.products.length, 'products');
        correctionEngine.buildDictionary(allProducts.products);
      }
    }
  }, [allProducts]);

  // Auto-trigger search if initialQuery provided (voice search result)
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setDebouncedQuery(initialQuery);
      lastQueryRef.current = initialQuery;
    }
  }, [initialQuery]);

  // Load recent searches on mount
  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  // Debounce search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      lastQueryRef.current = '';
      return;
    }

    if (lastQueryRef.current === trimmed) return;

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
      lastQueryRef.current = trimmed;
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Trigger API search when debounced query or filters change
  useEffect(() => {
    if (debouncedQuery) {
      triggerSearch({
        q: debouncedQuery,
        ...filters,
      }, true);
      addRecentSearch(debouncedQuery).then(setRecentSearches);
    }
  }, [debouncedQuery, filters, triggerSearch]);

  // Keep track of previous products to avoid flickering during filter changes
  useEffect(() => {
    if (searchResults?.products) {
      setPreviousProducts(searchResults.products);
    }
  }, [searchResults]);

  // Merge Local + API results with non-blocking fetch support
  const products = useMemo(() => {
    // If fetching and we have previous results, show them (non-blocking)
    if (isFetching && previousProducts.length > 0) {
      return previousProducts;
    }

    if (!searchQuery.trim()) return [];

    const apiItems = searchResults?.products || [];

    if (apiItems.length > 0 && debouncedQuery === searchQuery.trim()) {
      return apiItems;
    }

    // Instant local filtering while waiting for API
    const local = allProducts?.products?.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return local.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const q = searchQuery.toLowerCase();
      if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
      if (!aName.startsWith(q) && bName.startsWith(q)) return 1;
      return 0;
    }).slice(0, 12);
  }, [searchResults, searchQuery, debouncedQuery, allProducts, isFetching, previousProducts]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice > 0 || filters.maxPrice < 50000) count++;
    if (filters.category) count++;
    if (filters.rating) count++;
    if (filters.sortBy !== 'relevance') count++;
    return count;
  }, [filters]);

  const handleProductPress = useCallback((productId: string) => {
    navigation.navigate('ProductDetail', { productId });
  }, [navigation]);

  const handleFilterChange = (newFilters: FilterState) => {
    const changedFilters: Partial<FilterState & { priceRange: string }> = {};
    let hasChanged = false;

    // Check what changed
    if (newFilters.sortBy !== filters.sortBy || newFilters.sortOrder !== filters.sortOrder) {
      hasChanged = true;
      changedFilters.sortBy = newFilters.sortBy;
      changedFilters.sortOrder = newFilters.sortOrder;
      logEvent('sort_changed', { sort_by: newFilters.sortBy, sort_order: newFilters.sortOrder });
    } else {
      if (newFilters.category !== filters.category) {
        hasChanged = true;
        changedFilters.category = newFilters.category;
      }
      if (newFilters.rating !== filters.rating) {
        hasChanged = true;
        changedFilters.rating = newFilters.rating;
      }
      if (newFilters.minPrice !== filters.minPrice || newFilters.maxPrice !== filters.maxPrice) {
        hasChanged = true;
        changedFilters.minPrice = newFilters.minPrice;
        changedFilters.maxPrice = newFilters.maxPrice;
        changedFilters.priceRange = `${newFilters.minPrice}-${newFilters.maxPrice}`;
      }
      if (hasChanged) {
        logEvent('filter_applied', changedFilters);
      }
    }

    if (hasChanged) {
      setFilters(newFilters);
    }
  };

  const renderProduct = useCallback(({ item }: { item: Product }) => {
    return <SearchProductCard item={item} onPress={handleProductPress} />;
  }, [handleProductPress]);

  const clearAllFilters = useCallback(() => {
    setFilters({
      minPrice: 0,
      maxPrice: 50000,
      category: null,
      rating: null,
      sortBy: 'relevance',
      sortOrder: 'desc',
    });
  }, []);

  const removeFilter = useCallback((key: keyof FilterState) => {
    setFilters(prev => {
      const next = { ...prev };
      if (key === 'minPrice' || key === 'maxPrice') {
        next.minPrice = 0;
        next.maxPrice = 50000;
      } else if (key === 'category') {
        next.category = null;
      } else if (key === 'rating') {
        next.rating = null;
      } else if (key === 'sortBy') {
        next.sortBy = 'relevance';
        next.sortOrder = 'desc';
      }
      return next;
    });
  }, []);

  const renderEmpty = useCallback(() => {
    if (isLoading || isFetching) return null;

    if (searchQuery.length === 0) {
      return (
        <View style={{ flex: 1 }}>
          {recentSearches.length > 0 && (
            <View style={styles.recentContainer}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity onPress={async () => {
                  await clearRecentSearches();
                  setRecentSearches([]);
                }}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentItemRow}
                  onPress={() => setSearchQuery(item)}
                >
                  <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
                  <Text style={styles.recentItem}>{item}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Search for products</Text>
            <Text style={styles.emptySubtitle}>Start typing to find what you need</Text>
          </View>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyTitle}>Search failed</Text>
          <Text style={styles.emptySubtitle}>Please try again</Text>
        </View>
      );
    }

    if (activeFiltersCount > 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="filter-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptySubtitle}>Try removing some filters to see more results</Text>
          <TouchableOpacity 
            style={styles.clearFiltersBtn} 
            onPress={clearAllFilters}
          >
            <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No products found</Text>
        <Text style={styles.emptySubtitle}>Try different keywords or check spelling</Text>
      </View>
    );
  }, [isLoading, isFetching, searchQuery, recentSearches, error, activeFiltersCount, clearAllFilters]);

  const renderFilterChips = () => {
    if (activeFiltersCount === 0) return null;
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.chipScroll}
      >
        {filters.sortBy !== 'relevance' && (
          <TouchableOpacity style={styles.chip} onPress={() => removeFilter('sortBy')}>
            <Text style={[styles.chipText, { marginRight: 6 }]}>Sort: {filters.sortBy}</Text>
            <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {filters.category && (
          <TouchableOpacity style={styles.chip} onPress={() => removeFilter('category')}>
            <Text style={[styles.chipText, { marginRight: 6 }]}>{filters.category}</Text>
            <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {filters.rating && (
          <TouchableOpacity style={styles.chip} onPress={() => removeFilter('rating')}>
            <Text style={[styles.chipText, { marginRight: 6 }]}>{filters.rating}★ & above</Text>
            <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        {(filters.minPrice > 0 || filters.maxPrice < 50000) && (
          <TouchableOpacity style={styles.chip} onPress={() => removeFilter('minPrice')}>
            <Text style={[styles.chipText, { marginRight: 6 }]}>₹{filters.minPrice} - ₹{filters.maxPrice}</Text>
            <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.chip, styles.clearAllChip]} onPress={clearAllFilters}>
          <Text style={[styles.chipText, styles.clearAllChipText]}>Clear All</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderFilterBar = () => {
    return (
      <View style={styles.stickyFilterBar}>
        <View style={styles.filterBarRow}>
          <TouchableOpacity 
            style={styles.filterBarBtn} 
            onPress={() => {
              setFilterMode('filter');
              setIsFilterVisible(true);
            }}
          >
            <Ionicons name="funnel-outline" size={18} color={Colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.filterBarBtnText}>
              Filter {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
            </Text>
          </TouchableOpacity>
          <View style={styles.filterBarDivider} />
          <TouchableOpacity 
            style={styles.filterBarBtn} 
            onPress={() => {
              setFilterMode('sort');
              setIsFilterVisible(true);
            }}
          >
            <Ionicons name="swap-vertical" size={18} color={Colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.filterBarBtnText}>
              Sort {filters.sortBy !== 'relevance' ? `(${filters.sortBy})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
        {renderFilterChips()}
      </View>
    );
  };

  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  // 🚀 NEW: Toast Helper
  const showToast = useCallback((message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message, [{ text: 'OK' }]);
    }
  }, []);

  // 🚀 NEW: Add Items to Cart
  const addItemsToCart = useCallback((items: ResolvedItem[]) => {
    console.log('[VoiceCart] Adding items to cart:', items);
    
    items.forEach(item => {
      console.log('[VoiceCart] Dispatching addToCart for:', {
        productId: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      });
      
      dispatch(addToCart({
        productId: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      }));
    });
    
    logEvent('voice_cart_add', { 
      itemCount: items.length,
      totalValue: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
    });
  }, [dispatch]);

  // 🚀 UPGRADED: Voice Result Handler with Cart Intelligence
  const handleVoiceResult = useCallback(async (text: string) => {
    console.log('[VoiceCart] Processing:', text);
    
    // STEP 1: Check for follow-up commands first
    const followUp = voiceContext.handleFollowUp(text);
    
    if (followUp) {
      console.log('[VoiceCart] Follow-up detected:', followUp);
      
      const resolved = await resolveItems(followUp, async (query) => {
        try {
          const response = await triggerSearch({ q: query, limit: 1 }, false).unwrap();
          return response.products || [];
        } catch (error) {
          console.error('[VoiceCart] Search error:', error);
          return [];
        }
      });
      
      if (resolved.length > 0) {
        addItemsToCart(resolved);
        const itemNames = resolved.map(i => `${i.quantity}x ${i.productName}`).join(', ');
        showToast(`Added ${itemNames} 🛒`);
      }
      
      setTimeout(() => setVoiceModalVisible(false), 800);
      return;
    }
    
    // STEP 2: Process new voice input
    const result = processVoiceInput(text);
    console.log('[VoiceCart] Intent:', result.intent, 'Confidence:', result.confidence);
    
    // STEP 3: Update context memory
    voiceContext.update(result.items, result.intent);
    
    // STEP 4: Handle based on intent
    if (result.intent === 'ADD_TO_CART') {
      // Resolve items to actual products
      const resolved = await resolveItems(result.items, async (query) => {
        try {
          const response = await triggerSearch({ q: query, limit: 1 }, false).unwrap();
          return response.products || [];
        } catch (error) {
          console.error('[VoiceCart] Search error:', error);
          return [];
        }
      });
      
      console.log('[VoiceCart] Resolved:', resolved.length, 'items');
      
      if (resolved.length > 0) {
        setResolvedItems(resolved);
        
        if (result.needsConfirmation) {
          // Show confirmation UI for low confidence or large orders
          console.log('[VoiceCart] Showing confirmation');
          setTimeout(() => {
            setVoiceModalVisible(false);
            setShowVoiceConfirmation(true);
          }, 800);
        } else {
          // High confidence - add directly
          console.log('[VoiceCart] Adding directly (high confidence)');
          addItemsToCart(resolved);
          
          const itemNames = resolved.map(i => `${i.quantity}x ${i.productName}`).join(', ');
          showToast(`Added ${itemNames} 🛒`);
          
          setTimeout(() => setVoiceModalVisible(false), 800);
        }
        
        logEvent('voice_intent_detected', {
          intent: result.intent,
          itemCount: result.items.length,
          confidence: result.confidence,
        });
      } else {
        // No products found - fallback to search
        console.log('[VoiceCart] No products found, fallback to search');
        setTimeout(() => {
          setVoiceModalVisible(false);
          setSearchQuery(text);
        }, 800);
        showToast('No exact matches found. Showing search results.');
      }
    } else if (result.intent === 'FILTER') {
      // Handle filter intent
      console.log('[VoiceCart] Filter intent');
      setTimeout(() => {
        setVoiceModalVisible(false);
        setSearchQuery(result.searchQuery || text);
      }, 800);
      // TODO: Apply filters based on voice input
    } else {
      // SEARCH intent - use existing flow
      console.log('[VoiceCart] Search intent');
      setTimeout(() => {
        setVoiceModalVisible(false);
        setSearchQuery(result.searchQuery || text);
      }, 800);
    }
  }, [triggerSearch, addItemsToCart, showToast]);

  const voice = useVoiceSearch(handleVoiceResult);

  const handleMicPress = useCallback(async () => {
    setVoiceModalVisible(true);
    await voice.start('SearchScreen mic press / retry');
  }, [voice]);

  // 🚀 NEW: Voice Cart Confirmation Handlers
  const handleVoiceConfirm = useCallback(() => {
    addItemsToCart(resolvedItems);
    setShowVoiceConfirmation(false);
    
    const itemNames = resolvedItems.map(i => `${i.quantity}x ${i.productName}`).join(', ');
    showToast(`Added ${itemNames} 🛒`);
    
    logEvent('voice_cart_confirmed', { itemCount: resolvedItems.length });
  }, [resolvedItems, addItemsToCart, showToast]);
  
  const handleVoiceEdit = useCallback(() => {
    setShowVoiceConfirmation(false);
    
    // Navigate to search with items
    const query = resolvedItems.map(i => i.productName).join(' ');
    setSearchQuery(query);
    
    logEvent('voice_cart_edited', { itemCount: resolvedItems.length });
  }, [resolvedItems]);
  
  const handleVoiceCancel = useCallback(() => {
    setShowVoiceConfirmation(false);
    logEvent('voice_cart_cancelled', { itemCount: resolvedItems.length });
  }, [resolvedItems]);

  return (
    <View style={styles.safe}>
      <ScreenHeader title="Search" showBackButton />
      
      {/* Voice Listening Modal */}
      <VoiceListeningModal
        visible={voiceModalVisible}
        state={voice.state}
        voicePhase={voice.voicePhase}
        partialText={voice.partialText}
        finalText={voice.finalText}
        errorMessage={voice.errorMessage}
        onCancel={() => { voice.cancel(); setVoiceModalVisible(false); }}
        onRetry={handleMicPress}
      />
      
      {/* 🚀 NEW: Voice Cart Confirmation Modal */}
      <VoiceCartConfirmation
        visible={showVoiceConfirmation}
        items={resolvedItems}
        onConfirm={handleVoiceConfirm}
        onEdit={handleVoiceEdit}
        onCancel={handleVoiceCancel}
      />
      
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for products..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={!initialQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                addRecentSearch(searchQuery.trim()).then(setRecentSearches);
                Keyboard.dismiss();
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.clearBtn} 
            onPress={handleMicPress}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={voice.state === 'listening' ? "mic" : "mic-outline"} 
              size={22} 
              color={voice.state === 'listening' ? Colors.primary : Colors.textMuted} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {(debouncedQuery || activeFiltersCount > 0) && renderFilterBar()}

      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={
          (isFetching && products.length > 0) ? (
            <View style={styles.topLoader}>
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.topLoaderText}>Updating results...</Text>
            </View>
          ) : (isLoading && products.length === 0) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : null
        }
      />

      <FilterBottomSheet
        isVisible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApply={handleFilterChange}
        onClearAll={clearAllFilters}
        filters={filters}
        categories={categories}
        mode={filterMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4, marginRight: 8 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  clearBtn: { padding: 4 },
  listContent: { padding: 16, paddingBottom: 40 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  productCard: {
    width: COLUMN_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  productImage: { width: '100%', height: COLUMN_WIDTH, backgroundColor: Colors.background },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  productPrice: { fontSize: 15, fontWeight: '800', color: Colors.primary, marginRight: 6 },
  productMrp: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' },
  loadingContainer: { paddingVertical: 20, alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  recentContainer: { paddingHorizontal: 4, marginBottom: 20 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  clearText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recentItem: { flex: 1, marginLeft: 12, fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  stickyFilterBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
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
  },
  filterBarDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
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
  },
  clearFiltersBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 25,
  },
  clearFiltersBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  clearAllChip: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
  },
  clearAllChipText: {
    color: Colors.primary,
  },
  chipScroll: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: Colors.white,
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

export default SearchScreen;
