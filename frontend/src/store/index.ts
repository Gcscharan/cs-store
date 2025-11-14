import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer from "./slices/cartSlice";
import uiReducer from "./slices/uiSlice";
import { api } from "./api";

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  ui: uiReducer,
  api: api.reducer,
});

// Enhanced root reducer that can reset entire state
const enhancedRootReducer = (state: any, action: any) => {
  // Reset entire state on RESET_APP_STATE action, but preserve theme preference
  if (action.type === 'app/RESET_STATE') {
    console.log('🔥 RESETTING ENTIRE APP STATE');
    // Preserve only theme preference from UI state
    const preservedTheme = state?.ui?.theme || 'light';
    return {
      ...rootReducer(undefined, action),
      ui: {
        ...rootReducer(undefined, action).ui,
        theme: preservedTheme,
      }
    };
  }
  
  return rootReducer(state, action);
};

export const store = configureStore({
  reducer: enhancedRootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

// Note: Auth state is already loaded in authSlice.ts during initialization
// No need to load it again here to avoid conflicts

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
