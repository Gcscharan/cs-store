import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')
  || 'http://localhost:5001';

let socket: Socket | null = null;

export function useSocket() {
  const { accessToken } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (!accessToken) return;
    if (socket?.connected) return;

    socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('disconnect', () => console.log('Socket disconnected'));
    socket.on('connect_error', (err) => console.warn('Socket error:', err.message));

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [accessToken]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socket?.on(event, handler);
    return () => socket?.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socket?.emit(event, data);
  }, []);

  const joinRoom = useCallback((room: string) => {
    socket?.emit('join', room);
  }, []);

  return { on, emit, joinRoom, connected: socket?.connected || false };
}
