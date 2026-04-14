import { baseApi } from './baseApi';

export const adminApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    // Dashboard
    getDashboardStats: builder.query({
      query: () => ({ url: '/admin/dashboard-stats', method: 'GET' }),
    }),

    // Products
    getAdminProducts: builder.query<any, { status?: 'draft' | 'published' } | undefined>({
      query: (arg) => ({
        url: '/admin/products',
        method: 'GET',
        params: arg?.status ? { status: arg.status } : undefined,
      }),
      providesTags: ['Products'],
    }),
    deleteAdminProduct: builder.mutation({
      query: (id) => ({ url: `/admin/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Products'],
    }),
    updateAdminProduct: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/products/${id}`,
        method: 'PATCH', // Changed to PATCH for partial updates
        body,
      }),
      invalidatesTags: ['Products'],
    }),
    createAdminProduct: builder.mutation({
      query: (formData) => ({
        url: '/admin/products',
        method: 'POST',
        body: formData,
        headers: {
          'X-Request-Timeout': '60000', // 60s for image uploads
        },
      }),
      invalidatesTags: ['Products'],
    }),
    publishAdminProduct: builder.mutation({
      query: (id) => ({
        url: `/admin/products/${id}/publish`,
        method: 'POST',
      }),
      invalidatesTags: ['Products'],
    }),

    // Version Control
    getProductVersionHistory: builder.query<any, { productId: string; page?: number; limit?: number }>({
      query: ({ productId, page = 1, limit = 20 }) => ({
        url: `/admin/products/${productId}/versions`,
        method: 'GET',
        params: { page, limit },
      }),
    }),
    getProductVersion: builder.query<any, { productId: string; version: number }>({
      query: ({ productId, version }) => ({
        url: `/admin/products/${productId}/versions/${version}`,
        method: 'GET',
      }),
    }),
    getProductVersionDiff: builder.query<any, { productId: string; v1: number; v2: number }>({
      query: ({ productId, v1, v2 }) => ({
        url: `/admin/products/${productId}/versions/${v1}/diff/${v2}`,
        method: 'GET',
      }),
    }),
    rollbackProduct: builder.mutation<any, { productId: string; version: number }>({
      query: ({ productId, version }) => ({
        url: `/admin/products/${productId}/rollback/${version}`,
        method: 'POST',
      }),
      invalidatesTags: ['Products'],
    }),

    // Orders
    getAdminOrders: builder.query({
      query: () => ({ url: '/admin/orders', method: 'GET' }),
      providesTags: ['Orders'],
    }),
    confirmOrder: builder.mutation({
      query: (id) => ({
        url: `/admin/orders/${id}/confirm`,
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),
    packOrder: builder.mutation({
      query: (id) => ({
        url: `/admin/orders/${id}/pack`,
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),
    cancelOrder: builder.mutation({
      query: (id) => ({
        url: `/orders/${id}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: ['Orders'],
    }),

    // Users
    getAdminUsers: builder.query({
      query: () => ({ url: '/admin/users', method: 'GET' }),
      providesTags: ['Users'],
    }),
    deleteAdminUser: builder.mutation({
      query: (id) => ({
        url: `/admin/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Users'],
    }),

    // Delivery Boys
    getDeliveryBoys: builder.query({
      query: () => ({
        url: '/admin/delivery-boys-list',
        method: 'GET',
      }),
      providesTags: ['DeliveryBoys'],
    }),
    approveDeliveryBoy: builder.mutation({
      query: (id) => ({
        url: `/admin/delivery-boys/${id}/approve`,
        method: 'PUT',
      }),
      invalidatesTags: ['DeliveryBoys'],
    }),
    suspendDeliveryBoy: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/admin/delivery-boys/${id}/suspend`,
        method: 'PUT',
        body: { reason },
      }),
      invalidatesTags: ['DeliveryBoys'],
    }),

    // Analytics
    getAnalytics: builder.query({
      query: () => ({ url: '/admin/analytics', method: 'GET' }),
    }),

    // Admin Ops
    getOutboxFailures: builder.query({
      query: (limit = 50) => ({ url: '/admin/ops/outbox/failures', method: 'GET', params: { limit } }),
    }),
    getInventoryDrift: builder.query({
      query: () => ({ url: '/admin/ops/inventory/drift', method: 'GET' }),
    }),
    getTrackingKillswitch: builder.query({
      query: () => ({ url: '/admin/ops/tracking/killswitch', method: 'GET' }),
    }),

    // Finance Health
    getFinanceHealth: builder.query({
      query: () => ({ url: '/internal/finance/health', method: 'GET' }),
    }),

    // Payments
    getPaymentLogs: builder.query({
      query: () => ({ url: '/internal/payments/reconciliation', method: 'GET' }),
    }),
    getPaymentRecoverySuggestion: builder.query({
      query: ({ orderId, paymentIntentId }) => ({
        url: '/internal/payments/recovery-suggestion',
        method: 'GET',
        params: { orderId, paymentIntentId },
      }),
    }),
    executePaymentRecovery: builder.mutation({
      query: ({ paymentIntentId, action, reason }) => ({
        url: `/internal/payments/recovery/${paymentIntentId}/action`,
        method: 'POST',
        body: { action, reason },
      }),
    }),

    // Finance
    getFinanceData: builder.query({
      query: ({ from, to }) => ({
        url: '/internal/finance/net-revenue',
        method: 'GET',
        params: { from, to, currency: 'INR' },
      }),
    }),
    getFinanceRevenueLedger: builder.query({
      query: ({ from, to }) => ({
        url: '/internal/finance/revenue-ledger',
        method: 'GET',
        params: { from, to, currency: 'INR' },
      }),
    }),
    getFinanceRefundLedger: builder.query({
      query: ({ from, to }) => ({
        url: '/internal/finance/refund-ledger',
        method: 'GET',
        params: { from, to, currency: 'INR' },
      }),
    }),
    getFinanceGatewayPerformance: builder.query({
      query: ({ from, to }) => ({
        url: '/internal/finance/gateway-performance',
        method: 'GET',
        params: { from, to, currency: 'INR' },
      }),
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetAdminProductsQuery,
  useDeleteAdminProductMutation,
  useUpdateAdminProductMutation,
  useCreateAdminProductMutation,
  usePublishAdminProductMutation,
  useGetProductVersionHistoryQuery,
  useGetProductVersionQuery,
  useGetProductVersionDiffQuery,
  useRollbackProductMutation,
  useGetAdminOrdersQuery,
  useConfirmOrderMutation,
  usePackOrderMutation,
  useCancelOrderMutation,
  useGetAdminUsersQuery,
  useDeleteAdminUserMutation,
  useGetDeliveryBoysQuery,
  useApproveDeliveryBoyMutation,
  useSuspendDeliveryBoyMutation,
  useGetAnalyticsQuery,
  useGetOutboxFailuresQuery,
  useGetInventoryDriftQuery,
  useGetTrackingKillswitchQuery,
  useGetFinanceHealthQuery,
  useGetPaymentLogsQuery,
  useGetPaymentRecoverySuggestionQuery,
  useExecutePaymentRecoveryMutation,
  useGetFinanceDataQuery,
  useGetFinanceRevenueLedgerQuery,
  useGetFinanceRefundLedgerQuery,
  useGetFinanceGatewayPerformanceQuery,
} = adminApi;
