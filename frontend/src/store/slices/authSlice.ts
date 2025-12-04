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

// -------- Initial State --------
interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  tokens: AuthTokens;
}

const initialState: AuthState = {
  user: loadUser(),
  isAuthenticated: !!initialAccessToken && !!initialRefreshToken,
  tokens: {
    accessToken: initialAccessToken || null,
    refreshToken: initialRefreshToken || null,
  },
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
    },

    // Save tokens (used by login + refresh flow)
    setTokens(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>
    ) {
      const { accessToken, refreshToken } = action.payload;

      state.tokens.accessToken = accessToken;
      state.tokens.refreshToken = refreshToken;

      saveToLocalStorage("accessToken", accessToken);
      saveToLocalStorage("refreshToken", refreshToken);
    },

    // Remove everything (on logout/account deletion/refresh failure)
    logout(state) {
      state.user = null;
      state.tokens = { accessToken: null, refreshToken: null };
      state.isAuthenticated = false;

      // aggressive cleanup to avoid stale secrets
      try {
        removeFromLocalStorage("authUser");
        removeFromLocalStorage("accessToken");
        removeFromLocalStorage("refreshToken");
        removeFromLocalStorage("auth");
        removeFromLocalStorage("user");
        removeFromLocalStorage("isLoggingOut");
      } catch (e) {
        console.warn("authSlice.logout: localStorage cleanup failed", e);
      }
    },
  },
});

export const { setUser, setTokens, logout } = authSlice.actions;

// Standalone action for resetting entire app state
export const resetAppState = createAction('app/RESET_STATE');

export default authSlice.reducer;