/**
 * Voice API Client
 * 
 * Handles all voice learning backend communication
 */

import { baseApi } from './baseApi';

export interface LearnedCorrection {
  wrong: string;
  correct: string;
  productId: string;
  userId?: string;
  count: number;
  confidence: number;
  validationScore: number;
  source: 'user' | 'global';
  lastUsed: string;
}

export interface ProductClick {
  productId: string;
  productName: string;
  userId: string;
  query: string;
  isVoice: boolean;
  sessionId?: string;
}

export interface PopularProduct {
  _id: string;
  productName: string;
  totalClicks: number;
  voiceClicks: number;
  lastClicked: string;
}

export const voiceApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    // Backend-controlled voice correction (with experiment support)
    // 🔥 CRITICAL: Short timeout (1.5s) to prevent hanging UX
    correctVoiceQuery: builder.mutation<
      {
        success: boolean;
        original: string;
        corrected: string;
        confidence: number;
        matched: boolean;
        productId?: string;
        source: 'learned' | 'algorithmic' | 'none';
        variant?: string;
        experimentName?: string;
        thresholdUsed: number;
        latency: number;
      },
      { query: string; userId?: string; requestId?: string }
    >({
      query: (data) => ({
        url: '/voice/correct',
        method: 'POST',
        body: data,
        // Override default 15s timeout with 1.5s for voice UX
        headers: {
          'X-Request-Timeout': '1500',
          // Idempotency key to prevent duplicate processing on timeout/retry
          ...(data.requestId ? { 'X-Request-Id': data.requestId } : {}),
        },
      }),
      // Custom timeout handling
      extraOptions: {
        maxRetries: 0, // No retries for voice - fallback to local instead
      },
    }),
    
    // Save learned correction
    saveCorrection: builder.mutation<
      { success: boolean; correction: LearnedCorrection },
      {
        wrong: string;
        correct: string;
        productId: string;
        userId?: string;
        confidence?: number;
      }
    >({
      query: (data) => ({
        url: '/voice/correction',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Get correction for query
    getCorrection: builder.query<
      { success: boolean; correction: LearnedCorrection | null; source: string },
      { query: string; userId?: string }
    >({
      query: ({ query, userId }) => ({
        url: '/voice/correction',
        method: 'GET',
        params: { query, userId },
      }),
    }),
    
    // Track product click
    trackClick: builder.mutation<
      { success: boolean; click: ProductClick },
      ProductClick
    >({
      query: (data) => ({
        url: '/voice/click',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Get popular products
    getPopularProducts: builder.query<
      { success: boolean; products: PopularProduct[]; period: string },
      { limit?: number; days?: number }
    >({
      query: ({ limit = 10, days = 30 }) => ({
        url: '/voice/popular',
        method: 'GET',
        params: { limit, days },
      }),
    }),
    
    // Sync user data
    syncUserData: builder.mutation<
      { success: boolean; globalCorrections: LearnedCorrection[] },
      {
        userId: string;
        corrections: any[];
        rankings: any[];
      }
    >({
      query: (data) => ({
        url: '/voice/sync',
        method: 'POST',
        body: data,
      }),
    }),
  }),
});

export const {
  useCorrectVoiceQueryMutation,
  useSaveCorrectionMutation,
  useGetCorrectionQuery,
  useLazyGetCorrectionQuery,
  useTrackClickMutation,
  useGetPopularProductsQuery,
  useSyncUserDataMutation,
} = voiceApi;
