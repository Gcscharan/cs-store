import { baseApi } from './baseApi';

export type NotificationCategory = 'order' | 'delivery' | 'payment' | 'account' | 'promo';
export type NotificationPriority = 'high' | 'normal' | 'low';

export interface Notification {
  id: string;
  _id?: string;
  title: string;
  body: string;
  eventType?: string;
  meta?: Record<string, any>;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  deepLink?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface NotificationsParams {
  cursor?: string;
  limit?: number;
  category?: NotificationCategory | 'all';
}

export const notificationsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationsResponse, NotificationsParams>({
      query: ({ cursor, limit = 20, category }) => ({
        url: '/notifications',
        method: 'GET',
        params: {
          limit,
          ...(cursor ? { cursor } : {}),
          ...(category && category !== 'all' ? { category } : {}),
        },
      }),
      providesTags: ['Notifications'],
    }),

    getUnreadCount: builder.query<{ count: number }, void>({
      query: () => ({
        url: '/notifications/unread/count',
        method: 'GET',
      }),
      providesTags: ['Notifications'],
    }),

    markAsRead: builder.mutation<void, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications'],
    }),

    markAllAsRead: builder.mutation<void, void>({
      query: () => ({
        url: '/notifications/read-all',
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications'],
    }),

    deleteNotification: builder.mutation<void, string>({
      query: (id) => ({
        url: `/notifications/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
} = notificationsApi;
