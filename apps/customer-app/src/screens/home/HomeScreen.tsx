import React, { useState, useCallback, memo, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Dimensions,
  Alert,
  Platform,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  useGetProductsQuery,
  useGetCategoriesQuery,
  productsApi,
} from '../../api/productsApi';
import { useGetUnreadCountQuery } from '../../api/notificationsApi';
import { cartApi } from '../../api/cartApi';
import { ordersApi } from '../../api/ordersApi';
import { addressesApi } from '../../api/addressesApi';
import { useAddToCartMutation } from '../../api/cartApi';
import { useDispatch, useSelector } from 'react-redux';
import { addItem } from '../../store/slices/cartSlice';
import { showToast } from '../../store/slices/uiSlice';
import { selectUser } from '../../store/slices/authSlice';
import { SmartImage } from '../../components/SmartImage';
import { FreeDeliveryBanner } from '../../components/FreeDeliveryBanner';
import { BusinessRules } from '../../constants/businessRules';
import { Colors } from '../../constants/colors';
import { CURATED_CATEGORIES } from '../../constants/categories';
import { RootState, AppDispatch } from '../../store';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { logEvent } from '../../utils/analytics';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import VoiceListeningModal from '../../components/VoiceListeningModal';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

const { width } = Dimensions.get('window');

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary
  },
  brandName: { fontSize: 20, fontWeight: '900', color: Colors.white, fontFamily: 'Inter-Bold', letterSpacing: -0.5 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifIcon: { fontSize: 20, color: Colors.white },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.white,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  notifBadgeTxt: { color: Colors.primary, fontSize: 9, fontWeight: '900' },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    height: 48,
  },
  searchBar: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  micBtn: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPlaceholder: { color: Colors.textMuted, fontSize: 14, flex: 1, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  seeAll: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  categoryRow: { paddingHorizontal: 16, paddingBottom: 12 },
  catItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  catImageWrap: {
    width: 72,
    height: 72,
    backgroundColor: '#FFF7F2',
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: '#F0EAE5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
    marginBottom: 8,
  },
  catImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  catTileText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  catName: { fontSize: 12, color: '#2A2A2A', fontWeight: '600', textAlign: 'center', lineHeight: 15, letterSpacing: 0.2, maxWidth: 72 },
  catCount: { fontSize: 10, color: Colors.textMuted, marginTop: 4, fontWeight: '500' },
  dealCard: {
    width: 140,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 4
  },
  dealImg: { width: '100%', height: 120, backgroundColor: Colors.white },
  dealBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1
  },
  dealBadgeTxt: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  dealName: { fontSize: 13, color: Colors.textPrimary, padding: 8, paddingBottom: 4, lineHeight: 18, fontWeight: '600' },
  dealPrice: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: 8 },
  dealMrp: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    paddingHorizontal: 8,
    paddingBottom: 8,
    marginLeft: 0,
    marginTop: 2
  },
  productGrid: { padding: 16 },
  productCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  productImg: { width: '100%', aspectRatio: 1, backgroundColor: Colors.white },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1
  },
  discountTxt: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  ratingTxt: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },
  productInfo: { padding: 12, borderTopWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  productName: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18, marginBottom: 8, fontWeight: '600', minHeight: 36 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  price: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  mrp: { fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' },
  freeDelivery: { fontSize: 11, color: Colors.success, marginBottom: 8, fontWeight: '600' },
  addBtn: {
    backgroundColor: '#FFF5F0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnTxt: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  skeletonContainer: { flex: 1, backgroundColor: Colors.background },
  skeletonItem: { backgroundColor: Colors.border },
  skeletonRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 20 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, justifyContent: 'space-between' },
  skeletonCard: { width: '48%', height: 280, backgroundColor: Colors.border, borderRadius: 12, marginBottom: 16 },
});

const getImageUrl = (images?: any[]): string | undefined => {
  const first = images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return (
    first?.url ||
    first?.variants?.medium ||
    first?.variants?.small ||
    first?.thumb ||
    first?.original ||
    null
  ) || undefined;
};

// Optimized Skeleton Component
const SkeletonHome = memo(() => (
  <View style={s.skeletonContainer}>
    <View style={[s.skeletonItem, { height: 180, margin: 10, borderRadius: 12 }]} />
    <View style={s.sectionHeader}>
      <View style={[s.skeletonItem, { width: 120, height: 20 }]} />
    </View>
    <View style={s.skeletonRow}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={[s.skeletonItem, { width: 80, height: 100, marginRight: 10, borderRadius: 14 }]} />
      ))}
    </View>
    <View style={s.sectionHeader}>
      <View style={[s.skeletonItem, { width: 120, height: 20 }]} />
    </View>
    <View style={s.skeletonGrid}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={[s.skeletonItem, { width: '47%', height: 250, borderRadius: 14 }]} />
      ))}
    </View>
  </View>
));

