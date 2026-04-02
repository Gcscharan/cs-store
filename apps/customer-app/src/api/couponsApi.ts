import { baseApi } from './baseApi';

export interface Coupon {
  _id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minCartValue: number;
  expiryDate: string;
}

export interface ValidateCouponRequest {
  code: string;
  cartTotal: number;
}

export interface ValidateCouponResponse {
  valid: boolean;
  discount: number;
  message: string;
}

export const couponsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCoupons: builder.query<Coupon[], void>({
      query: () => ({ url: '/coupons' }),
      providesTags: ['Coupons'],
    }),
    validateCoupon: builder.mutation<ValidateCouponResponse, ValidateCouponRequest>({
      query: (body) => ({
        url: '/coupons/validate',
        method: 'POST',
        data: body,
      }),
    }),
  }),
});

export const {
  useGetCouponsQuery,
  useGetSmartCouponsQuery,
  useValidateCouponMutation,
} = couponsApi;