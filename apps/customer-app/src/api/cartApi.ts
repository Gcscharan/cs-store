import { baseApi } from './baseApi';
import type { CartItem } from '../types';

export const cartApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getCart: builder.query<{ items: CartItem[] }, void>({
      query: () => ({ url: '/cart', method: 'GET' }),
      providesTags: ['Cart'],
      keepUnusedDataFor: 60,
    }),
    addToCart: builder.mutation<{ success: boolean; items: CartItem[] }, { productId: string; quantity?: number }>({
      query: (data) => ({
        url: '/cart',
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Cart'],
    }),
    updateCartItem: builder.mutation<{ success: boolean; items: CartItem[] }, { productId: string; quantity: number }>({
      query: (data) => ({
        url: '/cart',
        method: 'PUT',
        data: data,
      }),
      invalidatesTags: ['Cart'],
    }),
    removeFromCart: builder.mutation<{ success: boolean; items: CartItem[] }, string>({
      query: (productId) => ({
        url: `/cart/${productId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Cart'],
    }),
  }),
});

export const {
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
} = cartApi;
