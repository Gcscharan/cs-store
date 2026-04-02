/**
 * Offline Action Queue — Production Resilience Layer
 * 
 * Queues SAFE actions (add-to-cart, wishlist) when device is offline.
 * Executes them when connectivity is restored.
 * 
 * NEVER queues: payments, order creation, or any money-touching action.
 * Uses AsyncStorage for persistence across app restarts.
 * Deduplicates using action keys.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { logEvent } from '../utils/analytics';

const QUEUE_STORAGE_KEY = '@vyaparsetu_offline_queue';

// Actions that are SAFE to queue offline
type SafeActionType = 'ADD_TO_CART' | 'UPDATE_CART_QUANTITY' | 'REMOVE_FROM_CART' | 'TOGGLE_WISHLIST' | 'LOCATION_UPDATE';

interface QueuedAction {
  id: string;           // Unique key for deduplication
  type: SafeActionType;
  payload: any;
  createdAt: string;
  retryCount: number;
}

type ActionExecutor = (action: QueuedAction) => Promise<boolean>;

class OfflineQueue {
  private queue: QueuedAction[] = [];
  private isProcessing = false;
  private executor: ActionExecutor | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;

  /**
   * Initialize with an executor function that knows how to replay actions.
   * Call once from App.tsx.
   */
  async init(executor: ActionExecutor) {
    this.executor = executor;
    await this.loadQueue();
    this.startNetworkListener();
  }

  /**
   * Cleanup on app teardown.
   */
  destroy() {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
  }

  /**
   * Add an action to the offline queue.
   * Deduplicates by action ID.
   */
  async enqueue(type: SafeActionType, payload: any, actionId?: string): Promise<void> {
    const id = actionId || `${type}_${Date.now()}`;

    // Dedup: don't queue if same action already pending
    if (this.queue.some(a => a.id === id)) return;

    const action: QueuedAction = {
      id,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.queue.push(action);
    await this.persistQueue();

    logEvent('offline_action_queued', { type, id });
  }

  /**
   * Get current queue length for UI display.
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  // ── Private ──

  private startNetworkListener() {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && !this.isProcessing && this.queue.length > 0) {
        logEvent('offline_queue_processing', { count: this.queue.length });
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing || !this.executor || this.queue.length === 0) return;
    this.isProcessing = true;

    const processed: string[] = [];

    for (const action of [...this.queue]) {
      try {
        const success = await this.executor(action);
        if (success) {
          processed.push(action.id);
          logEvent('offline_action_replayed', { type: action.type, id: action.id });
        } else {
          action.retryCount++;
          if (action.retryCount >= 3) {
            processed.push(action.id); // Give up after 3 attempts
            logEvent('offline_action_failed', { type: action.type, id: action.id, retries: action.retryCount });
          }
        }
      } catch {
        action.retryCount++;
        if (action.retryCount >= 3) {
          processed.push(action.id);
          logEvent('offline_action_failed', { type: action.type, id: action.id, retries: action.retryCount });
        }
      }
    }

    // Remove processed actions
    this.queue = this.queue.filter(a => !processed.includes(a.id));
    await this.persistQueue();
    this.isProcessing = false;
  }

  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch {
      this.queue = [];
    }
  }

  private async persistQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage write failed — queue lives in memory only
    }
  }
}

// Singleton
export const offlineQueue = new OfflineQueue();
