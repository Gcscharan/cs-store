/**
 * Production-Grade Axios Instance with Queued Refresh Interceptor
 * 
 * Features:
 * - Automatic token refresh on 401 TOKEN_EXPIRED
 * - Request queue during refresh (prevents multiple refresh calls)
 * - Concurrent request retry after successful refresh
 * - Logout only on refresh failure
 * - Safe retry logic with _retry flag
 * 
 * Architecture:
 * 1. Request interceptor attaches access token
 * 2. Response interceptor catches 401 TOKEN_EXPIRED
 * 3. First failed request triggers refresh
 * 4. Other failed requests wait in queue
 * 5. On refresh success, all queued requests retry
 * 6. On refresh failure, logout and reject all
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getApiOrigin } from "../config/runtime";

// -------- Types --------

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

interface ApiErrorResponse {
  message?: string;
  code?: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

// -------- Token Management (injected from Redux) --------

let getTokens: () => AuthTokens = () => ({ accessToken: null, refreshToken: null });
let setTokensAction: (tokens: { accessToken: string; refreshToken?: string | null }) => void = () => {};
let logoutAction: () => void = () => {};

/**
 * Register token getter from Redux store
 */
export function registerTokenGetter(getter: () => AuthTokens) {
  getTokens = getter;
}

/**
 * Register token setter (dispatches to Redux)
 */
export function registerTokenSetter(setter: (tokens: { accessToken: string; refreshToken?: string | null }) => void) {
  setTokensAction = setter;
}

/**
 * Register logout action (dispatches to Redux)
 */
export function registerLogoutAction(action: () => void) {
  logoutAction = action;
}

// -------- Refresh Queue System --------

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

/**
 * Process all queued requests after refresh completes
 * - On success: resolve with new token
 * - On failure: reject with error
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  console.log(`[AXIOS][REFRESH] Processing queue with ${failedQueue.length} pending requests`);
  
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

/**
 * Perform token refresh via backend endpoint
 */
async function performRefresh(): Promise<string | null> {
  const { refreshToken } = getTokens();
  
  if (!refreshToken) {
    console.warn("[AXIOS][REFRESH] No refresh token available");
    return null;
  }
  
  try {
    console.info("[AXIOS][REFRESH] Calling /auth/refresh endpoint");
    
    const response = await axios.post<RefreshResponse>(
      `${getApiOrigin()}/api/auth/refresh`,
      { refreshToken },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000, // 10 second timeout
      }
    );
    
    const newAccessToken = response.data?.accessToken;
    const newRefreshToken = response.data?.refreshToken;
    
    if (!newAccessToken) {
      console.warn("[AXIOS][REFRESH] No access token in response");
      return null;
    }
    
    // Update tokens in Redux store
    setTokensAction({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken || undefined,
    });
    
    console.info("[AXIOS][REFRESH] Token refresh successful");
    return newAccessToken;
    
  } catch (error) {
    console.error("[AXIOS][REFRESH] Refresh request failed:", error);
    return null;
  }
}

// -------- Axios Instance --------

const api = axios.create({
  baseURL: getApiOrigin(),
  withCredentials: true,
  timeout: 30000, // 30 second default timeout
});

// Extend config type for retry flag
declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

/* =========================
   REQUEST INTERCEPTOR
   - Attach access token to every request
========================= */

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = getTokens();
    
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================
   RESPONSE INTERCEPTOR
   - Handle 401 TOKEN_EXPIRED
   - Queue concurrent requests during refresh
   - Retry after successful refresh
========================= */

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;
    
    // Network error or no response
    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }
    
    const { status, data } = error.response;
    const code = data?.code?.trim();
    const message = data?.message?.toLowerCase();
    
    // Check if this is an expired token error
    const isTokenExpired = status === 401 && (
      code === "TOKEN_EXPIRED" || 
      message === "token expired"
    );
    
    // Only handle token expiration with retry
    if (!isTokenExpired) {
      return Promise.reject(error);
    }
    
    // Prevent infinite retry loops
    if (originalRequest._retry) {
      console.warn("[AXIOS][REFRESH] Request already retried, rejecting");
      return Promise.reject(error);
    }
    
    console.log(`[AXIOS][REFRESH] Token expired for ${originalRequest.url}`);
    
    // If refresh is already in progress, queue this request
    if (isRefreshing) {
      console.log("[AXIOS][REFRESH] Refresh in progress, queuing request");
      
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            originalRequest._retry = true;
            resolve(api(originalRequest));
          },
          reject: (err: Error) => {
            reject(err);
          },
        });
      });
    }
    
    // Mark as refreshing and retry attempted
    isRefreshing = true;
    originalRequest._retry = true;
    
    try {
      const newToken = await performRefresh();
      
      if (!newToken) {
        // Refresh failed - logout and reject all queued requests
        const refreshError = new Error("Session expired. Please log in again.");
        processQueue(refreshError, null);
        logoutAction();
        return Promise.reject(refreshError);
      }
      
      // Refresh succeeded - process queued requests
      processQueue(null, newToken);
      
      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
      
    } catch (err) {
      // Unexpected error during refresh
      const refreshError = new Error("Token refresh failed");
      processQueue(refreshError, null);
      logoutAction();
      return Promise.reject(refreshError);
      
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
