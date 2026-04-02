import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { storage } from '../utils/storage';
import { setStatus, setUser, setTokens } from '../store/slices/authSlice';
import { BASE_URL } from '../api/baseApi';

export const useAuthBootstrap = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;

    const runWhenIdle = (cb: () => void): number => {
      const ric = (globalThis as any).requestIdleCallback as undefined | ((fn: () => void) => number);
      if (typeof ric === 'function') {
        return ric(cb);
      }
      return setTimeout(cb, 0) as unknown as number;
    };

    const cancelIdle = (id: number) => {
      const cancelRic = (globalThis as any).cancelIdleCallback as undefined | ((handle: number) => void);
      if (typeof cancelRic === 'function') {
        cancelRic(id);
        return;
      }
      clearTimeout(id as unknown as any);
    };

    const bootstrap = async () => {
      try {
        const accessToken = await storage.getItem('accessToken');

        if (!accessToken) {
          dispatch(setStatus('UNAUTHENTICATED'));
          return;
        }

        const response = await fetch(`${BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            dispatch(setTokens({ accessToken, refreshToken: null }));
            dispatch(setUser(data.user));
            dispatch(setStatus('ACTIVE'));
          } else {
            dispatch(setStatus('UNAUTHENTICATED'));
          }
        } else {
          dispatch(setStatus('UNAUTHENTICATED'));
        }
      } catch (error) {
        dispatch(setStatus('UNAUTHENTICATED'));
      }
    };

    const idleId = runWhenIdle(() => {
      if (cancelled) return;
      void bootstrap();
    });

    return () => {
      cancelled = true;
      cancelIdle(idleId);
    };
  }, [dispatch]);
};