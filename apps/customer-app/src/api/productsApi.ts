import { baseApi } from './baseApi';
import type { Product } from '../types';

export type { Product };

export interface SearchProductsResponse {
  products: Product[];
  total: number;
}

export interface SearchProductsParams {
  q: string;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'price' | 'newest' | 'sales';
  sortOrder?: 'asc' | 'desc';
}

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<{ products: Product[]; total: number }, { page?: number; limit?: number; category?: string; search?: string } | undefined>({
      query: (params) => ({
        url: '/products',
        method: 'GET',
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 12,
          category: params?.category,
          search: params?.search,
        },
      }),
      providesTags: ['Products'],
    }),
    getCategories: builder.query<{ categories: { name: string; count: number }[] }, void>({
      query: () => ({
        url: '/products/categories',
        method: 'GET',
      }),
      providesTags: ['Categories'],
    }),
    getProductById: builder.query<Product, string>({
      query: (id) => ({
        url: `/products/${id}`,
        method: 'GET',
      }),
      providesTags: ['Product'],
    }),
    getSimilarProducts: builder.query<Product[], { id: string; limit?: number }>({
      query: ({ id, limit = 6 }) => ({
        url: `/products/${id}/similar`,
        method: 'GET',
        params: { limit },
      }),
      providesTags: ['Products'],
    }),
    searchProducts: builder.query<SearchProductsResponse, SearchProductsParams>({
      query: ({ q, page = 1, limit = 12, sortBy = 'relevance', sortOrder = 'desc' }) => ({
        url: '/search/products',
        method: 'GET',
        params: { q, page, limit, sortBy, sortOrder },
      }),
      providesTags: ['Products'],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetCategoriesQuery,
  useGetProductByIdQuery,
  useLazyGetSimilarProductsQuery,
  useSearchProductsQuery,
  useLazySearchProductsQuery,
} = productsApi;

// Re-export Product type for convenience
