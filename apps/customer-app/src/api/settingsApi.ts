import { baseApi } from './baseApi';

// ── Notification Preferences ──
export interface NotificationPreferences {
  [channelId: string]: {
    enabled: boolean;
    categories: Record<string, any>;
  };
}

// ── Admin Settings ──
export interface AdminSettings {
  storeName: string;
  storeEmail: string;
  supportPhone: string;
  warehouseLat: number;
  warehouseLng: number;
  warehousePincode: string;
  localRadiusKm: number;
  hubs: Array<{ id: string; name: string; lat: number; lng: number; radiusKm: number }>;
  routeCapacityMin: number;
  routeCapacityMax: number;
  killswitchEnabled: boolean;
  razorpayKeyId: string;
  razorpayConfigured: boolean;
}

// ── Route Types ──
export type RouteStatus = 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface AdminRoute {
  routeId: string;
  vehicleType: string;
  totalDistanceKm: number;
  estimatedTimeMin: number;
  status: RouteStatus;
  deliveryBoyId: string | null;
  orderIds: string[];
  routePath: string[];
  totalOrders: number;
  deliveredCount: number;
  failedCount: number;
  computedAt?: string;
}

export const settingsApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    // Notification Preferences
    getNotificationPreferences: builder.query<NotificationPreferences, void>({
      query: () => ({ url: '/user/notification-preferences', method: 'GET' }),
    }),
    updateNotificationPreferences: builder.mutation<{ success: boolean }, { preferences: NotificationPreferences }>({
      query: (body) => ({
        url: '/user/notification-preferences',
        method: 'PUT',
        body,
      }),
    }),

    // Admin Settings
    getAdminSettings: builder.query<AdminSettings, void>({
      query: () => ({ url: '/admin/settings', method: 'GET' }),
    }),
    updateAdminSettings: builder.mutation<{ success: boolean }, Partial<AdminSettings>>({
      query: (body) => ({
        url: '/admin/settings',
        method: 'PUT',
        body,
      }),
    }),
    toggleKillswitch: builder.mutation<{ success: boolean }, { enabled: boolean }>({
      query: (body) => ({
        url: '/admin/tracking/killswitch',
        method: 'POST',
        body,
      }),
    }),
    forceRouteRecompute: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/admin/routes/compute',
        method: 'POST',
        body: {},
      }),
    }),

    // Admin Routes
    getAdminRoutes: builder.query<{ routes: AdminRoute[] }, void>({
      query: () => ({ url: '/admin/routes', method: 'GET' }),
    }),
    assignRoute: builder.mutation<{ message: string }, { routeId: string; deliveryBoyId: string }>({
      query: ({ routeId, deliveryBoyId }) => ({
        url: `/admin/routes/${routeId}/assign`,
        method: 'POST',
        body: { deliveryBoyId },
      }),
    }),
  }),
});

export const {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useToggleKillswitchMutation,
  useForceRouteRecomputeMutation,
  useGetAdminRoutesQuery,
  useAssignRouteMutation,
} = settingsApi;
