import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ModalState {
  isOpen: boolean;
  type: string | null;
  data: any;
}

interface UIState {
  isLoading: boolean;
  toasts: ToastMessage[];
  toast: {
    visible: boolean;
    message: string;
  };
  modal: ModalState;
  error: string | null;
}

const initialState: UIState = {
  isLoading: false,
  toasts: [],
  toast: {
    visible: false,
    message: '',
  },
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  error: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    showToast: (state, action: PayloadAction<string>) => {
      state.toast = {
        visible: true,
        message: action.payload,
      };
    },
    hideToast: (state) => {
      state.toast.visible = false;
    },
    addToast: (state, action: PayloadAction<Omit<ToastMessage, 'id'>>) => {
      state.toasts.push({
        ...action.payload,
        id: Date.now().toString(),
      });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    openModal: (state, action: PayloadAction<{ type: string; data?: any }>) => {
      state.modal.isOpen = true;
      state.modal.type = action.payload.type;
      state.modal.data = action.payload.data;
    },
    closeModal: (state) => {
      state.modal.isOpen = false;
      state.modal.type = null;
      state.modal.data = null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setLoading,
  showToast,
  hideToast,
  addToast,
  removeToast,
  openModal,
  closeModal,
  setError,
  clearError,
} = uiSlice.actions;

export default uiSlice.reducer;
