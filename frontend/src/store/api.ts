// frontend/src/store/api.ts
import { createApi } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosError, AxiosRequestConfig } from "axios";
import { logout as logoutAction } from "./slices/authSlice";
import { publicApi } from "../config/publicApi";
import axiosApi from "../api/axiosInstance";
import { toApiUrl } from "../config/runtime";

/**
 * RTK Query API with axios baseQuery
 * 
 * Token refresh is handled EXCLUSIVELY by axiosInstance.ts interceptor.
 * This file does NOT handle 401 TOKEN_EXPIRED - axios handles it automatically.
 * 
 * Architecture:
 * - RTK Query calls axios via axiosBaseQuery
 * - Axios attaches token via request interceptor
 * - On 401 TOKEN_EXPIRED, axios refreshes and retries
 * - RTK Query receives successful response or final error
 */

// -------- Axios Base Query --------
// Uses axios instance which has built-in refresh interceptor

interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig["method"];
  body?: any;
  params?: any;
  headers?: Record<string, string>;
}

interface AxiosBaseQueryError {
  status: number;
  data: any;
}

const axiosBaseQuery: BaseQueryFn<
  AxiosBaseQueryArgs,
  unknown,
  AxiosBaseQueryError
> = async (args) => {
  try {
    const response = await axiosApi({
      url: args.url,
      method: args.method || "GET",
      data: args.body,
      params: args.params,
      headers: args.headers,
    });

    return { data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<any>;

    // Axios interceptor already handled refresh if it was a TOKEN_EXPIRED
    // If we get here with 401, it means refresh failed or it's not a token expiry
    if (axiosError.response) {
      return {
        error: {
          status: axiosError.response.status,
          data: axiosError.response.data,
        },
      };
    }

    // Network error or other non-HTTP error
    return {
      error: {
        status: "FETCH_ERROR" as any,
        data: axiosError.message || "Network error",
      },
    };
  }
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
  baseQuery: axiosBaseQuery,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  keepUnusedDataFor: 60,
  tagTypes: [
    "User",
    "Product",
    "Order",
    "Payment",
    "Cart",
    "Address",
    "Notification",
    "NotificationUnreadCount",
    "DeliveryProfile",
  ],
  endpoints: (builder) => ({
    // ---------- AUTH ----------
    login: builder.mutation({
      query: (credentials: { identifier: string; password: string }) => ({
        url: toApiUrl("/auth/login"),
        method: "POST",
        body: credentials,
      }),
    }),
    signup: builder.mutation({
      query: (payload: any) => ({
        url: toApiUrl("/auth/signup"),
        method: "POST",
        body: payload,
      }),
    }),
    refreshToken: builder.mutation({
      query: (refreshToken: string) => ({
        url: toApiUrl("/auth/refresh"),
        method: "POST",
        body: { refreshToken },
      }),
    }),
    changePassword: builder.mutation({
      query: (payload: { currentPassword: string; newPassword: string }) => ({
        url: toApiUrl("/auth/change-password"),
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["User"],
    }),
    logout: builder.mutation({
      query: (payload?: { refreshToken?: string }) => ({
        url: toApiUrl("/auth/logout"),
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
      query: () => ({ url: toApiUrl("/auth/me") }),
      providesTags: ["User"],
      transformResponse: (response: any) => (response && response.user ? response.user : response), // backend returns { user: { ..., profileCompleted } }
    }),
    updateProfile: builder.mutation({
      query: (profileData: any) => ({
        url: toApiUrl("/user/profile"),
        method: "PUT",
        body: profileData,
      }),
      invalidatesTags: ["User"],
    }),
    deleteAccount: builder.mutation({
      query: () => ({
        url: toApiUrl("/user/delete-account"),
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
      async queryFn(params?: Record<string, any>) {
        try {
          const res = await publicApi.get("/api/products", { params });
          const response: any = res.data;

          // Map _id to id for frontend compatibility
          const products = (response?.products || []).map((p: any) => ({
            ...p,
            id: p._id ?? p.id,
          }));
          return { data: { ...response, products } };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
      providesTags: (result: any) =>
        result?.products
          ? [
              ...result.products.map((p: any) => ({ type: "Product" as const, id: p._id })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),
    getProductById: builder.query({
      async queryFn(id: string) {
        try {
          const res = await publicApi.get(`/api/products/${id}`);
          const response: any = res.data;
          return {
            data: {
              ...response,
              id: response?._id ?? response?.id,
            },
          };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
      providesTags: (_, __, id) => [{ type: "Product" as const, id }],
    }),
    getSimilarProducts: builder.query({
      async queryFn({ id, limit = 4 }: { id: string; limit?: number }) {
        try {
          const res = await publicApi.get(`/api/products/${id}/similar`, {
            params: { limit },
          });
          return { data: res.data };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
      providesTags: ["Product"],
    }),

    // ---------- SEARCH ----------
    getSearchSuggestions: builder.query({
      async queryFn({ q }: { q: string }) {
        try {
          const res = await publicApi.get("/api/products/search/suggestions", {
            params: { q },
          });
          return { data: res.data?.suggestions || [] };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
    }),
    searchProducts: builder.query({
      async queryFn(params: any) {
        try {
          const res = await publicApi.get("/api/products/search", { params });
          return { data: res.data };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
      providesTags: ["Product"],
    }),

    // ---------- CART ----------
    getCart: builder.query({
      query: () => ({ url: toApiUrl("/cart") }),
      providesTags: ["Cart"],
    }),
    addToCart: builder.mutation({
      query: (cartData: any) => ({
        url: toApiUrl("/cart"),
        method: "POST",
        body: cartData,
      }),
      invalidatesTags: ["Cart"],
    }),
    updateCartItem: builder.mutation({
      query: (cartData: any) => ({
        url: toApiUrl("/cart"),
        method: "PUT",
        body: cartData,
      }),
      invalidatesTags: ["Cart"],
    }),
    removeFromCart: builder.mutation({
      query: (productId: string) => ({
        url: toApiUrl(`/cart/${productId}`),
        method: "DELETE",
      }),
      invalidatesTags: ["Cart"],
    }),
    clearCart: builder.mutation({
      query: () => ({
        url: toApiUrl("/cart/clear"),
        method: "DELETE",
      }),
      invalidatesTags: ["Cart"],
    }),

    // ---------- ORDERS ----------
    getOrders: builder.query({
      query: () => ({ url: toApiUrl("/orders") }),
      providesTags: ["Order"],
    }),
    createOrder: builder.mutation({
      query: (orderData: any) => ({
        url: toApiUrl("/orders"),
        method: "POST",
        body: orderData,
      }),
      invalidatesTags: ["Cart", "Order", "Notification", "NotificationUnreadCount"],
    }),

    // ---------- ADDRESS ----------
    getAddresses: builder.query({
      query: () => ({ url: toApiUrl("/user/addresses") }),
      providesTags: ["Address"],
      transformResponse: (response: any) => {
        // DEBUG: Log raw API response
        console.log("[getAddresses] Raw API response:", JSON.stringify(response, null, 2));
        const result = {
          addresses: response?.addresses || [],
          defaultAddressId: response?.defaultAddressId || null,
        };
        console.log("[getAddresses] Transformed result:", JSON.stringify(result, null, 2));
        return result;
      },
    }),
    addAddress: builder.mutation({
      query: (addressData: any) => ({
        url: toApiUrl("/user/addresses"),
        method: "POST",
        body: addressData,
      }),
      invalidatesTags: ["Address"],
    }),
    updateAddress: builder.mutation({
      query: ({ addressId, ...addressData }: any) => ({
        url: toApiUrl(`/user/addresses/${addressId}`),
        method: "PUT",
        body: addressData,
      }),
      invalidatesTags: ["Address"],
    }),
    deleteAddress: builder.mutation({
      query: (addressId: string) => ({
        url: toApiUrl(`/user/addresses/${addressId}`),
        method: "DELETE",
      }),
      invalidatesTags: ["Address"],
    }),
    setDefaultAddress: builder.mutation({
      query: (addressId: string) => ({
        url: toApiUrl(`/user/addresses/${addressId}/default`),
        method: "PATCH",
      }),
      invalidatesTags: ["Address"],
    }),

    // ---------- NOTIFICATIONS ----------
    getNotifications: builder.query({
      query: () => ({ url: toApiUrl("/notifications") }),
      providesTags: ["Notification"],
    }),
    getNotificationsV2: builder.query({
      query: (params?: { cursor?: string; limit?: number; category?: string }) => ({
        url: toApiUrl("/notifications/v2"),
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
      query: () => ({ url: toApiUrl("/notifications/unread/count") }),
      providesTags: ["NotificationUnreadCount"],
    }),
    markAsRead: builder.mutation({
      query: (notificationId: string) => ({
        url: toApiUrl(`/notifications/${notificationId}/read`),
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
        url: toApiUrl(`/notifications/${notificationId}`),
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
        url: toApiUrl("/notifications/read-all"),
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
      query: () => ({ url: toApiUrl("/user/notification-preferences") }),
      providesTags: ["User"],
    }),
    updateNotificationPreferences: builder.mutation({
      query: (preferences: any) => ({
        url: toApiUrl("/user/notification-preferences"),
        method: "PUT",
        // Backend expects full-object updates under a `preferences` key
        body: { preferences },
      }),
      invalidatesTags: ["User"],
    }),

    // ---------- ADMIN (upload/product management) ----------
    getPresignedUploadUrl: builder.mutation({
      query: (payload: any) => ({
        url: toApiUrl("/products/upload-url"),
        method: "POST",
        body: payload,
      }),
    }),
    createProduct: builder.mutation({
      query: (productData: any) => ({
        url: toApiUrl("/products"),
        method: "POST",
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...productData }: any) => ({
        url: toApiUrl(`/products/${id}`),
        method: "PUT",
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    deleteProduct: builder.mutation({
      query: (id: string) => ({
        url: toApiUrl(`/admin/products/${id}`),
        method: "DELETE",
      }),
      invalidatesTags: ["Product"],
    }),

    // ---------- PINCODE / MISC ----------
    checkPincode: builder.query({
      query: (pincode: string) => ({ url: toApiUrl(`/pincode/check/${pincode}`) }),
    }),

    // ---------- DELIVERY ----------
    getDeliveryProfile: builder.query({
      query: () => ({ url: toApiUrl("/delivery/profile") }),
      providesTags: ["DeliveryProfile"],
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
  useGetDeliveryProfileQuery,
} = api;

export default api;