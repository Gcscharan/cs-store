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
const initialAuthState = loadFromLocalStorage("authState");

// -------- User from LocalStorage (safe parse) --------
function loadUser() {
  try {
    const raw = loadFromLocalStorage("authUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// -------- Initial State --------
interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

type AuthStateMachine = "ACTIVE" | "GOOGLE_AUTH_ONLY" | null;

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  tokens: AuthTokens;
  authState: AuthStateMachine;
  profileCompleted: boolean;
  loading: boolean;
}

const initialState: AuthState = {
  user: loadUser(),
  isAuthenticated: !!initialAccessToken,
  tokens: {
    accessToken: initialAccessToken || null,
    refreshToken: initialRefreshToken || null,
  },
  authState: ((loadUser() as any)?.authState || initialAuthState || null) as AuthStateMachine,
  profileCompleted: !!(loadUser() as any)?.profileCompleted || !!(loadUser() as any)?.isProfileComplete,
  loading: true, // Will be set to false after AuthInitializer resolves
};

// -------- Slice --------
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Save user object (from login, profile fetch)
    setUser(state, action: PayloadAction<any>) {
      state.user = action.payload;
      saveToLocalStorage("authUser", JSON.stringify(action.payload));
      state.isAuthenticated = true;
      // Store authoritative profileCompleted from backend
      state.profileCompleted =
        !!action.payload.profileCompleted || !!action.payload.isProfileComplete;

      const nextAuthState = (action.payload?.authState || state.authState || null) as AuthStateMachine;
      state.authState = nextAuthState;
      if (nextAuthState) {
        saveToLocalStorage("authState", nextAuthState);
      } else {
        removeFromLocalStorage("authState");
      }
    },

    setAuthState(state, action: PayloadAction<AuthStateMachine>) {
      state.authState = action.payload;
      if (action.payload) {
        saveToLocalStorage("authState", action.payload);
      } else {
        removeFromLocalStorage("authState");
      }
    },

    // Set loading state (used by AuthInitializer)
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },

    // Save tokens (used by login + refresh flow)
    setTokens(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string | null }>
    ) {
      const { accessToken, refreshToken } = action.payload;

      state.tokens.accessToken = accessToken;
      state.tokens.refreshToken = refreshToken || null;

      state.isAuthenticated = !!accessToken;

      saveToLocalStorage("accessToken", accessToken);
      if (refreshToken) {
        saveToLocalStorage("refreshToken", refreshToken);
      } else {
        removeFromLocalStorage("refreshToken");
      }
    },

    // Remove everything (on logout/account deletion/refresh failure)
    logout(state) {
      state.user = null;
      state.tokens = { accessToken: null, refreshToken: null };
      state.isAuthenticated = false;
      state.authState = null;
      state.profileCompleted = false;
      state.loading = false;

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

export const { setUser, setTokens, logout, setLoading, setAuthState } = authSlice.actions;

// Standalone action for resetting entire app state
export const resetAppState = createAction('app/RESET_STATE');

export default authSlice.reducer;