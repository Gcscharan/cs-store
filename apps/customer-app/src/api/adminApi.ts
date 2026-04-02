import { baseApi } from './baseApi';

export const adminApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    // Dashboard
    getDashboardStats: builder.query({
      query: () => ({ url: '/admin/dashboard-stats', method: 'GET' }),
    }),

    // Products
    getAdminProducts: builder.query({
      query: () => ({ url: '/admin/products', method: 'GET' }),
      providesTags: ['Products'],
    }),
    deleteAdminProduct: builder.mutation({
      query: (id) => ({ url: `/admin/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Products'],
    }),
    updateAdminProduct: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/products/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Products'],
    }),
    createAdminProduct: builder.mutation({
      query: (formData) => ({
        url: '/admin/products',
        method: 'POST',
        body: formData,
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
    }),
    deleteAdminUser: builder.mutation({
      query: (id) => ({
        url: `/admin/users/${id}`,
        method: 'DELETE',
      }),
    }),

    // Delivery Boys
    getDeliveryBoys: builder.query({
      query: () => ({
        url: '/admin/delivery-boys-list',
        method: 'GET',
      }),
    }),
    approveDeliveryBoy: builder.mutation({
      query: (id) => ({
        url: `/admin/delivery-boys/${id}/approve`,
        method: 'PUT',
      }),
    }),
    suspendDeliveryBoy: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/admin/delivery-boys/${id}/suspend`,
        method: 'PUT',
        body: { reason },
      }),
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
