import { baseApi } from './baseApi';
import type { Order, PaginatedResponse, OrderStatus, OrderTracking } from '../types';

export const ordersApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getOrders: builder.query<PaginatedResponse<Order>, { status?: OrderStatus; page?: number; limit?: number } | undefined>({
      query: (params) => ({
        url: '/orders',
        method: 'GET',
        params: {
          status: params?.status,
          page: params?.page,
          limit: params?.limit,
        },
      }),
      providesTags: ['Orders'],
    }),

    getOrderById: builder.query<Order, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}`,
        method: 'GET',
      }),
      providesTags: ['Order'],
    }),

    getOrderTracking: builder.query<OrderTracking, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}/tracking`,
        method: 'GET',
      }),
      providesTags: ['Order'],
    }),

    cancelOrder: builder.mutation<{ success: boolean }, { orderId: string; reason?: string }>({
      query: ({ orderId, reason }) => ({
        url: `/orders/${orderId}/cancel`,
        method: 'PUT',
        data: { reason },
      }),
      invalidatesTags: ['Orders', 'Order'],
    }),

    requestRefund: builder.mutation<{ success: boolean; refundId?: string }, { orderId: string; reason: string; amount?: number }>({
      query: ({ orderId, ...data }) => ({
        url: `/orders/${orderId}/refund`,
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Orders', 'Order'],
    }),

    getOrderInvoice: builder.query<{ invoiceUrl: string }, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}/invoice`,
        method: 'GET',
      }),
    }),

    createOrder: builder.mutation<Order, {
      paymentMethod: 'cod' | 'upi';
      idempotencyKey: string;
      upiVpa?: string;
      couponCode?: string;
    }>({
      query: (args) => ({
        url: '/orders',
        method: 'POST',
        data: {
          paymentMethod: args.paymentMethod,
          idempotencyKey: args.idempotencyKey,
          ...(args.upiVpa ? { upiVpa: args.upiVpa } : {}),
          ...(args.couponCode ? { couponCode: args.couponCode } : {}),
        },
        headers: {
          'Idempotency-Key': args.idempotencyKey,
        },
      }),
      invalidatesTags: ['Orders', 'Cart'],
    }),

    verifyUPI: builder.mutation<{ valid: boolean; name?: string; bank?: string }, string>({
      query: (vpa) => ({
        url: '/upi/verify',
        method: 'POST',
        data: { vpa },
      }),
    }),

    clearCart: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/cart/clear',
        method: 'DELETE',
      }),
      invalidatesTags: ['Cart'],
    }),

    getPaymentStatus: builder.query<{ paymentStatus: string }, string>({
      query: (orderId) => ({
        url: `/payment-status/${orderId}`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useLazyGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderTrackingQuery,
  useCancelOrderMutation,
  useRequestRefundMutation,
  useGetOrderInvoiceQuery,
  useCreateOrderMutation,
  useVerifyUPIMutation,
  useClearCartMutation,
  useGetPaymentStatusQuery,
  useLazyGetPaymentStatusQuery,
} = ordersApi;
