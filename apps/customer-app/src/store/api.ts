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
  tagTypes: ['Products', 'Orders', 'Cart', 'Profile'],
  endpoints: (builder) => ({
    // Products
    getProducts: builder.query<any, { page?: number; limit?: number; category?: string }>({
      query: ({ page = 1, limit = 12, category } = {}) => ({
        url: '/products',
        params: { page, limit, category },
      }),
      providesTags: ['Products'],
    }),
    getProduct: builder.query<any, string>({
      query: (id) => `/products/${id}`,
    }),
    // Auth
    sendOtp: builder.mutation<any, { phone: string; mode: string }>({
      query: (body) => ({ url: '/auth/send-otp', method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<any, { phone: string; otp: string; mode: string }>({
      query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }),
    }),
    getProfile: builder.query<any, void>({
      query: () => '/auth/me',
      providesTags: ['Profile'],
    }),
    // Cart
    getCart: builder.query<any, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),
    addToCart: builder.mutation<any, { productId: string; quantity: number }>({
      query: (body) => ({ url: '/cart/add', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    // Orders
    getOrders: builder.query<any, void>({
      query: () => '/orders',
      providesTags: ['Orders'],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/orders/${id}`,
    }),
    createOrder: builder.mutation<any, any>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Orders', 'Cart'],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductQuery,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useGetProfileQuery,
  useGetCartQuery,
  useAddToCartMutation,
  useGetOrdersQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
} = api;
