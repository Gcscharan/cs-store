import { createSlice, PayloadAction, createAction } from "@reduxjs/toolkit";

// -------- LocalStorage helpers (safe) --------
function loadFromLocalStorage(key: string) {
  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    return null;
  }
}

function saveToLocalStorage(key: string, value: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {}
}

function removeFromLocalStorage(key: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {}
}

// -------- Initial Tokens from LocalStorage --------
const initialAccessToken = loadFromLocalStorage("accessToken");
const initialRefreshToken = loadFromLocalStorage("refreshToken");

// -------- User from LocalStorage (safe parse) --------
function loadUser() {
  try {
    const raw = loadFromLocalStorage("authUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// -------- Auth Status (Single Source of Truth) --------
// NEVER infer auth from token existence. ONLY trust status.
export type AuthStatus =
  | "LOADING"
  | "UNAUTHENTICATED"
  | "GOOGLE_AUTH_ONLY"
  | "ACTIVE";

interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthState {
  status: AuthStatus; // Single source of truth
  user: any | null;
  tokens: AuthTokens;
  profileCompleted: boolean;
  // Backward-compatible derived fields (computed from status)
  isAuthenticated: boolean;
  authState: AuthStatus | null;
  loading: boolean;
}

// Helper to compute derived fields from status
function computeDerivedFields(status: AuthStatus) {
  return {
    // isAuthenticated is ONLY true for ACTIVE users, not GOOGLE_AUTH_ONLY
    isAuthenticated: status === "ACTIVE",
    authState: status === "ACTIVE" || status === "GOOGLE_AUTH_ONLY" ? status : null,
    loading: status === "LOADING",
  };
}

// Determine initial status from localStorage
function getInitialStatus(): AuthStatus {
  const token = loadFromLocalStorage("accessToken");
  const authState = loadFromLocalStorage("authState");
  const user = loadUser();

  if (!token) return "UNAUTHENTICATED";
  if (authState === "GOOGLE_AUTH_ONLY" || user?.authState === "GOOGLE_AUTH_ONLY") return "GOOGLE_AUTH_ONLY";
  return "LOADING"; // Have token, need to verify with backend
}

const initialStatus = getInitialStatus();

const initialState: AuthState = {
  status: initialStatus,
  user: loadUser(),
  tokens: {
    accessToken: initialAccessToken || null,
    refreshToken: initialRefreshToken || null,
  },
  profileCompleted: !!(loadUser() as any)?.profileCompleted || !!(loadUser() as any)?.isProfileComplete,
  // Derived fields for backward compatibility
  ...computeDerivedFields(initialStatus),
};

// -------- Slice --------
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Set auth status (ONLY way to change auth state)
    setStatus(state, action: PayloadAction<AuthStatus>) {
      state.status = action.payload;
      if (action.payload === "GOOGLE_AUTH_ONLY") {
        saveToLocalStorage("authState", "GOOGLE_AUTH_ONLY");
      } else if (action.payload === "UNAUTHENTICATED") {
        removeFromLocalStorage("authState");
      }
      // Update derived fields for backward compatibility
      Object.assign(state, computeDerivedFields(action.payload));
    },

    // Save user object (from login, profile fetch)
    setUser(state, action: PayloadAction<any>) {
      state.user = action.payload;
      saveToLocalStorage("authUser", JSON.stringify(action.payload));
      // Store authoritative profileCompleted from backend
      state.profileCompleted =
        !!action.payload.profileCompleted || !!action.payload.isProfileComplete;
      
      // Set status to ACTIVE when user is set (login success)
      // This prevents brief redirect to onboarding/login
      if (state.tokens.accessToken && action.payload) {
        state.status = "ACTIVE";
        saveToLocalStorage("authState", "ACTIVE");
        // Update derived fields
        Object.assign(state, computeDerivedFields("ACTIVE"));
      }
    },

    // Save tokens (used by login + refresh flow)
    setTokens(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string | null }>
    ) {
      const { accessToken, refreshToken } = action.payload;

      state.tokens.accessToken = accessToken;
      state.tokens.refreshToken = refreshToken || null;

      saveToLocalStorage("accessToken", accessToken);
      if (refreshToken) {
        saveToLocalStorage("refreshToken", refreshToken);
      } else {
        removeFromLocalStorage("refreshToken");
      }
    },

    // Remove everything (on logout/account deletion/refresh failure)
    logout(state) {
      state.status = "UNAUTHENTICATED";
      state.user = null;
      state.tokens = { accessToken: null, refreshToken: null };
      state.profileCompleted = false;
      // Update derived fields for backward compatibility
      Object.assign(state, computeDerivedFields("UNAUTHENTICATED"));

      // aggressive cleanup to avoid stale secrets
      try {
        removeFromLocalStorage("authUser");
        removeFromLocalStorage("accessToken");
        removeFromLocalStorage("refreshToken");
        removeFromLocalStorage("authState");
        removeFromLocalStorage("auth");
        removeFromLocalStorage("user");
        removeFromLocalStorage("isLoggingOut");
      } catch (e) {
        console.warn("authSlice.logout: localStorage cleanup failed", e);
      }
    },
  },
});

export const { setUser, setTokens, logout, setStatus } = authSlice.actions;

// Legacy compatibility exports (deprecated, use setStatus instead)
export const setAuthState = setStatus;
export const setLoading = (loading: boolean) => 
  setStatus(loading ? "LOADING" : "UNAUTHENTICATED");

// Standalone action for resetting entire app state
export const resetAppState = createAction('app/RESET_STATE');

// -------- Backward-Compatible Selectors --------
// These derive legacy fields from the new status field for gradual migration

/**
 * Select isAuthenticated from status
 * - ACTIVE = authenticated (can access full app)
 * - GOOGLE_AUTH_ONLY = NOT authenticated (onboarding only)
 * - UNAUTHENTICATED or LOADING = not authenticated
 */
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.status === "ACTIVE";

/**
 * Select isActiveUser - true ONLY for ACTIVE status
 * Use this for Navbar and protected UI elements that should not show during onboarding
 */
export const selectIsActiveUser = (state: { auth: AuthState }) =>
  state.auth.status === "ACTIVE";

/**
 * Select authState (legacy) from status
 * - ACTIVE -> "ACTIVE"
 * - GOOGLE_AUTH_ONLY -> "GOOGLE_AUTH_ONLY"
 * - UNAUTHENTICATED or LOADING -> null
 */
export const selectAuthState = (state: { auth: AuthState }) =>
  state.auth.status === "ACTIVE" || state.auth.status === "GOOGLE_AUTH_ONLY"
    ? state.auth.status
    : null;

/**
 * Select loading from status
 * - LOADING -> true
 * - All other states -> false
 */
export const selectAuthLoading = (state: { auth: AuthState }) =>
  state.auth.status === "LOADING";

export default authSlice.reducer;