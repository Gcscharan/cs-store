import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../constants/colors';

type ProductLike = {
  _id: string;
  name: string;
  price: number;
  mrp?: number;
  images?: any[];
  category?: string;
};

interface ProductCardProps {
  product: ProductLike;
  onPress: () => void;
  onAddToCart: () => void;
}

const getImageUrl = (product: ProductLike): string | undefined => {
  const first = product.images?.[0];
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

const ProductCard: React.FC<ProductCardProps> = memo(({ product, onPress, onAddToCart }) => {
  const imageUrl = getImageUrl(product);
  
  // Calculate discount if MRP exists and is greater than price
  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountPercent = hasDiscount 
    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100) 
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.image} 
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountTxt}>{discountPercent}% OFF</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {hasDiscount && (
            <Text style={styles.mrp}>₹{product.mrp}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.addButton} onPress={onAddToCart} activeOpacity={0.8}>
          <Text style={styles.addButtonText}>ADD</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.white,
    position: 'relative',
    padding: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
  },
  body: {
    padding: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    minHeight: 36,
    lineHeight: 18,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginRight: 6,
  },
  mrp: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#FFF5F0',
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default ProductCard;
