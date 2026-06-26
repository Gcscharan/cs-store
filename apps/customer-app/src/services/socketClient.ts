/**
 * Socket.IO Client — Production Real-Time Layer
 * 
 * Connects to backend WebSocket with JWT auth.
 * Handles: auto-reconnect, token refresh, RTK cache invalidation.
 * Falls back to polling when socket is disconnected.
 * 
 * Events consumed:
 *   - order_status_updated   → invalidates Orders/Order cache
 *   - delivery_location_updated → dispatched to order tracking subscribers
 *   - payment_status_updated → invalidates Orders cache + triggers payment recovery
 *   - order:status:changed   → admin order status updates with complete order object
 *   - order:assigned         → admin order assignment events with delivery partner info
 *   - notification:read      → marks a specific notification as read (multi-device sync)
 *   - notification:read_all  → marks all notifications as read (multi-device sync)
 *   - notification:unread_count → updates unread badge count in real-time
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../utils/storage';
import { logEvent } from '../utils/analytics';
import { baseApi, BASE_URL } from '../api/baseApi';
import { enqueueNotificationToast, showNextNotificationToast } from '../store/slices/uiSlice';
import type { AppDispatch } from '../store';

const API_URL = BASE_URL;
// Socket connects to the server root, not /api
const SOCKET_URL = API_URL.replace('/api', '');

console.log("🔥 FINAL SOCKET URL:", SOCKET_URL);

// ── Reconnection config (exponential backoff: 1s → 2s → 4s → 8s → 16s, max 30s) ──
const RECONNECT_DELAY_MIN = 1000;
const RECONNECT_DELAY_MAX = 30000;

// ── Offline Sync Storage Keys ──
const STORAGE_KEY_LAST_SEEN_TIMESTAMP = 'notifications:lastSeenTimestamp';
const STORAGE_KEY_CACHED_NOTIFICATIONS = 'notifications:cachedNotifications';
const MAX_CACHED_NOTIFICATIONS = 50;

type DeliveryLocationData = {
  orderId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
};

type OrderStatusChangedData = {
  orderId: string;
  from: string;
  to: string;
  actorRole: 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';
  actorId: string;
  timestamp: string;
  order?: any; // Complete order object
};

type OrderAssignedData = {
  orderId: string;
  deliveryPartnerId: string;
  deliveryPartner?: any;
  timestamp: string;
  order?: any; // Complete order object
};

type NotificationReadData = {
  notificationId: string;
};

type NotificationUnreadCountData = {
  count: number;
};

type NotificationNewData = {
  id: string;
  _id?: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  deepLink?: string;
  createdAt: string;
  eventType?: string;
  meta?: Record<string, any>;
  isRead?: boolean;
};

type NotificationSyncData = {
  notifications: NotificationNewData[];
  totalUnread: number;
};

type NotificationSyncListener = (data: NotificationSyncData) => void;

type LocationListener = (data: DeliveryLocationData) => void;
type OrderStatusListener = (data: OrderStatusChangedData) => void;
type OrderAssignedListener = (data: OrderAssignedData) => void;
type NotificationNewListener = (data: NotificationNewData) => void;

class SocketClient {
  private socket: Socket | null = null;
  private dispatch: AppDispatch | null = null;
  private isConnecting = false;
  private locationListeners: Map<string, Set<LocationListener>> = new Map();
  private lastSeenTimestamp: string | null = null;

  /**
   * Initialize with Redux dispatch for cache invalidation.
   * Call once from App.tsx after store is ready.
   */
  init(dispatch: AppDispatch) {
    this.dispatch = dispatch;
    // Load persisted lastSeenTimestamp on init
    this.loadLastSeenTimestamp();
  }

  /**
   * Load last seen timestamp from AsyncStorage.
   */
  private async loadLastSeenTimestamp(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_LAST_SEEN_TIMESTAMP);
      if (stored) {
        this.lastSeenTimestamp = stored;
      }
    } catch (err) {
      logEvent('socket_load_timestamp_error', { error: String(err) });
    }
  }

  /**
   * Update lastSeenTimestamp when a new notification is received.
   */
  private async updateLastSeenTimestamp(timestamp: string): Promise<void> {
    // Only update if this timestamp is newer
    if (!this.lastSeenTimestamp || new Date(timestamp) > new Date(this.lastSeenTimestamp)) {
      this.lastSeenTimestamp = timestamp;
      try {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_SEEN_TIMESTAMP, timestamp);
      } catch (err) {
        logEvent('socket_save_timestamp_error', { error: String(err) });
      }
    }
  }

  /**
   * Get the current lastSeenTimestamp (for external access by screens).
   */
  getLastSeenTimestamp(): string | null {
    return this.lastSeenTimestamp;
  }

  /**
   * Request sync from server with missed notifications since last seen.
   * Called on reconnect or when app comes to foreground.
   */
  requestSync(): void {
    if (!this.socket?.connected) return;
    const timestamp = this.lastSeenTimestamp || new Date(0).toISOString();
    this.socket.emit('notification:request_sync', { lastSeenTimestamp: timestamp });
    logEvent('socket_request_sync', { lastSeenTimestamp: timestamp });
  }

  // ── Notification Cache (AsyncStorage) ──

  /**
   * Save notifications to local cache for immediate display on app open.
   */
  async cacheNotifications(notifications: NotificationNewData[]): Promise<void> {
    try {
      const limited = notifications.slice(0, MAX_CACHED_NOTIFICATIONS);
      await AsyncStorage.setItem(STORAGE_KEY_CACHED_NOTIFICATIONS, JSON.stringify(limited));
    } catch (err) {
      logEvent('socket_cache_notifications_error', { error: String(err) });
    }
  }

  /**
   * Load cached notifications from AsyncStorage.
   */
  async getCachedNotifications(): Promise<NotificationNewData[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_CACHED_NOTIFICATIONS);
      if (raw) {
        return JSON.parse(raw) as NotificationNewData[];
      }
    } catch (err) {
      logEvent('socket_load_cache_error', { error: String(err) });
    }
    return [];
  }

  /**
   * Merge server sync data with local cache.
   * Server state takes precedence for read/unread status.
   */
  async mergeSyncWithCache(syncData: NotificationSyncData): Promise<NotificationNewData[]> {
    const cached = await this.getCachedNotifications();
    const serverMap = new Map<string, NotificationNewData>();

    // Index server notifications by ID
    for (const notif of syncData.notifications) {
      const id = notif._id || notif.id;
      serverMap.set(id, notif);
    }

    // Merge: server state takes precedence
    const merged: NotificationNewData[] = [];
    const seenIds = new Set<string>();

    // Add all server notifications first (they have authoritative state)
    for (const notif of syncData.notifications) {
      const id = notif._id || notif.id;
      merged.push(notif);
      seenIds.add(id);
    }

    // Add cached notifications that aren't in the server response
    for (const cachedNotif of cached) {
      const id = cachedNotif._id || cachedNotif.id;
      if (!seenIds.has(id)) {
        merged.push(cachedNotif);
        seenIds.add(id);
      }
    }

    // Sort by createdAt descending (newest first) and limit
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const limited = merged.slice(0, MAX_CACHED_NOTIFICATIONS);

    // Persist the merged result
    await this.cacheNotifications(limited);

    return limited;
  }

  /**
   * Connect to WebSocket with JWT token from SecureStore.
   * Safe to call multiple times — deduplicates connections.
   */
  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const token = await storage.getItem('accessToken');
      if (!token) {
        this.isConnecting = false;
        return;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'], // Skip long-polling, go straight to WS
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY_MIN,
        reconnectionDelayMax: RECONNECT_DELAY_MAX,
        reconnectionAttempts: Infinity, // Never give up
        timeout: 10000,
        forceNew: false,
      });

      this.setupEventHandlers();
    } catch (err) {
      logEvent('socket_connect_error', { error: String(err) });
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect and cleanup.
   */
  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.locationListeners.clear();
  }

  /**
   * Reconnect with fresh token (call after token refresh).
   */
  async reconnectWithNewToken() {
    this.disconnect();
    await this.connect();
  }

  /**
   * Check if socket is currently connected.
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ── Delivery Location Subscriptions ──

  /**
   * Subscribe to live delivery location updates for a specific order.
   * Returns unsubscribe function.
   */
  subscribeToDeliveryLocation(orderId: string, listener: LocationListener): () => void {
    if (!this.locationListeners.has(orderId)) {
      this.locationListeners.set(orderId, new Set());
    }
    this.locationListeners.get(orderId)!.add(listener);

    // Tell server we want updates for this order
    this.socket?.emit('subscribe_delivery_tracking', { orderId });

    return () => {
      const listeners = this.locationListeners.get(orderId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.locationListeners.delete(orderId);
          this.socket?.emit('unsubscribe_delivery_tracking', { orderId });
        }
      }
    };
  }

  // ── Notification Event Subscriptions ──

  /**
   * Subscribe to notification:unread_count events for badge updates.
   * Returns unsubscribe function.
   */
  subscribeToUnreadCount(listener: (data: { count: number }) => void): () => void {
    if (!this.socket) return () => {};

    this.socket.on('notification:unread_count', listener);

    return () => {
      this.socket?.off('notification:unread_count', listener);
    };
  }

  /**
   * Subscribe to notification:new events for real-time notification prepend.
   * Returns unsubscribe function.
   */
  subscribeToNewNotification(listener: (data: any) => void): () => void {
    if (!this.socket) return () => {};

    this.socket.on('notification:new', listener);

    return () => {
      this.socket?.off('notification:new', listener);
    };
  }

  /**
   * Subscribe to notification:read events for multi-device sync.
   * Returns unsubscribe function.
   */
  subscribeToNotificationRead(listener: (data: { notificationId: string }) => void): () => void {
    if (!this.socket) return () => {};

    this.socket.on('notification:read', listener);

    return () => {
      this.socket?.off('notification:read', listener);
    };
  }

  /**
   * Subscribe to notification:read_all events for multi-device sync.
   * Returns unsubscribe function.
   */
  subscribeToNotificationReadAll(listener: () => void): () => void {
    if (!this.socket) return () => {};

    this.socket.on('notification:read_all', listener);

    return () => {
      this.socket?.off('notification:read_all', listener);
    };
  }

  /**
   * Subscribe to notification:sync events for offline sync.
   * Returns unsubscribe function.
   */
  subscribeToNotificationSync(listener: NotificationSyncListener): () => void {
    if (!this.socket) return () => {};

    this.socket.on('notification:sync', listener);

    return () => {
      this.socket?.off('notification:sync', listener);
    };
  }

  // ── Admin Event Subscriptions ──

  /**
   * Subscribe to order status change events for admin screens.
   * Returns unsubscribe function.
   */
  subscribeToOrderStatusChanges(listener: OrderStatusListener): () => void {
    if (!this.socket) return () => {};
    
    this.socket.on('order:status:changed', listener);
    
    return () => {
      this.socket?.off('order:status:changed', listener);
    };
  }

  /**
   * Subscribe to order assignment events for admin screens.
   * Returns unsubscribe function.
   */
  subscribeToOrderAssignments(listener: OrderAssignedListener): () => void {
    if (!this.socket) return () => {};
    
    this.socket.on('order:assigned', listener);
    
    return () => {
      this.socket?.off('order:assigned', listener);
    };
  }

  // ── Notification Event Subscriptions ──

  /**
   * Subscribe to new notification events (notification:new).
   * Returns unsubscribe function.
   */
  subscribeToNewNotifications(listener: NotificationNewListener): () => void {
    if (!this.socket) return () => {};

    this.socket.on('notification:new', listener);

    return () => {
      this.socket?.off('notification:new', listener);
    };
  }

  // ── Private ──

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logEvent('socket_connected', { id: this.socket?.id });
      // On reconnect, request sync for missed notifications
      this.requestSync();
    });

    this.socket.on('disconnect', (reason) => {
      logEvent('socket_disconnected', { reason });
    });

    this.socket.on('connect_error', async (err) => {
      logEvent('socket_connect_error', { error: err.message });
      const msg = String(err?.message || '').toLowerCase();
      // If auth/token error, attempt silent refresh loop
      if (msg.includes('authentication') || msg.includes('token') || msg.includes('exp')) {
        logEvent('socket_token_expired_reconnecting', {});
        try {
          const refreshToken = await storage.getItem('refreshToken');
          if (refreshToken) {
            const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            if (res.data?.accessToken) {
               await storage.setItem('accessToken', res.data.accessToken);
               if (res.data.refreshToken) await storage.setItem('refreshToken', res.data.refreshToken);
               await this.reconnectWithNewToken();
               return;
            }
          }
        } catch (e) {
          logEvent('socket_token_refresh_failed', { error: String(e) });
        }
        this.socket?.disconnect();
      }
    });

    // ── Business Events ──

    this.socket.on('order_status_updated', (data: { orderId: string; status: string }) => {
      logEvent('realtime_order_update', { orderId: data.orderId, status: data.status });
      // Invalidate RTK Query cache so screens refetch
      this.dispatch?.(baseApi.util.invalidateTags(['Orders', 'Order']));
    });

    // ── Admin Events ──

    this.socket.on('order:status:changed', (data: OrderStatusChangedData) => {
      logEvent('admin_order_status_changed', { 
        orderId: data.orderId, 
        from: data.from, 
        to: data.to,
        actorRole: data.actorRole 
      });
      // Invalidate RTK Query cache so admin screens refetch
      this.dispatch?.(baseApi.util.invalidateTags(['Orders', 'Order']));
    });

    this.socket.on('order:assigned', (data: OrderAssignedData) => {
      logEvent('admin_order_assigned', { 
        orderId: data.orderId, 
        deliveryPartnerId: data.deliveryPartnerId 
      });
      // Invalidate RTK Query cache so admin screens refetch
      this.dispatch?.(baseApi.util.invalidateTags(['Orders', 'Order']));
    });

    this.socket.on('payment_status_updated', (data: { orderId: string; status: string }) => {
      // Backward compat: also listen for old event name
      this.handlePaymentUpdate(data);
    });

    this.socket.on('payment_status_update', (data: { orderId: string; status: string }) => {
      this.handlePaymentUpdate(data);
    });

    this.socket.on('delivery_location_updated', (data: DeliveryLocationData) => {
      const listeners = this.locationListeners.get(data.orderId);
      if (listeners) {
        listeners.forEach(fn => fn(data));
      }
    });

    // ── Notification Sync Events (multi-device read state) ──

    this.socket.on('notification:read', (data: NotificationReadData) => {
      logEvent('realtime_notification_read', { notificationId: data.notificationId });
      // Invalidate notifications cache so UI reflects read state from another device
      this.dispatch?.(baseApi.util.invalidateTags(['Notifications']));
    });

    this.socket.on('notification:read_all', () => {
      logEvent('realtime_notification_read_all', {});
      // Invalidate notifications cache so all notifications show as read
      this.dispatch?.(baseApi.util.invalidateTags(['Notifications']));
    });

    this.socket.on('notification:unread_count', (data: NotificationUnreadCountData) => {
      logEvent('realtime_notification_unread_count', { count: data.count });
      // Invalidate notifications cache to refresh unread count badge
      this.dispatch?.(baseApi.util.invalidateTags(['Notifications']));
    });

    // ── Notification Toast Trigger ──

    this.socket.on('notification:new', (data: NotificationNewData) => {
      logEvent('realtime_notification_new_toast', { id: data.id, category: data.category });
      // Track lastSeenTimestamp for offline sync
      const timestamp = data.createdAt || new Date().toISOString();
      this.updateLastSeenTimestamp(timestamp);
      // Enqueue notification as toast and trigger display
      this.dispatch?.(enqueueNotificationToast({
        id: data.id || `notif-${Date.now()}`,
        title: data.title,
        body: data.body,
        deepLink: data.deepLink,
        category: data.category,
        priority: data.priority,
      }));
      this.dispatch?.(showNextNotificationToast());
      // Also invalidate notifications cache for list/badge
      this.dispatch?.(baseApi.util.invalidateTags(['Notifications']));
    });

    // ── Notification Sync (Offline Recovery) ──

    this.socket.on('notification:sync', (data: NotificationSyncData) => {
      logEvent('realtime_notification_sync', {
        count: data.notifications?.length || 0,
        totalUnread: data.totalUnread,
      });
      // Update lastSeenTimestamp from the most recent synced notification
      if (data.notifications && data.notifications.length > 0) {
        const latest = data.notifications[0]; // Sorted newest first from server
        if (latest.createdAt) {
          this.updateLastSeenTimestamp(latest.createdAt);
        }
      }
      // Merge with local cache and persist
      this.mergeSyncWithCache(data);
      // Invalidate RTK Query cache so UI refetches
      this.dispatch?.(baseApi.util.invalidateTags(['Notifications']));
    });
  }

  private handlePaymentUpdate(data: { orderId: string; status: string }) {
    logEvent('realtime_payment_update', { orderId: data.orderId, status: data.status });
    this.dispatch?.(baseApi.util.invalidateTags(['Orders', 'Order']));
  }
}

// Singleton — import this everywhere
export const socketClient = new SocketClient();

// Export types for use in screens
export type { OrderStatusChangedData, OrderAssignedData, OrderStatusListener, OrderAssignedListener, NotificationNewData, NotificationNewListener, NotificationSyncData, NotificationSyncListener };
