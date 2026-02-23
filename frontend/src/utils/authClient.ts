import { toApiUrl } from "../config/runtime";

let refreshInFlight: Promise<string | null> | null = null;

let storeModulePromise: Promise<any> | null = null;
async function getStoreModule(): Promise<any | null> {
  try {
    if (!storeModulePromise) {
      storeModulePromise = import("../store");
    }
    return await storeModulePromise;
  } catch {
    return null;
  }
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
  (async () => {
    const mod = await getStoreModule();
    try {
      mod?.store?.dispatch?.({ type: "auth/logout" });
    } catch {
    }
  })();

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
      const res = await fetch(toApiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json().catch(() => ({} as any));
      const nextAccessToken = String((data as any)?.accessToken || "").trim();
      const nextRefreshToken = String((data as any)?.refreshToken || "").trim();

      if (!res.ok || !nextAccessToken) {
        handleRefreshFailure();
        return null;
      }

      saveToLocalStorage("accessToken", nextAccessToken);
      if (nextRefreshToken) {
        saveToLocalStorage("refreshToken", nextRefreshToken);
      }

      const mod = await getStoreModule();
      try {
        mod?.store?.dispatch?.({
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

function isTokenExpired401Response(data: any): boolean {
  const code = String(data?.code || "").trim();
  const msg = String(data?.message || "").trim();
  return code === "TOKEN_EXPIRED" || msg.toLowerCase() === "token expired";
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts?: { retryOnce?: boolean }
): Promise<Response> {
  const retryOnce = opts?.retryOnce !== false;

  const token = String(loadFromLocalStorage("accessToken") || "").trim();

  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization") && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status !== 401 || !retryOnce) {
    return res;
  }

  let data: any = null;
  try {
    const clone = res.clone();
    data = await clone.json();
  } catch {
    data = null;
  }

  if (!isTokenExpired401Response(data)) {
    return res;
  }

  const next = await refreshAccessToken();
  if (!next) {
    throw new Error("Session expired");
  }

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set("Authorization", `Bearer ${next}`);

  return await fetch(input, { ...init, headers: retryHeaders });
}
