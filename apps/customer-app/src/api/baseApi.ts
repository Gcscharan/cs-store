import { createApi } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import { axiosBaseQuery } from './axiosBaseQuery';
import Constants from 'expo-constants';

const getRawUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  
  // If explicit URL provided, use it
  if (envUrl) {
    console.log("🌐 BASE_URL CONFIG:", {
      source: 'EXPO_PUBLIC_API_URL',
      url: envUrl,
      isDevice: Constants.isDevice,
      platform: Platform.OS,
    });
    return envUrl;
  }

  // Fallback: Auto-detect based on platform and device type
  const isEmulator = Constants.isDevice === false;
  
  if (Platform.OS === 'android' && isEmulator) {
    // Android emulator: use 10.0.2.2 (special alias for host machine)
    console.log("🌐 BASE_URL CONFIG:", {
      source: 'auto-detect',
      url: 'http://10.0.2.2:5001/api',
      reason: 'Android Emulator',
    });
    return 'http://10.0.2.2:5001/api';
  }
  
  // Real device or iOS simulator
  console.log("🌐 BASE_URL CONFIG:", {
    source: 'fallback',
    url: 'http://localhost:5001/api',
    isDevice: Constants.isDevice,
    platform: Platform.OS,
  });
  return 'http://localhost:5001/api';
};

export const BASE_URL = getRawUrl();

/**
 * RTK Query base API configuration
 * All API endpoints will be injected here
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery({ baseUrl: BASE_URL }),
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
    'Reviews',
    'Coupons',

    'AdminRoutes',
    'AdminSettings',
  ],
  endpoints: () => ({}),
});
