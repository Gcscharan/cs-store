import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./api";
import authSlice from "./slices/authSlice";
import cartSlice from "./slices/cartSlice";
import uiSlice from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authSlice,
    cart: cartSlice,
    ui: uiSlice,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST"],
      },
    }).concat(api.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
