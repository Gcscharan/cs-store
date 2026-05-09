import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { adminApi } from '../api/adminApi';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5002').replace('/api', '');

export const useProductSocket = () => {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => state.auth.accessToken);
  const userRole = useSelector((state: RootState) => (state.auth.user as any)?.role);

  useEffect(() => {
    if (!token || userRole !== 'admin') return;

    const processedEventIds = new Map<string, number>();

    const isEventDuplicate = (eventId: string): boolean => {
      const now = Date.now();
      for (const [id, ts] of processedEventIds) {
        if (now - ts > 60_000) processedEventIds.delete(id);
      }
      if (processedEventIds.has(eventId)) return true;
      processedEventIds.set(eventId, now);
      return false;
    };

    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      socket.emit('join_room', { room: 'admin_room', token });
    });

    socket.on('reconnect', () => {
      dispatch(adminApi.util.invalidateTags(['Products']));
    });

    const handleProductCreated = (event: any) => {
      if (!event?.product?._id) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      dispatch(
        adminApi.util.updateQueryData('getAdminProducts', undefined, (draft: any) => {
          const exists = draft?.products?.find((p: any) => p._id === event.product._id);
          if (!exists) draft?.products?.unshift(event.product);
        })
      );
    };

    const handleProductUpdated = (event: any) => {
      if (!event?.product?._id) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      dispatch(
        adminApi.util.updateQueryData('getAdminProducts', undefined, (draft: any) => {
          const idx = draft?.products?.findIndex((p: any) => p._id === event.product._id);
          if (idx !== undefined && idx !== -1) draft.products[idx] = event.product;
        })
      );
    };

    const handleProductDeleted = (event: any) => {
      if (!event?.productId) return;
      if (event.eventId && isEventDuplicate(event.eventId)) return;
      dispatch(
        adminApi.util.updateQueryData('getAdminProducts', undefined, (draft: any) => {
          if (draft?.products) {
            draft.products = draft.products.filter((p: any) => p._id !== event.productId);
          }
        })
      );
    };

    socket.on('product:created', handleProductCreated);
    socket.on('product:updated', handleProductUpdated);
    socket.on('product:deleted', handleProductDeleted);

    return () => {
      socket.off('product:created', handleProductCreated);
      socket.off('product:updated', handleProductUpdated);
      socket.off('product:deleted', handleProductDeleted);
      socket.disconnect();
    };
  }, [token, userRole, dispatch]);
};
