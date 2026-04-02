import { baseApi } from './baseApi';
import type { User } from '../types';

export type { User };

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
  sms: boolean;
}

export interface ProfileUser {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role?: string;
  profileCompleted?: boolean;
  isProfileComplete?: boolean;
}

export interface ProfileUpdateResponse {
  success: boolean;
  message: string;
  user: ProfileUser;
}

export const profileApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getProfile: builder.query<ProfileUser, void>({
      query: () => ({
        url: '/auth/me',
        method: 'GET',
      }),
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<ProfileUpdateResponse, UpdateProfilePayload>({
      query: (body) => ({
        url: '/user/profile',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Profile'],
    }),

    getNotificationPreferences: builder.query<NotificationPreferences, void>({
      query: () => ({
        url: '/user/notification-preferences',
        method: 'GET',
      }),
    }),

    updateNotificationPreferences: builder.mutation<NotificationPreferences, NotificationPreferences>({
      query: (prefs) => ({
        url: '/user/notification-preferences',
        method: 'PUT',
        body: prefs,
      }),
    }),

    updatePushToken: builder.mutation<void, { pushToken: string }>({
      query: (body) => ({
        url: '/user/push-token',
        method: 'POST',
        body,
      }),
    }),

    deleteAccount: builder.mutation<void, void>({
      query: () => ({
        url: '/user/delete-account',
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useDeleteAccountMutation,
} = profileApi;
