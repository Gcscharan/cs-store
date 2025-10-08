import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  shopkeeperId: string;
  shopkeeperName: string;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<Omit<CartItem, "quantity">>) => {
      const existingItem = state.items.find(
        (item) => item.productId === action.payload.productId
      );

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }

      cartSlice.caseReducers.calculateTotals(state);
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(
        (item) => item.productId !== action.payload
      );
      cartSlice.caseReducers.calculateTotals(state);
    },
    updateQuantity: (
      state,
      action: PayloadAction<{ productId: string; quantity: number }>
    ) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find((item) => item.productId === productId);

      if (item) {
        if (quantity <= 0) {
          state.items = state.items.filter(
            (item) => item.productId !== productId
          );
        } else {
          item.quantity = quantity;
        }
      }

      cartSlice.caseReducers.calculateTotals(state);
    },
    clearCart: (state) => {
      state.items = [];
      state.total = 0;
      state.itemCount = 0;
    },
    calculateTotals: (state) => {
      state.total = state.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      state.itemCount = state.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart } =
  cartSlice.actions;

export default cartSlice.reducer;
