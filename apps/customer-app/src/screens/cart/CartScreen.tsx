import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { useGetCartQuery, useRemoveFromCartMutation, useUpdateCartItemMutation } from '../../api/cartApi';
import { useGetAddressesQuery } from '../../api/addressesApi';
import { removeItem, syncCart, updateQuantity } from '../../store/slices/cartSlice';
import type { RootState } from '../../store';
import type { CartNavigationProp, MainTabNavigationProp } from '../../navigation/types';
import { logEvent } from '../../utils/analytics';
import { calculatePriceBreakdown, estimateDeliveryFee, formatPrice } from '../../utils/priceCalculator';
import { BusinessRules } from '../../constants/businessRules';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FreeDeliveryBanner } from '../../components/FreeDeliveryBanner';
import { SmartImage } from '../../components/SmartImage';
import LoadingScreen from '../common/LoadingScreen';

// Helper to format delivery date
const getDeliveryDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Delivery by ${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
};

// Optimized Cart Item Component
const CartItemCard = React.memo(({ 
  item, 
  onUpdateQty, 
  onRemove, 
  deliveryDate 
}: { 
  item: any, 
  onUpdateQty: (productId: string, qty: number) => void, 
  onRemove: (productId: string) => void,
  deliveryDate: string
}) => {
  // Defensive checks for item data
  const productId = String(item?.productId || '');
  const name = item?.name || 'Unknown Product';
  const price = Number(item?.price || 0);
  const quantity = Number(item?.quantity || 1);
  const image = item?.image || undefined;
  
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemImageWrap}>
        <SmartImage uri={image} style={styles.itemImage} />
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.itemPrice}>₹{price}</Text>

        <View style={styles.qtyRow}>
          <Pressable
            style={({ pressed }) => [
              styles.qtyBtn, 
              quantity <= 1 ? styles.qtyBtnDisabled : null,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }
            ]}
            onPress={() => onUpdateQty(productId, quantity - 1)}
            disabled={quantity <= 1}
            hitSlop={8}
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </Pressable>
          <Text style={styles.qtyText}>{quantity}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.qtyBtn, 
              quantity >= 99 ? styles.qtyBtnDisabled : null,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] }
            ]}
            onPress={() => onUpdateQty(productId, quantity + 1)}
            disabled={quantity >= 99}
            hitSlop={8}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <TouchableOpacity onPress={() => onRemove(productId)} style={styles.trashBtn} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
});

const CartScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<CartNavigationProp>();
  const tabNav = useNavigation<MainTabNavigationProp>();
  
  const cartState = useSelector((state: RootState) => state.cart);
  const itemsFromStore = cartState.items || [];
  const itemCountFromStore = cartState.itemCount || 0;

  const { data, isLoading, isFetching, refetch } = useGetCartQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });

  const [updateCartItemMutation] = useUpdateCartItemMutation();
  const [removeFromCartMutation] = useRemoveFromCartMutation();
  const { data: addressData } = useGetAddressesQuery(undefined);

  const cart = (data as any)?.cart;
  
  const items = itemsFromStore;

  const subtotal = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    const sum = items.reduce(
      (acc: number, it: any) => acc + Number(it?.price || 0) * Number(it?.quantity || 0),
      0
    );
    return Number.isFinite(sum) ? sum : 0;
  }, [items]);

  const deliveryDate = useMemo(() => getDeliveryDate(), []);

  useEffect(() => {
    logEvent('view_cart', { itemCount: items.length, cartValue: subtotal });
  }, []);

  useEffect(() => {
    if (!cart) return;
    dispatch(
      syncCart({
        items: cart.items || [],
        total: cart.totalAmount || 0,
        itemCount: cart.itemCount || 0,
      })
    );
  }, [cart, dispatch]);

  const addresses = addressData?.addresses || [];
  const defaultAddressId = addressData?.defaultAddressId || null;
  const defaultAddress = useMemo(() => {
    if (!defaultAddressId) return addresses.find((a: any) => a?.isDefault);
    return addresses.find(
        (a: any) => String(a?._id || a?.id || '').trim() === String(defaultAddressId).trim()
      );
  }, [addresses, defaultAddressId]);

  const hasDefaultAddress = !!defaultAddress;
  const deliveryFeeDetails = useMemo(() => estimateDeliveryFee(defaultAddress as any, subtotal), [defaultAddress, subtotal]);
  const breakdown = useMemo(() => calculatePriceBreakdown(items as any[], deliveryFeeDetails), [items, deliveryFeeDetails]);

  const changeQty = useCallback(async (productId: string, qty: number) => {
    const next = Math.max(1, Math.min(99, qty));
    dispatch(updateQuantity({ productId, quantity: next }));
    try {
      const result: any = await updateCartItemMutation({ productId, quantity: next }).unwrap();
      if (result?.cart) {
        dispatch(syncCart({
          items: result.cart.items || [],
          total: result.cart.totalAmount || 0,
          itemCount: result.cart.itemCount || 0,
        }));
      }
    } catch (e) {
      refetch();
    }
  }, [updateCartItemMutation, dispatch, refetch]);

  const remove = useCallback(async (productId: string) => {
    dispatch(removeItem(productId));
    try {
      const result: any = await removeFromCartMutation(productId).unwrap();
      if (result?.cart) {
        dispatch(syncCart({
          items: result.cart.items || [],
          total: result.cart.totalAmount || 0,
          itemCount: result.cart.itemCount || 0,
        }));
      }
    } catch (e) {
      refetch();
    }
  }, [removeFromCartMutation, dispatch, refetch]);

  const renderCartItem = useCallback(({ item }: { item: any }) => (
    <CartItemCard 
      item={item} 
      onUpdateQty={changeQty} 
      onRemove={remove} 
      deliveryDate={deliveryDate}
    />
  ), [changeQty, remove, deliveryDate]);

  if (isLoading && items.length === 0) {
    return <LoadingScreen />;
  }

  if (items.length === 0 && !isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="My Cart" subtitle={`(${itemCountFromStore} items)`} />
        <View style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={80} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <TouchableOpacity
            style={styles.shopBtn}
            onPress={() => tabNav.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Cart" subtitle={`(${items.length} items)`} />

      <FlatList
        data={items}
        keyExtractor={(item: any) => String(item?.productId)}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <FreeDeliveryBanner cartTotal={subtotal} threshold={BusinessRules.FREE_DELIVERY_THRESHOLD} style={{ marginBottom: 16 }} urgency />
        }
        renderItem={renderCartItem}
        ListFooterComponent={
          <>
            {defaultAddress ? (
              <View style={styles.addressCard}>
                <View style={styles.addressLeft}>
                  <Ionicons name="location-outline" size={20} color={Colors.primary} style={styles.addressIcon} />
                  <View style={styles.addressContent}>
                    <View style={styles.addressHeaderRow}>
                      <Text style={styles.deliverToLabel}>Deliver to:</Text>
                      <Text style={styles.addressName}>
                        {defaultAddress.name} - {defaultAddress.pincode}
                      </Text>
                    </View>
                    <Text style={styles.addressFull} numberOfLines={2}>
                      {defaultAddress.line1}{defaultAddress.line2 ? `, ${defaultAddress.line2}` : ''}, {defaultAddress.city}, {defaultAddress.state}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => navigation.navigate('Addresses')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.addAddressCard}>
                <View style={styles.addAddressLeft}>
                  <Ionicons name="location-outline" size={20} color={Colors.textMuted} style={styles.addressIcon} />
                  <View>
                    <Text style={styles.addAddressTitle}>Add delivery address</Text>
                    <Text style={styles.addAddressSubtitle}>Add address to see delivery charges</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.addAddressBtn}
                  onPress={() => navigation.navigate('AddAddress', {})}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addAddressBtnText}>Add Address →</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatPrice(breakdown.subtotalBeforeTax)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST ({breakdown.gstRate}%)</Text>
                <Text style={styles.summaryValue}>{formatPrice(breakdown.gstAmount)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={[styles.summaryValue, breakdown.isFreeDelivery && { color: '#16a34a' }]}>
                  {breakdown.isFreeDelivery ? 'FREE' : (hasDefaultAddress ? formatPrice(breakdown.deliveryFee) : 'Calculated at checkout')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(breakdown.total)}</Text>
              </View>
              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={() => {
                  if (!hasDefaultAddress) {
                    Alert.alert('Address Required', 'Please add a delivery address to proceed.');
                    return;
                  }
                  navigation.navigate('Checkout');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.checkoutText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </View>
          </>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary },
  headerCount: { marginLeft: 6, color: Colors.textSecondary, fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, paddingTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 16, marginBottom: 20 },
  shopBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  shopBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemImageWrap: {
    width: 70,
    height: 70,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  itemImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, paddingHorizontal: 12 },
  itemName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  itemPrice: { marginTop: 4, fontSize: 15, fontWeight: '800', color: Colors.primary },
  deliveryDate: {
    marginTop: 4,
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  qtyRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  qtyBtnDisabled: { backgroundColor: Colors.border },
  qtyBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  qtyText: { width: 34, textAlign: 'center', fontWeight: '800', color: Colors.textPrimary },
  trashBtn: { padding: 8 },
  addressCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
  },
  addressLeft: { flexDirection: 'row', flex: 1, alignItems: 'flex-start' },
  addressIcon: { marginRight: 10, marginTop: 2 },
  addressContent: { flex: 1 },
  addressHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  deliverToLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginRight: 6 },
  addressName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  addressFull: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  changeBtn: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  changeBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  addAddressCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addAddressLeft: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  addAddressTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  addAddressSubtitle: { fontSize: 12, color: Colors.textMuted },
  addAddressBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addAddressBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  summaryValue: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  totalLabel: { color: Colors.textPrimary, fontWeight: '900', fontSize: 17, marginTop: 4 },
  totalValue: { color: Colors.primary, fontWeight: '900', fontSize: 18, marginTop: 4 },
  checkoutBtn: { marginTop: 16, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  checkoutText: { color: Colors.white, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  recommendationsSection: {
    marginTop: 24,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  recItem: {
    width: 140,
    marginRight: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  recName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  recPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 4,
  },
});

export default CartScreen;
