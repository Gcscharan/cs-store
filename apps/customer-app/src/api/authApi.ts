import { baseApi } from './baseApi';
import type { User, AuthTokens } from '../types';

export interface AuthResponse extends AuthTokens {
  user: User;
}

export const authApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    sendOtp: builder.mutation<{ success: boolean; message?: string }, { phone: string; mode: 'login' | 'signup'; name?: string }>({
      query: ({ mode, ...body }) => ({
        url: `/auth/send-otp?mode=${mode}`,
        method: 'POST',
        data: body,
      }),
    }),

    verifyOtp: builder.mutation<AuthResponse, { phone: string; otp: string; mode: 'login' | 'signup'; name?: string }>({
      query: ({ mode, ...body }) => ({
        url: `/auth/verify-otp?mode=${mode}`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Profile'],
    }),

    getProfile: builder.query<User, void>({
      query: () => ({
        url: '/auth/me',
        method: 'GET',
      }),
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<{ success: boolean; user: User }, Partial<User>>({
      query: (data) => ({
        url: '/auth/complete-profile',
        method: 'PUT',
        data,
      }),
      invalidatesTags: ['Profile'],
    }),

    checkPhone: builder.mutation<{ exists: boolean }, { phone: string }>({
      query: (body) => ({
        url: '/auth/check-phone',
        method: 'POST',
        data: body,
      }),
    }),

    verifyOnboardingOtp: builder.mutation<{ success: boolean }, { phone: string; otp: string }>({
      query: (body) => ({
        url: '/auth/verify-onboarding-otp',
        method: 'POST',
        data: body,
      }),
    }),

    completeOnboarding: builder.mutation<AuthResponse, { name: string; phone: string }>({
      query: (body) => ({
        url: '/auth/complete-onboarding',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Profile'],
    }),

    signup: builder.mutation<AuthResponse, { name: string; email: string; phone: string }>({
      query: (body) => ({
        url: '/auth/signup',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Profile'],
    }),

    refreshToken: builder.mutation<{ accessToken: string; refreshToken?: string }, { refreshToken: string }>({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        data: body,
      }),
    }),

    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Profile', 'Cart', 'Orders', 'Addresses'],
    }),
  }),
});

export const {
  useSendOtpMutation,
  useVerifyOtpMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useCheckPhoneMutation,
  useVerifyOnboardingOtpMutation,
  useCompleteOnboardingMutation,
  useSignupMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
} = authApi;
