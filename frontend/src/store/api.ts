import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseQuery = fetchBaseQuery({
  baseUrl: `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api`, // Use environment variable with fallback
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as any).auth?.tokens?.accessToken;
    
    console.log("🔐 API Request - Token check:", {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "none",
    });
    
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    
    // Ensure Content-Type is set for JSON requests
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    
    return headers;
  },
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["User", "Product", "Order", "Payment", "Cart", "Address", "Notification"],
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
    getSimilarProducts: builder.query({
      query: ({ id, limit = 4 }) => ({
        url: `/products/${id}/similar`,
        params: { limit },
      }),
      providesTags: ["Product"],
    }),
    searchProducts: builder.query({
      query: (searchTerm) => ({
        url: "/products/search",
        params: { q: searchTerm },
      }),
      providesTags: ["Product"],
    }),

    // Cart endpoints
    getCart: builder.query({
      query: () => "/cart",
      providesTags: ["Cart"],
    }),
    addToCart: builder.mutation({
      query: (cartData) => ({
        url: "/cart",
        method: "POST",
        body: cartData,
      }),
      invalidatesTags: ["Cart"],
    }),
    updateCartItem: builder.mutation({
      query: (cartData) => ({
        url: "/cart",
        method: "PUT",
        body: cartData,
      }),
      invalidatesTags: ["Cart"],
    }),
    removeFromCart: builder.mutation({
      query: (productId) => ({
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

    // Admin product endpoints
    updateProduct: builder.mutation({
      query: ({ id, ...productData }) => ({
        url: `/admin/products/${id}`,
        method: "PUT",
        body: productData,
      }),
      invalidatesTags: ["Product"],
    }),
    deleteProduct: builder.mutation({
      query: (id) => ({
        url: `/admin/products/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Product"],
    }),

    // Address endpoints
    getAddresses: builder.query({
      query: () => "/user/addresses",
      providesTags: ["Address"],
      transformResponse: (response: any) => {
        // Backend returns { success: true, addresses: [...], defaultAddressId: "xxx" }
        // Return full response to access both addresses and defaultAddressId
        return {
          addresses: response?.addresses || [],
          defaultAddressId: response?.defaultAddressId || null,
        };
      },
    }),
    addAddress: builder.mutation({
      query: (addressData) => ({
        url: "/user/addresses",
        method: "POST",
        body: addressData,
      }),
      invalidatesTags: ["Address"],
    }),
    updateAddress: builder.mutation({
      query: ({ addressId, ...addressData }) => ({
        url: `/user/addresses/${addressId}`,
        method: "PUT",
        body: addressData,
      }),
      invalidatesTags: ["Address"],
    }),
    deleteAddress: builder.mutation({
      query: (addressId) => ({
        url: `/user/addresses/${addressId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Address"],
    }),
    setDefaultAddress: builder.mutation({
      query: (addressId) => ({
        url: `/user/addresses/${addressId}/default`,
        method: "PATCH",
      }),
      invalidatesTags: ["Address"],
    }),

    // Notification endpoints
    getNotifications: builder.query({
      query: () => "/notifications",
      providesTags: ["Notification"],
    }),
    getUnreadCount: builder.query({
      query: () => "/notifications/unread/count",
      providesTags: ["Notification"],
    }),
    markAsRead: builder.mutation({
      query: (notificationId) => ({
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
      query: (notificationId) => ({
        url: `/notifications/${notificationId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Notification"],
    }),

    // Notification Preferences endpoints
    getNotificationPreferences: builder.query({
      query: () => "/user/notification-preferences",
      providesTags: ["User"],
    }),
    updateNotificationPreferences: builder.mutation({
      query: (preferences) => ({
        url: "/user/notification-preferences",
        method: "PUT",
        body: preferences,
      }),
      invalidatesTags: ["User"],
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
  useGetSimilarProductsQuery,
  useSearchProductsQuery,
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
  useClearCartMutation,
  useGetOrdersQuery,
  useCreateOrderMutation,
  useCheckPincodeQuery,
  useUpdateProductMutation,
  useDeleteProductMutation,
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
} = api;
