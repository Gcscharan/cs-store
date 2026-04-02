import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import * as SecureStore from 'expo-secure-store';
import type { RootState } from './index';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

export const api = createApi({
  reducerPath: 'legacyApi',
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: async (headers, { getState }) => {
      const storeToken = (getState() as RootState).auth.accessToken;
      const token = storeToken || await SecureStore.getItemAsync('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: [
    'Products',
    'Orders',
    'Cart',
    'Profile',
    'Addresses',
    'Notifications',
    'Reviews'
  ],
  endpoints: (builder) => ({
    // ── AUTH ──
    sendOtp: builder.mutation<any, { phone: string; mode: string; name?: string }>({
      query: ({ mode, ...body }) => ({ url: `/auth/send-otp?mode=${mode}`, method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<any, { phone: string; otp: string; mode: string; name?: string }>({
      query: ({ mode, ...body }) => ({ url: `/auth/verify-otp?mode=${mode}`, method: 'POST', body }),
    }),
    getProfile: builder.query<any, void>({
      query: () => '/auth/me',
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation<any, Partial<{ name: string; email: string; avatar: string }>>({
      query: (body) => ({ url: '/auth/complete-profile', method: 'PUT', body }),
      invalidatesTags: ['Profile'],
    }),
    refreshToken: builder.mutation<any, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/refresh', method: 'POST', body }),
    }),
    logout: builder.mutation<any, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),

    // ── PRODUCTS ──
    getProducts: builder.query<any, {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
    }>({
      query: (params = {}) => ({ url: '/products', params }),
      providesTags: ['Products'],
    }),
    getProduct: builder.query<any, string>({
      query: (id) => `/products/${id}`,
    }),
    getCategories: builder.query<{ categories: { name: string; count: number }[] }, void>({
      query: () => '/products/categories',
    }),
    getFeaturedProducts: builder.query<any, void>({
      query: () => ({ url: '/products', params: { featured: true, limit: 10 } }),
    }),
    getTopDeals: builder.query<any, void>({
      query: () => ({ url: '/products', params: { sort: 'discount', limit: 10 } }),
    }),

    // ── REVIEWS ──
    getProductReviews: builder.query<any, { productId: string; page?: number }>({
      query: ({ productId, page = 1 }) => `/products/${productId}/reviews?page=${page}`,
      providesTags: ['Reviews'],
    }),
    addReview: builder.mutation<any, { productId: string; rating: number; comment: string }>({
      query: ({ productId, ...body }) => ({
        url: `/products/${productId}/reviews`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Reviews'],
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

    // ── ORDERS ──
    getOrders: builder.query<any, void>({
      query: () => '/orders',
      providesTags: ['Orders'],
    }),
    getOrder: builder.query<any, string>({
      query: (id) => `/orders/${id}`,
    }),
    placeOrder: builder.mutation<any, any>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Orders', 'Cart'],
    }),
    cancelOrder: builder.mutation<any, string>({
      query: (id) => ({ url: `/orders/${id}/cancel`, method: 'PUT' }),
      invalidatesTags: ['Orders'],
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
    updateAddress: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({ url: `/user/addresses/${id}`, method: 'PUT', body }),
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
  }),
});

export const {
  useSendOtpMutation,
  useVerifyOtpMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetProductsQuery,
  useGetProductQuery,
  useGetCategoriesQuery,
  useGetFeaturedProductsQuery,
  useGetTopDealsQuery,
  useGetProductReviewsQuery,
  useAddReviewMutation,
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
  useClearCartMutation,
  useGetOrdersQuery,
  useGetOrderQuery,
  usePlaceOrderMutation,
  useCancelOrderMutation,
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} = api;
