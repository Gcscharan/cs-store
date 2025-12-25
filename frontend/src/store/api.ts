// frontend/src/store/api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { RootState } from "./index"; // adjust path if needed
import { logout as logoutAction } from "./slices/authSlice";
import { Mutex } from "async-mutex";

/**
 * Robust RTK Query API with:
 * - token-attachment via prepareHeaders
 * - automatic refresh-on-401 (retry once)
 * - transformResponse normalizing _id -> id for products
 *
 * NOTE: adjust baseUrl if your env var name/path differs
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL ||
  "http://localhost:5001") + "/api";

// Mutex for token refresh race condition prevention
const mutex = new Mutex();

// raw baseQuery used for actual fetch calls
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "include", // send cookies if used
  timeout: 10000, // 10 second timeout
  prepareHeaders: (headers, { getState }) => {
    try {
      const token = (getState() as RootState).auth?.tokens?.accessToken;
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
    } catch (e) {
      // silent
    }
    return headers;
  },
});

// wrapper baseQuery to handle 401 --> attempt refresh --> retry original
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshResponse: any = await rawBaseQuery(
          {
            url: "/auth/refresh",
            method: "POST",
            body: { refreshToken: (api.getState() as any).auth?.tokens?.refreshToken },
          },
          api,
          extraOptions
        );

        if (refreshResponse?.data?.accessToken) {
          api.dispatch({
            type: "auth/setTokens",
            payload: {
              accessToken: refreshResponse.data.accessToken,
              refreshToken: refreshResponse.data.refreshToken ?? (api.getState() as any).auth?.tokens?.refreshToken,
            },
          });

          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          api.dispatch({ type: "auth/logout" });
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "User",
    "Product",
    "Order",
    "Payment",
    "Cart",
    "Address",
    "Notification",
  ],
  endpoints: (builder) => ({
    // ---------- AUTH ----------
    login: builder.mutation({
      query: (credentials: { identifier: string; password: string }) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    signup: builder.mutation({
      query: (payload: any) => ({
        url: "/auth/signup",
        method: "POST",
        body: payload,
      }),
    }),
    refreshToken: builder.mutation({
      query: (refreshToken: string) => ({
        url: "/auth/refresh",
        method: "POST",
        body: { refreshToken },
      }),
    }),
    changePassword: builder.mutation({
      query: (payload: { currentPassword: string; newPassword: string }) => ({
        url: "/auth/change-password",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["User"],
    }),
    logout: builder.mutation({
      query: (payload?: { refreshToken?: string }) => ({
        url: "/auth/logout",
        method: "POST",
        body: payload,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // On logout, clear auth state locally
        try {
          await queryFulfilled;
        } finally {
          dispatch(logoutAction());
        }
      },
    }),

    // ---------- USER ----------
    getProfile: builder.query({
      query: () => "/user/profile",
      providesTags: ["User"],
      transformResponse: (response: any) => response, // backend returns user object
    }),
    updateProfile: builder.mutation({
      query: (profileData: any) => ({
        url: "/user/profile",
        method: "PUT",
        body: profileData,
      }),
      invalidatesTags: ["User"],
    }),
    deleteAccount: builder.mutation({
      query: () => ({
        url: "/user/delete-account",
        method: "DELETE",
      }),
      invalidatesTags: ["User", "Cart", "Order", "Notification"],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Clear all user-related cache on delete
          dispatch(api.util.resetApiState());
        } catch (error) {
          // Handle deletion error
        }
      },
    }),

    // ---------- PRODUCTS ----------
    getProducts: builder.query({
      // params: object (page, limit, filters) OR undefined
      query: (params?: Record<string, any>) => ({
        url: "/products",
        method: "GET",
        params,
      }),
      providesTags: (result: any) =>
        result?.products
          ? [
              ...result.products.map((p: any) => ({ type: "Product" as const, id: p._id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
      transformResponse: (response: any) => {
        // Map _id to id for frontend compatibility
        const products = (response?.products || []).map((p: any) => ({
          ...p,
          id: p._id ?? p.id,
        }));
        return { ...response, products };
      },
    }),
    getProductById: builder.query({
      query: (id: string) => `/products/${id}`,
      providesTags: (_, __, id) => [{ type: "Product" as const, id }],
      transformResponse: (response: any) => ({
        ...response,
        id: response._id ?? response.id,
      }),
    }),
    getSimilarProducts: builder.query({
      query: ({ id, limit = 4 }: { id: string; limit?: number }) => ({
        url: `/products/${id}/similar`,
        method: "GET",
        params: { limit },
      }),
      transformResponse: (response: any) => response,
      providesTags: ["Product"],
    }),

    // ---------- SEARCH ----------
    getSearchSuggestions: builder.query({
      query: ({ q }: { q: string }) => ({
        url: `/products/search/suggestions`,
        method: "GET",
        params: { q },
      }),
      transformResponse: (response: any) => response?.suggestions || [],
    }),
    searchProducts: builder.query({
      query: (params: any) => ({
        url: "/products/search",
        method: "GET",
        params,
      }),
      transformResponse: (response: any) => response,
      providesTags: ["Product"],
    }),

    // ---------- CART ----------
    getCart: builder.query({
      query: () => "/cart",
      providesTags: ["Cart"],
    }),
    addToCart: builder.mutation({
      query: (cartData: any) => ({
        url: "/cart",
        method: "POST",
        body: cartData,
      }),
      invalidatesTags: ["Cart"],
    }),
    updateCartItem: builder.mutation({
      query: (cartData: any) => ({
        url: "/cart",
        method: "PUT",
        body: cartData,
      }),
      invalidatesTags: ["Cart"],
    }),
    removeFromCart: builder.mutation({
      query: (productId: string) => ({
        url: `/cart/${productId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Cart"],
    }),
    clearCart: builder.mutation({
      query: () => ({
        url: "/cart/clear",
        method: "DELETE",
      }),
      invalidatesTags: ["Cart"],
    }),

    // ---------- ORDERS ----------
    getOrders: builder.query({
      query: () => "/orders",
      providesTags: ["Order"],
    }),
    createOrder: builder.mutation({
      query: (orderData: any) => ({
        url: "/orders",
        method: "POST",
        body: orderData,
      }),
      invalidatesTags: ["Cart", "Order"],
    }),

    // ---------- ADDRESS ----------
    getAddresses: builder.query({
      query: () => "/user/addresses",
      providesTags: ["Address"],
      transformResponse: (response: any) => {
        return {
          addresses: response?.addresses || [],
          defaultAddressId: response?.defaultAddressId || null,
        };
      },
    }),
    addAddress: builder.mutation({
      query: (addressData: any) => ({
        url: "/user/addresses",
        method: "POST",
        body: addressData,
      }),
      invalidatesTags: ["Address"],
    }),
    updateAddress: builder.mutation({
      query: ({ addressId, ...addressData }: any) => ({
        url: `/user/addresses/${addressId}`,
        method: "PUT",
        body: addressData,
      }),
      invalidatesTags: ["Address"],
    }),
    deleteAddress: builder.mutation({
      query: (addressId: string) => ({
        url: `/user/addresses/${addressId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Address"],
    }),
    setDefaultAddress: builder.mutation({
      query: (addressId: string) => ({
        url: `/user/addresses/${addressId}/default`,
        method: "PATCH",
      }),
      invalidatesTags: ["Address"],
    }),

    // ---------- NOTIFICATIONS ----------
    getNotifications: builder.query({
      query: () => "/notifications",
      providesTags: ["Notification"],
    }),
    getUnreadCount: builder.query({
      query: () => "/notifications/unread/count",
      providesTags: ["Notification"],
    }),
    markAsRead: builder.mutation({
      query: (notificationId: string) => ({
        url: `/notifications/${notificationId}/read`,
        method: "PUT",
      }),
      invalidatesTags: ["Notification"],
    }),
    markAllAsRead: builder.mutation({
      query: () => ({
        url: "/notifications/read-all",
        method: "PUT",
      }),
      invalidatesTags: ["Notification"],
    }),
    deleteNotification: builder.mutation({
      query: (notificationId: string) => ({
        url: `/notifications/${notificationId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Notification"],
    }),

    // ---------- NOTIFICATION PREFERENCES ----------
    getNotificationPreferences: builder.query({
      query: () => "/user/notification-preferences",
      providesTags: ["User"],
    }),
    updateNotificationPreferences: builder.mutation({
      query: (preferences: any) => ({
        url: "/user/notification-preferences",
        method: "PUT",
        // Backend expects full-object updates under a `preferences` key
        body: { preferences },
      }),
      invalidatesTags: ["User"],
    }),

    // ---------- ADMIN (upload/product management) ----------
    getPresignedUploadUrl: builder.mutation({
      query: (payload: any) => ({
        url: "/products/upload-url",
        method: "POST",
        body: payload,
      }),
    }),
    createProduct: builder.mutation({
      query: (productData: any) => ({
        url: "/products",
        method: "POST",
        // productData could be FormData - keep body as-is
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...productData }: any) => ({
        url: `/products/${id}`,
        method: "PUT",
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    deleteProduct: builder.mutation({
      query: (id: string) => ({
        url: `/admin/products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Product"],
    }),

    // ---------- PINCODE / MISC ----------
    checkPincode: builder.query({
      query: (pincode: string) => `/pincode/check/${pincode}`,
    }),
  }),
});

// Export hooks
export const {
  useLoginMutation,
  useSignupMutation,
  useRefreshTokenMutation,
  useChangePasswordMutation,
  useLogoutMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useDeleteAccountMutation,
  useGetProductsQuery,
  useGetProductByIdQuery,
  useGetSimilarProductsQuery,
  useGetSearchSuggestionsQuery,
  useSearchProductsQuery,
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
  useClearCartMutation,
  useGetOrdersQuery,
  useCreateOrderMutation,
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useGetPresignedUploadUrlMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useCheckPincodeQuery,
} = api;

export default api;