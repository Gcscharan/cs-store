import { isRejectedWithValue } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';

let isRefreshing = false;

export const authMiddleware = (store: any) => (next: any) => async (action: any) => {
  if (isRejectedWithValue(action) && action.payload?.status === 401 && !isRefreshing) {
    isRefreshing = true;
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api'}/auth/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          await SecureStore.setItemAsync('accessToken', data.accessToken);
          store.dispatch({ type: 'auth/setTokens', payload: { accessToken: data.accessToken } });
        } else {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          store.dispatch({ type: 'auth/logout' });
        }
      } else {
        store.dispatch({ type: 'auth/logout' });
      }
    } catch (e) {
      store.dispatch({ type: 'auth/logout' });
    } finally {
      isRefreshing = false;
    }
  }
  return next(action);
};
