import { baseApi } from './baseApi';

export interface ReferralCode {
  code: string;
  link?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
  pending: number;
  completed: number;
}

export const referralApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getReferralCode: builder.query<ReferralCode, void>({
      query: () => ({
        url: '/user/referral',
        method: 'GET',
      }),
    }),

    getReferralStats: builder.query<ReferralStats, void>({
      query: () => ({
        url: '/user/referral/stats',
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useGetReferralCodeQuery,
  useGetReferralStatsQuery,
} = referralApi;
