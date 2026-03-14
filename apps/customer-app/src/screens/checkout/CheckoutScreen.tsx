import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  useGetAddressesQuery, useCreateOrderMutation, useGetProfileQuery,
} from '../../store/api';
import { RazorpayPayment } from '../../components/payment/RazorpayPayment';

const PAYMENT_METHODS = [
  { id: 'razorpay', label: 'UPI / Cards / NetBanking', icon: '💳', subtitle: 'Powered by Razorpay — 100% secure' },
  { id: 'cod', label: 'Cash on Delivery', icon: '💵', subtitle: 'Pay when your order arrives' },
];

export default function CheckoutScreen({ navigation }: any) {
  const { items } = useSelector((s: RootState) => s.cart);
  const { data: profileData } = useGetProfileQuery();
  const { data: addrData } = useGetAddressesQuery();
  const [createOrder, { isLoading }] = useCreateOrderMutation();

  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  const addresses = addrData?.addresses || [];
  const user = profileData?.user || profileData;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = subtotal >= 500 ? 0 : 40;
  const total = subtotal + deliveryFee;

  useEffect(() => {
    const def = addresses.find((a: any) => a.isDefault) || addresses[0];
    if (def) setSelectedAddress(def);
  }, [addresses]);

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select a delivery address');
      return;
    }
    try {
      const orderData = {
        items: items.map(i => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        deliveryAddress: {
          name: selectedAddress.name,
          phone: selectedAddress.phone,
          line1: selectedAddress.line1 || selectedAddress.addressLine,
          line2: selectedAddress.line2 || '',
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
        },
        paymentMethod,
        totalAmount: total,
        subtotal,
        deliveryFee,
      };

      if (paymentMethod === 'cod') {
        const result = await createOrder({ ...orderData, paymentStatus: 'PENDING' }).unwrap();
        navigation.replace('OrderSuccess', { orderId: result.order?.orderId || result.orderId });
        return;
      }

      // Razorpay flow - create order then show payment modal
      const result = await createOrder({
        ...orderData,
        paymentStatus: 'PENDING',
        paymentMethod: 'razorpay',
      }).unwrap();

      setPendingOrder({ ...result, orderId: result.order?.orderId || result.orderId });
      setShowRazorpay(true);
    } catch (e: any) {
      Alert.alert('Error', e?.data?.message || 'Failed to place order');
    }
  };

  const handlePaymentSuccess = (paymentId: string) => {
    setShowRazorpay(false);
    navigation.replace('OrderSuccess', { orderId: pendingOrder?.orderId });
  };

  const handlePaymentFailure = (error: string) => {
    setShowRazorpay(false);
    Alert.alert(
      'Payment Failed',
      error || 'Payment could not be processed. Your order is saved.',
      [
        { text: 'Try Again', onPress: () => setShowRazorpay(true) },
        { text: 'Pay Later', onPress: () => navigation.navigate('Orders') },
      ]
    );
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Checkout</Text>
        </View>
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🛒</Text>
          <Text style={s.emptyTxt}>Your cart is empty</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={s.shopBtnTxt}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Checkout</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Delivery Address */}
        <Text style={s.sectionTitle}>📍 Delivery Address</Text>
        {selectedAddress ? (
          <TouchableOpacity
            style={s.addressCard}
            onPress={() => navigation.navigate('Addresses', {
              selectMode: true,
              onSelect: (addr: any) => setSelectedAddress(addr),
            })}
          >
            <View style={s.addressHeader}>
              <Text style={s.addressName}>{selectedAddress.name}</Text>
              {selectedAddress.isDefault && (
                <View style={s.defaultBadge}>
                  <Text style={s.defaultBadgeTxt}>Default</Text>
                </View>
              )}
            </View>
            <Text style={s.addressText}>
              {selectedAddress.line1 || selectedAddress.addressLine}
              {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}
            </Text>
            <Text style={s.addressText}>
              {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
            </Text>
            <Text style={s.addressPhone}>📞 {selectedAddress.phone}</Text>
            <Text style={s.changeTxt}>Change Address →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.addAddressCard}
            onPress={() => navigation.navigate('Addresses', {
              selectMode: true,
              onSelect: (addr: any) => setSelectedAddress(addr),
            })}
          >
            <Text style={s.addAddressIcon}>+</Text>
            <Text style={s.addAddressTxt}>Select Delivery Address</Text>
          </TouchableOpacity>
        )}

        {/* Order Items */}
        <Text style={s.sectionTitle}>📦 Order Items ({items.length})</Text>
        <View style={s.itemsCard}>
          {items.map((item, i) => (
            <View key={i} style={[s.itemRow, i < items.length - 1 && s.itemBorder]}>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.itemQty}>×{item.quantity}</Text>
              <Text style={s.itemPrice}>₹{item.price * item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Payment Method */}
        <Text style={s.sectionTitle}>💳 Payment Method</Text>
        <View style={s.paymentCard}>
          {PAYMENT_METHODS.map(pm => (
            <TouchableOpacity
              key={pm.id}
              style={[s.paymentOption, paymentMethod === pm.id && s.paymentOptionActive]}
              onPress={() => setPaymentMethod(pm.id)}
            >
              <Text style={s.paymentIcon}>{pm.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.paymentLabel}>{pm.label}</Text>
                <Text style={s.paymentSub}>{pm.subtitle}</Text>
              </View>
              <View style={[s.radio, paymentMethod === pm.id && s.radioActive]}>
                {paymentMethod === pm.id && <View style={s.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price Summary */}
        <Text style={s.sectionTitle}>💰 Price Details</Text>
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Subtotal</Text>
            <Text style={s.summaryValue}>₹{subtotal}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Delivery Fee</Text>
            <Text style={[s.summaryValue, deliveryFee === 0 && s.freeTxt]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          {deliveryFee === 0 && (
            <Text style={s.freeNote}>🎉 Free delivery on orders above ₹500</Text>
          )}
          <View style={[s.summaryRow, s.totalRow]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>₹{total}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={s.bottomBar}>
        <View>
          <Text style={s.totalLabel}>Total Amount</Text>
          <Text style={s.totalValueLarge}>₹{total}</Text>
        </View>
        <TouchableOpacity
          style={[s.placeBtn, isLoading && s.placeBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.placeBtnTxt}>{paymentMethod === 'cod' ? '📦 Place Order' : '💳 Pay ₹' + total}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Razorpay WebView Modal */}
      {pendingOrder && (
        <RazorpayPayment
          visible={showRazorpay}
          amount={total * 100}
          orderId={pendingOrder.orderId}
          razorpayOrderId={pendingOrder.razorpayOrderId || ''}
          keyId={process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || ''}
          name={user?.name || ''}
          email={user?.email || ''}
          phone={user?.phone || ''}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
          onDismiss={() => setShowRazorpay(false)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTxt: { fontSize: 17, color: '#666' },
  shopBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 24,
    paddingVertical: 14, borderRadius: 10, marginTop: 8 },
  shopBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333',
    marginTop: 16, marginBottom: 10 },
  addressCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#E95C1E' },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  addressName: { fontSize: 16, fontWeight: '700', color: '#222' },
  defaultBadge: { backgroundColor: '#fff3ee', paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: 4 },
  defaultBadgeTxt: { color: '#E95C1E', fontSize: 11, fontWeight: '600' },
  addressText: { fontSize: 14, color: '#666', lineHeight: 20 },
  addressPhone: { fontSize: 14, color: '#666', marginTop: 4 },
  changeTxt: { color: '#E95C1E', fontWeight: '600', fontSize: 13, marginTop: 10 },
  addAddressCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' },
  addAddressIcon: { fontSize: 32, color: '#E95C1E' },
  addAddressTxt: { color: '#E95C1E', fontWeight: '600', fontSize: 15, marginTop: 8 },
  itemsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemBorder: { borderBottomWidth: 1, borderColor: '#f0f0f0' },
  itemName: { flex: 1, fontSize: 14, color: '#333' },
  itemQty: { fontSize: 13, color: '#888', marginHorizontal: 12 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#333' },
  paymentCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  paymentOption: { flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderColor: '#f5f5f5' },
  paymentOptionActive: { backgroundColor: '#fff8f5' },
  paymentIcon: { fontSize: 24, marginRight: 12 },
  paymentLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  paymentSub: { fontSize: 12, color: '#888', marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#E95C1E' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E95C1E' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, color: '#333' },
  freeTxt: { color: '#2e7d32', fontWeight: '600' },
  freeNote: { fontSize: 12, color: '#2e7d32', marginTop: 4 },
  totalRow: { borderTopWidth: 1, borderColor: '#f0f0f0', marginTop: 8, paddingTop: 12 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 17, fontWeight: '800', color: '#E95C1E' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderColor: '#f0f0f0' },
  totalValueLarge: { fontSize: 20, fontWeight: '800', color: '#E95C1E' },
  placeBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: 12 },
  placeBtnDisabled: { backgroundColor: '#ccc' },
  placeBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
