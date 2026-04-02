import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import {
  useGetProductReviewsQuery,
  useDeleteReviewMutation,
  Review,
} from '../../api/reviewsApi';
import type { RootState } from '../../store';

const FILTER_OPTIONS = [
  { label: 'All', value: 0 },
  { label: '5 ★', value: 5 },
  { label: '4 ★', value: 4 },
  { label: '3 ★', value: 3 },
  { label: '2 ★', value: 2 },
  { label: '1 ★', value: 1 },
];

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const StarRow = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Ionicons
        key={star}
        name={star <= rating ? 'star' : 'star-outline'}
        size={size}
        color={star <= rating ? '#f59e0b' : Colors.border}
        style={{ marginRight: star === 5 ? 0 : 2 }}
      />
    ))}
  </View>
);

const RatingBar = ({
  star,
  count,
  total,
}: {
  star: number;
  count: number;
  total: number;
}) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={rb.row}>
      <Text style={rb.label}>{star} ★</Text>
      <View style={rb.track}>
        <View style={[rb.fill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={rb.count}>{count}</Text>
    </View>
  );
};

const rb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    width: 30,
    textAlign: 'right',
    marginRight: 8,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.backgroundDark,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  count: {
    fontSize: 12,
    color: Colors.textMuted,
    width: 24,
  },
});

export default function AllReviewsScreen({ route, navigation }: any) {
  const { productId, productName } = route.params;
  const { user } = useSelector((s: RootState) => s.auth);

  const [filterRating, setFilterRating] = useState(0);
  const [page, setPage] = useState(1);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const LIMIT = 15;

  const { data, isLoading, isFetching, refetch, error } = useGetProductReviewsQuery({
    productId,
    page,
    limit: LIMIT,
  });

  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  // Accumulate reviews across pages
  React.useEffect(() => {
    if (data?.reviews) {
      if (page === 1) {
        setAllReviews(data.reviews);
      } else {
        setAllReviews((prev) => [...prev, ...data.reviews]);
      }
    }
  }, [data, page]);

  const hasMore = data ? allReviews.length < data.total : false;

  const filteredReviews = useMemo(() => {
    if (filterRating === 0) return allReviews;
    return allReviews.filter((r) => r.rating === filterRating);
  }, [allReviews, filterRating]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isFetching && filterRating === 0) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isFetching, filterRating]);

  const handleRefresh = useCallback(() => {
    setPage(1);
    setAllReviews([]);
    refetch();
  }, [refetch]);

  const handleDelete = (review: Review) => {
    Alert.alert('Delete Review', 'Are you sure you want to delete your review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReview({ productId, reviewId: review._id }).unwrap();
            setAllReviews((prev) => prev.filter((r) => r._id !== review._id));
          } catch {
            Alert.alert('Error', 'Failed to delete review. Please try again.');
          }
        },
      },
    ]);
  };

  const handleEdit = (review: Review) => {
    navigation.navigate('WriteReview', {
      productId,
      productName,
      existingReview: {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
      },
    });
  };

  const avgRating = data?.averageRating
    ? data.averageRating
    : allReviews.length
    ? allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length
    : 0;

  const breakdown = data?.ratingBreakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // ── Render helpers ─────────────────────────────────────────
  const renderReview = ({ item }: { item: Review }) => {
    const isOwn = user && item.userId === (user as any)?._id;
    return (
      <View style={s.reviewCard}>
        <View style={s.reviewTop}>
          {/* Avatar */}
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(item.userName || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.reviewMeta}>
              <Text style={s.reviewerName}>{item.userName || 'Customer'}</Text>
              {isOwn && (
                <View style={s.ownBadge}>
                  <Text style={s.ownBadgeText}>Your review</Text>
                </View>
              )}
            </View>
            <View style={s.reviewSubMeta}>
              <StarRow rating={item.rating} />
              <Text style={s.reviewDate}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
          {/* Own review actions */}
          {isOwn && (
            <View style={s.ownActions}>
              <TouchableOpacity
                onPress={() => handleEdit(item)}
                style={s.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={s.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={isDeleting}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={s.reviewComment}>{item.comment}</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Rating summary */}
      <View style={s.summaryCard}>
        <View style={s.summaryLeft}>
          <Text style={s.bigRating}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
          <StarRow rating={Math.round(avgRating)} size={18} />
          <Text style={s.totalCount}>{data?.total ?? allReviews.length} reviews</Text>
        </View>
        <View style={s.summaryRight}>
          {[5, 4, 3, 2, 1].map((star) => (
            <RatingBar
              key={star}
              star={star}
              count={(breakdown as any)[star] ?? 0}
              total={data?.total ?? allReviews.length}
            />
          ))}
        </View>
      </View>

      {/* Filter pills */}
      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => String(item.value)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.filterPill, filterRating === item.value && s.filterPillActive]}
            onPress={() => setFilterRating(item.value)}
          >
            <Text
              style={[
                s.filterPillText,
                filterRating === item.value && s.filterPillTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={s.listHeading}>
        {filterRating === 0
          ? `All ${data?.total ?? allReviews.length} reviews`
          : `${filteredReviews.length} reviews with ${filterRating} star`}
      </Text>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={s.emptyContainer}>
        <Ionicons name="chatbubble-outline" size={48} color={Colors.textMuted} />
        <Text style={s.emptyTitle}>No reviews yet</Text>
        <Text style={s.emptySubtitle}>Be the first to share your experience!</Text>
        <TouchableOpacity
          style={s.writeFirstBtn}
          onPress={() => navigation.navigate('WriteReview', { productId, productName })}
        >
          <Text style={s.writeFirstBtnText}>Write a Review</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Error state ───────────────────────────────────────────
  if (error && allReviews.length === 0) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Reviews" showBackButton />
        <View style={s.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={s.errorText}>Failed to load reviews</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleRefresh}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScreenHeader 
        title="Reviews" 
        showBackButton 
        rightComponent={
          <TouchableOpacity
            style={s.writeBtnHeader}
            onPress={() => navigation.navigate('WriteReview', { productId, productName })}
          >
            <Ionicons name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        }
      />

      {isLoading && page === 1 ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => item._id}
          renderItem={renderReview}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={s.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && page === 1}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={
            isFetching && page > 1 ? (
              <View style={s.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  writeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  writeBtnHeader: {
    padding: 8,
    marginRight: -8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  // Summary card
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    marginRight: 16,
  },
  bigRating: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 40,
    marginBottom: 4,
  },
  totalCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  summaryRight: {
    flex: 1,
    justifyContent: 'center',
  },
  // Filters
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  listHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 16,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 40,
  },
  reviewCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E95C1E',
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  ownBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownBadgeText: {
    fontSize: 10,
    color: '#2e7d32',
    fontWeight: '700',
  },
  reviewSubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  ownActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionBtn: {
    padding: 4,
    marginLeft: 12,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  writeFirstBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  writeFirstBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
