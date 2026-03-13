import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import * as SecureStore from 'expo-secure-store';
import type { RootState } from './index';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: async (headers, { getState }) => {
      const storeToken = (getState() as RootState).auth.accessToken;
      const token = storeToken || await SecureStore.getItemAsync('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Products', 'Orders', 'Cart', 'Profile', 'Addresses', 'Notifications'],
  endpoints: (builder) => ({
    // ── AUTH ──
    sendOtp: builder.mutation<any, { phone: string; mode: string }>({
      query: (body) => ({ url: '/auth/otp/send', method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<any, { phone: string; otp: string; mode: string }>({
      query: (body) => ({ url: '/auth/otp/verify', method: 'POST', body }),
    }),
    getProfile: builder.query<any, void>({
      query: () => '/auth/profile',
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation<any, Partial<{ name: string; email: string; avatar: string }>>({
      query: (body) => ({ url: '/auth/profile', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),
    // ── PRODUCTS ──
    getProducts: builder.query<any, { page?: number; limit?: number; category?: string; search?: string; sort?: string; minPrice?: number; maxPrice?: number }>({
      query: (params = {}) => ({ url: '/products', params }),
      providesTags: ['Products'],
    }),
    getProduct: builder.query<any, string>({
      query: (id) => `/products/${id}`,
    }),
    searchProducts: builder.query<any, { q: string; page?: number; limit?: number; category?: string; minPrice?: number; maxPrice?: number; sort?: string }>({
      query: (params) => ({ url: '/products', params: { search: params.q, ...params } }),
    }),
    getCategories: builder.query<any, void>({
      query: () => '/products/categories',
    }),
    // ── CART ──
    getCart: builder.query<any, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),
    addToCart: builder.mutation<any, { productId: string; quantity: number }>({
      query: (body) => ({ url: '/cart', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    updateCartItem: builder.mutation<any, { productId: string; quantity: number }>({
      query: (body) => ({ url: '/cart', method: 'PUT', body }),
      invalidatesTags: ['Cart'],
    }),
    removeFromCart: builder.mutation<any, string>({
      query: (productId) => ({ url: `/cart/${productId}`, method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    clearCart: builder.mutation<any, void>({
      query: () => ({ url: '/cart/clear', method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    // ── ADDRESSES ──
    getAddresses: builder.query<any, void>({
      query: () => '/user/addresses',
      providesTags: ['Addresses'],
    }),
    addAddress: builder.mutation<any, any>({
      query: (body) => ({ url: '/user/addresses', method: 'POST', body }),
      invalidatesTags: ['Addresses'],
    }),
    updateAddress: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/user/addresses/${id}`, method: 'PUT', body: data }),
      invalidatesTags: ['Addresses'],
    }),
    deleteAddress: builder.mutation<any, string>({
      query: (id) => ({ url: `/user/addresses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Addresses'],
    }),
    setDefaultAddress: builder.mutation<any, string>({
      query: (id) => ({ url: `/user/addresses/${id}/default`, method: 'PATCH' }),
      invalidatesTags: ['Addresses'],
    }),
    // ── PINCODE ──
    checkPincode: builder.query<any, string>({
      query: (pincode) => `/pincode/check/${pincode}`,
    }),
    // ── ORDERS ──
    getOrders: builder.query<any, { page?: number; limit?: number } | void>({
      query: (params) => ({ url: '/orders', params: params || {} }),
      providesTags: ['Orders'],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/orders/${id}`,
    }),
    getOrderTracking: builder.query<any, string>({
      query: (id) => `/orders/${id}/tracking`,
    }),
    createOrder: builder.mutation<any, any>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Orders', 'Cart'],
    }),
    // ── PAYMENT ──
    verifyUpi: builder.mutation<any, { upiId: string }>({
      query: (body) => ({ url: '/upi/verify', method: 'POST', body }),
    }),
    // ── NOTIFICATIONS ──
    getNotifications: builder.query<any, void>({
      query: () => '/notifications',
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<any, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllRead: builder.mutation<any, void>({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    getUnreadCount: builder.query<any, void>({
      query: () => '/notifications/unread-count',
    }),
  }),
});

export const {
  useSendOtpMutation, useVerifyOtpMutation,
  useGetProfileQuery, useUpdateProfileMutation,
  useGetProductsQuery, useGetProductQuery, useSearchProductsQuery, useGetCategoriesQuery,
  useGetCartQuery, useAddToCartMutation, useUpdateCartItemMutation,
  useRemoveFromCartMutation, useClearCartMutation,
  useGetAddressesQuery, useAddAddressMutation, useUpdateAddressMutation,
  useDeleteAddressMutation, useSetDefaultAddressMutation,
  useCheckPincodeQuery,
  useGetOrdersQuery, useGetOrderQuery, useGetOrderTrackingQuery, useCreateOrderMutation,
  useVerifyUpiMutation,
  useGetNotificationsQuery, useMarkNotificationReadMutation,
  useMarkAllReadMutation, useGetUnreadCountQuery,
} = api;
