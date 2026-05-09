import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import uiReducer from './slices/uiSlice';
import { baseApi } from '../api/baseApi';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'cart'],
  blacklist: [baseApi.reducerPath],
};

const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['status', 'user', 'accessToken', 'refreshToken'],
};

const cartPersistConfig = {
  key: 'cart',
  storage: AsyncStorage,
  whitelist: ['items', 'total', 'itemCount'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  cart: persistReducer(cartPersistConfig, cartReducer),
  ui: uiReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Performance optimization: Increase threshold for dev mode warnings
        warnAfter: 128,
      },
      // Performance optimization: Disable immutability check for large state in dev
      immutableCheck: { warnAfter: 128 },
    }).concat(baseApi.middleware as any),
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
// AppDispatch: typed to accept RTK Query thunks (updateQueryData, invalidateTags, etc.)
//
// Why `any` for the state parameter:
// RTK Query generates thunks typed against its own internal RootState<Definitions>,
// which is structurally incompatible with our redux-persist wrapped state (requires _persist).
// This is a known limitation of redux-persist + RTK Query — the state shapes cannot be
// reconciled without `any`. The `any` is scoped only to the state parameter of ThunkDispatch,
// preserving action type safety (UnknownAction) and return type safety.
// See: https://redux-toolkit.js.org/usage/usage-with-typescript#getting-the-dispatch-type
export type AppDispatch = import('@reduxjs/toolkit').ThunkDispatch<any, unknown, import('redux').UnknownAction>;
