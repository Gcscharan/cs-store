import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Colors } from '../../constants/colors';
import { RootState } from '../../store';
import { useGetCategoriesQuery, useGetProductsQuery } from '../../api/productsApi';
import { useAddToCartMutation } from '../../api/cartApi';
import { useGetAddressesQuery } from '../../api/addressesApi';
import ProductCard from '../../components/ProductCard';
import { addItem, syncCart } from '../../store/slices/cartSlice';
import { useNavigation } from '@react-navigation/native';
import type { HomeNavigationProp } from '../../navigation/types';

const CATEGORIES = [
  { name: 'chocolates', emoji: '🍫', label: 'Chocolates' },
  { name: 'beverages', emoji: '🥤', label: 'Beverages' },
  { name: 'snacks', emoji: '🍿', label: 'Snacks' },
  { name: 'dairy', emoji: '🥛', label: 'Dairy & Eggs' },
  { name: 'vegetables', emoji: '🥦', label: 'Fruits & Veg' },
  { name: 'personal_care', emoji: '🧴', label: 'Personal Care' },
];

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const dispatch = useDispatch();
  const cartItemCount = useSelector((state: RootState) => state.cart.itemCount);

  const { data: addressData } = useGetAddressesQuery();
  const addresses = addressData?.addresses || [];
  const defaultAddressId = addressData?.defaultAddressId || null;
  const defaultAddress = defaultAddressId
    ? addresses.find(
        (a: any) =>
          String(a?._id || a?.id || '').trim() ===
          String(defaultAddressId).trim()
      )
    : addresses.find((a: any) => a?.isDefault);

  const [selectedCategory, setSelectedCategory] = React.useState<string>('All');
  const [searchText, setSearchText] = React.useState('');

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    error: categoriesErrorDetail,
    refetch: refetchCategories,
  } = useGetCategoriesQuery(undefined);

  const categoryParam = selectedCategory === 'All' ? undefined : selectedCategory;
  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
    isFetching: isProductsFetching,
    error: productsErrorDetail,
    refetch: refetchProducts,
  } = useGetProductsQuery({ page: 1, limit: 12, category: categoryParam });

  const [addToCartMutation] = useAddToCartMutation();

  const products = (productsData as any)?.products || [];
  const categories = (categoriesData as any)?.categories || [];

  React.useEffect(() => {
    console.log('[HomeScreen] Products state:', {
      isLoading: productsLoading,
      isError: productsError,
      error: productsErrorDetail,
      dataExists: !!productsData,
      data: productsData,
    });
  }, [productsLoading, productsError, productsErrorDetail, productsData]);

  React.useEffect(() => {
    console.log('[HomeScreen] Categories state:', {
      isLoading: categoriesLoading,
      isError: categoriesError,
      error: categoriesErrorDetail,
      data: categoriesData,
    });
  }, [categoriesLoading, categoriesError, categoriesErrorDetail, categoriesData]);

  const onRefresh = async () => {
    await Promise.allSettled([refetchProducts(), refetchCategories()]);
  };

  const renderCategory = ({ item }: { item: any }) => {
    const name = String(item?.name || item);
    const isSelected = selectedCategory === name;
    return (
      <TouchableOpacity
        onPress={() => setSelectedCategory(name)}
        style={[styles.categoryPill, isSelected ? styles.categoryPillSelected : styles.categoryPillUnselected]}
        activeOpacity={0.9}
      >
        <Text style={[styles.categoryText, isSelected ? styles.categoryTextSelected : styles.categoryTextUnselected]}>
          {name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = (_: any, index: number) => <View key={index} style={styles.skeletonCard} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.logo}>VyaparSetu</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => {}} style={styles.iconButton}>
              <Text style={styles.iconText}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}} style={styles.iconButton}>
              <Text style={styles.iconText}>🛒</Text>
              {cartItemCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartItemCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addressBar}
          activeOpacity={0.9}
          onPress={() => (navigation as any).navigate('ProfileTab', { screen: 'Addresses' })}
        >
          <Text style={styles.addressIcon}>📍</Text>
          <View style={styles.addressTextWrap}>
            <Text style={styles.addressTitle} numberOfLines={1}>
              {defaultAddress ? String(defaultAddress?.name || 'Delivery Address') : 'Add Address'}
            </Text>
            <Text style={styles.addressSubtitle} numberOfLines={1}>
              {defaultAddress
                ? `${String(defaultAddress?.city || '')}${defaultAddress?.pincode ? ` - ${String(defaultAddress?.pincode)}` : ''}`
                : 'Choose your delivery location'}
            </Text>
          </View>
          <Text style={styles.addressChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Search')}
        >
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search products..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            editable={false}
          />
        </TouchableOpacity>

        {/* Quick Categories Shortcuts */}
        <View style={styles.quickCatsWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('CategoriesTab', { screen: 'Categories' })}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCatsList}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={styles.quickCatItem}
                onPress={() => (navigation as any).navigate('CategoriesTab', { 
                  screen: 'Categories', 
                  params: { preselect: cat.name } 
                })}
              >
                <View style={styles.quickCatEmojiWrap}>
                  <Text style={styles.quickCatEmoji}>{cat.emoji}</Text>
                </View>
                <Text style={styles.quickCatLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.categoriesWrap}>
          <FlatList
            horizontal
            data={[{ name: 'All' }, ...categories]}
            keyExtractor={(item: any, idx: number) => String(item?.name || item) + idx}
            renderItem={renderCategory}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {productsError ? (
          <View style={styles.centerBlock}>
            <Text style={styles.errorText}>Failed to load products</Text>
            <TouchableOpacity onPress={() => refetchProducts()} style={styles.retryBtn} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : productsLoading ? (
          <View style={styles.gridWrap}>{Array.from({ length: 6 }).map(renderSkeleton)}</View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item: any) => String(item?._id || item?.id)}
            numColumns={2}
            refreshControl={<RefreshControl refreshing={isProductsFetching} onRefresh={onRefresh} />}
            contentContainerStyle={styles.productsList}
            ListEmptyComponent={
              <View style={styles.centerBlock}>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            }
            renderItem={({ item }: { item: any }) => (
              <ProductCard
                product={item}
                onPress={() => {
                  navigation.navigate('ProductDetail', { productId: String(item?._id || item?.id) });
                }}
                onAddToCart={async () => {
                  try {
                    dispatch(
                      addItem({
                        id: String(item?._id || item?.id),
                        productId: String(item?._id || item?.id),
                        name: String(item?.name || ''),
                        price: Number(item?.price || 0),
                        quantity: 1,
                        image: undefined,
                      })
                    );

                    const result: any = await addToCartMutation({
                      productId: String(item?._id || item?.id),
                      quantity: 1,
                    }).unwrap();

                    if (result?.cart) {
                      dispatch(
                        syncCart({
                          items: result.cart.items || [],
                          total: result.cart.totalAmount || 0,
                          itemCount: result.cart.itemCount || 0,
                        })
                      );
                    }
                  } catch (e) {
                    console.log('[HomeScreen] add-to-cart failed:', e);
                  }
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 10, padding: 6 },
  iconText: { fontSize: 18, color: Colors.textPrimary },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  addressBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  addressTextWrap: {
    flex: 1,
  },
  addressTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  addressSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  addressChevron: {
    color: Colors.textMuted,
    fontSize: 22,
    marginLeft: 8,
    lineHeight: 22,
    fontWeight: '900',
  },
  quickCatsWrap: {
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  quickCatsList: {
    paddingHorizontal: 12,
  },
  quickCatItem: {
    alignItems: 'center',
    width: 80,
    marginHorizontal: 4,
  },
  quickCatEmojiWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  quickCatEmoji: {
    fontSize: 28,
  },
  quickCatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: Colors.surfaceDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  categoriesWrap: { paddingLeft: 16, paddingBottom: 10 },
  categoriesList: { paddingRight: 16 },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
  },
  categoryPillSelected: { backgroundColor: Colors.primary },
  categoryPillUnselected: { backgroundColor: Colors.surfaceDark },
  categoryText: { fontSize: 13, fontWeight: '700' },
  categoryTextSelected: { color: Colors.white },
  categoryTextUnselected: { color: Colors.textSecondary },
  productsList: { paddingHorizontal: 8, paddingBottom: 16 },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  skeletonCard: {
    width: '46%',
    margin: '2%',
    aspectRatio: 0.82,
    borderRadius: 12,
    backgroundColor: Colors.surfaceDark,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: { color: Colors.error, fontWeight: '800', marginBottom: 10 },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: Colors.white, fontWeight: '800' },
  emptyText: { color: Colors.textSecondary, fontWeight: '700' },
});

export default HomeScreen;
