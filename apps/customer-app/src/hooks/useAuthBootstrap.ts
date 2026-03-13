import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { setTokens, setStatus, setUser } from '../store/slices/authSlice';
import { api } from '../store/api';
import type { AppDispatch } from '../store';

export function useAuthBootstrap() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    (async () => {
      try {
        const accessToken = await SecureStore.getItemAsync('accessToken');
        const refreshToken = await SecureStore.getItemAsync('refreshToken');

        if (accessToken) {
          dispatch(setTokens({ accessToken, refreshToken: refreshToken || '' }));
          // Verify token by fetching profile
          try {
            const result = await dispatch(api.endpoints.getProfile.initiate());
            if (result.data) {
              dispatch(setUser(result.data));
              dispatch(setStatus('ACTIVE'));
            } else {
              dispatch(setStatus('UNAUTHENTICATED'));
            }
          } catch {
            dispatch(setStatus('UNAUTHENTICATED'));
          }
        } else {
          dispatch(setStatus('UNAUTHENTICATED'));
        }
      } catch {
        dispatch(setStatus('UNAUTHENTICATED'));
      }
    })();
  }, [dispatch]);
}
