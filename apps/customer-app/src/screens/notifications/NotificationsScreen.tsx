import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigationProp } from '../../navigation/types';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  Notification,
  NotificationCategory,
} from '../../api/notificationsApi';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { socketClient, NotificationNewData, NotificationSyncData } from '../../services/socketClient';

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

// Premium category theming for notification cards (Ionicons + accent + soft bg)
const CATEGORY_VISUAL: Record<string, { icon: string; accent: string; bg: string }> = {
  order: { icon: 'cube', accent: '#FF6A00', bg: '#FFF1E6' },
  delivery: { icon: 'bicycle', accent: '#2563EB', bg: '#E8F0FE' },
  payment: { icon: 'card', accent: '#16A34A', bg: '#E7F7EE' },
  account: { icon: 'shield-checkmark', accent: '#7C3AED', bg: '#F1E9FE' },
  promo: { icon: 'pricetag', accent: '#DB2777', bg: '#FCE7F1' },
  default: { icon: 'notifications', accent: '#FF6A00', bg: '#FFF1E6' },
};

const getCategoryVisual = (category: NotificationCategory) =>
  CATEGORY_VISUAL[category] || CATEGORY_VISUAL.default;

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewPill, setShowNewPill] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const newItemAnims = useRef<Map<string, Animated.Value>>(new Map()).current;

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

  const { data: unreadData } = useGetUnreadCountQuery();

  const [markAsRead, { isLoading: isMarkingRead }] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();
  const [deleteNotification, { isLoading: isDeleting }] = useDeleteNotificationMutation();

  // Update items when response changes and persist to local cache
  useEffect(() => {
    if (response) {
      setItems(response.notifications || []);
      setHasMore(response.hasMore || false);
      setNextCursor(response.nextCursor);

      // Cache notifications in AsyncStorage for offline access
      if (response.notifications && response.notifications.length > 0) {
        const toCache: NotificationNewData[] = response.notifications.map((n) => ({
          id: n.id || n._id || '',
          _id: n._id || n.id || '',
          title: n.title,
          body: n.body,
          category: n.category,
          priority: n.priority,
          deepLink: n.deepLink,
          createdAt: n.createdAt,
          eventType: n.eventType,
          meta: n.meta,
          isRead: n.isRead,
        }));
        socketClient.cacheNotifications(toCache);

        // Update lastSeenTimestamp from the most recent notification
        const newest = response.notifications[0];
        if (newest?.createdAt) {
          // Access the private method through the public interface isn't ideal,
          // so we just update via the socketClient's internal tracking on next notification:new event
        }
      }
    }
  }, [response]);

  // Sync unread count from server
  useEffect(() => {
    if (unreadData) {
      setUnreadCount(unreadData.count);
    }
  }, [unreadData]);

  // Load cached notifications on mount for immediate display
  useEffect(() => {
    const loadCached = async () => {
      const cached = await socketClient.getCachedNotifications();
      if (cached.length > 0 && items.length === 0) {
        const mapped: Notification[] = cached.map((n) => ({
          id: n.id || n._id || '',
          _id: n._id || n.id || '',
          title: n.title,
          body: n.body,
          category: (n.category as NotificationCategory) || 'order',
          priority: (n.priority as any) || 'normal',
          isRead: n.isRead ?? false,
          deepLink: n.deepLink,
          createdAt: n.createdAt || new Date().toISOString(),
          eventType: n.eventType,
          meta: n.meta,
        }));
        setItems(mapped);
      }
    };
    loadCached();
  }, []);

  // AppState listener: on app foreground, check socket connection and trigger reconnect/sync
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — check socket and request sync
        if (!socketClient.isConnected) {
          socketClient.connect().then(() => {
            // requestSync is auto-called on connect via the connect handler
          });
        } else {
          // Already connected but may have missed notifications while in background
          socketClient.requestSync();
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Socket.IO listener for notification:sync events (offline recovery)
  useEffect(() => {
    const unsubscribe = socketClient.subscribeToNotificationSync(async (data: NotificationSyncData) => {
      if (!data.notifications || data.notifications.length === 0) {
        // Just update unread count from server
        setUnreadCount(data.totalUnread);
        return;
      }

      // Merge server sync with local cache
      const merged = await socketClient.mergeSyncWithCache(data);

      // Apply category filter if active
      const filtered = selectedCategory === 'all'
        ? merged
        : merged.filter((n) => n.category === selectedCategory);

      const mappedNotifications: Notification[] = filtered.map((n) => ({
        id: n.id || n._id || '',
        _id: n._id || n.id || '',
        title: n.title,
        body: n.body,
        category: (n.category as NotificationCategory) || 'order',
        priority: (n.priority as any) || 'normal',
        isRead: n.isRead ?? false,
        deepLink: n.deepLink,
        createdAt: n.createdAt || new Date().toISOString(),
        eventType: n.eventType,
        meta: n.meta,
      }));

      // Merge with current items, server state takes precedence for read/unread
      setItems((prev) => {
        const serverMap = new Map<string, Notification>();
        for (const notif of mappedNotifications) {
          serverMap.set(notif._id || notif.id, notif);
        }

        // Update existing items with server state, add new ones
        const updatedExisting = prev.map((item) => {
          const id = item._id || item.id;
          const serverVersion = serverMap.get(id);
          if (serverVersion) {
            serverMap.delete(id); // Mark as processed
            return serverVersion; // Server state takes precedence
          }
          return item;
        });

        // Add new notifications from server that weren't in local list
        const newItems = Array.from(serverMap.values());
        const combined = [...newItems, ...updatedExisting];

        // Sort newest first
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return combined;
      });

      // Update unread count from server (authoritative)
      setUnreadCount(data.totalUnread);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategory]);

  // Socket.IO listener for notification:new events
  useEffect(() => {
    const unsubscribe = socketClient.subscribeToNewNotifications((data: NotificationNewData) => {
      const newNotification: Notification = {
        id: data.id || data._id || '',
        _id: data._id || data.id || '',
        title: data.title,
        body: data.body,
        category: (data.category as NotificationCategory) || 'order',
        priority: (data.priority as any) || 'normal',
        isRead: false,
        deepLink: data.deepLink,
        createdAt: data.createdAt || new Date().toISOString(),
        eventType: data.eventType,
        meta: data.meta,
      };

      // If a category filter is applied and notification doesn't match, skip prepend
      if (selectedCategory !== 'all' && newNotification.category !== selectedCategory) {
        // Still increment unread count
        setUnreadCount((prev) => prev + 1);
        return;
      }

      // Create fade-in animation for the new notification
      const notifId = newNotification._id || newNotification.id;
      const fadeAnim = new Animated.Value(0);
      newItemAnims.set(notifId, fadeAnim);

      // Prepend to local list
      setItems((prev) => [newNotification, ...prev]);

      // Optimistically increment unread count
      setUnreadCount((prev) => prev + 1);

      // Animate the new entry
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Cleanup animation value after completion
        setTimeout(() => newItemAnims.delete(notifId), 500);
      });

      // If user is scrolled down, show "New notification" pill
      if (isScrolledDown) {
        setShowNewPill(true);
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategory, isScrolledDown]);

  // Track scroll position to determine if user is scrolled down
  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setIsScrolledDown(offsetY > 100);
  }, []);

  // Handle "New notification" pill tap — scroll to top
  const handleNewPillPress = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowNewPill(false);
    Animated.timing(pillOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pillOpacity]);

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

  const renderNotification = ({ item }: { item: Notification }) => {
    const notifId = item._id || item.id;
    const fadeAnim = newItemAnims.get(notifId);
    const visual = getCategoryVisual(item.category);

    const content = (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
        onPress={() => handleMarkRead(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        {/* Category icon avatar */}
        <View style={[styles.iconAvatar, { backgroundColor: visual.bg }]}>
          <Ionicons name={visual.icon as any} size={20} color={visual.accent} />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[styles.notificationTitle, !item.isRead && styles.notificationTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: visual.accent }]} />}
          </View>

          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>

          <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );

    // Wrap in Animated.View if this is a newly received notification
    if (fadeAnim) {
      return (
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          }}
        >
          {content}
        </Animated.View>
      );
    }

    return content;
  };

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
      <View style={{ flex: 1 }}>
        {/* "New notification" pill at top */}
        {showNewPill && (
          <Animated.View style={[styles.newNotificationPill, { opacity: pillOpacity }]}>
            <TouchableOpacity style={styles.newNotificationPillButton} onPress={handleNewPillPress}>
              <Ionicons name="arrow-up" size={14} color={Colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.newNotificationPillText}>New notification</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <FlatList
          ref={flatListRef}
          data={groupedNotifications}
          keyExtractor={(item) => item.title}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          onScroll={handleScroll}
          scrollEventThrottle={100}
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
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notificationCardUnread: {
    backgroundColor: Colors.white,
    borderColor: '#FFE0CC',
  },
  iconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryIcon: {
    fontSize: 16,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
  newNotificationPill: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  newNotificationPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  newNotificationPillText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default NotificationsScreen;
