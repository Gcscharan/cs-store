import React from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useGetOrdersQuery } from '../../api/ordersApi';
import type { OrdersNavigationProp } from '../../navigation/types';
import type { Order } from '../../types';

const mapDbToFriendly = (dbStatus?: string): string => {
  const s = String(dbStatus || '').toUpperCase();
  if (['CREATED', 'PENDING', 'PENDING_PAYMENT'].includes(s)) return 'Pending';
  if (['CONFIRMED', 'PROCESSING'].includes(s)) return 'Confirmed';
  if (['PACKED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s)) return 'On the way';
  if (s === 'DELIVERED') return 'Delivered';
  if (['CANCELLED', 'CANCELED', 'FAILED'].includes(s)) return 'Cancelled';
  return 'Pending';
};

const badgeStyle = (friendly: string) => {
  const s = friendly;
  if (s === 'Pending') return { bg: '#FFF7ED', text: '#EA580C', icon: 'time-outline' };
  if (s === 'Confirmed') return { bg: '#EFF6FF', text: '#2563EB', icon: 'checkmark-circle-outline' };
  if (s === 'On the way') return { bg: '#F5F3FF', text: '#7C3AED', icon: 'bicycle-outline' };
  if (s === 'Delivered') return { bg: '#F0FDF4', text: '#16A34A', icon: 'checkmark-done-circle-outline' };
  if (s === 'Cancelled') return { bg: '#FEF2F2', text: '#DC2626', icon: 'close-circle-outline' };
  return { bg: '#F3F4F6', text: '#6B7280', icon: 'ellipse-outline' };
};

const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (amount: number | string) => {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
};

// Optimized Order Card Component
const OrderCard = React.memo(({ item, onPress }: { item: any; onPress: (id: string) => void }) => {
  const friendly = mapDbToFriendly(item.orderStatus || item.status);
  const badge = badgeStyle(friendly);
  const itemsCount = Array.isArray(item.items) ? item.items.length : 0;
  const shortId = typeof item?.orderId === 'string' ? item.orderId.slice(-8).toUpperCase() : (typeof item?._id === 'string' ? item._id.slice(-8).toUpperCase() : 'N/A');
  const created = item?.createdAt || item?.updatedAt;
  
  const firstItem = Array.isArray(item.items) ? item.items[0] : null;
  const populated = typeof firstItem?.product === 'object' ? firstItem.product : (typeof firstItem?.productId === 'object' ? firstItem.productId : null);
  const firstName = firstItem?.name || populated?.name || 'Items inside package';
  const rawImage = firstItem?.image || populated?.images?.[0] || populated?.image;
  const firstImage = typeof rawImage === 'string' && rawImage.trim().length > 0 ? rawImage.trim() : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        }
      ]}
      onPress={() => onPress(String(item.orderId || item._id))}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIconBox}>
          <Feather name="package" size={20} color={badge.text} />
        </View>
        <View style={styles.cardHeaderFill}>
          <Text style={styles.productTitle} numberOfLines={1}>{firstName}</Text>
          <Text style={styles.orderDate}>{formatDate(created)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBody}>
        {firstImage ? (
          <Image source={{ uri: firstImage }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Feather name="shopping-bag" size={20} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.itemMeta}>
          <Text style={styles.itemTotal}>{formatCurrency(item.totalAmount)}</Text>
          {itemsCount > 1 && (
            <Text style={styles.itemCountExtra}>+ {itemsCount - 1} more item{itemsCount - 1 > 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon as any} size={14} color={badge.text} style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>{friendly}</Text>
        </View>

        {friendly === 'On the way' ? (
          <TouchableOpacity 
            style={styles.trackBtn} 
            onPress={() => onPress(String(item.orderId || item._id))}
          >
            <Text style={styles.trackBtnText}>Live Track</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.detailsGhostBtn}
            onPress={() => onPress(String(item.orderId || item._id))}
          >
            <Text style={styles.detailsGhostText}>View Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<OrdersNavigationProp>();
  const { data, isFetching, refetch } = useGetOrdersQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const orders: Order[] = (data as any)?.orders || [];

  const pulse = React.useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const dataToRender: Array<any> = isFetching && orders.length === 0
    ? Array.from({ length: 4 }).map((_, idx) => ({ __skeleton: true, key: `s-${idx}` }))
    : orders;

  const handleOrderPress = React.useCallback((orderId: string) => {
    navigation.navigate('OrderDetail', { orderId });
  }, [navigation]);

  const renderItem = React.useCallback(({ item }: { item: any }) => {
    if (item?.__skeleton) {
      return (
        <View style={[styles.card, { padding: 16 }]}>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
             <Animated.View style={[styles.skelAvatar, { opacity: pulse, marginRight: 12 }]} />
             <View style={{ flex: 1 }}>
               <Animated.View style={[styles.skelLine, { height: 16, width: '40%', opacity: pulse, marginBottom: 8 }]} />
               <Animated.View style={[styles.skelLine, { height: 12, width: '60%', opacity: pulse }]} />
             </View>
          </View>
          <Animated.View style={[styles.skelLine, { height: 1, width: '100%', marginBottom: 16, opacity: pulse }]} />
          <View style={{ flexDirection: 'row' }}>
             <Animated.View style={[styles.skelImage, { opacity: pulse, marginRight: 12 }]} />
             <View style={{ flex: 1, justifyContent: 'center' }}>
               <Animated.View style={[styles.skelLine, { height: 14, width: '80%', opacity: pulse, marginBottom: 8 }]} />
               <Animated.View style={[styles.skelLine, { height: 14, width: '30%', opacity: pulse }]} />
             </View>
          </View>
        </View>
      );
    }
    return <OrderCard item={item} onPress={handleOrderPress} />;
  }, [handleOrderPress, pulse]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Orders" />

      <FlatList
        data={dataToRender}
          keyExtractor={(item: any, i: number) => (item?.__skeleton ? String(item.key) : String(item._id || item.orderId || i))}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.primary} />}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Feather name="package" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>You haven't placed any orders in this category yet. Start exploring our store!</Text>
              <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })} activeOpacity={0.9}>
                <Text style={styles.shopBtnText}>Browse Products</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderItem}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderFill: { flex: 1 },
  productTitle: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary, marginBottom: 4, letterSpacing: -0.3 },
  orderDate: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  
  cardDivider: { height: 1, backgroundColor: '#F3F4F6' },
  
  cardBody: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginRight: 14,
  },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemMeta: { flex: 1, justifyContent: 'center' },
  itemCountExtra: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },
  itemTotal: { fontSize: 16, color: Colors.textPrimary, fontWeight: '800' },
  
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: { fontWeight: '700', fontSize: 13 },
  
  trackBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  trackBtnText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  
  detailsGhostBtn: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailsGhostText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },

  // Empty State
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  emptySubtitle: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  shopBtn: { backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  shopBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  
  // Skeleton
  skelLine: { backgroundColor: '#F3F4F6', borderRadius: 6 },
  skelAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6' },
  skelImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F3F4F6' },
});

export default OrdersScreen;
