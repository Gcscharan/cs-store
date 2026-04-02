import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';

interface FreeDeliveryBannerProps {
  cartTotal: number;
  threshold: number;
  style?: ViewStyle;
  urgency?: boolean;
}

export const FreeDeliveryBanner: React.FC<FreeDeliveryBannerProps> = ({ cartTotal, threshold, style, urgency = false }) => {
  const remaining = Math.max(0, threshold - cartTotal);
  const progress = Math.min(cartTotal / threshold, 1);
  
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const formatPrice = (amount: number) => 
    `₹${amount.toLocaleString('en-IN')}`;

  const message = cartTotal >= threshold 
    ? '🎉 You unlocked FREE delivery!' 
    : `Add ${formatPrice(remaining)} more for FREE delivery`;

  const urgencyMessage = null;

  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.bannerTitle}>
        {cartTotal >= threshold ? '🎉 Free Delivery Unlocked' : '🚚 Free Delivery'}
      </Text>

      <Text style={styles.bannerSubtitle}>
        {message}
      </Text>

      {urgencyMessage && <Text style={styles.urgencyText}>{urgencyMessage}</Text>}

      <View style={styles.progressContainer}>
        <Animated.View 
          style={[ 
            styles.progressBar, 
            { 
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }, 
          ]} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
    fontWeight: '500',
  },
  urgencyText: {
    marginTop: 8,
    color: '#E65100',
    fontWeight: '600',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#FFE0B2',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6D00',
    borderRadius: 4,
  },
});
