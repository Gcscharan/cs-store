import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  ActivityIndicator,
  Vibration,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderTrackingQuery,
} from '../../api/ordersApi';
import { useGetProductsQuery } from '../../api/productsApi';
import { SmartImage } from '../../components/SmartImage';
import type { RootNavigationProp, MainTabNavigationProp } from '../../navigation/types';
import type { Product } from '../../types';

import { ScreenHeader } from '../../components/ScreenHeader';
import { logEvent } from '../../utils/analytics';

const { width } = Dimensions.get('window');

const OrderSuccessScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const tabNav = useNavigation<MainTabNavigationProp>();
  const route = useRoute<any>();
  
  // Get params from navigation
  const orderId = String(route?.params?.orderId || '');
  const address = route?.params?.address;
  const totalAmount = route?.params?.totalAmount;

  const [fadeAnim] = useState(new Animated.Value(0));
  const [redirectTimer, setRedirectTimer] = useState(7);

  const { data: orderData, isLoading: isLoadingOrder } = useGetOrderByIdQuery(orderId, {
    skip: !orderId,
  });
  const order = (orderData as any)?.order || orderData;

  const { data: productsData } = useGetProductsQuery({ limit: 10, featured: true });
  const recommendations = useMemo(() => productsData?.products || [], [productsData]);

  useEffect(() => {
    if (orderId && order) {
      logEvent('order_success', { orderId, amount: order.totalAmount });
    }
  }, [orderId, order]);

  useEffect(() => {
    // Start fade-in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Success vibration
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 100, 50, 200]);
    }

    // Auto-redirect timer
    const interval = setInterval(() => {
      setRedirectTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTrackOrder();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTrackOrder = () => {
    if (!orderId) return;
    navigation.replace('OrderTracking', { orderId });
  };

  const handleContinueShopping = () => {
    tabNav.navigate('Home');
  };

  if (isLoadingOrder) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Success" />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Order Confirmed" />
      
      <LottieView
        source={{ uri: 'https://assets9.lottiefiles.com/packages/lf20_u4j3tAz6QX.json' }}
        autoPlay
        loop={false}
        style={styles.confetti}
        resizeMode="cover"
      />

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.successIconContainer}>
              <LottieView
                source={{ uri: 'https://assets10.lottiefiles.com/packages/lf20_kz9pjcjt.json' }}
                autoPlay
                loop={false}
                style={styles.successLottie}
              />
            </View>
            <Text style={styles.celebrationText}>Order Placed! 🎉</Text>
            <Text style={styles.thankYouText}>Thank you for shopping with Vyapara Setu</Text>
          </View>

          {/* Redirect Hint */}
          <View style={styles.redirectHint}>
            <Text style={styles.redirectText}>
              Redirecting to tracking in <Text style={styles.timerText}>{redirectTimer}s</Text>
            </Text>
          </View>

          {/* Quick Info Card */}
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Order ID</Text>
                <Text style={styles.infoValue}>#{orderId.slice(-8).toUpperCase()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Est. Delivery</Text>
                <Text style={[styles.infoValue, { color: Colors.success }]}>20–25 mins</Text>
              </View>
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.detailsCard}>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Delivery Address</Text>
                {address ? (
                  <>
                    <Text style={styles.detailValue}>{address.name}</Text>
                    <Text style={styles.detailAddress}>
                      {address.house}, {address.area}
                    </Text>
                    <Text style={styles.detailAddress}>
                      {address.city}, {address.state} - {address.pincode}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.detailValue} numberOfLines={2}>
                    {order?.deliveryAddress?.line1 || order?.deliveryAddress?.addressLine || order?.address?.address || order?.address?.addressLine || 'Your saved address'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.detailSeparator} />

            <View style={styles.detailItem}>
              <Ionicons name="card-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>
                  {order?.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI Payment'}
                </Text>
              </View>
            </View>

            {totalAmount && (
              <>
                <View style={styles.detailSeparator} />
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={20} color={Colors.textMuted} />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Total Amount</Text>
                    <Text style={[styles.detailValue, { color: Colors.primary }]}>
                      ₹{totalAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.trackBtn} onPress={handleTrackOrder}>
              <Text style={styles.trackBtnText}>Track Order</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueBtn} onPress={handleContinueShopping}>
              <Text style={styles.continueBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <View style={styles.recommendationsSection}>
              <Text style={styles.recommendationTitle}>People also bought</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendationScroll}>
                {recommendations.map((item: Product) => (
                  <TouchableOpacity 
                    key={item._id} 
                    style={styles.recommendationCard}
                    onPress={() => navigation.navigate('ProductDetail', { productId: item._id })}
                  >
                    <SmartImage uri={item.images?.[0]} style={styles.recImage} />
                    <Text style={styles.recName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.recPrice}>₹{item.price}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  confetti: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    pointerEvents: 'none',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successLottie: {
    width: 200,
    height: 200,
  },
  celebrationText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginTop: -20,
  },
  thankYouText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  redirectHint: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  redirectText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  timerText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  detailAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  detailSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  actions: {
    width: '100%',
    marginBottom: 40,
  },
  trackBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 12,
  },
  trackBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  continueBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  continueBtnText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  recommendationsSection: {
    width: '100%',
    paddingBottom: 40,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  recommendationScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  recommendationCard: {
    width: 140,
    marginRight: 16,
  },
  recImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  recName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  recPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
});

export default OrderSuccessScreen;
