import { createSlice, PayloadAction, createAction } from "@reduxjs/toolkit";

// Minimal user info for auth/routing only
// Profile details (name, phone) come from useGetProfileQuery
interface User {
  id: string;
  email: string;
  role?: string;
  isAdmin?: boolean;
  // Profile data (name, phone) NOT stored here
  // Use useGetProfileQuery to fetch from MongoDB
}

interface AuthState {
  user: User | null;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
  isAuthenticated: boolean;
}

// Helper function to check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error("Error parsing token:", error);
    return true;
  }
};

// Load initial state from localStorage with token validation
// Only loads tokens and minimal user info (id, email, role)
// Profile data (name, phone) must be fetched via useGetProfileQuery
const loadAuthFromStorage = (): AuthState => {
  try {
    const storedAuth = localStorage.getItem("auth");
    if (storedAuth) {
      const parsed = JSON.parse(storedAuth);

      // Validate that we have all required fields and token is not expired
      if (
        parsed.isAuthenticated &&
        parsed.user?.id &&
        parsed.tokens?.accessToken &&
        !isTokenExpired(parsed.tokens.accessToken)
      ) {
        // Only restore minimal user info, NOT profile data
        return {
          user: {
            id: parsed.user.id,
            email: parsed.user.email,
            role: parsed.user.role,
            isAdmin: parsed.user.isAdmin,
            // DO NOT restore name, phone - fetch from MongoDB
          },
          tokens: parsed.tokens,
          isAuthenticated: true,
        };
      } else {
        // Clear invalid auth data
        localStorage.removeItem("auth");
      }
    }
  } catch (error) {
    console.error("Error loading auth from localStorage:", error);
    // Clear corrupted auth data
    localStorage.removeItem("auth");
  }

  return {
    user: null,
    tokens: {
      accessToken: null,
      refreshToken: null,
    },
    isAuthenticated: false,
  };
};

const initialState: AuthState = loadAuthFromStorage();

// Helper function to save auth state to localStorage
// Only saves tokens and minimal user info (id, email, role)
// Profile data (name, phone) is NOT saved - must come from MongoDB
const saveAuthToStorage = (authState: AuthState) => {
  try {
    if (authState.user) {
      // Only save minimal user info, NOT profile data
      const minimalAuth = {
        user: {
          id: authState.user.id,
          email: authState.user.email,
          role: authState.user.role,
          isAdmin: authState.user.isAdmin,
          // DO NOT save name, phone - fetch from MongoDB
        },
        tokens: authState.tokens,
        isAuthenticated: authState.isAuthenticated,
      };
      localStorage.setItem("auth", JSON.stringify(minimalAuth));
    } else {
      localStorage.setItem("auth", JSON.stringify(authState));
    }
  } catch (error) {
    console.error("Error saving auth to localStorage:", error);
  }
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Updates user in Redux state only (in-memory)
    // Profile data is NOT saved to localStorage
    // Use this after fetching profile from MongoDB via useGetProfileQuery
    setUser: (state, action: PayloadAction<User>) => {
      // Merge with existing user to preserve id, email, role from login
      state.user = {
        ...state.user,
        ...action.payload,
      } as User;
      state.isAuthenticated = true;
      // Save only minimal info (id, email, role), not profile data
      saveAuthToStorage(state);
    },
    setTokens: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>
    ) => {
      state.tokens = action.payload;
      saveAuthToStorage(state);
    },
    setAuth: (
      state,
      action: PayloadAction<{
        user: User;
        tokens: { accessToken: string; refreshToken: string };
      }>
    ) => {
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      saveAuthToStorage(state);
    },
    logout: (state) => {
      console.log('🔐 AUTH SLICE: AGGRESSIVE logout action called');
      
      // CRITICAL: Ensure Redux state is completely cleared
      state.user = null;
      state.tokens = { accessToken: null, refreshToken: null };
      state.isAuthenticated = false;
      
      // AGGRESSIVE localStorage cleanup from within the slice
      console.log('🔐 AUTH SLICE: Aggressive localStorage cleanup...');
      const criticalKeys = [
        "auth", "accessToken", "refreshToken", "token", 
        "user", "userId", "user_id", "currentUser"
      ];
      
      criticalKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          console.log(`🔐 AUTH SLICE: Removed ${key}`);
        } catch (e) {
          console.warn(`🔐 AUTH SLICE: Could not remove ${key}:`, e);
        }
      });
      
      console.log('🔐 AUTH SLICE: Logout state cleared completely');
    },
    switchUser: (
      state,
      action: PayloadAction<{
        user: User;
        tokens: { accessToken: string; refreshToken: string };
      }>
    ) => {
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      saveAuthToStorage(state);
      // Note: cart loading will be handled by the component
    },
  },
});

// Standalone action for resetting entire app state
export const resetAppState = createAction('app/RESET_STATE');

export const { setUser, setTokens, setAuth, logout, switchUser } =
  authSlice.actions;
export default authSlice.reducer;
