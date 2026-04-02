import { baseApi } from './baseApi';

export interface Review {
  _id: string;
  userId: string;
  userName?: string;
  productId: string;
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  averageRating?: number;
  ratingBreakdown?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export const reviewsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getProductReviews: builder.query<
      ReviewsResponse,
      { productId: string; page?: number; limit?: number }
    >({
      query: ({ productId, page = 1, limit = 10 }) => ({
        url: `/products/${productId}/reviews`,
        method: 'GET',
        params: { page, limit },
      }),
      providesTags: ['Reviews'],
    }),

    addReview: builder.mutation<
      Review,
      { productId: string; rating: number; comment: string; images?: string[] }
    >({
      query: ({ productId, ...data }) => ({
        url: `/products/${productId}/reviews`,
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Reviews'],
    }),

    updateReview: builder.mutation<
      Review,
      { productId: string; reviewId: string; rating: number; comment: string; images?: string[] }
    >({
      query: ({ productId, reviewId, ...data }) => ({
        url: `/products/${productId}/reviews/${reviewId}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: ['Reviews'],
    }),

    deleteReview: builder.mutation<
      { message: string },
      { productId: string; reviewId: string }
    >({
      query: ({ productId, reviewId }) => ({
        url: `/products/${productId}/reviews/${reviewId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Reviews'],
    }),
  }),
});

export const {
  useGetProductReviewsQuery,
  useAddReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} = reviewsApi;