import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthTokens } from '@vyaparsetu/types';
import { profileApi } from '../../api/profileApi';

export type AuthStatus = 'LOADING' | 'UNAUTHENTICATED' | 'GOOGLE_AUTH_ONLY' | 'ACTIVE';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const initialState: AuthState = {
  status: 'LOADING',
  user: null,
  accessToken: null,
  refreshToken: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<AuthStatus>) => {
      state.status = action.payload;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    setTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    logout: (state) => {
      state.status = 'UNAUTHENTICATED';
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
    },
    bootstrapComplete: (state) => {
      if (state.status === 'LOADING') {
        state.status = 'UNAUTHENTICATED';
      }
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      profileApi.endpoints.updateProfile.matchFulfilled,
      (state, { payload }) => {
        // payload is ProfileUpdateResponse { success, message, user }
        state.user = payload.user as any;
      }
    );
  },
});

export const { setStatus, setUser, setTokens, logout, bootstrapComplete } = authSlice.actions;

// Selectors
export const selectAuthStatus = (state: { auth: AuthState }) => state.auth.status;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => 
  state.auth.status === 'ACTIVE';
export const selectAccessToken = (state: { auth: AuthState }) => state.auth.accessToken;

export default authSlice.reducer;
