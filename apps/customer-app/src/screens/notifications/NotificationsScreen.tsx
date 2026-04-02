import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigationProp } from '../../navigation/types';
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  Notification,
  NotificationCategory,
} from '../../api/notificationsApi';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';

type CategoryFilter = NotificationCategory | 'all';

interface GroupedNotifications {
  title: string;
  data: Notification[];
}

const CATEGORY_FILTERS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'order', label: 'Orders' },
  { key: 'payment', label: 'Payments' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'account', label: 'Account' },
  { key: 'promo', label: 'Promotions' },
];

const getCategoryIcon = (category: NotificationCategory): string => {
  switch (category) {
    case 'order':
      return '📦';
    case 'payment':
      return '💳';
    case 'delivery':
      return '🚚';
    case 'account':
      return '👤';
    case 'promo':
      return '🎉';
    default:
      return '🔔';
  }
};

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

const getGroupTitle = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
};

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  const {
    data: response,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useGetNotificationsQuery({
    limit: 20,
    category: selectedCategory,
  });

  const [markAsRead, { isLoading: isMarkingRead }] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();
  const [deleteNotification, { isLoading: isDeleting }] = useDeleteNotificationMutation();

  // Update items when response changes
  React.useEffect(() => {
    if (response) {
      setItems(response.notifications || []);
      setHasMore(response.hasMore || false);
      setNextCursor(response.nextCursor);
    }
  }, [response]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isFetching) return;
    // For cursor pagination, we'd need a lazy query
    // For simplicity, we'll just show what we have
  }, [hasMore, nextCursor, isFetching]);

  const handleMarkRead = async (notification: any) => {
    // Navigate based on metadata
    if (notification.meta?.orderId) {
      navigation.navigate('OrderDetail', { orderId: notification.meta.orderId });
    }

    if (notification.isRead) return;
    try {
      // Use _id as the primary ID field from backend
      const id = notification._id || notification.id;
      if (!id) {
        return;
      }
      await markAsRead(id).unwrap();
    } catch (error: any) {
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const handleDelete = (notification: any) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const id = notification._id || notification.id;
              if (!id) {
                return;
              }
              await deleteNotification(id).unwrap();
            } catch (e) {}
          },
        },
      ]
    );
  };

  // Group notifications by date
  const groupedNotifications: GroupedNotifications[] = useMemo(() => {
    const groups: { [key: string]: Notification[] } = {};

    items.forEach((item) => {
      const groupTitle = getGroupTitle(item.createdAt);
      if (!groups[groupTitle]) {
        groups[groupTitle] = [];
      }
      groups[groupTitle].push(item);
    });

    const result: GroupedNotifications[] = [];
    ['Today', 'Yesterday', 'Earlier'].forEach((title) => {
      if (groups[title] && groups[title].length > 0) {
        result.push({ title, data: groups[title] });
      }
    });

    return result;
  }, [items]);

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
      onPress={() => handleMarkRead(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.7}
    >
      {!item.isRead && <View style={styles.unreadIndicator} />}

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.categoryIcon, { marginRight: 6 }]}>{getCategoryIcon(item.category)}</Text>
          <Text style={[styles.notificationTitle, !item.isRead && styles.notificationTitleUnread]}>
            {item.title}
          </Text>
        </View>

        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>

        <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderGroup = ({ item: group }: { item: GroupedNotifications }) => (
    <View key={group.title}>
      <Text style={styles.groupTitle}>{group.title}</Text>
      {group.data.map((notification) => (
        <React.Fragment key={notification._id || notification.id}>
          {renderNotification({ item: notification })}
        </React.Fragment>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No notifications</Text>
      <Text style={styles.emptySubtitle}>
        {selectedCategory === 'all'
          ? "You're all caught up!"
          : `No ${selectedCategory} notifications`}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Notifications" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Notifications" showBackButton />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load notifications</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" showBackButton />
      
      {/* Category Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={CATEGORY_FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedCategory === item.key && styles.filterPillActive,
              ]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategory === item.key && styles.filterPillTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Mark All Read Button */}
      {items.some((n) => !n.isRead) && (
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllRead}
          disabled={isMarkingAll}
        >
          {isMarkingAll ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.markAllText}>Mark all as read</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Notifications List */}
      <FlatList
        data={groupedNotifications}
        keyExtractor={(item) => item.title}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[Colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          hasMore ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loadMore} />
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.white,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notificationCardUnread: {
    backgroundColor: Colors.white,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 8,
    marginTop: 6,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryIcon: {
    fontSize: 16,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loadMore: {
    marginVertical: 16,
  },
});

export default NotificationsScreen;
