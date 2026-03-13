import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthTokens } from '@vyaparsetu/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: 'LOADING' | 'UNAUTHENTICATED' | 'ACTIVE';
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  status: 'LOADING',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken || null;
    },
    setStatus: (state, action: PayloadAction<AuthState['status']>) => {
      state.status = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.status = 'UNAUTHENTICATED';
    },
  },
});

export const { setUser, setTokens, setStatus, logout } = authSlice.actions;
export default authSlice.reducer;
