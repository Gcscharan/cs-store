import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

/** A queued notification toast with optional deep link and metadata */
export interface NotificationToast {
  id: string;
  title: string;
  body: string;
  deepLink?: string;
  category?: string;
  priority?: string;
}

interface ToastQueueState {
  /** The toast currently being displayed */
  current: NotificationToast | null;
  /** Pending toasts waiting to be shown */
  queue: NotificationToast[];
  /** Whether a toast is actively visible on screen */
  isDisplaying: boolean;
  /** Count of collapsed notifications (shown as summary) */
  overflowCount: number;
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
  /** Queue-based notification toast system */
  notificationToastQueue: ToastQueueState;
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
  notificationToastQueue: {
    current: null,
    queue: [],
    isDisplaying: false,
    overflowCount: 0,
  },
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  error: null,
};

const MAX_QUEUED_TOASTS = 3;

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

    // ── Notification Toast Queue Actions ──

    /** Enqueue a new notification toast. If queue exceeds max, increments overflow count. */
    enqueueNotificationToast: (state, action: PayloadAction<NotificationToast>) => {
      if (state.notificationToastQueue.queue.length >= MAX_QUEUED_TOASTS) {
        // Beyond max queue — increment overflow counter
        state.notificationToastQueue.overflowCount += 1;
      } else {
        state.notificationToastQueue.queue.push(action.payload);
      }
    },

    /** Show the next toast from the queue (or summary toast if overflow). */
    showNextNotificationToast: (state) => {
      if (state.notificationToastQueue.overflowCount > 0) {
        // Show summary toast for overflow
        const totalOverflow = state.notificationToastQueue.overflowCount + state.notificationToastQueue.queue.length;
        state.notificationToastQueue.current = {
          id: `summary-${Date.now()}`,
          title: `${totalOverflow} more notifications`,
          body: 'Tap to view all notifications',
          deepLink: '/notifications',
        };
        state.notificationToastQueue.queue = [];
        state.notificationToastQueue.overflowCount = 0;
        state.notificationToastQueue.isDisplaying = true;
      } else if (state.notificationToastQueue.queue.length > 0) {
        state.notificationToastQueue.current = state.notificationToastQueue.queue.shift()!;
        state.notificationToastQueue.isDisplaying = true;
      }
    },

    /** Dismiss the current notification toast. */
    dismissNotificationToast: (state) => {
      state.notificationToastQueue.current = null;
      state.notificationToastQueue.isDisplaying = false;
    },

    /** Clear all queued notification toasts. */
    clearNotificationToastQueue: (state) => {
      state.notificationToastQueue.current = null;
      state.notificationToastQueue.queue = [];
      state.notificationToastQueue.isDisplaying = false;
      state.notificationToastQueue.overflowCount = 0;
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
  enqueueNotificationToast,
  showNextNotificationToast,
  dismissNotificationToast,
  clearNotificationToastQueue,
  openModal,
  closeModal,
  setError,
  clearError,
} = uiSlice.actions;

export { uiSlice };

export default uiSlice.reducer;
