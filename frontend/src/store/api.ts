import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as any).auth?.accessToken;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User", "Product", "Order", "Payment"],
  endpoints: (builder) => ({
    // Auth endpoints
    login: builder.mutation({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    register: builder.mutation({
      query: (userData) => ({
        url: "/auth/register",
        method: "POST",
        body: userData,
      }),
    }),
    refreshToken: builder.mutation({
      query: (refreshToken) => ({
        url: "/auth/refresh",
        method: "POST",
        body: { refreshToken },
      }),
    }),

    // User endpoints
    getProfile: builder.query({
      query: () => "/user/profile",
      providesTags: ["User"],
    }),
    updateProfile: builder.mutation({
      query: (profileData) => ({
        url: "/user/profile",
        method: "PUT",
        body: profileData,
      }),
      invalidatesTags: ["User"],
    }),

    // Product endpoints
    getProducts: builder.query({
      query: (params) => ({
        url: "/products",
        params,
      }),
      providesTags: ["Product"],
    }),
    getProductById: builder.query({
      query: (id) => `/products/${id}`,
      providesTags: ["Product"],
    }),
    searchProducts: builder.query({
      query: (searchTerm) => ({
        url: "/products/search",
        params: { q: searchTerm },
      }),
      providesTags: ["Product"],
    }),

    // Order endpoints
    getOrders: builder.query({
      query: () => "/orders",
      providesTags: ["Order"],
    }),
    createOrder: builder.mutation({
      query: (orderData) => ({
        url: "/orders",
        method: "POST",
        body: orderData,
      }),
      invalidatesTags: ["Order"],
    }),

    // Pincode endpoints
    checkPincode: builder.query({
      query: (pincode) => `/pincode/check/${pincode}`,
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetProductsQuery,
  useGetProductByIdQuery,
  useSearchProductsQuery,
  useGetOrdersQuery,
  useCreateOrderMutation,
  useCheckPincodeQuery,
} = api;
