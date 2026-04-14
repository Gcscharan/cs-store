import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5002';

export interface OrderTrackingState {
  orderStatus: string | null;
  riderLat: number | null;
  riderLng: number | null;
  etaMinutes: number | null;
  isDelivered: boolean;
  isFailed: boolean;
  failureReason?: string;
}

const INITIAL_STATE: OrderTrackingState = {
  orderStatus: null,
  riderLat: null,
  riderLng: null,
  etaMinutes: null,
  isDelivered: false,
  isFailed: false,
  failureReason: undefined,
};

const TERMINAL_STATUSES = ['DELIVERED', 'FAILED'];

export const useOrderTrackingSocket = (orderId: string): OrderTrackingState => {
  const token = useSelector((state: RootState) => state.auth.accessToken);
  const [state, setState] = useState<OrderTrackingState>(INITIAL_STATE);

  useEffect(() => {
    if (!token || !orderId) return;

    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      socket.emit('join_order_room', { orderId, token });
    });

    const handleStatusChanged = (event: {
      orderStatus: string;
      failureReason?: string;
      [key: string]: any;
    }) => {
      setState((prev) => ({
        ...prev,
        orderStatus: event.orderStatus,
        isDelivered: event.orderStatus === 'DELIVERED',
        isFailed: event.orderStatus === 'FAILED',
        failureReason: event.failureReason,
      }));

      if (TERMINAL_STATUSES.includes(event.orderStatus)) {
        socket.disconnect();
      }
    };

    const handleLocationUpdate = (data: {
      riderLat: number;
      riderLng: number;
      etaMinutes: number;
    }) => {
      setState((prev) => ({
        ...prev,
        riderLat: data.riderLat,
        riderLng: data.riderLng,
        etaMinutes: data.etaMinutes,
      }));
    };

    socket.on('order:status:changed', handleStatusChanged);
    socket.on('order:location:update', handleLocationUpdate);

    return () => {
      socket.off('order:status:changed', handleStatusChanged);
      socket.off('order:location:update', handleLocationUpdate);
      socket.disconnect();
    };
  }, [token, orderId]);

  return state;
};
