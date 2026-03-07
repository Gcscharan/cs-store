import { toApiUrl } from "../config/runtime";
import axiosApi from "../api/axiosInstance";

let refreshInFlight: Promise<string | null> | null = null;

type AuthClientDispatch = (action: { type: string; payload?: any }) => void;

let authClientDispatch: AuthClientDispatch | null = null;

export function registerAuthClientDispatch(dispatch: AuthClientDispatch | null) {
  authClientDispatch = dispatch;
}

function loadFromLocalStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveToLocalStorage(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
  }
}

function safeCloseRazorpayIfOpen() {
  try {
    const inst = (window as any)?.__razorpayInstance;
    if (inst && typeof inst.close === "function") {
      inst.close();
    }
  } catch {
  }
}

function handleRefreshFailure() {
  console.info("[AUTH][TOKEN_REFRESH_FAILED]");
  try {
    authClientDispatch?.({ type: "auth/logout" });
  } catch {
  }

  safeCloseRazorpayIfOpen();

  try {
    if (typeof window !== "undefined") {
      window.alert("Your session expired. Please log in again to continue payment.");
    }
  } catch {
  }

  try {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  } catch {
  }
}

export function getJwtExpiryMs(token: string | null | undefined): number | null {
  try {
    const t = String(token || "").trim();
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    const expSec = Number(json?.exp);
    if (!Number.isFinite(expSec) || expSec <= 0) return null;
    return expSec * 1000;
  } catch {
    return null;
  }
}

export function isTokenExpiringSoon(token: string | null | undefined, minValidityMs: number): boolean {
  const exp = getJwtExpiryMs(token);
  if (!exp) return false;
  return exp <= Date.now() + Math.max(0, Number(minValidityMs) || 0);
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    console.info("[AUTH][TOKEN_REFRESH_START]");

    const refreshToken = String(loadFromLocalStorage("refreshToken") || "").trim();
    if (!refreshToken) {
      handleRefreshFailure();
      return null;
    }

    try {
      // Use axios directly to avoid circular dependency with interceptor
      const res = await axiosApi.post(toApiUrl("/auth/refresh"), { refreshToken });

      const data = res.data;
      const nextAccessToken = String(data?.accessToken || "").trim();
      const nextRefreshToken = String(data?.refreshToken || "").trim();

      if (!nextAccessToken) {
        handleRefreshFailure();
        return null;
      }

      saveToLocalStorage("accessToken", nextAccessToken);
      if (nextRefreshToken) {
        saveToLocalStorage("refreshToken", nextRefreshToken);
      }

      try {
        authClientDispatch?.({
          type: "auth/setTokens",
          payload: {
            accessToken: nextAccessToken,
            refreshToken: nextRefreshToken || loadFromLocalStorage("refreshToken"),
          },
        });
      } catch {
      }

      console.info("[AUTH][TOKEN_REFRESH_SUCCESS]");
      return nextAccessToken;
    } catch {
      handleRefreshFailure();
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function ensureAccessTokenFresh(minValidityMs: number): Promise<string | null> {
  const token = String(loadFromLocalStorage("accessToken") || "").trim();
  if (token && !isTokenExpiringSoon(token, minValidityMs)) return token;
  return await refreshAccessToken();
}

/**
 * Auth-aware fetch wrapper using axios instance
 * 
 * Token refresh is handled EXCLUSIVELY by axiosInstance.ts interceptor.
 * This function delegates to axios which handles TOKEN_EXPIRED automatically.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const method = init.method || "GET";
  const body = init.body;
  
  // Extract headers
  const headers: Record<string, string> = {};
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (typeof init.headers === "object") {
      Object.assign(headers, init.headers);
    }
  }

  try {
    const response = await axiosApi({
      url,
      method,
      data: body ? (typeof body === "string" ? JSON.parse(body) : body) : undefined,
      headers,
    });

    // Convert axios response to fetch-like Response object
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers as any),
      json: async () => response.data,
      text: async () => JSON.stringify(response.data),
      clone: function() { return this; },
    } as Response;
  } catch (error: any) {
    // Axios interceptor already handled refresh if it was TOKEN_EXPIRED
    // Return error as Response-like object for compatibility
    const status = error?.response?.status || 500;
    const data = error?.response?.data || { message: error.message };
    
    return {
      ok: false,
      status,
      statusText: error.message || "Error",
      headers: new Headers(),
      json: async () => data,
      text: async () => JSON.stringify(data),
      clone: function() { return this; },
    } as Response;
  }
}
