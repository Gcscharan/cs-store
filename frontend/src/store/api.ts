// frontend/src/store/api.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { RootState } from "./index"; // adjust path if needed
import { logout as logoutAction } from "./slices/authSlice";
import { Mutex } from "async-mutex";
import { getApiBaseUrl } from "../config/runtime";

/**
 * Robust RTK Query API with:
 * - token-attachment via prepareHeaders
 * - automatic refresh-on-401 (retry once)
 * - transformResponse normalizing _id -> id for products
 *
 * NOTE: adjust baseUrl if your env var name/path differs
 */

const API_BASE_URL = getApiBaseUrl();

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
    const currentAuthState = (api.getState() as any)?.auth?.authState;
    if (currentAuthState === "GOOGLE_AUTH_ONLY") {
      return result;
    }

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

function findWasUnreadInNotificationsV2Cache(getState: () => unknown, notificationId: string): boolean | null {
  try {
    const state: any = getState() as any;
    const queries = state?.api?.queries;
    if (!queries || typeof queries !== "object") return null;

    for (const key of Object.keys(queries)) {
      const entry = queries[key];
      if (!entry || entry.endpointName !== "getNotificationsV2") continue;
      const data = entry?.data;
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      const found = list.find((n: any) => String(n?.id || n?._id || "") === String(notificationId));
      if (found) {
        return !Boolean(found?.isRead);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function removeFromNotificationsV2Caches(dispatch: any, getState: () => unknown, notificationId: string) {
  const v2Args = listNotificationsV2CachedArgs(getState);
  return v2Args.map((arg) =>
    dispatch(
      api.util.updateQueryData("getNotificationsV2", arg, (draft: any) => {
        const list = Array.isArray(draft?.notifications) ? draft.notifications : [];
        const next = list.filter((n: any) => String(n?.id || n?._id || "") !== String(notificationId));
        if (Array.isArray(draft?.notifications)) {
          draft.notifications = next;
        }
      })
    )
  );
}

function listNotificationsV2CachedArgs(getState: () => unknown): any[] {
  try {
    const state: any = getState() as any;
    const queries = state?.api?.queries;
    if (!queries || typeof queries !== "object") return [];
    const args: any[] = [];
    for (const key of Object.keys(queries)) {
      const entry = queries[key];
      if (!entry || entry.endpointName !== "getNotificationsV2") continue;
      args.push(entry.originalArgs);
    }
    return args;
  } catch {
    return [];
  }
}

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
    "NotificationUnreadCount",
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
      query: () => "/auth/me",
      providesTags: ["User"],
      transformResponse: (response: any) => (response && response.user ? response.user : response), // backend returns { user: { ..., profileCompleted } }
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
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`,
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
      query: (id: string) => `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/${id}`,
      providesTags: (_, __, id) => [{ type: "Product" as const, id }],
      transformResponse: (response: any) => ({
        ...response,
        id: response._id ?? response.id,
      }),
    }),
    getSimilarProducts: builder.query({
      query: ({ id, limit = 4 }: { id: string; limit?: number }) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/${id}/similar`,
        method: "GET",
        params: { limit },
      }),
      transformResponse: (response: any) => response,
      providesTags: ["Product"],
    }),

    // ---------- SEARCH ----------
    getSearchSuggestions: builder.query({
      query: ({ q }: { q: string }) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/search/suggestions`,
        method: "GET",
        params: { q },
      }),
      transformResponse: (response: any) => response?.suggestions || [],
    }),
    searchProducts: builder.query({
      query: (params: any) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/search`,
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
      invalidatesTags: ["Cart", "Order", "Notification", "NotificationUnreadCount"],
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
    getNotificationsV2: builder.query({
      query: (params?: { cursor?: string; limit?: number; category?: string }) => ({
        url: "/notifications/v2",
        method: "GET",
        params: {
          ...(params?.cursor ? { cursor: params.cursor } : {}),
          ...(typeof params?.limit === "number" ? { limit: params.limit } : {}),
          ...(params?.category ? { category: params.category } : {}),
        },
      }),
      providesTags: ["Notification"],
    }),
    getUnreadNotificationCount: builder.query<{ count: number }, void>({
      query: () => "/notifications/unread/count",
      providesTags: ["NotificationUnreadCount"],
    }),
    markAsRead: builder.mutation({
      query: (notificationId: string) => ({
        url: `/notifications/${notificationId}/read`,
        method: "PUT",
      }),
      async onQueryStarted(notificationId: string, { dispatch, getState, queryFulfilled }) {
        const wasUnread = findWasUnreadInNotificationsV2Cache(getState, notificationId);
        const v2Args = listNotificationsV2CachedArgs(getState);

        const v2Patches = v2Args.map((arg) =>
          dispatch(
            api.util.updateQueryData("getNotificationsV2", arg, (draft: any) => {
              const list = Array.isArray(draft?.notifications) ? draft.notifications : [];
              for (const n of list) {
                if (String(n?.id || n?._id || "") === String(notificationId)) {
                  n.isRead = true;
                }
              }
            })
          )
        );

        const patchCount = wasUnread
          ? dispatch(
              api.util.updateQueryData(
                "getUnreadNotificationCount",
                undefined,
                (draft: any) => {
                  const current = Number(draft?.count || 0);
                  if (current > 0) {
                    draft.count = current - 1;
                  }
                }
              )
            )
          : ({ undo: () => undefined } as any);

        const patchLegacyList = dispatch(
          api.util.updateQueryData("getNotifications", undefined, (draft: any) => {
            const list = Array.isArray(draft?.notifications) ? draft.notifications : [];
            for (const n of list) {
              if (String(n?._id || n?.id || "") === String(notificationId)) {
                n.isRead = true;
              }
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchCount.undo();
          patchLegacyList.undo();
          for (const p of v2Patches) p.undo();
        }
      },
      invalidatesTags: ["NotificationUnreadCount"],
    }),

    deleteNotification: builder.mutation({
      query: (notificationId: string) => ({
        url: `/notifications/${notificationId}`,
        method: "DELETE",
      }),
      async onQueryStarted(notificationId: string, { dispatch, getState, queryFulfilled }) {
        const deletedWasUnread = findWasUnreadInNotificationsV2Cache(getState, notificationId);
        const v2Patches = removeFromNotificationsV2Caches(dispatch, getState, notificationId);

        const patchLegacyList = dispatch(
          api.util.updateQueryData("getNotifications", undefined, (draft: any) => {
            const list = Array.isArray(draft?.notifications) ? draft.notifications : [];
            const idx = list.findIndex(
              (n: any) => String(n?._id || n?.id || "") === String(notificationId)
            );
            if (idx >= 0) {
              list.splice(idx, 1);
              draft.count = Array.isArray(draft?.notifications) ? draft.notifications.length : draft.count;
            }
          })
        );

        const patchCount = deletedWasUnread
          ? dispatch(
              api.util.updateQueryData(
                "getUnreadNotificationCount",
                undefined,
                (draft: any) => {
                  const current = Number(draft?.count || 0);
                  if (current > 0) {
                    draft.count = current - 1;
                  }
                }
              )
            )
          : ({ undo: () => undefined } as any);

        try {
          await queryFulfilled;
        } catch {
          patchCount.undo();
          patchLegacyList.undo();
          for (const p of v2Patches) p.undo();
        }
      },
      invalidatesTags: ["NotificationUnreadCount"],
    }),

    markAllAsRead: builder.mutation({
      query: () => ({
        url: "/notifications/read-all",
        method: "PUT",
      }),
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        const patchCount = dispatch(
          api.util.updateQueryData(
            "getUnreadNotificationCount",
            undefined,
            (draft: any) => {
              draft.count = 0;
            }
          )
        );

        const v2Args = listNotificationsV2CachedArgs(getState);
        const v2Patches = v2Args.map((arg) =>
          dispatch(
            api.util.updateQueryData("getNotificationsV2", arg, (draft: any) => {
              const list = Array.isArray(draft?.notifications) ? draft.notifications : [];
              for (const n of list) {
                n.isRead = true;
              }
            })
          )
        );

        const patchLegacyList = dispatch(
          api.util.updateQueryData("getNotifications", undefined, (draft: any) => {
            const list = Array.isArray(draft?.notifications) ? draft.notifications : [];
            for (const n of list) {
              n.isRead = true;
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchCount.undo();
          patchLegacyList.undo();
          for (const p of v2Patches) p.undo();
        }
      },
      invalidatesTags: ["NotificationUnreadCount"],
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
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/upload-url`,
        method: "POST",
        body: payload,
      }),
    }),
    createProduct: builder.mutation({
      query: (productData: any) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`,
        method: "POST",
        // productData could be FormData - keep body as-is
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...productData }: any) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/${id}`,
        method: "PUT",
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    deleteProduct: builder.mutation({
      query: (id: string) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/admin/products/${id}`,
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
  useGetNotificationsV2Query,
  useLazyGetNotificationsV2Query,
  useGetUnreadNotificationCountQuery,
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