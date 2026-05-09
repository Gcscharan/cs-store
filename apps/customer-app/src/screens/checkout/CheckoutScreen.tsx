import { logEvent } from '../../utils/analytics';
import { useGetSmartCouponsQuery, useValidateCouponMutation } from '../../api/couponsApi';
import { useGetAddressesQuery } from '../../api/addressesApi';
import { useClearCartMutation, useCreateOrderMutation, useVerifyUPIMutation, useLazyGetPaymentStatusQuery } from '../../api/ordersApi';
import { BusinessRules } from '../../constants/businessRules';
import { FreeDeliveryBanner } from '../../components/FreeDeliveryBanner';
import { PAYMENT_ICONS } from '../../constants/paymentIcons';
import { storage } from '../../utils/storage';
import { BASE_URL as API_BASE_URL } from '../../api/baseApi';
import { calculatePriceBreakdown, estimateDeliveryFee, formatPrice } from '../../utils/priceCalculator';
import { clearCart } from '../../store/slices/cartSlice';
import type { CartNavigationProp } from '../../navigation/types';
import type { RootState } from '../../store';
import { Colors } from '../../constants/colors';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Generates a UUID v4 compliant idempotency key.
 * For COD: deterministic from cart+user+paymentMethod (same cart = same key, prevents duplicates).
 * For UPI: random per attempt (user may retry with same cart after a failed payment).
 */
const generateUuidV4 = (): string => {
  // RFC 4122 UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generates a deterministic UUID v4-format idempotency key from cart and user context.
 * Same cart + same user + same payment method = same key (prevents duplicate COD orders).
 */
const generateIdempotencyKey = (
  userId: string,
  cartItems: any[],
  paymentMethod: string,
): string => {
  const sortedIds = cartItems
    .map(it => `${it.productId || it._id}:${it.quantity}`)
    .sort()
    .join('|');
  const raw = `${userId}|${sortedIds}|${paymentMethod}`;
  // djb2 hash → seed two 32-bit values for UUID fields
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) & 0xffffffff;
    h2 = ((h2 << 5) + h2 ^ c) & 0xffffffff;
  }
  const a = Math.abs(h1).toString(16).padStart(8, '0').slice(0, 8);
  const b = Math.abs(h2).toString(16).padStart(8, '0').slice(0, 4);
  const c2 = Math.abs(h1 ^ h2).toString(16).padStart(4, '0').slice(0, 3);
  const d = ((Math.abs(h2) & 0x3fff) | 0x8000).toString(16).slice(0, 4);
  const e = Math.abs(h1 * 31 + h2).toString(16).padStart(12, '0').slice(0, 12);
  // Force version 4 indicator
  return `${a}-${b}-4${c2}-${d}-${e}`;
};

const BASE_URL = API_BASE_URL;

const UPI_APPS = [ 
  { 
    id: 'gpay',
    name: 'Google Pay', 
    subtitle: 'Pay using Google Pay UPI',
    iconKey: 'GOOGLE_PAY',
    razorpayCode: 'com.google.android.apps.nqo',
    deepLinkScheme: 'gpay://', // For installed app detection
  }, 
  { 
    id: 'phonepe',
    name: 'PhonePe', 
    subtitle: 'Pay using PhonePe UPI',
    iconKey: 'PHONEPE',
    razorpayCode: 'com.phonepe.app',
    deepLinkScheme: 'phonepe://',
  }, 
  { 
    id: 'paytm',
    name: 'Paytm', 
    subtitle: 'Pay using Paytm UPI',
    iconKey: 'PAYTM',
    razorpayCode: 'net.one97.paytm',
    deepLinkScheme: 'paytmmp://',
  }, 
  { 
    id: 'bhim',
    name: 'BHIM', 
    subtitle: 'Pay using BHIM UPI',
    iconKey: 'BHIM',
    razorpayCode: 'in.org.npci.upiapp',
    deepLinkScheme: 'bhim://',
  }, 
  { 
    id: 'other',
    name: 'Other UPI App', 
    subtitle: 'Pay using any UPI app',
    iconKey: 'UPI',
    razorpayCode: undefined,
    deepLinkScheme: undefined,
  }, 
];

/**
 * Check if a UPI app is installed on the device
 * Uses deep link scheme detection for runtime verification
 */
const checkUpiAppInstalled = async (app: typeof UPI_APPS[0]): Promise<boolean> => {
  if (!app.deepLinkScheme) return true; // 'other' option always available
  
  try {
    const canOpen = await Linking.canOpenURL(app.deepLinkScheme);
    return canOpen;
  } catch (error) {
    console.warn(`Failed to check if ${app.name} is installed:`, error);
    return false; // Assume not installed on error
  }
};

/**
 * Get last used UPI app from storage for smart defaults
 */
const getLastUsedUpiApp = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('lastUsedUpiApp');
  } catch {
    return null;
  }
};

/**
 * Save last used UPI app for future smart defaults
 */
const saveLastUsedUpiApp = async (appId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('lastUsedUpiApp', appId);
  } catch (error) {
    console.warn('Failed to save last used UPI app:', error);
  }
};

type PaymentMethod = 'cod' | 'upi';

const CheckoutScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<CartNavigationProp>();

  const cart = useSelector((state: RootState) => state.cart);
  const items = cart.items || [];

  const subtotal = items.reduce(
    (sum, it: any) => sum + Number(it?.price || 0) * Number(it?.quantity || 0),
    0
  );

  const { data: addressesData, isFetching: isFetchingAddresses, refetch } =
    useGetAddressesQuery(undefined);

  const addresses = React.useMemo(() => {
    const raw = addressesData?.addresses || [];
    const defaultId = addressesData?.defaultAddressId;
    
    return [...raw].sort((a, b) => {
      const aId = String((a as any)?._id || (a as any).id || '').trim();
      const bId = String((b as any)?._id || (b as any).id || '').trim();
      const defId = String(defaultId || '').trim();
      
      if (aId === defId) return -1;
      if (bId === defId) return 1;
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return 0;
    });
  }, [addressesData]);

  const defaultAddressId = addressesData?.defaultAddressId || null;

  const defaultAddress = React.useMemo(() => {
    if (!Array.isArray(addresses) || addresses.length === 0) return null;
    if (defaultAddressId) {
      return (
        addresses.find(
          (a: any) =>
            String(a?._id || a?.id || '').trim() ===
            String(defaultAddressId).trim()
        ) || null
      );
    }
    return addresses.find((a: any) => a?.isDefault) || null;
  }, [addresses, defaultAddressId]);

  const hasDefaultAddress = !!defaultAddress;

  // Selected address state
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  const [isAddressModalVisible, setIsAddressModalVisible] = React.useState(false);

  // Initialize selected address + handle deletion edge case
  React.useEffect(() => {
    if (addresses.length === 0) {
      setSelectedAddressId(null);
      return;
    }

    // Check if current selectedAddressId is still valid
    const isStillValid = selectedAddressId && addresses.some(
      (a: any) => String(a?._id || a?.id || '').trim() === String(selectedAddressId).trim()
    );

    if (!isStillValid) {
      // Fallback: defaultAddressId → first address → null
      const fallbackId = defaultAddressId || (addresses[0] as any)?._id || (addresses[0] as any)?.id;
      setSelectedAddressId(fallbackId);
    }
  }, [addresses, defaultAddressId, selectedAddressId]);

  const selectedAddress = React.useMemo(() => {
    if (!selectedAddressId || !addresses.length) return null;
    return addresses.find(
      (a: any) => String(a?._id || a?.id || '').trim() === String(selectedAddressId).trim()
    ) || null;
  }, [addresses, selectedAddressId]);

  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const [upiVpa, setUpiVpa] = React.useState('');
  const [isPlacingOrder, setIsPlacingOrder] = React.useState(false);
  const [couponCode, setCouponCode] = React.useState('');
  const [couponDiscount, setCouponDiscount] = React.useState(0);
  const [couponMessage, setCouponMessage] = React.useState('');
  const [couponMessageType, setCouponMessageType] = React.useState<'success' | 'error'>('success');

  const [isRecoveryModalVisible, setIsRecoveryModalVisible] = React.useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = React.useState(false);
  const [isTimeoutModalVisible, setIsTimeoutModalVisible] = React.useState(false);
  const [lastPayment, setLastPayment] = React.useState<{ method: 'cod' | 'upi', upiApp?: typeof UPI_APPS[0] } | null>(null);
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = React.useState<string | null>(null);
  const [pendingPaymentError, setPendingPaymentError] = React.useState<string>('');

  // ── UPI Verification State (PRODUCTION GATING) ──
  const [upiVerified, setUpiVerified] = React.useState(false);
  const [upiVerifiedVpa, setUpiVerifiedVpa] = React.useState('');
  const [upiVerifiedName, setUpiVerifiedName] = React.useState('');

  // ── UPI App Detection State (ELITE UX) ──
  const [installedUpiApps, setInstalledUpiApps] = React.useState<Set<string>>(new Set());
  const [isCheckingApps, setIsCheckingApps] = React.useState(false);

  const hasNavigatedRef = React.useRef(false);
  const inFlightStatusCheckRef = React.useRef(false);

  const paymentMethod = selectedOptionId === 'cod' ? 'cod' : (selectedOptionId ? 'upi' : null);
  const selectedUpiApp = UPI_APPS.find(a => a.id === selectedOptionId) || null;

  const user = useSelector((state: RootState) => state.auth.user);

  // Reset UPI verification when VPA changes
  const handleUpiVpaChange = useCallback((text: string) => {
    setUpiVpa(text);
    if (text !== upiVerifiedVpa) {
      setUpiVerified(false);
      setUpiVerifiedVpa('');
      setUpiVerifiedName('');
    }
  }, [upiVerifiedVpa]);

  const [createOrder, { isLoading: isCreatingOrder }] = useCreateOrderMutation();
  const [clearCartApi, { isLoading: isClearingCart }] = useClearCartMutation();
  const [validateCoupon, { isLoading: isValidatingCoupon }] = useValidateCouponMutation();
  const [verifyUPI, { isLoading: isVerifyingUPI }] = useVerifyUPIMutation();
  const [getPaymentStatus] = useLazyGetPaymentStatusQuery();
  const { data: couponsData } = useGetSmartCouponsQuery({ cartTotal: subtotal });
  const coupons = couponsData || [];



  const deliveryFeeDetails = estimateDeliveryFee(selectedAddress, subtotal);
  const breakdown = calculatePriceBreakdown(
    items as any[],
    deliveryFeeDetails,
    couponDiscount
  );

  useEffect(() => {
    logEvent('begin_checkout', { itemCount: items.length, cartValue: subtotal });
    
    // Detect installed UPI apps for smart UX
    const detectInstalledApps = async () => {
      setIsCheckingApps(true);
      const installed = new Set<string>();
      
      for (const app of UPI_APPS) {
        if (app.id === 'other') {
          installed.add(app.id); // 'other' is always available
          continue;
        }
        
        const isInstalled = await checkUpiAppInstalled(app);
        if (isInstalled) {
          installed.add(app.id);
          console.log(`✅ [UPI Detection] ${app.name} is installed`);
        } else {
          console.log(`❌ [UPI Detection] ${app.name} is NOT installed`);
        }
      }
      
      setInstalledUpiApps(installed);
      setIsCheckingApps(false);
      
      // Smart default: Select last used app if installed, otherwise most popular
      const lastUsed = await getLastUsedUpiApp();
      if (lastUsed && installed.has(lastUsed)) {
        console.log(`🎯 [Smart Default] Auto-selecting last used app: ${lastUsed}`);
        // Don't auto-select, just log for now (user should explicitly choose)
      } else if (installed.has('phonepe')) {
        console.log(`🎯 [Smart Default] PhonePe available (most popular in India)`);
      } else if (installed.has('gpay')) {
        console.log(`🎯 [Smart Default] Google Pay available`);
      }
      
      logEvent('upi_apps_detected', { 
        installedApps: Array.from(installed),
        totalInstalled: installed.size - 1, // Exclude 'other'
      });
    };
    
    detectInstalledApps();
  }, []);

  const isLoading = isCreatingOrder || isClearingCart;

  const hasStockIssues = items.some(
    (item: any) => item.isOutOfStock || item.hasInsufficientStock || item.price === 0
  );

  const isPlaceDisabled =
    isPlacingOrder ||
    isLoading ||
    !selectedOptionId ||
    !selectedAddressId ||
    hasStockIssues ||
    (selectedOptionId === 'other' && (!upiVpa.trim() || !upiVerified));

  const showApiError = (err: any, fallback: string) => {
    const message =
      String(err?.data?.message || err?.data?.error || err?.message || '').trim() || fallback;
    Alert.alert('Error', message);
  };

  const clearCartEverywhere = async () => {
    dispatch(clearCart());
    try {
      await clearCartApi(undefined).unwrap();
    } catch {
      // ignore (local cart already cleared)
    }
  };

  const resolvePaymentStatus = (statusRaw: string | undefined) => {
    const status = String(statusRaw || '').toUpperCase();
    if (status === 'PAID' || status === 'COMPLETED' || status === 'SUCCESS') return 'SUCCESS';
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED') return 'FAILED';
    return 'PENDING';
  };

  /**
   * Poll payment status with 20 attempts and 2-second intervals (40 seconds total)
   * Handles SUCCESS, FAILED, PENDING, and TIMEOUT scenarios
   * Requirements: NFR-004
   */
  const pollPaymentStatus = async (orderId: string, selectedApp: typeof UPI_APPS[0]) => {
    const MAX_ATTEMPTS = 20;
    const POLL_INTERVAL = 2000; // 2 seconds
    const pollStartTime = Date.now();
    
    // NFR-004: Log polling started
    console.log('🔄 [Polling] Payment polling started', { 
      orderId, 
      app: selectedApp.id, 
      maxAttempts: MAX_ATTEMPTS 
    });
    logEvent('payment_polling_started', { orderId, app: selectedApp.id, maxAttempts: MAX_ATTEMPTS });
    
    setIsVerifyingPayment(true);
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // NFR-004: Log polling attempt
        console.log(`🔄 [Polling] Attempt ${attempt}/${MAX_ATTEMPTS}`, { orderId, app: selectedApp.id });
        
        const res = await getPaymentStatus(orderId).unwrap();
        const verdict = resolvePaymentStatus(res?.paymentStatus);
        
        if (verdict === 'SUCCESS') {
          // Payment successful - clear pending order and navigate to success
          const duration = Date.now() - pollStartTime;
          
          // NFR-004: Log payment verified
          console.log('✅ [Success] Payment verified via polling', { 
            orderId, 
            attempts: attempt, 
            durationMs: duration 
          });
          logEvent('payment_verified', { method: 'polling', orderId, app: selectedApp.id, attempts: attempt, durationMs: duration });
          
          await AsyncStorage.removeItem('pendingPaymentOrderId');
          await AsyncStorage.removeItem('pendingPaymentTimestamp');
          
          hasNavigatedRef.current = true;
          setIsVerifyingPayment(false);
          
          logEvent('payment_success', { 
            method: 'upi', 
            app: selectedApp.id, 
            orderId,
            attempts: attempt 
          });
          
          await clearCartEverywhere();
          navigation.replace('OrderSuccess', { orderId });
          return;
        }
        
        if (verdict === 'FAILED') {
          // Payment failed - show recovery modal
          const duration = Date.now() - pollStartTime;
          
          // NFR-004: Log payment failed
          console.log('❌ [Error] Payment failed', { orderId, attempts: attempt, durationMs: duration });
          setIsVerifyingPayment(false);
          setLastPayment({ method: 'upi', upiApp: selectedApp });
          setIsRecoveryModalVisible(true);
          
          logEvent('payment_failed', { 
            method: 'upi', 
            app: selectedApp.id, 
            orderId,
            attempts: attempt 
          });
          return;
        }
        
        // Still pending, wait before next attempt
        if (attempt < MAX_ATTEMPTS) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), POLL_INTERVAL));
        }
        
      } catch (error: any) {
        // NFR-004: Log polling error
        console.error(`❌ [Error] Polling attempt ${attempt} failed`, { 
          orderId, 
          error: error?.message || String(error) 
        });
        logEvent('payment_polling_error', { orderId, attempt, error: error?.message || 'unknown' });
        
        // Continue polling on error (network issues)
        if (attempt < MAX_ATTEMPTS) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), POLL_INTERVAL));
        }
      }
    }
    
    // Timeout - verification taking longer than expected
    const duration = Date.now() - pollStartTime;
    
    // NFR-004: Log timeout
    console.log('⏱️ [Timeout] Payment verification timeout', { 
      orderId, 
      maxAttempts: MAX_ATTEMPTS, 
      durationMs: duration 
    });
    setIsVerifyingPayment(false);
    
    logEvent('payment_verification_timeout', { 
      method: 'upi', 
      app: selectedApp.id, 
      orderId,
      durationMs: duration,
    });
    
    // Show timeout modal
    setIsTimeoutModalVisible(true);
  };

  const handleCodPayment = async () => { 
    try { 
      setIsPlacingOrder(true);
      logEvent('checkout_started', { method: 'cod', itemCount: items.length, total: breakdown.total });
      const userId = String(user?._id || user?.id || `guest_${Date.now()}`);
      const idempotencyKey = generateIdempotencyKey(
        userId,
        items,
        'cod',
      );
      const res: any = await createOrder({ 
        paymentMethod: 'cod', 
        idempotencyKey, 
        addressId: selectedAddressId,
        couponCode: couponDiscount > 0 ? couponCode : undefined,
      } as any).unwrap(); 
      const orderId = String(res?.order?._id || '').trim(); 
      if (!orderId) throw new Error('Failed to place order');
      logEvent('payment_success', { method: 'cod', orderId });
      logEvent('order_placed', { orderId, total: breakdown.total, itemCount: items.length });
      await clearCartEverywhere(); 
      navigation.replace('OrderSuccess', { 
        orderId,
      }); 
    } catch (error: any) { 
      showApiError(error, 'Failed to place order.');
      logEvent('payment_failed', { method: 'cod', reason: error?.data?.message || 'unknown' });
    } finally { 
      setIsPlacingOrder(false); 
    } 
  };

  const handleVerifyUpi = useCallback(async () => {
    if (!upiVpa.trim()) {
      Alert.alert('Enter UPI ID', 'Please enter your UPI ID first.');
      return;
    }
    logEvent('upi_verification_started', { vpa: upiVpa });
    try {
      const res = await verifyUPI(upiVpa.trim()).unwrap();
      if (res.valid) {
        setUpiVerified(true);
        setUpiVerifiedVpa(upiVpa.trim());
        setUpiVerifiedName(res.name || '');
        logEvent('upi_verification_success', { vpa: upiVpa, name: res.name });
      } else {
        setUpiVerified(false);
        Alert.alert('Invalid UPI ID', 'This UPI ID could not be verified. Please check and try again.');
        logEvent('upi_verification_invalid', { vpa: upiVpa });
      }
    } catch {
      setUpiVerified(false);
      Alert.alert('Verification Failed', 'Could not verify UPI ID. Please try again.');
      logEvent('upi_verification_failed', { vpa: upiVpa });
    }
  }, [upiVpa, verifyUPI]);

  const handleUpiPayment = async (selectedApp: typeof UPI_APPS[0]) => { 
    try { 
      setIsPlacingOrder(true);
      
      // 🔥 CRITICAL: Clear any stale pending payment state before starting new payment
      // This prevents conflicts with old pending orders and polling loops
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');
      console.log('🧹 [Payment] Cleared stale pending payment state');
      
      // NFR-004: Log checkout started
      console.log('� [Payment] Checkout started', { 
        method: 'upi', 
        app: selectedApp.id, 
        itemCount: items.length, 
        total: breakdown.total 
      });
      logEvent('checkout_started', { method: 'upi', app: selectedApp.id, itemCount: items.length, total: breakdown.total });

      // ELITE UX: Check if selected app is actually installed
      if (selectedApp.id !== 'other' && !installedUpiApps.has(selectedApp.id)) {
        console.warn(`⚠️ [Payment] ${selectedApp.name} not installed, will use Razorpay fallback`);
        logEvent('upi_app_not_installed', { app: selectedApp.id });
        // Continue anyway - Razorpay will show fallback UI
      }

      // GATE: For 'other' UPI, require verified VPA
      if (selectedApp.id === 'other') {
        if (!upiVpa.trim()) {
          Alert.alert('Enter UPI ID', 'Please enter and verify your UPI ID first.');
          setIsPlacingOrder(false);
          return;
        }
        if (!upiVerified) {
          Alert.alert('Verify UPI', 'Please verify your UPI ID before proceeding.');
          setIsPlacingOrder(false);
          return;
        }
      }
  
      // Step 1: Create order with UNIQUE idempotency key per payment attempt
      // 🔥 CRITICAL FIX: Use UUID v4 to make each payment attempt unique
      // This prevents conflicts when user retries payment with same cart
      const idempotencyKey = generateUuidV4();
      
      // 🔍 DEBUG: Log order creation payload
      const orderPayload: any = { 
        paymentMethod: 'upi', 
        idempotencyKey,
      };
      
      // Only add optional fields if they have values
      if (upiVpa.trim()) {
        orderPayload.upiVpa = upiVpa.trim();
      }
      
      if (couponDiscount > 0 && couponCode) {
        orderPayload.couponCode = couponCode;
      }
      
      console.log('🧾 [Order Creation] Payload:', {
        ...orderPayload,
        cartItems: items.length,
        cartTotal: subtotal,
        userId: user?._id || user?.id,
        hasAddress: !!selectedAddressId,
        hasCoupon: !!orderPayload.couponCode,
      });
      
      const res: any = await createOrder(orderPayload as any).unwrap(); 
  
      const orderId = String(res?.order?._id || '').trim(); 
      const razorpayOrderId = String(res?.order?.razorpayOrderId || '').trim();
      
      if (!orderId) throw new Error('Order creation failed');
      if (!razorpayOrderId) throw new Error('Razorpay order ID not received');
  
      // Step 2: Store pending order for recovery
      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());
      
      // Step 3: Save last used app for smart defaults (ELITE UX)
      await saveLastUsedUpiApp(selectedApp.id);
      
      // Step 4: Open Razorpay UPI Intent
      const razorpayKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID || 
                          process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
      
      if (!razorpayKey) {
        throw new Error('Razorpay key not configured');
      }

      const options: any = {
        key: razorpayKey,
        amount: Math.round(res.order.totalAmount * 100), // Convert to paise
        currency: 'INR',
        order_id: razorpayOrderId,

        // UPI only — block all other payment methods
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
        },

        // Prefill contact to skip Razorpay mobile-number screen
        prefill: {
          contact: user?.phone || selectedAddress?.phone || '9999999999',
          name: user?.name || selectedAddress?.name || 'Customer',
        },

        // show_default_blocks: true → Razorpay shows PhonePe / GPay / Paytm natively
        config: {
          display: {
            preferences: {
              show_default_blocks: true,
            },
          },
        },

        theme: {
          color: '#3399cc',
        },
      };

      // NFR-004: Log Razorpay opening
      console.log('💳 [Payment] Opening Razorpay UPI', {
        orderId,
        razorpayOrderId,
        app: selectedApp.name,
        amount: options.amount,
      });

      logEvent('razorpay_upi_opened', { 
        orderId, 
        razorpayOrderId, 
        app: selectedApp.id 
      });

      const data = await RazorpayCheckout.open(options);
      
      // NFR-004: Log payment initiated successfully
      console.log('✅ [Payment] Payment initiated successfully', { 
        orderId, 
        razorpayOrderId, 
        razorpayPaymentId: data.razorpay_payment_id 
      });
      logEvent('razorpay_payment_initiated', { 
        orderId, 
        razorpayOrderId,
        razorpayPaymentId: data.razorpay_payment_id 
      });
  
      // Step 4: Backend-driven verification (polling)
      await pollPaymentStatus(orderId, selectedApp);
  
    } catch (error: any) {
      // NFR-004: Log payment error with FULL details
      console.error('❌ [Payment] Payment error - FULL DETAILS:', {
        message: error?.message,
        code: error?.code,
        description: error?.description,
        response: error?.response?.data,
        status: error?.response?.status,
        fullError: JSON.stringify(error, null, 2),
      });
      
      // Handle Razorpay-specific errors
      if (error.code === 'PAYMENT_CANCELLED' || error.code === '2') {
        // User cancelled payment — clear pending order so recovery doesn't pick it up
        await AsyncStorage.removeItem('pendingPaymentOrderId');
        await AsyncStorage.removeItem('pendingPaymentTimestamp');
        console.log('🚫 [Payment] User cancelled payment', { app: selectedApp.id });
        logEvent('payment_cancelled', { method: 'upi', app: selectedApp.id });
        setLastPayment({ method: 'upi', upiApp: selectedApp });
        setIsRecoveryModalVisible(true);
      } else if (error.code === 'NETWORK_ERROR' || error.code === '0') {
        // Network error — clear pending order (payment didn't complete)
        await AsyncStorage.removeItem('pendingPaymentOrderId');
        await AsyncStorage.removeItem('pendingPaymentTimestamp');
        console.error('🌐 [Error] Network error during payment', { app: selectedApp.id });
        logEvent('payment_network_error', { method: 'upi', app: selectedApp.id });
        Alert.alert(
          'Network Error',
          'Unable to connect to payment gateway. Please check your internet connection and try again.'
        );
      } else if (error?.response?.status === 400) {
        // Backend validation error - ORDER CREATION FAILED
        console.error('🔴 [CRITICAL] Order creation failed (400 BAD REQUEST):', {
          backendError: error.response.data,
          message: error.response.data?.message || error.response.data?.error,
        });
        logEvent('order_creation_failed', { 
          method: 'upi',
          reason: error.response.data?.message || 'validation_error',
          status: 400,
        });
        Alert.alert(
          'Order Creation Failed',
          error.response.data?.message || error.response.data?.error || 'Unable to create order. Please try again.'
        );
      } else {
        // Other errors
        console.error('❌ [Error] Payment failed', { 
          reason: error?.description || error?.message || 'unknown',
          code: error?.code,
          app: selectedApp.id,
          backendError: error?.response?.data,
        });
        logEvent('payment_failed', { 
          method: 'upi', 
          reason: error?.description || error?.message || 'unknown',
          code: error?.code,
          backendError: error?.response?.data?.message,
        });
        
        // Show user-friendly error
        const errorMessage = error?.response?.data?.message || 
                            error?.response?.data?.error || 
                            error?.description || 
                            error?.message || 
                            'Payment failed. Please try again.';
        Alert.alert('Payment Error', errorMessage);
        
        setLastPayment({ method: 'upi', upiApp: selectedApp });
        setIsRecoveryModalVisible(true);
      }
    } finally {
      setIsPlacingOrder(false); 
    } 
  };

  const handlePlaceOrder = async () => {
    if (lastPayment) {
      const paymentToRetry = { ...lastPayment };
      setLastPayment(null);

      if (paymentToRetry.method === 'cod') {
        await handleCodPayment();
      } else if (paymentToRetry.method === 'upi' && paymentToRetry.upiApp) {
        await handleUpiPayment(paymentToRetry.upiApp);
      }
      return;
    }

    if (!selectedAddressId) {
      return;
    }

    if (!paymentMethod) {
      Alert.alert('Select Payment', 'Please select a payment method to continue.');
      return;
    }

    if (paymentMethod === 'cod') {
      await handleCodPayment();
    } else if (paymentMethod === 'upi') {
      if (!selectedUpiApp) {
        Alert.alert('Select UPI App', 'Please select a UPI app to pay with.');
        return;
      }
      await handleUpiPayment(selectedUpiApp);
    }
  };

  const handleApplyCoupon = async (manualCode?: string) => {
    const codeToApply = manualCode || couponCode;
    if (!codeToApply.trim()) {
      setCouponMessage('Please enter a coupon code.');
      setCouponMessageType('error');
      return;
    }
    try {
      const result = await validateCoupon({
        code: codeToApply,
        cartTotal: subtotal,
      }).unwrap();

      if (result.valid) {
        setCouponCode(codeToApply);
        setCouponDiscount(result.discount);
        setCouponMessage(result.message);
        setCouponMessageType('success');
      } else {
        setCouponDiscount(0);
        setCouponMessage(result.message);
        setCouponMessageType('error');
      }
    } catch (err: any) {
      setCouponDiscount(0);
      setCouponMessage(err.data?.message || 'Invalid coupon code');
      setCouponMessageType('error');
    }
  };

  const handleClearCoupon = () => {
    setCouponDiscount(0);
    setCouponCode('');
    setCouponMessage('');
  };

  const handleAddAddress = () => {
    navigation.navigate('AddAddress', {});
  };

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    setIsAddressModalVisible(false);
  };

  // Refetch addresses when returning from AddAddressScreen
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (!items.length) {
    return (
      <View style={styles.safe}>
        <ScreenHeader title="Checkout" showBackButton />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add items to continue to checkout.</Text>
        </View>
      </View>
    );
  }

  const renderAddressCard = (address: any, isInModal: boolean = false) => {
    const addressId = String(address?._id || address?.id || '').trim();
    const isSelected = addressId === selectedAddressId;
    const isDefault = addressId === defaultAddressId;

    return (
      <TouchableOpacity
        key={addressId}
        style={[
          styles.addressCard,
          isInModal && styles.addressCardModal,
          isSelected && isInModal && styles.addressCardSelected,
        ]}
        onPress={isInModal ? () => {
          setSelectedAddressId(addressId);
          setIsAddressModalVisible(false);
        } : undefined}
        activeOpacity={isInModal ? 0.7 : 1}
        disabled={!isInModal}
      >
        <View style={styles.addressCardHeader}>
          <View style={styles.addressCardLabels}>
            <View style={[styles.addressLabelBadge, { backgroundColor: Colors.primary }]}>
              <Text style={styles.addressLabelBadgeText}>{address.label || 'HOME'}</Text>
            </View>
            {isDefault && (
              <View style={styles.addressDefaultBadge}>
                <Text style={styles.addressDefaultBadgeText}>DEFAULT</Text>
              </View>
            )}
          </View>
          {!isInModal && (
            <TouchableOpacity
              style={styles.changeAddressBtn}
              onPress={() => setIsAddressModalVisible(true)}
            >
              <Text style={styles.changeAddressBtnText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.addressName}>{address.name}</Text>
        <Text style={styles.addressPhone}>📞 {address.phone}</Text>
        <Text style={styles.addressLine}>
          {address.house}, {address.area}
        </Text>
        <Text style={styles.addressCityState}>
          {address.city}, {address.state} - {address.pincode}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPaymentRow = (id: string, name: string, subtitle: string, iconKey: string, isCod: boolean = false) => {
    const isSelected = selectedOptionId === id;
    const isInstalled = isCod || id === 'other' || installedUpiApps.has(id);
    const isUpiApp = !isCod && id !== 'other';
    
    return (
      <View key={id} style={[styles.optionContainer, isSelected && styles.optionContainerSelected]}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => setSelectedOptionId(id)}
          activeOpacity={0.7}
        >
          {/* Radio Button */}
          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>

          {/* Text Info */}
          <View style={styles.optionInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.optionName}>{name}</Text>
              {/* ELITE UX: Show installed indicator */}
              {isUpiApp && isInstalled && (
                <View style={{ 
                  backgroundColor: '#10B981', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4 
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                    INSTALLED
                  </Text>
                </View>
              )}
              {isUpiApp && !isInstalled && !isCheckingApps && (
                <View style={{ 
                  backgroundColor: '#9CA3AF', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4 
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                    NOT INSTALLED
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.optionSubtitle}>{subtitle}</Text>
          </View>

          {/* Icon */}
          <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
            <Image 
              source={isCod ? PAYMENT_ICONS.COD : (PAYMENT_ICONS[iconKey] || PAYMENT_ICONS.UPI)} 
              style={styles.paymentIcon}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        {/* Inline Actions — UPI ID input only; pay button is in sticky bar */}
        {isSelected && id === 'other' && (
          <View style={{ paddingBottom: 12 }}>
            <TextInput
              value={upiVpa}
              onChangeText={handleUpiVpaChange}
              placeholder="Enter UPI ID (e.g. name@upi)"
              style={styles.upiInputInline}
              autoCapitalize="none"
            />
            {upiVpa.trim().length > 0 && (
              <TouchableOpacity
                style={[styles.verifyUpiBtn, upiVerified && styles.verifyUpiBtnVerified]}
                onPress={handleVerifyUpi}
                disabled={isVerifyingUPI || upiVerified}
              >
                {isVerifyingUPI ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.verifyUpiBtnText}>
                    {upiVerified ? `✅ Verified${upiVerifiedName ? ` — ${upiVerifiedName}` : ''}` : '🔍 Verify UPI ID'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <ScreenHeader 
        title="Payments" 
        showBackButton 
        rightComponent={
          <View style={styles.secureBadge}>
            <Text style={styles.secureBadgeText}>🔒 100% Secure</Text>
          </View>
        }
      />

      <ScrollView style={styles.container} bounces={false}>
        {/* Stock Warning Banner */}
        {hasStockIssues && (
          <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, margin: 12, borderRadius: 8, padding: 12 }}>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>⚠️ Stock Issue</Text>
            {items.filter((item: any) => item.isOutOfStock || item.hasInsufficientStock || item.price === 0).map((item: any, i: number) => (
              <Text key={i} style={{ color: '#DC2626', fontSize: 12 }}>
                • {item.name || 'Item'}: {item.isOutOfStock || item.price === 0 ? 'Out of stock' : `Only ${item.stock} available (you have ${item.quantity})`}
              </Text>
            ))}
            <Text style={{ color: '#7F1D1D', fontSize: 11, marginTop: 6 }}>Please go back and update your cart to proceed.</Text>
          </View>
        )}

        {/* Address Section */}
        {isFetchingAddresses ? (
          <View style={styles.addressSection}>
            <View style={styles.addressSkeletonCard}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
            </View>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.addressSection}>
            <View style={styles.emptyAddressCard}>
              <Text style={styles.emptyAddressIcon}>📍</Text>
              <Text style={styles.emptyAddressTitle}>Add a delivery address to continue</Text>
              <TouchableOpacity style={styles.addAddressButton} onPress={handleAddAddress}>
                <Text style={styles.addAddressButtonText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : selectedAddress ? (
          <View style={styles.addressSection}>
            <View style={styles.addressSectionHeader}>
              <Text style={styles.addressSectionTitle}>Delivery Address</Text>
              <TouchableOpacity onPress={() => setIsAddressModalVisible(true)}>
                <Text style={styles.changeAddressButton}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.addressCard}>
              <View style={styles.addressCardHeader}>
                <View style={[styles.addressLabelBadge, { backgroundColor: '#f97316' }]}>
                  <Text style={styles.addressLabelBadgeText}>{(selectedAddress as any).label || 'HOME'}</Text>
                </View>
              </View>
              <Text style={styles.addressName}>{(selectedAddress as any).name}</Text>
              <Text style={styles.addressPhone}>📞 {(selectedAddress as any).phone}</Text>
              <Text style={styles.addressLine}>
                {(selectedAddress as any).house}, {(selectedAddress as any).area}
              </Text>
              <Text style={styles.addressCityState}>
                {(selectedAddress as any).city}, {(selectedAddress as any).state} - {(selectedAddress as any).pincode}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Available Coupons Horizontal List */}
        {addresses.length > 0 && coupons && coupons.length > 0 && (
          <View style={styles.couponsListContainer}>
            <Text style={styles.couponsListTitle}>Available Coupons</Text>
            <FlatList
              horizontal
              data={coupons}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.couponsListContent}
              renderItem={({ item }) => {
                const isEligible = subtotal >= item.minCartValue;
                return (
                  <View style={[styles.couponCard, !isEligible && styles.couponCardIneligible]}>
                    <View style={styles.couponCardHeader}>
                      <Text style={styles.couponCardCode}>{item.code}</Text>
                      {isEligible ? (
                        <TouchableOpacity
                          style={styles.applyCouponBadge}
                          onPress={() => handleApplyCoupon(item.code)}
                          disabled={isValidatingCoupon || couponDiscount > 0}
                        >
                          <Text style={styles.applyCouponBadgeText}>APPLY</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.ineligibleBadge}>Min ₹{item.minCartValue}</Text>
                      )}
                    </View>
                    <Text style={styles.couponCardDesc} numberOfLines={1}>{item.description}</Text>
                  </View>
                );
              }}
            />
          </View>
        )}

        {/* Coupon Section */}
        {addresses.length > 0 && (
        <View style={styles.couponSection}>
          <TextInput
            style={styles.couponInput}
            placeholder="Enter Coupon Code"
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
            editable={couponDiscount === 0}
          />
          <TouchableOpacity
            style={[
              styles.applyButton,
              (isValidatingCoupon || couponDiscount > 0) && { opacity: 0.5 }
            ]}
            onPress={() => handleApplyCoupon()}
            disabled={isValidatingCoupon || couponDiscount > 0}
          >
            {isValidatingCoupon ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.applyButtonText}>
                {couponDiscount > 0 ? 'Applied' : 'Apply'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        )}

        {addresses.length > 0 && couponMessage ? (
          couponMessageType === 'success' ? (
            <View style={styles.appliedCouponPill}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#16a34a" style={{ marginRight: 8 }} />
              <Text style={styles.appliedCouponText}>
                {couponCode} applied — saving {formatPrice(couponDiscount)}
              </Text>
              <TouchableOpacity onPress={handleClearCoupon} style={styles.clearCouponBtn}>
                <MaterialCommunityIcons name="close" size={16} color="#16a34a" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.couponMessage, { color: 'red' }]}>
              {couponMessage}
            </Text>
          )
        ) : null}

        {/* Total Amount Bar */}
        {addresses.length > 0 && (
          <>
            <View style={styles.totalBar}>
              <Text style={styles.totalLabelBlue}>Total Amount ↓</Text>
              <Text style={styles.totalValueBlue}>{formatPrice(breakdown.total)}</Text>
            </View>

            {/* Detailed Price Summary */}
            <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Bill Details</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelRow}>
              <MaterialCommunityIcons name="cart-outline" size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={styles.summaryLabel}>Item Total</Text>
            </View>
            <Text style={styles.summaryValue}>{formatPrice(breakdown.subtotalBeforeTax)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelRow}>
              <MaterialCommunityIcons name="percent" size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={styles.summaryLabel}>GST ({breakdown.gstRate}%)</Text>
            </View>
            <Text style={styles.summaryValue}>{formatPrice(breakdown.gstAmount)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryLabelRow}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
            </View>
            <Text style={[styles.summaryValue, breakdown.isFreeDelivery && { color: '#16a34a' }]}>
              {breakdown.isFreeDelivery ? 'FREE' : formatPrice(breakdown.deliveryFee)}
            </Text>
          </View>

          {breakdown.discount > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryLabelRow}>
                <MaterialCommunityIcons name="tag-outline" size={16} color="#16a34a" style={{ marginRight: 8 }} />
                <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>Coupon Discount</Text>
              </View>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{formatPrice(breakdown.discount)}</Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>{formatPrice(breakdown.total)}</Text>
          </View>
        </View>

        {/* Free Delivery Banner */}
        <FreeDeliveryBanner cartTotal={subtotal} threshold={BusinessRules.FREE_DELIVERY_THRESHOLD} style={{ marginHorizontal: 16 }} />
          </>
        )}

        {/* Payment Methods - Only show if address exists */}
        {addresses.length > 0 && (
          <>
            {/* UPI Section */}
            <View style={styles.sectionSeparator}>
              <Text style={styles.sectionSeparatorText}>💳 UPI</Text>
            </View>
            {UPI_APPS.map(app => renderPaymentRow(app.id, app.name, app.subtitle, app.iconKey))}

            {/* COD Section */}
            <View style={styles.sectionSeparator}>
              <Text style={styles.sectionSeparatorText}>Cash on Delivery</Text>
            </View>
            {renderPaymentRow('cod', 'Cash on Delivery', 'Pay when your order arrives', 'COD', true)}

            {/* Trust Badges Footer */}
            <View style={styles.footerInfo}>
              <Text style={styles.footerSecureText}>🔒 100% Secure & Encrypted Payment</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Sticky Bottom Bar (Flipkart-style) ─────────────────────────── */}
      {addresses.length > 0 && selectedOptionId && (
        <View style={styles.stickyBar}>
          <View style={styles.stickyBarLeft}>
            <Text style={styles.stickyBarTotal}>{formatPrice(breakdown.total)}</Text>
            {breakdown.discount > 0 && (
              <Text style={styles.stickyBarSaving}>Saving {formatPrice(breakdown.discount)}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.stickyBarBtn, isPlaceDisabled && styles.stickyBarBtnDisabled]}
            onPress={handlePlaceOrder}
            disabled={isPlaceDisabled}
            activeOpacity={0.85}
          >
            {isPlacingOrder ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.stickyBarBtnText}>
                {selectedOptionId === 'cod' ? 'Place Order' : `Pay ${formatPrice(breakdown.total)}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={isVerifyingPayment}
        transparent
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Verifying Payment</Text>
            <Text style={styles.modalMessage}>
              Please wait while we confirm your payment with the bank.
            </Text>
            <Text style={styles.modalWarning}>
              Do not close the app or press back.
            </Text>

            {pendingPaymentError ? (
              <Text style={[styles.modalMessage, { marginTop: 10, color: Colors.textSecondary }]}>
                {pendingPaymentError}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isRecoveryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRecoveryModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Payment Failed</Text>
            <Text style={styles.modalMessage}>Your payment could not be processed. Please try again.</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setIsRecoveryModalVisible(false);
                logEvent('payment_retry', { method: lastPayment?.method });
                handlePlaceOrder();
              }}
            >
              <Text style={styles.modalButtonText}>Retry Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => {
                setIsRecoveryModalVisible(false);
                logEvent('payment_method_changed');
                setSelectedOptionId('cod');
              }}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>Switch to Cash on Delivery</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Timeout Modal */}
      <Modal
        visible={isTimeoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTimeoutModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="clock-alert-outline" size={48} color="#f59e0b" style={{ marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Verification Taking Longer</Text>
            <Text style={styles.modalMessage}>
              Payment verification is taking longer than expected. Please check your order status in "My Orders".
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setIsTimeoutModalVisible(false);
                logEvent('payment_timeout_check_orders', { orderId: pendingPaymentOrderId });
                (navigation as any).navigate('Orders');
              }}
            >
              <Text style={styles.modalButtonText}>Check Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => {
                setIsTimeoutModalVisible(false);
              }}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Address Selection Modal */}
      <Modal
        visible={isAddressModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddressModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          activeOpacity={1}
          onPress={() => setIsAddressModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.addressModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.addressModalHandle} />
            <View style={styles.addressModalHeader}>
              <Text style={styles.addressModalTitle}>Select Delivery Address</Text>
              <TouchableOpacity onPress={() => setIsAddressModalVisible(false)}>
                <Text style={styles.addressModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={addresses}
              keyExtractor={(item: any) => String(item?._id || item?.id || '')}
              style={styles.addressModalList}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item: addr }) => {
                const addressId = String((addr as any)?._id || (addr as any)?.id || '').trim();
                const isSelected = addressId === selectedAddressId;
                const isDefault = addressId === defaultAddressId;
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.addressCardModal,
                      isSelected && styles.addressCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedAddressId(addressId);
                      setIsAddressModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressCardHeader}>
                      <View style={styles.addressCardLabels}>
                        <View style={[styles.addressLabelBadge, { backgroundColor: '#f97316' }]}>
                          <Text style={styles.addressLabelBadgeText}>{(addr as any).label || 'HOME'}</Text>
                        </View>
                        {isDefault && (
                          <View style={styles.addressDefaultBadge}>
                            <Text style={styles.addressDefaultBadgeText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      {isSelected && (
                        <View style={styles.selectedCheckmark}>
                          <Text style={styles.selectedCheckmarkText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.addressName}>{(addr as any).name}</Text>
                    <Text style={styles.addressPhone}>📞 {(addr as any).phone}</Text>
                    <Text style={styles.addressLine}>
                      {(addr as any).house}, {(addr as any).area}
                    </Text>
                    <Text style={styles.addressCityState}>
                      {(addr as any).city}, {(addr as any).state} - {(addr as any).pincode}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.addNewAddressBtn}
                  onPress={() => {
                    setIsAddressModalVisible(false);
                    handleAddAddress();
                  }}
                >
                  <Text style={styles.addNewAddressBtnText}>+ Add New Address</Text>
                </TouchableOpacity>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: { paddingRight: 16 },
  backArrow: { fontSize: 24, color: '#111827' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
  secureBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  secureBadgeText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },

  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
  },
  trustBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#eff6ff',
  },
  totalLabelBlue: { color: '#2563eb', fontSize: 15, fontWeight: '500' },
  totalValueBlue: { color: '#2563eb', fontSize: 15, fontWeight: '700' },

  summaryCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },

  couponSection: {
    flexDirection: 'row',
    padding: 16,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
    marginLeft: 10,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  couponMessage: {
    marginHorizontal: 16,
    marginBottom: 16,
    fontSize: 13,
  },
  couponsListContainer: {
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  couponsListTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  couponsListContent: {
    paddingHorizontal: 12,
  },
  couponCard: {
    width: 200,
    padding: 12,
    backgroundColor: '#fdf4ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fae8ff',
    marginHorizontal: 4,
  },
  couponCardIneligible: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
    opacity: 0.8,
  },
  couponCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  couponCardCode: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  couponCardDesc: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  applyCouponBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E95C1E',
  },
  applyCouponBadgeText: {
    fontSize: 10,
    color: '#E95C1E',
    fontWeight: '800',
  },
  ineligibleBadge: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '700',
  },
  appliedCouponPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 16,
  },
  appliedCouponText: {
    flex: 1,
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '700',
  },
  clearCouponBtn: {
    padding: 4,
  },

  sectionSeparator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
  },
  sectionSeparatorText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
  },

  optionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionContainerSelected: {
    backgroundColor: '#fffaf5',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#f97316',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f97316',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerSelected: {
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  paymentIcon: {
    width: 28,
    height: 28,
  },
  optionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  logoBox: {
    width: 40,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  upiInputInline: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  verifyUpiBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  verifyUpiBtnVerified: {
    backgroundColor: '#16a34a',
  },
  verifyUpiBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  payButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f97316',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  footerInfo: {
    padding: 24,
    alignItems: 'center',
  },
  footerSecureText: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // ── Sticky Bottom Bar ──────────────────────────────────────────────────────
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  stickyBarLeft: {
    flex: 1,
  },
  stickyBarTotal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  stickyBarSaving: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '700',
    marginTop: 2,
  },
  stickyBarBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  stickyBarBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  stickyBarBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { color: Colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalWarning: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonSecondaryText: {
    color: Colors.textPrimary,
  },

  // Address Section Styles
  addressSection: {
    padding: 16,
    backgroundColor: '#fff',
  },
  addressSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  changeAddressButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f97316',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addressCardModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  addressCardSelected: {
    borderColor: '#f97316',
    borderWidth: 2,
    backgroundColor: '#fff7ed',
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressCardLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addressLabelBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  addressDefaultBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addressDefaultBadgeText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '700',
  },
  changeAddressBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeAddressBtnText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '700',
  },
  addressName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  addressPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  addressCityState: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Empty Address State
  emptyAddressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  emptyAddressIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyAddressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  addAddressButton: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addAddressButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Address Loading Skeleton
  addressSkeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    width: '100%',
  },

  // Address Modal Styles
  addressModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    marginTop: 'auto',
  },
  addressModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  addressModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  addressModalClose: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '400',
  },
  addressModalList: {
    padding: 16,
  },
  addNewAddressBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 8,
  },
  addNewAddressBtnText: {
    color: '#f97316',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CheckoutScreen;
