import React, { useState, useRef, useCallback } from 'react'; 
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Share, Alert, FlatList, useWindowDimensions,
  StatusBar, Platform, Pressable, Animated, Easing,
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useGetProductByIdQuery, useLazyGetSimilarProductsQuery } from '../../api/productsApi';
import { useGetProductReviewsQuery } from '../../api/reviewsApi';
import { useAddToCartMutation } from '../../api/cartApi';
import { useDispatch } from 'react-redux'; 
import { addItem } from '../../store/slices/cartSlice'; 
import { showToast } from '../../store/slices/uiSlice';
import { SmartImage } from '../../components/SmartImage'; 
import { BusinessRules } from '../../constants/businessRules';
import { Colors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { logEvent } from '../../utils/analytics';
import { HomeSearchBar } from '../../components/HomeSearchBar';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import VoiceListeningModal from '../../components/VoiceListeningModal';
import ProductCard from '../../components/ProductCard';

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

// ✅ Modern autoplay video component (Instagram/Reels style) with proper lifecycle management
const VideoItem = React.memo(({ item, width, isActive }: { 
  item: { type: 'video'; url: string; thumbnail?: string; duration?: number }; 
  width: number; 
  isActive: boolean; 
}) => {
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [isPlayerReleased, setIsPlayerReleased] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  // Each video has its own player
  const player = useVideoPlayer(item.url, (p) => {
    try {
      p.loop = true; // 🔁 Infinite loop
      p.muted = true; // 🔇 Muted by default (better UX)
    } catch (e) {
      console.log('[VideoItem] Player setup error:', e);
    }
  });

  // ✅ FIXED: Proper player cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (player && !isPlayerReleased) {
        try {
          setIsPlayerReleased(true);
          player.release();
        } catch (e) {
          console.log('[VideoItem] Player release error:', e);
        }
      }
    };
  }, [player, isPlayerReleased]);

  // ✅ FIXED: Clean autoplay logic with proper null checks and release state tracking
  React.useEffect(() => {
    if (!player || isPlayerReleased) return;
    
    if (isActive) {
      if (!isPausedByUser) {
        try {
          player.play();
        } catch (e) {
          console.log('[VideoItem] Play error:', e);
          // If error suggests player is released, update state
          if (e.message && e.message.includes('released')) {
            setIsPlayerReleased(true);
          }
        }
      }
    } else {
      try {
        player.pause();
      } catch (e) {
        console.log('[VideoItem] Pause error:', e);
        // If error suggests player is released, update state
        if (e.message && e.message.includes('released')) {
          setIsPlayerReleased(true);
        }
      }
    }
  }, [isActive, isPausedByUser, player, isPlayerReleased]);

  // ✅ FIXED: Reset pause state only on unmount
  React.useEffect(() => {
    return () => {
      setIsPausedByUser(false);
    };
  }, []);

  // ✅ FIXED: Tap feedback + pause/resume with pause icon and proper error handling
  const handleToggle = () => {
    if (!player || isPlayerReleased) return;
    
    // Micro feedback animation
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setIsPausedByUser(prev => {
      const next = !prev;
      
      try {
        if (next) {
          player.pause();
          
          // 👇 Show pause icon briefly
          setShowPauseIcon(true);
          setTimeout(() => setShowPauseIcon(false), 800);
        } else {
          player.play();
        }
      } catch (e) {
        console.log('[VideoItem] Toggle error:', e);
        // If error suggests player is released, update state
        if (e.message && e.message.includes('released')) {
          setIsPlayerReleased(true);
        }
      }
      
      return next;
    });
  };

  // Don't render if player is released to prevent further errors
  if (isPlayerReleased) {
    return (
      <View style={[s.mediaItem, { width }]}>
        <View style={s.videoErrorState}>
          <Ionicons name="videocam-off" size={32} color="#666" />
          <Text style={s.videoErrorText}>Video unavailable</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={handleToggle} style={[s.mediaItem, { width }]}>
      <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
        
        {player && (
          <VideoView
            player={player}
            style={s.mediaVideo}
            nativeControls={false}
            contentFit="contain"
          />
        )}
        
        {/* Pause feedback */}
        {showPauseIcon && (
          <View style={s.pauseOverlay}>
            <Ionicons name="pause" size={28} color="#000" />
          </View>
        )}
        
        {/* Video hint */}
        <View style={s.videoHint}>
          <Ionicons name="videocam" size={12} color="#fff" />
        </View>
        
      </Animated.View>
    </Pressable>
  );
});

