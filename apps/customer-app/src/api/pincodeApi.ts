import { baseApi } from './baseApi';

export interface PincodeCheckResponse {
  pincode: string;
  serviceable: boolean;
  estimatedDays?: number;
}

export const pincodeApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    checkPincode: builder.query<PincodeCheckResponse, string>({
      query: (pincode) => ({
        url: `/pincode/check/${pincode}`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useCheckPincodeQuery,
} = pincodeApi;
