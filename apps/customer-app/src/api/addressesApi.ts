import { baseApi } from './baseApi';
import type { Address } from '../types';

export type { Address };

export interface PincodeCheckResponse {
  deliverable: boolean;
  state?: string;
  postal_district?: string;
  admin_district?: string;
  cities?: string[];
  message?: string;
}

export interface GetAddressesResponse {
  addresses: Address[];
  defaultAddressId: string | null;
}

export const addressesApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getAddresses: builder.query<GetAddressesResponse, void>({
      query: () => ({ url: '/user/addresses', method: 'GET' }),
      transformResponse: (response: any) => {
        console.log('[getAddresses] Raw response:', JSON.stringify(response)?.slice(0, 500));
        const result = {
          addresses: response?.addresses || [],
          defaultAddressId: response?.defaultAddressId || null,
        };
        console.log('[getAddresses] Transformed:', result.addresses?.length, 'addresses, defaultId:', result.defaultAddressId);
        return result;
      },
      providesTags: ['Addresses'],
    }),

    addAddress: builder.mutation<Address, Address>({
      query: (body) => ({
        url: '/user/addresses',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Addresses'],
      onQueryStarted: async (args, { queryFulfilled, dispatch }) => {
        console.log('[addAddress] Mutation started, args:', args);
        try {
          const result = await queryFulfilled;
          console.log('[addAddress] Mutation success:', result?.data?._id);
          // Force immediate refetch of addresses
          dispatch(baseApi.util.invalidateTags(['Addresses']));
        } catch (err) {
          console.log('[addAddress] Mutation error:', err);
        }
      },
    }),

    updateAddress: builder.mutation<Address, Address>({
      query: (body) => ({
        url: `/user/addresses/${body._id}`,
        method: 'PUT',
        data: body,
      }),
      invalidatesTags: ['Addresses'],
    }),

    deleteAddress: builder.mutation<void, string>({
      query: (addressId) => ({
        url: `/user/addresses/${addressId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Addresses'],
    }),

    setDefaultAddress: builder.mutation<void, string>({
      query: (addressId) => ({
        url: `/user/addresses/${addressId}/default`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Addresses'],
    }),

    checkPincode: builder.query<PincodeCheckResponse, string>({
      query: (pincode) => ({
        url: `/pincode/check/${pincode}`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  useCheckPincodeQuery,
  useLazyCheckPincodeQuery,
} = addressesApi;
