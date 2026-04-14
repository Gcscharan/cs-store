import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import { axiosBaseQuery, AxiosBaseQueryError } from './axiosBaseQuery';
import * as Device from 'expo-device';
import { storage } from '../utils/storage';
import axios from 'axios';

// After this change run: npx expo start -c
// IMPORTANT: Device and laptop must be on same WiFi for local IP to work
const getRawUrl = (): string => {
  const normalizeUrl = (value: string): string => {
    let v = value.trim();
    const wrapped =
      (v.startsWith('`') && v.endsWith('`')) ||
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"));
    if (wrapped) v = v.slice(1, -1).trim();
    v = v.replace(/^[`'"]+/, '').replace(/[`'"]+$/, '').trim();
    return v;
  };

  const envUrlRaw = process.env.EXPO_PUBLIC_API_URL;
  const envUrl = envUrlRaw ? normalizeUrl(envUrlRaw) : '';
  
  // If explicit URL provided, use it
  if (envUrl) {
    console.log("🌐 BASE_URL CONFIG:", {
      source: 'EXPO_PUBLIC_API_URL',
      url: envUrl,
      isDevice: Device.isDevice,
      platform: Platform.OS,
    });
    return envUrl;
  }

  // Fallback: Use .local hostname (mDNS) which is more stable across IP changes
  const hostname = 'GCSCharans-MacBook-Air.local';
  const fallbackUrl = `http://${hostname}:5002/api`;
  
  console.log("🌐 BASE_URL CONFIG:", {
    source: 'fallback (.local)',
    url: fallbackUrl,
    isDevice: Device.isDevice,
    platform: Platform.OS,
  });
  return fallbackUrl;
};

export const BASE_URL = getRawUrl();

console.log("🔥 FINAL API BASE URL (Axios):", BASE_URL);

const baseQuery = axiosBaseQuery({ baseUrl: BASE_URL });

const baseQueryWithReauth: BaseQueryFn<
  any,
  unknown,
  AxiosBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try to get a new token
    console.log('🔐 [Auth] 401 detected, attempting token refresh...');
    
    try {
      const refreshToken = await storage.getItem('refreshToken');
      
      if (refreshToken) {
        // We use a clean axios instance for the refresh call to avoid circular 401s
        const refreshResult = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        if (refreshResult.data && refreshResult.data.accessToken) {
          console.log('✅ [Auth] Token refreshed successfully');
          
          const { accessToken, refreshToken: newRefreshToken } = refreshResult.data;
          
          // Store new tokens
          await storage.setItem('accessToken', accessToken);
          if (newRefreshToken) {
            await storage.setItem('refreshToken', newRefreshToken);
          }

          // Update Redux state
          api.dispatch({ type: 'auth/setTokens', payload: { accessToken, refreshToken: newRefreshToken || refreshToken } });

          // Retry the initial query
          result = await baseQuery(args, api, extraOptions);
        } else {
          console.warn('❌ [Auth] Refresh failed: No token in response');
          api.dispatch({ type: 'auth/logout' });
        }
      } else {
        console.log('🔐 [Auth] No refresh token available, logging out');
        api.dispatch({ type: 'auth/logout' });
      }
    } catch (refreshError) {
      console.error('❌ [Auth] Token refresh failed with error:', refreshError);
      api.dispatch({ type: 'auth/logout' });
    }
  }

  return result;
};

/**
 * RTK Query base API configuration
 * All API endpoints will be injected here
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  // Performance Optimization: Cache rules
  keepUnusedDataFor: 60,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  refetchOnMountOrArgChange: false,
  tagTypes: [
    'Products',
    'Product',
    'Categories',
    'Cart',
    'Orders',
    'Order',
    'Addresses',
    'Profile',
    'Notifications',
    'DeliveryOrders',
    'DeliveryBoys',
    'Reviews',
    'Coupons',
    'Users',

    'AdminRoutes',
    'AdminSettings',
    'Pincode',
  ],
  endpoints: () => ({}),
});
