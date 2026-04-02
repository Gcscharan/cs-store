import { baseApi } from './baseApi';

export const deliveryApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    // Orders
    getDeliveryOrders: builder.query<any, void>({
      query: () => ({ url: '/delivery/orders', method: 'GET' }),
      providesTags: ['DeliveryOrders'],
    }),

    // Order Actions
    acceptOrder: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/delivery/orders/${orderId}/accept`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    rejectOrder: builder.mutation<any, { orderId: string; reason?: string }>({
      query: ({ orderId, reason }) => ({
        url: `/delivery/orders/${orderId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    pickupOrder: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/delivery/orders/${orderId}/pickup`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    startDelivery: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/delivery/orders/${orderId}/start-delivery`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    markArrived: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/delivery/orders/${orderId}/arrived`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    deliverAttempt: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/delivery/orders/${orderId}/deliver`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    verifyDeliveryOtp: builder.mutation<any, { orderId: string; otp: string }>({
      query: ({ orderId, otp }) => ({
        url: `/delivery/orders/${orderId}/verify-otp`,
        method: 'POST',
        body: { otp },
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    failDelivery: builder.mutation<any, { orderId: string; failureReasonCode: string; failureNotes?: string }>({
      query: ({ orderId, failureReasonCode, failureNotes }) => ({
        url: `/delivery/orders/${orderId}/fail`,
        method: 'POST',
        body: { failureReasonCode, failureNotes },
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    // COD Collection
    getCodCollection: builder.query<any, string>({
      query: (orderId) => ({
        url: `/delivery/orders/${orderId}/cod-collection`,
        method: 'GET',
      }),
    }),

    createCodCollection: builder.mutation<any, { orderId: string; mode: 'CASH' | 'UPI'; idempotencyKey: string; upiRef?: string }>({
      query: ({ orderId, mode, idempotencyKey, upiRef }) => ({
        url: `/delivery/orders/${orderId}/cod-collection`,
        method: 'POST',
        body: { mode, idempotencyKey, upiRef },
      }),
      invalidatesTags: ['DeliveryOrders'],
    }),

    // Location
    updateLocation: builder.mutation<void, {
      lat: number;
      lng: number;
      accuracy: number | null;
      speed: number;
      heading: number;
      timestamp: number;
      routeId: string;
    }>({
      query: (payload) => ({
        url: '/delivery/location',
        method: 'PUT',
        body: payload,
      }),
    }),

    // Status (on duty toggle)
    toggleStatus: builder.mutation<any, { isOnline: boolean }>({
      query: (body) => ({
        url: '/delivery/status',
        method: 'PUT',
        body,
      }),
    }),

    // Earnings
    getEarnings: builder.query<any, void>({
      query: () => ({ url: '/delivery/earnings', method: 'GET' }),
    }),

    // Profile
    getDeliveryProfile: builder.query<any, void>({
      query: () => ({ url: '/delivery/profile', method: 'GET' }),
      providesTags: ['Profile'],
    }),

    updateDeliveryProfile: builder.mutation<any, { name?: string; phone?: string; email?: string; vehicleType?: string }>({
      query: (body) => ({
        url: '/delivery/profile',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Profile'],
    }),

    // Selfie
    getSelfieUrl: builder.query<{ success: boolean; selfieUrl: string | null }, void>({
      query: () => ({ url: '/delivery/selfie-url', method: 'GET' }),
    }),

    updateSelfie: builder.mutation<any, { selfieUrl: string }>({
      query: (body) => ({
        url: '/delivery/update-selfie',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Profile'],
    }),

    // Current Route
    getCurrentRoute: builder.query<any, void>({
      query: () => ({ url: '/delivery/routes/current', method: 'GET' }),
    }),
  }),
});

export const {
  useGetDeliveryOrdersQuery,
  useAcceptOrderMutation,
  useRejectOrderMutation,
  usePickupOrderMutation,
  useStartDeliveryMutation,
  useMarkArrivedMutation,
  useDeliverAttemptMutation,
  useVerifyDeliveryOtpMutation,
  useFailDeliveryMutation,
  useGetCodCollectionQuery,
  useCreateCodCollectionMutation,
  useUpdateLocationMutation,
  useToggleStatusMutation,
  useGetEarningsQuery,
  useGetDeliveryProfileQuery,
  useUpdateDeliveryProfileMutation,
  useGetSelfieUrlQuery,
  useUpdateSelfieMutation,
  useGetCurrentRouteQuery,
} = deliveryApi;
