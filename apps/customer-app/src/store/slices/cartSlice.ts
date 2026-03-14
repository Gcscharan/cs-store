import { createSlice, PayloadAction, AnyAction } from '@reduxjs/toolkit';
import { ThunkDispatch } from '@reduxjs/toolkit';
import type { CartItem } from '@vyaparsetu/types';
import { api } from '../api';

interface CartState {
  items: CartItem[];
  total: number;
  syncing: boolean;
}

const initialState: CartState = { items: [], total: 0, syncing: false };

const recalcTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCartLocal: (state, action: PayloadAction<CartItem>) => {
      const existing = state.items.find(i => i.productId === action.payload.productId);
      if (existing) { existing.quantity += action.payload.quantity; }
      else { state.items.push(action.payload); }
      state.total = recalcTotal(state.items);
    },
    removeFromCartLocal: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.productId !== action.payload);
      state.total = recalcTotal(state.items);
    },
    updateQuantityLocal: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const item = state.items.find(i => i.productId === action.payload.productId);
      if (item) {
        if (action.payload.quantity <= 0) {
          state.items = state.items.filter(i => i.productId !== action.payload.productId);
        } else {
          item.quantity = action.payload.quantity;
        }
      }
      state.total = recalcTotal(state.items);
    },
    clearCartLocal: (state) => { state.items = []; state.total = 0; },
    setCartFromServer: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload;
      state.total = recalcTotal(action.payload);
    },
    setSyncing: (state, action: PayloadAction<boolean>) => { state.syncing = action.payload; },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      (action): action is AnyAction => action.type === 'api/executeQuery/fulfilled' &&
        action.meta?.arg?.endpointName === 'getCart',
      (state, action: any) => {
        if (action.payload?.items) {
          state.items = action.payload.items.map((i: any) => ({
            productId: i.productId || i.product?._id,
            name: i.name || i.product?.name,
            price: i.price || i.product?.price,
            quantity: i.quantity,
            image: i.image || i.product?.images?.[0],
          }));
          state.total = recalcTotal(state.items);
        }
      }
    );
  },
});

export const {
  addToCartLocal, removeFromCartLocal, updateQuantityLocal,
  clearCartLocal, setCartFromServer, setSyncing,
} = cartSlice.actions;

// Thunk: add to cart and sync to server
export const addToCartWithSync = (item: CartItem) => async (dispatch: ThunkDispatch<any, any, AnyAction>) => {
  dispatch(addToCartLocal(item));
  dispatch(setSyncing(true));
  try {
    await dispatch(api.endpoints.addToCart.initiate({
      productId: item.productId, quantity: item.quantity,
    }));
  } catch (e) {
    console.warn('Cart sync failed, kept local copy');
  } finally {
    dispatch(setSyncing(false));
  }
};

export const removeFromCartWithSync = (productId: string) => async (dispatch: ThunkDispatch<any, any, AnyAction>) => {
  dispatch(removeFromCartLocal(productId));
  dispatch(setSyncing(true));
  try {
    await dispatch(api.endpoints.removeFromCart.initiate(productId));
  } catch (e) {
    console.warn('Cart remove sync failed');
  } finally {
    dispatch(setSyncing(false));
  }
};

export const updateQuantityWithSync = (productId: string, quantity: number) => async (dispatch: ThunkDispatch<any, any, AnyAction>) => {
  dispatch(updateQuantityLocal({ productId, quantity }));
  dispatch(setSyncing(true));
  try {
    if (quantity <= 0) {
      await dispatch(api.endpoints.removeFromCart.initiate(productId));
    } else {
      await dispatch(api.endpoints.updateCartItem.initiate({ productId, quantity }));
    }
  } catch (e) {
    console.warn('Cart update sync failed');
  } finally {
    dispatch(setSyncing(false));
  }
};

export const clearCartWithSync = () => async (dispatch: ThunkDispatch<any, any, AnyAction>) => {
  dispatch(clearCartLocal());
  dispatch(setSyncing(true));
  try {
    await dispatch(api.endpoints.clearCart.initiate());
  } catch (e) {
    console.warn('Cart clear sync failed');
  } finally {
    dispatch(setSyncing(false));
  }
};

// Legacy exports for backward compatibility
export const addToCart = addToCartLocal;
export const removeFromCart = removeFromCartLocal;
export const updateQuantity = updateQuantityLocal;
export const clearCart = clearCartLocal;

export default cartSlice.reducer;
