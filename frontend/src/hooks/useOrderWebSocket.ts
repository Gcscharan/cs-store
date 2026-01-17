import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { getApiOrigin } from "../config/runtime";

const SOCKET_URL = getApiOrigin() || '/';

interface OrderStatusChangedPayload {
  orderId: string;
  from: string;
  to: string;
  actorRole: 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';
  actorId: string;
  timestamp: string;
}

interface UseOrderWebSocketOptions {
  userId?: string;
  userRole?: 'admin' | 'delivery' | 'customer';
  onOrderStatusChanged?: (payload: OrderStatusChangedPayload) => void;
  enabled?: boolean;
}

/**
 * useOrderWebSocket
 * 
 * React hook for real-time order status updates via WebSocket
 * 
 * @param options Configuration options
 * @returns Socket instance (for debugging/advanced use)
 */
export const useOrderWebSocket = (options: UseOrderWebSocketOptions) => {
  const {
    userId,
    userRole,
    onOrderStatusChanged,
    enabled = true,
  } = options;

  const verboseLoggingEnabled =
    String(import.meta.env.VITE_DEV_LOW_POWER || "").toLowerCase() !== "true";

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !userId || !userRole) {
      return;
    }

    if (userRole !== 'admin') {
      return;
    }

    const token =
      (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
        ? window.localStorage.getItem('accessToken')
        : null) || '';

    // Create socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token,
      },
    });

    if (verboseLoggingEnabled) {
      (window as any).socket = socket;
    }

    socket.onAny((event, ...args) => {
      if (verboseLoggingEnabled) {
        console.log('📡 WS EVENT:', event, ...args);
      }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (verboseLoggingEnabled) {
        console.log(`✅ [WebSocket] Connected as ${userRole}: ${userId}`);
      }

      // Join appropriate room based on role
      socket.emit('join_room', {
        room: 'admin_room',
        userId,
        userRole,
        token,
      });
    });

    socket.on('disconnect', () => {
      if (verboseLoggingEnabled) {
        console.log('❌ [WebSocket] Disconnected');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });

    // Listen for order status changes
    socket.on('order:status:changed', (payload: OrderStatusChangedPayload) => {
      if (verboseLoggingEnabled) {
        console.log(`📦 [WebSocket] Order status changed:`, payload);
      }
      if (onOrderStatusChanged) {
        onOrderStatusChanged(payload);
      }
    });

    // Cleanup on unmount
    return () => {
      if (verboseLoggingEnabled) {
        console.log('[WebSocket] Disconnecting...');
      }
      socket.disconnect();
    };
  }, [userId, userRole, enabled, onOrderStatusChanged]);

  return socketRef.current;
};
