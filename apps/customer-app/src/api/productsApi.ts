import { baseApi } from './baseApi';
import type { Product, PaginatedResponse, SearchProductsParams } from '../types';

export type { Product };

export const productsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getProducts: builder.query<PaginatedResponse<Product>, { 
      page?: number; 
      limit?: number; 
      category?: string; 
      search?: string;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
      featured?: boolean;
    } | undefined>({
      query: (params) => ({
        url: '/products',
        method: 'GET',
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 12,
          category: params?.category,
          search: params?.search,
          sort: params?.sort,
          minPrice: params?.minPrice,
          maxPrice: params?.maxPrice,
          featured: params?.featured,
        },
      }),
      providesTags: ['Products'],
    }),
    getCategories: builder.query<{ categories: { name: string; count: number }[] }, void>({
      query: () => ({
        url: '/products/categories',
        method: 'GET',
      }),
    }),
    getProductById: builder.query<Product, string>({
      query: (id) => ({
        url: `/products/${id}`,
        method: 'GET',
      }),
      providesTags: ['Product'],
    }),
    getSimilarProducts: builder.query<{ products: Product[] }, { id: string; limit?: number }>({
      query: ({ id, limit = 6 }) => ({
        url: `/products/${id}/similar`,
        method: 'GET',
        params: { limit },
      }),
      providesTags: ['Products'],
    }),
    searchProducts: builder.query<PaginatedResponse<Product>, SearchProductsParams>({
      query: ({ q, page = 1, limit = 12, sortBy = 'relevance', sortOrder = 'desc', minPrice, maxPrice, category, rating }) => ({
        url: '/products/search',
        method: 'GET',
        params: { q, page, limit, sortBy, sortOrder, minPrice, maxPrice, category, rating },
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
