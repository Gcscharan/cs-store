import React, { useState } from 'react'; 
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Share, Alert, Pressable,
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetProductByIdQuery } from '../../api/productsApi';
import { useGetProductReviewsQuery } from '../../api/reviewsApi';
import { useAddToCartMutation } from '../../api/cartApi';
import { useDispatch, useSelector } from 'react-redux'; 
import { addItem } from '../../store/slices/cartSlice'; 
import { showToast } from '../../store/slices/uiSlice';
import { SmartImage } from '../../components/SmartImage'; 
import { BusinessRules } from '../../constants/businessRules';
import { Colors } from '../../constants/colors';
import type { RootState } from '../../store'; 
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { logEvent } from '../../utils/analytics';

const getImageUrl = (img: any): string | undefined => {
  if (!img) return undefined;
  if (typeof img === 'string') return img;
  
  // Try direct properties first, then look inside variants
  return (
    img?.url ||
    img?.variants?.medium ||
    img?.variants?.small ||
    img?.thumb ||
    img?.original ||
    null
  ) || undefined;
};

export default function ProductDetailScreen({ route, navigation }: any) { 
  // Handle both id and productId from navigation params
  const id = route.params?.productId || route.params?.id; 
  const { data: product, isLoading, isError, refetch } = useGetProductByIdQuery(id, { skip: !id }); 
  const dispatch = useDispatch(); 
  const { user } = useSelector((s: RootState) => s.auth); 
 
  const [qty, setQty] = useState(1); 
  const [selectedImage, setSelectedImage] = useState(0); 
 
  const { data: reviewsData } = useGetProductReviewsQuery( 
    { productId: id }, { skip: !id }); 
  const [addToCart, { isLoading: addingToCart }] = useAddToCartMutation(); 
 
  if (!id) return (
    <View style={s.container}>
      <ScreenHeader title="Product" showBackButton />
      <View style={s.center}>
        <Text>Error: No Product ID provided</Text>
      </View>
    </View>
  );

  if (isLoading) return ( 
    <View style={s.container}>
      <ScreenHeader title="Loading..." showBackButton />
      <View style={s.center}> 
        <ActivityIndicator size="large" color="#E95C1E" /> 
        <Text style={{ marginTop: 10, color: '#888' }}>Loading product...</Text> 
      </View> 
    </View>
  ); 

  if (isError) return ( 
    <View style={s.container}> 
      <ScreenHeader title="Error" showBackButton />
      <View style={s.center}> 
        <Text style={{ fontSize: 40 }}>😕</Text> 
        <Text style={{ fontSize: 16, color: '#666', marginTop: 10 }}> 
          Failed to load product 
        </Text> 
        <TouchableOpacity 
          style={{ marginTop: 16, backgroundColor: '#E95C1E', 
            padding: 12, borderRadius: 8 }} 
          onPress={() => refetch()} 
        > 
          <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text> 
        </TouchableOpacity> 
      </View> 
    </View> 
  ); 
 
  if (!product) return ( 
    <View style={s.container}>
      <ScreenHeader title="Not Found" showBackButton />
      <View style={s.center}><Text>Product not found</Text></View> 
    </View>
  );

  const images = product.images?.length ? product.images : [null]; 
  const discount = product.mrp > product.price 
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0; 
  const savings = product.mrp - product.price; 
  const reviews = reviewsData?.reviews || []; 
  const avgRating = reviews.length 
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1) 
    : null; 

  // Deterministic pseudo-random number for urgency based on product ID
  const getUrgencyCount = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 20) + 5; // Returns a number between 5 and 24
  };
  const urgencyCount = id ? getUrgencyCount(id) : 12;
 
  const handleShare = async () => { 
    await Share.share({ 
      message: `Check out ${product.name} on Vyapara Setu for just ₹${product.price}!\nDownload: https://vyaparsetu.in`, 
      title: product.name, 
    }); 
  }; 
 
  const handleAddToCart = async () => { 
    const imageUrl = getImageUrl(images);
    try { 
      logEvent('add_to_cart', { 
        productId: product._id, 
        quantity: qty, 
        price: product.price, 
        category: product.category 
      });
      // Optimistic UI: Update local cart immediately 
      dispatch(addItem({ 
        productId: product._id, 
        name: product.name, 
        price: product.price, 
        quantity: qty, 
        image: imageUrl, 
      })); 
      dispatch(showToast(`${product.name} added to cart`)); 
 
      // Background API sync 
      await addToCart({ productId: product._id, quantity: qty }).unwrap(); 
    } catch (error: any) { 
      // If API fails, cart slice logic or a manual rollback would go here 
      // For now, we alert the user 
      Alert.alert('Error', error?.data?.message || 'Failed to sync cart with server'); 
    } 
  }; 
 
  return ( 
    <View style={s.container}> 
      <ScreenHeader 
        title={product.name} 
        showBackButton 
        rightComponent={
          <TouchableOpacity onPress={handleShare} style={s.shareBtn}> 
            <Ionicons name="share-social-outline" size={20} color={Colors.white} /> 
          </TouchableOpacity> 
        }
      /> 
 
      <ScrollView showsVerticalScrollIndicator={false}> 
        {/* Image gallery */} 
        <View style={s.imageSection}> 
          <SmartImage 
            uri={getImageUrl(images[selectedImage])} 
            style={s.mainImage} 
            resizeMode="contain" 
          /> 
          {discount > 0 && ( 
            <View style={s.bigDiscount}> 
              <Text style={s.bigDiscountTxt}>{discount}% OFF</Text> 
            </View> 
          )} 
          {images.length > 1 && ( 
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={s.thumbRow} 
            > 
              {images.map((img: any, i: number) => ( 
                <TouchableOpacity 
                  key={i} 
                  onPress={() => setSelectedImage(i)} 
                  style={[s.thumbWrap, selectedImage === i && s.thumbActive, { marginRight: 8 }]} 
                > 
                  <SmartImage uri={getImageUrl(img)} style={s.thumb} resizeMode="contain" /> 
                </TouchableOpacity> 
              ))} 
            </ScrollView> 
          )} 
        </View> 
 
        <View style={s.content}> 
          {/* Product name */} 
          <Text style={s.name}>{product.name}</Text> 
 
           {/* Rating */} 
           {avgRating && ( 
             <TouchableOpacity 
               style={s.ratingRow} 
               onPress={() => {}} 
             > 
               <Text style={[s.stars, { marginRight: 6 }]}>★ {avgRating}</Text> 
               <Text style={s.reviewCount}>({reviews.length} reviews)</Text> 
             </TouchableOpacity> 
           )} 
 
           {/* Badges */}
          <View style={s.badgesRow}>
            {product.isBestseller && (
              <View style={[s.badge, s.bestsellerBadge, { marginRight: 8, marginBottom: 8 }]}>
               <Ionicons name="flame" size={12} color="#E53E3E" style={{ marginRight: 4 }} />
               <Text style={s.bestsellerBadgeTxt}>Bestseller</Text>
              </View>
            )}
            {avgRating && Number(avgRating) >= 4.5 && (
              <View style={[s.badge, s.ratingBadge, { marginRight: 8, marginBottom: 8 }]}>
                <Ionicons name="star" size={12} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={s.ratingBadgeTxt}>High Rating</Text>
              </View>
            )}
            <View style={[s.badge, s.deliveryBadge, { marginRight: 8, marginBottom: 8 }]}>
              <Ionicons name="flash" size={12} color="#48BB78" style={{ marginRight: 4 }} />
              <Text style={s.deliveryBadgeTxt}>Fast Delivery</Text>
            </View>
            {product.isSponsored && <Text style={[s.badge, s.sponsoredBadge, { marginRight: 8, marginBottom: 8 }]}>Sponsored</Text>}
          </View>

          {/* Urgency & Scarcity */}
          <View style={s.urgencyRow}>
            <View style={[s.badge, s.urgencyBadge, { marginRight: 8 }]}>
              <Ionicons name="trending-up" size={12} color="#D97706" style={{ marginRight: 4 }} />
              <Text style={s.urgencyBadgeTxt}>{urgencyCount} bought today</Text>
            </View>
            {product.stock > 0 && product.stock <= 10 && (
              <View style={[s.badge, s.scarcityBadge]}>
                <Ionicons name="time" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                <Text style={s.scarcityBadgeTxt}>Only {product.stock} left</Text>
              </View>
            )}
          </View>
 
          {/* Price */} 
          <View style={s.priceSection}> 
            <Text style={s.price}>₹{product.price}</Text> 
            {product.mrp > product.price && ( 
              <> 
                <Text style={s.mrp}>M.R.P: ₹{product.mrp}</Text> 
                <View style={s.saveBadge}> 
                  <Text style={s.saveTxt}>You save ₹{savings} ({discount}%)</Text> 
                </View> 
              </> 
            )} 
          </View> 
 
          {/* Trust badges */} 
          <View style={s.trustRow}> 
            <View style={[s.trustBadge, { marginRight: 8, marginBottom: 8 }]}>
              <Ionicons name="shield-checkmark" size={14} color="#555" style={{ marginRight: 6 }} />
              <Text style={s.trustTxt}>Secure Pay</Text>
            </View>
            <View style={[s.trustBadge, { marginRight: 8, marginBottom: 8 }]}>
              <Ionicons name="refresh" size={14} color="#555" style={{ marginRight: 6 }} />
              <Text style={s.trustTxt}>Easy Returns</Text>
            </View>
            <View style={[s.trustBadge, { marginRight: 8, marginBottom: 8 }]}>
              <Ionicons name="flash" size={14} color="#555" style={{ marginRight: 6 }} />
              <Text style={s.trustTxt}>Fast Delivery</Text>
            </View>
          </View> 
 
          {/* Free delivery badge */} 
          {product.price >= BusinessRules.FREE_DELIVERY_THRESHOLD && ( 
            <View style={s.freeDeliveryBadge}> 
              <Ionicons name="car" size={16} color="#1565C0" style={{ marginRight: 6 }} />
              <Text style={s.freeDeliveryTxt}>FREE Delivery on this order</Text> 
            </View> 
          )} 
 
          {/* Stock status */} 
          <View style={s.stockStatusRow}>
            <Ionicons name={product.stock > 0 ? "checkmark-circle" : "close-circle"} size={16} color={product.stock > 0 ? "#16A34A" : "#DC2626"} style={{ marginRight: 6 }} />
            <Text style={product.stock > 0 ? s.inStock : s.outStock}> 
              {product.stock > 0 
                ? `In Stock (${product.stock} available)` 
                : `Out of Stock`} 
            </Text> 
          </View> 
 
          {/* Description */} 
          {product.description && ( 
            <View style={s.section}> 
              <Text style={s.sectionTitle}>About this product</Text> 
              <Text style={s.desc}>{product.description}</Text> 
            </View> 
          )} 
 
          {/* Reviews */}
          <View style={s.section}>
            <View style={s.reviewHeader}>
              <View>
                <Text style={s.sectionTitle}>Customer Reviews</Text>
                {avgRating && (
                  <View style={s.avgRatingRow}>
                    {[1,2,3,4,5].map(star => (
                      <Text
                        key={star}
                        style={{ color: star <= Math.round(Number(avgRating)) ? '#f59e0b' : '#ddd', fontSize: 14, marginRight: 2 }}
                      >
                        ★
                      </Text>
                    ))}
                    <Text style={[s.avgRatingText, { marginLeft: 4 }]}>{avgRating} ({reviews.length})</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={s.writeReviewBtn}
                onPress={() => navigation.navigate('WriteReview', {
                  productId: id,
                  productName: product.name,
                })}
              >
                <Text style={s.writeReviewTxt}>+ Write Review</Text>
              </TouchableOpacity>
            </View>

            {reviews.length === 0 ? (
              <View style={s.noReviewsContainer}>
                <Ionicons name="chatbubbles-outline" size={32} color={Colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={s.noReviews}>No reviews yet. Be the first to review!</Text>
                <TouchableOpacity
                  style={s.beFirstBtn}
                  onPress={() => navigation.navigate('WriteReview', {
                    productId: id,
                    productName: product.name,
                  })}
                >
                  <Text style={s.beFirstBtnText}>Write a Review</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {reviews.slice(0, 3).map((review: any) => (
                  <View key={review._id} style={s.reviewCard}>
                    <View style={s.reviewTop}>
                      <View style={s.reviewAvatar}>
                        <Text style={s.reviewAvatarText}>
                          {(review.userName || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reviewAuthor}>{review.userName || 'Customer'}</Text>
                        <View style={s.reviewStarRow}>
                          {[1,2,3,4,5].map(star => (
                            <Text
                              key={star}
                              style={{ color: star <= review.rating ? '#f59e0b' : '#ddd', fontSize: 12 }}
                            >
                              ★
                            </Text>
                          ))}
                          <Text style={s.reviewDate}>
                            {'  '}{new Date(review.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={s.reviewText}>{review.comment}</Text>
                  </View>
                ))}

                {reviews.length > 3 && (
                  <TouchableOpacity
                    style={s.seeAllReviews}
                    onPress={() => navigation.navigate('AllReviews', {
                      productId: id,
                      productName: product.name,
                    })}
                  >
                    <Text style={s.seeAllReviewsTxt}>
                      See all {reviews.length} reviews →
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View> 
        </View> 
      </ScrollView> 
 
      {/* Add to cart footer */} 
      {product.stock > 0 && ( 
        <View style={s.footer}> 
          <View style={[s.qtyRow, { marginRight: 16 }]}> 
            <TouchableOpacity 
              style={s.qtyBtn} 
              onPress={() => setQty(q => Math.max(1, q - 1))} 
            > 
              <Text style={s.qtyBtnTxt}>−</Text> 
            </TouchableOpacity> 
            <Text style={[s.qty, { marginHorizontal: 16 }]}>{qty}</Text> 
            <TouchableOpacity 
              style={s.qtyBtn} 
              onPress={() => setQty(q => Math.min(product.stock, q + 1))} 
            > 
              <Text style={s.qtyBtnTxt}>+</Text> 
            </TouchableOpacity> 
          </View> 
          <TouchableOpacity 
            style={[s.addBtn, addingToCart && { opacity: 0.7 }]} 
            disabled={addingToCart}
            onPress={handleAddToCart} 
          > 
            {addingToCart ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.addBtnTxt}>Add to Cart · ₹{product.price * qty}</Text> 
            )}
          </TouchableOpacity> 
        </View> 
      )} 
    </View> 
  ); 
} 
 
const s = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: Colors.background }, 
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
  topBar: { flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, 
    backgroundColor: Colors.white, borderBottomWidth: 1, borderColor: Colors.border }, 
  backBtn: { padding: 4 }, 
  backTxt: { fontSize: 24, color: Colors.textPrimary }, 
  shareBtn: { padding: 8, backgroundColor: Colors.inputBackground, borderRadius: 8 }, 
  imageSection: { backgroundColor: Colors.white, paddingBottom: 16 }, 
  mainImage: { width: '100%', height: 320, backgroundColor: Colors.white }, 
  bigDiscount: { position: 'absolute', top: 12, right: 12, 
    backgroundColor: Colors.primary, paddingHorizontal: 12, 
    paddingVertical: 6, borderRadius: 8 }, 
  bigDiscountTxt: { color: Colors.white, fontWeight: '900', fontSize: 16 }, 
  thumbRow: { padding: 12 }, 
  thumbWrap: { borderRadius: 8, overflow: 'hidden', 
    borderWidth: 2, borderColor: Colors.border, padding: 4, backgroundColor: Colors.white }, 
  thumbActive: { borderColor: Colors.primary }, 
  thumb: { width: 64, height: 64, backgroundColor: Colors.white }, 
  content: { padding: 16, backgroundColor: Colors.background }, 
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, lineHeight: 26 }, 
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, 
  stars: { fontSize: 14, color: '#FBBF24', fontWeight: '700' }, 
  reviewCount: { fontSize: 13, color: Colors.primary, fontWeight: '500' }, 
  urgencyRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  urgencyBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDF4CA',
  },
  urgencyBadgeTxt: { fontSize: 12, fontWeight: '600', color: '#B45309' },
  scarcityBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  scarcityBadgeTxt: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bestsellerBadge: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  bestsellerBadgeTxt: { color: '#E53E3E', fontSize: 12, fontWeight: '600' },
  ratingBadge: { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' },
  ratingBadgeTxt: { color: '#B45309', fontSize: 12, fontWeight: '600' },
  deliveryBadge: { backgroundColor: '#F0FFF4', borderColor: '#BBF7D0' },
  deliveryBadgeTxt: { color: '#16A34A', fontSize: 12, fontWeight: '600' },
  sponsoredBadge: { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF', color: '#9333EA', fontSize: 12, fontWeight: '600' },
  priceSection: { marginTop: 16 }, 
  price: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary }, 
  mrp: { fontSize: 14, color: Colors.textMuted, 
    textDecorationLine: 'line-through', marginTop: 2 }, 
  saveBadge: { backgroundColor: Colors.successLight, alignSelf: 'flex-start', 
    paddingHorizontal: 10, paddingVertical: 4, 
    borderRadius: 6, marginTop: 6 }, 
  saveTxt: { color: Colors.success, fontWeight: '700', fontSize: 12 }, 
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', 
    marginTop: 16 }, 
  trustBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: 10, 
    paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }, 
  trustTxt: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' }, 
  freeDeliveryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 12, 
    borderRadius: 8, marginTop: 16, borderWidth: 1, borderColor: '#BFDBFE' }, 
  freeDeliveryTxt: { color: '#1E40AF', fontWeight: '600', fontSize: 13 }, 
  stockStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  inStock: { color: Colors.success, fontWeight: '600', fontSize: 14 }, 
  outStock: { color: '#DC2626', fontWeight: '600', fontSize: 14 }, 
  section: { marginTop: 24, paddingTop: 20, 
    borderTopWidth: 1, borderColor: Colors.border }, 
  sectionTitle: { fontSize: 16, fontWeight: '700', 
    color: Colors.textPrimary, marginBottom: 12 }, 
  desc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 }, 
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'center', marginBottom: 16 }, 
  avgRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avgRatingText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 6,
    fontWeight: '500',
  },
  writeReviewBtn: { backgroundColor: Colors.white, borderWidth: 1, 
    borderColor: Colors.border, paddingHorizontal: 12, 
    paddingVertical: 8, borderRadius: 10 }, 
  writeReviewTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 12 }, 
  noReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noReviews: { color: Colors.textMuted, fontSize: 14 }, 
  beFirstBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  beFirstBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  reviewCard: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 12 }, 
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', 
    marginBottom: 8 }, 
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reviewAuthor: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary }, 
  reviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  reviewText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginTop: 4 }, 
  seeAllReviews: { alignItems: 'center', padding: 12, backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 4 }, 
  seeAllReviewsTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 }, 
  footer: { flexDirection: 'row', alignItems: 'center', 
    padding: 16, borderTopWidth: 1, borderColor: Colors.border, 
    backgroundColor: Colors.white }, 
  qtyRow: { flexDirection: 'row', alignItems: 'center' }, 
  qtyBtn: { width: 40, height: 40, borderRadius: 20, 
    backgroundColor: Colors.inputBackground, 
    justifyContent: 'center', alignItems: 'center' }, 
  qtyBtnTxt: { fontSize: 22, color: Colors.textPrimary, fontWeight: '500' }, 
  qty: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center', color: Colors.textPrimary }, 
  addBtn: { flex: 1, backgroundColor: Colors.primary, padding: 16, 
    borderRadius: 12, alignItems: 'center' }, 
  addBtnTxt: { color: Colors.white, fontSize: 15, fontWeight: '700' }, 
}); 