// Optimized Product Card Component
const HomeProductCard = memo(({ 
  item, 
  navigation, 
  t, 
  onAdd,
  onPrefetch
}: { 
  item: any, 
  navigation: any, 
  t: any, 
  onAdd: (item: any) => void,
  onPrefetch: (id: string) => void
}) => {
  const discount = item.mrp > item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const imageUrl = getImageUrl(item.images);
  const rating = useMemo(() => {
    const v = Number(item?.averageRating ?? item?.rating);
    if (!Number.isFinite(v) || v <= 0) return null;
    return Math.min(5, Math.max(0, v));
  }, [item?.averageRating, item?.rating]);

  const handlePress = useCallback(() => {
    navigation.navigate('ProductDetail', { productId: item._id });
  }, [navigation, item._id]);

  const handlePressIn = useCallback(() => {
    onPrefetch(item._id);
  }, [onPrefetch, item._id]);

  const handleAdd = useCallback(() => {
    onAdd(item);
  }, [onAdd, item]);

  return (
    <Pressable
      style={({ pressed }) => [
        s.productCard,
        { 
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        }
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
    >
      <View style={{ padding: 12, backgroundColor: Colors.white }}>
        <SmartImage uri={imageUrl} style={s.productImg} resizeMode="contain" />
        {discount > 0 && (
          <View style={s.discountBadge}>
            <Text style={s.discountTxt}>{discount}% {t('off') || 'OFF'}</Text>
          </View>
        )}
        {rating !== null && (
          <View style={s.ratingBadge}>
            <Text style={s.ratingTxt}>⭐ {rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View style={s.productInfo}>
        <Text style={s.productName} numberOfLines={2}>{item.name}</Text>
        <View style={s.priceRow}>
          <Text style={[s.price, { marginRight: 6 }]}>₹{item.price}</Text>
          {item.mrp > item.price && (
            <Text style={s.mrp}>₹{item.mrp}</Text>
          )}
        </View>
        {item.price >= BusinessRules.FREE_DELIVERY_THRESHOLD && (
          <Text style={s.freeDelivery}>🚚 {t('free_delivery') || 'Free Delivery'}</Text>
        )}
        <TouchableOpacity
          style={s.addBtn}
          onPress={handleAdd}
          activeOpacity={0.7}
        >
          <Text style={s.addBtnTxt}>{t('home.add') || 'Add to Cart'}</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
});


export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const [refreshing, setRefreshing] = useState(false);
  const [addToCart] = useAddToCartMutation();
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  // Get user from Redux state
  const user = useSelector(selectUser);

  // Add minimal logging
  console.log("🎯 UI RENDER", {userId: user?.id, time: Date.now()});

  // Block UI until user is ready
  if (!user) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Fix 1: guard against double-navigation if mic tapped rapidly
  const hasNavigatedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      hasNavigatedRef.current = false;
    }, []),
  );

  const handleVoiceResult = useCallback((text: string) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    // Fix 2: 300ms close for snappy feel
    setTimeout(() => {
      setVoiceModalVisible(false);
      setTimeout(() => {
        navigation.navigate('Search', { initialQuery: text });
      }, 160);
    }, 300);
  }, [navigation]);

  const voice = useVoiceSearch(handleVoiceResult);

  const handleMicPress = useCallback(async () => {
    setVoiceModalVisible(true);
    await voice.start('HomeScreen mic press / retry');
  }, [voice]);

  const handleVoiceCancel = useCallback(() => {
    voice.cancel();
    setVoiceModalVisible(false);
  }, [voice]);

  const handlePrefetch = useCallback((id: string) => {
    dispatch(productsApi.util.prefetch('getProductById', id, { force: true }));
  }, [dispatch]);

  // Analytics on mount
  useEffect(() => {
    logEvent('view_home');
  }, []);

  // Global Prefetching on Mount
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(cartApi.util.prefetch('getCart', undefined, { force: true }));
      dispatch(ordersApi.util.prefetch('getOrders', undefined, { force: true }));
      dispatch(addressesApi.util.prefetch('getAddresses', undefined, { force: true }));
    }, 100);
    return () => clearTimeout(timer);
  }, [dispatch]);

  const { data: productsData, isLoading, error, refetch } = useGetProductsQuery({ limit: 20 });
  const products = productsData?.products || [];

  const { deals, dealsError } = useGetProductsQuery({ sort: 'discount', limit: 10 }, {
    selectFromResult: (result) => ({
      deals: result.data?.products?.filter((p: any) => p.mrp > p.price) || [],
      dealsError: result.error,
    }),
  });

  // Use curated categories instead of API data
  const categories = CURATED_CATEGORIES;

  const { unreadCount } = useGetUnreadCountQuery(undefined, {
    selectFromResult: (result) => ({
      unreadCount: result.data?.count || 0,
    }),
  });

  const cartTotal = useSelector((state: RootState) => state.cart.total);
  const cartItems = useSelector((state: RootState) => state.cart.items) || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAddToCart = useCallback(async (item: any) => {
    const imageUrl = getImageUrl(item.images);
    try {
      // Optimistic Update: Add to local cart first for instant feedback
      dispatch(addItem({
        productId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: imageUrl,
      }));
      dispatch(showToast(`${item.name} added to cart`));
      
      // Perform background API call
      await addToCart({ productId: item._id, quantity: 1 }).unwrap();
    } catch (error: any) {
    }
  }, [addToCart, dispatch]);

  const renderProductItem = useCallback(({ item }: { item: any }) => (
    <HomeProductCard 
      item={item} 
      navigation={navigation} 
      t={t} 
      onAdd={handleAddToCart} 
      onPrefetch={handlePrefetch}
    />
  ), [navigation, t, handleAddToCart, handlePrefetch]);

  if (isLoading) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Vyapara Setu" />
        <SkeletonHome />
      </View>
    );
  }

  if (error || (dealsError && products.length === 0 && deals.length === 0)) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Vyapara Setu" />
        <ErrorState 
          message={t('home.error_loading') || 'Failed to load products. Please check your connection.'} 
          onRetry={refetch} 
          screenName="Home"
        />
      </View>
    );
  }

  if (products.length === 0 && deals.length === 0 && !refreshing) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Vyapara Setu" />
        <EmptyState 
          title={t('home.no_products_title') || 'No products available'} 
          description={t('home.no_products_desc') || 'Check back later for exciting new items!'} 
          onAction={onRefresh}
          actionLabel={t('refresh') || 'Refresh'}
        />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Voice Search Modal */}
      <VoiceListeningModal
        visible={voiceModalVisible}
        state={voice.state}
        voicePhase={voice.voicePhase}
        partialText={voice.partialText}
        finalText={voice.finalText}
        errorMessage={voice.errorMessage}
        onCancel={handleVoiceCancel}
        onRetry={handleMicPress}
      />
      {/* Header */}
      <ScreenHeader 
        title="Vyapara Setu" 
        rightComponent={
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={s.notifIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeTxt}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      {/* Search bar + Mic */}
      <View style={s.searchBarRow}>
        <TouchableOpacity
          style={s.searchBar}
          onPress={() => navigation.navigate('Search', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Text style={s.searchPlaceholder}>
            {t('home.search_placeholder') || 'Search for products…'}
          </Text>
        </TouchableOpacity>
        {/* Mic: separate touchable so tap is independent */}
        <TouchableOpacity
          style={s.micBtn}
          onPress={handleMicPress}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons
            name={voice.state === 'listening' ? 'mic' : 'mic-outline'}
            size={22}
            color={voice.state === 'listening' ? Colors.primary : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E95C1E" />
        }
      >
        {/* Free delivery banner */}
        <FreeDeliveryBanner cartTotal={cartTotal} threshold={BusinessRules.FREE_DELIVERY_THRESHOLD} style={{ marginHorizontal: 16 }} />

        {/* Categories */}
        {categories.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('home.shop_by_category') || 'Shop by Category'}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoryRow}
            >
              {categories.map((cat: any) => (
                <TouchableOpacity
                  key={cat.name}
                  style={s.catItem}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Categories', {
                     preselect: cat.name
                   })}
                >
                  <View style={[
                    s.catImageWrap,
                    cat.isTextTile && { backgroundColor: cat.tileBg || '#F0F9FF' },
                  ]}>
                    {cat.isTextTile ? (
                      <>
                        <Text style={[s.catTileText, cat.tileColor ? { color: cat.tileColor } : null]}>
                          {cat.tileText}
                        </Text>
                      </>
                    ) : (
                      <Image 
                        source={cat.image} 
                        style={s.catImage} 
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <Text style={s.catName} numberOfLines={2}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Top Deals */}
        {deals.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('home.top_deals') || 'Top Deals'}</Text>
            </View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {deals.slice(0, 8).map((item: any) => (
                <TouchableOpacity
                  key={item._id}
                  style={[s.dealCard, { marginRight: 12 }]}
                  onPress={() => navigation.navigate('ProductDetail', { productId: item._id })}
                  activeOpacity={0.8}
                >
                  <View style={{ padding: 12, backgroundColor: Colors.white }}>
                    <SmartImage uri={getImageUrl(item.images)} style={s.dealImg} resizeMode="contain" />
                  </View>
                  <View style={s.dealBadge}>
                    <Text style={s.dealBadgeTxt}>
                      {Math.round(((item.mrp - item.price) / item.mrp) * 100)}% {t('off') || 'OFF'}
                    </Text>
                  </View>
                  <Text style={s.dealName} numberOfLines={2}>{item.name}</Text>
                  <View style={s.priceRow}>
                    <Text style={[s.dealPrice, { marginRight: 6 }]}>₹{item.price}</Text>
                    <Text style={s.dealMrp}>₹{item.mrp}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Top Selling */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t('home.topSelling') || 'Top Selling'}</Text>
        </View>

        <View style={[s.productGrid, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }]}>
          {products.map((item: any) => (
            <View key={item._id} style={{ width: '48%', marginBottom: 16 }}>
              {renderProductItem({ item })}
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
