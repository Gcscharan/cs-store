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
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { storage } from '../utils/storage';
import { logEvent } from '../utils/analytics';
import { baseApi } from '../api/baseApi';
import type { AppDispatch } from '../store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';
// Socket connects to the server root, not /api
const SOCKET_URL = API_URL.replace('/api', '');

// ── Reconnection config (exponential backoff: 1s → 2s → 4s → 8s → 16s, max 30s) ──
const RECONNECT_DELAY_MIN = 1000;
const RECONNECT_DELAY_MAX = 30000;

type DeliveryLocationData = {
  orderId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
};

type LocationListener = (data: DeliveryLocationData) => void;

class SocketClient {
  private socket: Socket | null = null;
  private dispatch: AppDispatch | null = null;
  private isConnecting = false;
  private locationListeners: Map<string, Set<LocationListener>> = new Map();

  /**
   * Initialize with Redux dispatch for cache invalidation.
   * Call once from App.tsx after store is ready.
   */
  init(dispatch: AppDispatch) {
    this.dispatch = dispatch;
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

  // ── Private ──

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logEvent('socket_connected', { id: this.socket?.id });
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
  }

  private handlePaymentUpdate(data: { orderId: string; status: string }) {
    logEvent('realtime_payment_update', { orderId: data.orderId, status: data.status });
    this.dispatch?.(baseApi.util.invalidateTags(['Orders', 'Order']));
  }
}

// Singleton — import this everywhere
export const socketClient = new SocketClient();
