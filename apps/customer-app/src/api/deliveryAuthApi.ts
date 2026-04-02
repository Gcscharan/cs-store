import { baseApi } from './baseApi';

export interface DeliveryLoginRequest {
  email: string;
  password: string;
}

export interface DeliveryLoginResponse {
  user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    isAdmin: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface DeliverySignupRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  vehicleType: 'AUTO' | 'CAR' | 'BIKE' | 'SCOOTER' | 'CYCLE';
}

export interface DeliverySignupResponse {
  message: string;
}

export const deliveryAuthApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    deliveryLogin: builder.mutation<DeliveryLoginResponse, DeliveryLoginRequest>({
      query: (body) => ({
        url: '/delivery/auth/login',
        method: 'POST',
        body,
      }),
    }),

    deliverySignup: builder.mutation<DeliverySignupResponse, DeliverySignupRequest>({
      query: (body) => ({
        url: '/delivery/auth/signup',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useDeliveryLoginMutation,
  useDeliverySignupMutation,
} = deliveryAuthApi;
