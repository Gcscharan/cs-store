import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string; // Store thumbnail for cart display
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

// Initialize with empty cart - cart will be loaded from backend via useGetCartQuery
const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existingItem = state.items.find(
        (item) => item.id === action.payload.id
      );
      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
      state.total = state.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      state.itemCount = state.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = state.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      state.itemCount = state.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
    },
    updateCartItem: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const item = state.items.find((item) => item.id === action.payload.id);
      if (item) {
        item.quantity = action.payload.quantity;
        state.total = state.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        state.itemCount = state.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
      }
    },
    clearCart: (state) => {
      state.items = [];
      state.total = 0;
      state.itemCount = 0;
    },
    setCart: (
      state,
      action: PayloadAction<{
        items: CartItem[];
        total: number;
        itemCount: number;
      }>
    ) => {
      console.log("🛒 setCart action called with:", action.payload);
      state.items = action.payload.items;
      state.total = action.payload.total;
      state.itemCount = action.payload.itemCount;
    },
    clearCartOnLogout: (state) => {
      state.items = [];
      state.total = 0;
      state.itemCount = 0;
    },
  },
});

export const {
  addToCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  setCart,
  clearCartOnLogout,
} = cartSlice.actions;

// Cart middleware removed - MongoDB is now the single source of truth

export default cartSlice.reducer;
