import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UIState {
  theme: "light" | "dark";
  sidebarOpen: boolean;
  loading: boolean;
  notifications: Array<{
    id: string;
    type: "success" | "error" | "warning" | "info";
    message: string;
    timestamp: number;
  }>;
  searchQuery: string;
  filters: {
    category: string;
    priceRange: [number, number];
    rating: number;
    sortBy: string;
  };
}

const initialState: UIState = {
  theme: "light",
  sidebarOpen: false,
  loading: false,
  notifications: [],
  searchQuery: "",
  filters: {
    category: "",
    priceRange: [0, 10000],
    rating: 0,
    sortBy: "relevance",
  },
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    addNotification: (
      state,
      action: PayloadAction<
        Omit<UIState["notifications"][0], "id" | "timestamp">
      >
    ) => {
      const notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<UIState["filters"]>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {
        category: "",
        priceRange: [0, 10000],
        rating: 0,
        sortBy: "relevance",
      };
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  setLoading,
  addNotification,
  removeNotification,
  clearNotifications,
  setSearchQuery,
  setFilters,
  clearFilters,
} = uiSlice.actions;

export default uiSlice.reducer;