export default function ProductDetailScreen({ route, navigation }: any) { 
  // Handle both id and productId from navigation params
  const id = route.params?.productId || route.params?.id; 
  const { data: product, isLoading, isError, refetch } = useGetProductByIdQuery(id, { skip: !id }); 
  const dispatch = useDispatch(); 
  const { width } = useWindowDimensions();

  const [qty, setQty] = useState(1); 
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [carouselWidth, setCarouselWidth] = useState(width);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Voice search handlers
  const handleVoiceResult = React.useCallback((text: string) => {
    setVoiceModalVisible(false);
    if (text.trim()) {
      setTimeout(() => {
        navigation.navigate('Search', { initialQuery: text });
      }, 160);
    }
  }, [navigation]);

  const voice = useVoiceSearch(handleVoiceResult);

  const handleMicPress = React.useCallback(async () => {
    setVoiceModalVisible(true);
    await voice.start('ProductDetailScreen mic press');
  }, [voice]);

  const handleVoiceCancel = React.useCallback(() => {
    voice.cancel();
    setVoiceModalVisible(false);
  }, [voice]);

  // Build unified media array (images + video)
  const media = React.useMemo(() => {
    const items: Array<{ type: 'image' | 'video'; url: string; thumbnail?: string; duration?: number }> = [];
    
    // Add images
    if (product?.images?.length) {
      product.images.forEach((img: any) => {
        const url = getImageUrl(img);
        if (url) {
          items.push({ type: 'image', url });
        }
      });
    }
    
    // Add video
    if (product?.video?.url) {
      items.push({
        type: 'video',
        url: product.video.url,
        thumbnail: product.video.thumbnail,
        duration: product.video.duration,
      });
    }
    
    console.log("🔍 MEDIA LENGTH:", items.length);
    console.log("🔍 MEDIA:", items);
    
    return items;
  }, [product]);

  // Handle scroll
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / carouselWidth);
    console.log("� SCROLL X:", offsetX, "| Index:", index, "| Expected max:", carouselWidth * (media.length - 1));
    setCurrentMediaIndex(index);
    scrollX.setValue(offsetX);
  }; 
 
  const { data: reviewsData } = useGetProductReviewsQuery( 
    { productId: id }, { skip: !id }); 
  const [getSimilar, { data: similarData }] = useLazyGetSimilarProductsQuery();
  const [addToCart, { isLoading: addingToCart }] = useAddToCartMutation(); 

  React.useEffect(() => {
    if (id) {
      getSimilar({ id, limit: 6 });
    }
  }, [id, getSimilar]);
 
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

  const getMediaUrl = (item: any): string | undefined => {
    if (!item) return undefined;
    if (typeof item === 'string') return item;
    return item.url || item.uri || getImageUrl(item);
  };
 
  const handleShare = async () => { 
    await Share.share({ 
      message: `Check out ${product.name} on Vyapara Setu for just ₹${product.price}!\nDownload: https://vyaparsetu.in`, 
      title: product.name, 
    }); 
  }; 
 
  const handleAddToCart = async () => { 
    // Validate product availability
    if (!product || product.stock === 0) {
      Alert.alert(
        'Unavailable',
        product?.stock === 0 
          ? 'This product is currently out of stock.' 
          : 'This product is no longer available.',
        [{ text: 'OK' }]
      );
      return;
    }

    const firstImage = product.images?.[0];
    const imageUrl = getMediaUrl(firstImage);

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

  // Render media item
  const renderMediaItem = (item: typeof media[0], index: number) => {
    if (item.type === 'image') {
      return (
        <View key={`image-${item.url}-${index}`} style={[s.mediaItem, { width: carouselWidth }]}>
          <SmartImage 
            uri={item.url} 
            style={s.mediaImage} 
          />
        </View>
      );
    }

    if (item.type === 'video') {
      return (
        <VideoItem 
          key={`video-${item.url}-${index}`}
          item={item as { type: 'video'; url: string; thumbnail?: string; duration?: number }} 
          width={carouselWidth} 
          isActive={currentMediaIndex === index}
        />
      );
    }

    return null;
  };

  const carouselHeight = carouselWidth; // Square aspect ratio like Flipkart 
  const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView); 

  // Render carousel
  const renderCarousel = () => (
    <View 
      style={[s.mediaCarouselContainer, { height: carouselHeight }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        console.log("✅ ACTUAL CAROUSEL WIDTH:", w);
        if (w !== carouselWidth) {
          setCarouselWidth(w);
        }
      }}
    >
      <AnimatedScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        snapToInterval={carouselWidth}
        snapToAlignment="center"
        contentContainerStyle={{ width: carouselWidth * media.length }}
      >
        {media.map((item, index) => renderMediaItem(item, index))}
      </AnimatedScrollView>

      {/* Pagination Dots - Animated Wave Effect */}
      {media.length > 1 && (
        <View style={s.paginationDots}>
          {media.map((_, index) => {
            const inputRange = [
              (index - 1) * carouselWidth,
              index * carouselWidth,
              (index + 1) * carouselWidth,
            ];

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [1, 1.8, 1],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            const widthAnim = scrollX.interpolate({
              inputRange,
              outputRange: [5, 12, 5],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  s.dot,
                  {
                    opacity,
                    transform: [{ scale }],
                    width: widthAnim,
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );

  // Render product info
  const renderProductInfo = () => (
    <View style={s.productInfo}> 
      {/* Title */}
      <Text style={s.name}>{product.name}</Text> 

      {/* Brand (clickable blue text) */}
      <TouchableOpacity onPress={() => {}}>
        <Text style={s.brand}>Visit the Store</Text>
      </TouchableOpacity>

      {/* Rating Row + Bestseller Badge */}
      <View style={s.ratingBadgeRow}>
        {avgRating && ( 
          <TouchableOpacity style={s.ratingRow} onPress={() => {}}> 
            <Text style={s.stars}>{avgRating}</Text>
            <Ionicons name="star" size={12} color="#FFA41C" style={{ marginLeft: 2, marginRight: 4 }} />
            <Text style={s.reviewCount}>({reviews.length})</Text> 
          </TouchableOpacity> 
        )}
        {product.isBestseller && (
          <View style={s.bestsellerBadge}>
            <Text style={s.bestsellerBadgeTxt}>#1 Best Seller</Text>
          </View>
        )}
      </View>

      {/* Price Section - Amazon Style */}
      <View style={s.priceSection}> 
        <View style={s.priceRow}>
          {product.mrp > product.price && (
            <Text style={s.discountPercent}>-{discount}%</Text>
          )}
          <Text style={s.price}>₹{product.price.toLocaleString('en-IN')}</Text> 
        </View>
        {product.mrp > product.price && ( 
          <View style={s.mrpRow}>
            <Text style={s.mrpLabel}>M.R.P.: </Text>
            <Text style={s.mrp}>₹{product.mrp.toLocaleString('en-IN')}</Text> 
          </View>
        )} 
      </View> 

      {/* Small Badges - Compact */}
      <View style={s.badgesRow}>
        {product.price >= BusinessRules.FREE_DELIVERY_THRESHOLD && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>FREE Delivery</Text>
          </View>
        )}
        {product.stock > 0 && product.stock <= 10 && (
          <View style={[s.badge, s.urgentBadge]}>
            <Text style={s.urgentBadgeTxt}>Only {product.stock} left</Text>
          </View>
        )}
      </View>

      {/* Trust Row - Inline Icons */}
      <View style={s.trustRow}> 
        <View style={s.trustItem}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#007185" />
          <Text style={s.trustTxt}>Secure Pay</Text>
        </View>
        <View style={s.trustDivider} />
        <View style={s.trustItem}>
          <Ionicons name="refresh-outline" size={16} color="#007185" />
          <Text style={s.trustTxt}>Easy Returns</Text>
        </View>
        <View style={s.trustDivider} />
        <View style={s.trustItem}>
          <Ionicons name="flash-outline" size={16} color="#007185" />
          <Text style={s.trustTxt}>Fast Delivery</Text>
        </View>
      </View> 

      {/* Stock Status - Small Green Text */}
      {product.stock > 0 ? (
        <Text style={s.inStock}>In Stock</Text> 
      ) : (
        <Text style={s.outStock}>Currently unavailable</Text>
      )}

      {/* Description - Compact */}
      {product.description && ( 
        <View style={s.section}> 
          <Text style={s.sectionTitle}>About this item</Text> 
          <Text style={s.desc}>{product.description}</Text> 
        </View> 
      )} 

      {/* Reviews */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Customer reviews</Text>
        
        {avgRating && (
          <View style={s.reviewSummary}>
            <Text style={s.avgRating}>{avgRating}</Text>
            <View style={s.starsColumn}>
              <View style={s.starsRow}>
                {[1,2,3,4,5].map(star => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(Number(avgRating)) ? "star" : "star-outline"}
                    size={14}
                    color="#FFA41C"
                  />
                ))}
              </View>
              <Text style={s.reviewCountText}>{reviews.length} ratings</Text>
            </View>
          </View>
        )}

        {reviews.length === 0 ? (
          <Text style={s.noReviews}>No reviews yet</Text>
        ) : (
          <>
            {reviews.slice(0, 5).map((review: any) => (
              <View key={review._id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <View style={s.reviewAvatar}>
                    <Text style={s.reviewAvatarText}>
                      {(review.userName || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reviewAuthor}>{review.userName || 'Customer'}</Text>
                    <View style={s.reviewStarRow}>
                      {[1,2,3,4,5].map(star => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? "star" : "star-outline"}
                          size={12}
                          color="#FFA41C"
                        />
                      ))}
                      <Text style={s.reviewDate}>
                        {' '}{new Date(review.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={s.reviewText}>{review.comment}</Text>
              </View>
            ))}

            {reviews.length > 5 && (
              <TouchableOpacity
                style={s.seeAllReviews}
                onPress={() => navigation.navigate('AllReviews', {
                  productId: id,
                  productName: product.name,
                })}
              >
                <Text style={s.seeAllReviewsTxt}>
                  See all {reviews.length} reviews
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Similar Products Section */}
      {similarData?.products && Array.isArray(similarData.products) && similarData.products.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Similar Products</Text>
          <FlatList
            data={similarData.products}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyExtractor={(item: any) => item._id}
            renderItem={({ item }) => (
              <View style={{ width: 160, marginRight: 12 }}>
                <ProductCard
                  product={item}
                  onPress={() => navigation.push('ProductDetail', { productId: item._id })}
                  onAddToCart={() => {
                    dispatch(addItem({ 
                      productId: item._id, 
                      name: item.name, 
                      price: item.price, 
                      quantity: 1, 
                      image: getMediaUrl(item.images?.[0]) 
                    }));
                    dispatch(showToast(`${item.name} added to cart`));
                  }}
                />
              </View>
            )}
          />
        </View>
      )}
    </View> 
  );
 
  return ( 
    <View style={s.container}> 
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
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

      {/* Header matching Home Screen */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBackBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <HomeSearchBar
            navigation={navigation}
            placeholder="Search or ask a question"
            variant="header"
            onMicPress={handleMicPress}
            voiceState={voice.state}
          />
        </View>
      </SafeAreaView>
      
      {/* Main ScrollView with carousel and product info */}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {renderCarousel()}
        {renderProductInfo()}
      </ScrollView>
 
      {/* Sticky Bottom Bar - Amazon Style */}
      {product.stock > 0 ? ( 
        <View style={s.footer}> 
          <View style={s.qtyRow}> 
            <TouchableOpacity 
              style={s.qtyBtn} 
              onPress={() => setQty(q => Math.max(1, q - 1))} 
            > 
              <Text style={s.qtyBtnTxt}>−</Text> 
            </TouchableOpacity> 
            <Text style={s.qty}>{qty}</Text> 
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
              <Text style={s.addBtnTxt}>Add to Cart</Text> 
            )}
          </TouchableOpacity> 
        </View>
      ) : (
        <View style={s.footer}>
          <View style={s.outOfStockFooter}>
            <Ionicons name="close-circle" size={20} color="#B12704" style={{ marginRight: 8 }} />
            <Text style={s.outOfStockFooterText}>Out of Stock</Text>
          </View>
          <TouchableOpacity 
            style={s.notifyBtn}
            onPress={() => {
              dispatch(showToast('We\'ll notify you when this product is back in stock'));
            }}
          >
            <Text style={s.notifyBtnTxt}>Notify Me</Text>
          </TouchableOpacity>
        </View>
      )} 
    </View> 
  ); 
} 
 
const s = StyleSheet.create({ 
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  }, 
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
  
  // Header matching Home Screen
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    minHeight: 56,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerBackBtn: {
    padding: 4,
  },
  
  // Full-Width Image Carousel - White Background
  mediaCarouselContainer: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E6E6',
  },
  mediaItem: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  pauseOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  videoHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 4,
    borderRadius: 6,
    zIndex: 3,
  },
  videoErrorState: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  videoErrorText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#000',
    marginHorizontal: 3,
  },
  
  // Product Info - White Background, No Card
  productInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 100,
  }, 
  
  // Title
  name: { 
    fontSize: 15, 
    fontWeight: '400', 
    color: '#0F1111', 
    lineHeight: 20,
    marginBottom: 4,
  }, 
  
  // Brand
  brand: {
    fontSize: 13,
    color: '#007185',
    fontWeight: '400',
    marginBottom: 8,
  },
  
  // Rating + Bestseller Badge Row
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  ratingRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginRight: 12,
  }, 
  stars: { 
    fontSize: 13, 
    color: '#111', 
    fontWeight: '400',
  }, 
  reviewCount: { 
    fontSize: 13, 
    color: '#007185', 
    fontWeight: '400',
    marginLeft: 4,
  }, 
  bestsellerBadge: {
    backgroundColor: '#FF9900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  bestsellerBadgeTxt: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: '600',
  },
  
  // Price Section - Amazon Style
  priceSection: { 
    marginBottom: 12,
  }, 
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountPercent: {
    fontSize: 14,
    fontWeight: '400',
    color: '#CC0C39',
    marginRight: 6,
  },
  price: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: '#0F1111',
  }, 
  mrpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  mrpLabel: {
    fontSize: 13,
    color: '#565959',
    fontWeight: '400',
  },
  mrp: { 
    fontSize: 13, 
    color: '#565959', 
    textDecorationLine: 'line-through',
    fontWeight: '400',
  }, 
  
  // Small Badges - Compact
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    backgroundColor: '#F0F2F2',
  },
  badgeTxt: {
    fontSize: 11,
    fontWeight: '400',
    color: '#111',
  },
  urgentBadge: {
    backgroundColor: '#FEF2F2',
  },
  urgentBadgeTxt: {
    fontSize: 11,
    fontWeight: '400',
    color: '#DC2626',
  },
  
  // Trust Row - Inline Icons
  trustRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E3E6E6',
    marginBottom: 12,
  }, 
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  trustDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E3E6E6',
  },
  trustTxt: { 
    fontSize: 11, 
    color: '#007185', 
    fontWeight: '400',
    marginLeft: 4,
  }, 
  
  // Stock Status - Small Green Text
  inStock: { 
    color: '#007600', 
    fontWeight: '400', 
    fontSize: 14,
    marginBottom: 16,
  }, 
  outStock: { 
    color: '#B12704', 
    fontWeight: '400', 
    fontSize: 14,
    marginBottom: 16,
  }, 
  
  // Description - Compact
  section: { 
    marginTop: 16,
    paddingTop: 16, 
    borderTopWidth: 1, 
    borderColor: '#E3E6E6',
  }, 
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#111', 
    marginBottom: 8,
  }, 
  desc: { 
    fontSize: 13, 
    color: '#111', 
    lineHeight: 19,
    fontWeight: '400',
  }, 
  
  // Reviews - Amazon Style
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avgRating: {
    fontSize: 48,
    fontWeight: '400',
    color: '#111',
    marginRight: 16,
  },
  starsColumn: {
    flex: 1,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  reviewCountText: {
    fontSize: 13,
    color: '#007185',
    fontWeight: '400',
  },
  noReviews: { 
    color: '#565959', 
    fontSize: 13,
    fontWeight: '400',
  }, 
  reviewCard: { 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E3E6E6',
  }, 
  reviewHeader: { 
    flexDirection: 'row', 
    marginBottom: 8,
  }, 
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },
  reviewAuthor: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#111',
  }, 
  reviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#565959',
    marginLeft: 6,
    fontWeight: '400',
  },
  reviewText: { 
    fontSize: 13, 
    color: '#111', 
    lineHeight: 19,
    fontWeight: '400',
  }, 
  seeAllReviews: { 
    paddingVertical: 12,
  }, 
  seeAllReviewsTxt: { 
    color: '#007185', 
    fontWeight: '400', 
    fontSize: 13,
  }, 
  
  // Sticky Bottom Bar - Amazon Style
  footer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12,
    borderTopWidth: 1, 
    borderColor: '#E3E6E6', 
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  }, 
  qtyRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginRight: 12,
  }, 
  qtyBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 4,
    backgroundColor: '#F0F2F2', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5D9D9',
  }, 
  qtyBtnTxt: { 
    fontSize: 18, 
    color: '#111', 
    fontWeight: '400',
  }, 
  qty: { 
    fontSize: 16, 
    fontWeight: '400', 
    minWidth: 32, 
    textAlign: 'center', 
    color: '#111',
    marginHorizontal: 12,
  }, 
  addBtn: { 
    flex: 1, 
    backgroundColor: '#FFA41C', 
    paddingVertical: 14,
    borderRadius: 8, 
    alignItems: 'center',
  }, 
  addBtnTxt: { 
    color: '#111', 
    fontSize: 14, 
    fontWeight: '700',
  },
  
  // Out of Stock Footer
  outOfStockFooter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  outOfStockFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B12704',
  },
  notifyBtn: {
    flex: 1,
    backgroundColor: '#F0F2F2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5D9D9',
  },
  notifyBtnTxt: {
    color: '#111',
    fontSize: 14,
    fontWeight: '600',
  },
}); 
