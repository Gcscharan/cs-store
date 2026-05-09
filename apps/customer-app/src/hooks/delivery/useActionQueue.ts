import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const DELIVERY_QUEUE_KEY  = '@delivery_action_queue';
const ACTION_TTL_MS       = 2 * 60 * 60 * 1000; // 2 hours
const MAX_QUEUE_SIZE      = 50;
const MAX_RETRIES         = 5;
const BASE_BACKOFF_MS     = 30_000;              // 30s base, doubles per retry
const PERSIST_DEBOUNCE_MS = 200;                 // batch writes during replay

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueuedAction {
  id: string;
  action: string;
  orderId: string;
  targetStatus: string;
  args: unknown[];
  fn: (...args: any[]) => Promise<void>;
  idempotencyKey: string;
  enqueuedAt: number;
  retries: number;
  nextRetryAt: number;
}

type PersistedAction = Omit<QueuedAction, 'fn'>;

// ─── Action Registry ──────────────────────────────────────────────────────────

type ActionFnFactory = (
  args: unknown[],
  idempotencyKey: string
) => (...callArgs: any[]) => Promise<void>;

const actionRegistry = new Map<string, ActionFnFactory>();

export const registerActionHandler = (
  actionType: string,
  factory: ActionFnFactory
): void => {
  if (__DEV__ && actionRegistry.has(actionType)) {
    console.log(`[ActionQueue] Re-registering handler for '${actionType}'`);
  }
  actionRegistry.set(actionType, factory);
};

const reconstructFn = (
  action: PersistedAction
): ((...args: any[]) => Promise<void>) | null => {
  const factory = actionRegistry.get(action.action);
  if (!factory) return null;
  return factory(action.args, action.idempotencyKey);
};

// ─── Transitions ──────────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ['assigned'],
  assigned:   ['picked_up'],
  picked_up:  ['in_transit'],
  in_transit: ['arrived'],
  arrived:    ['delivered', 'failed', 'escalated'],
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useActionQueue = () => {
  const [queue, setQueue]         = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queueRef        = useRef<QueuedAction[]>([]);
  const isReplayingRef  = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persistence ────────────────────────────────────────────────────────────

  const persistQueueNow = useCallback(async (actions: QueuedAction[]): Promise<void> => {
    try {
      const serialisable: PersistedAction[] = actions.map(({ fn: _fn, ...rest }) => rest);
      await AsyncStorage.setItem(DELIVERY_QUEUE_KEY, JSON.stringify(serialisable));
    } catch (err) {
      console.error('[ActionQueue] Failed to persist queue:', err);
    }
  }, []);

  /**
   * Debounced persist — batches rapid writes during replay into one write.
   * Enqueue bypasses this and calls persistQueueNow directly (never lose a new action).
   */
  const persistQueue = useCallback((actions: QueuedAction[]): void => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistQueueNow(actions);
    }, PERSIST_DEBOUNCE_MS);
  }, [persistQueueNow]);

  /**
   * Flush any pending debounced write immediately.
   * Called on AppState background/inactive to prevent losing queue state
   * when the app is killed before the debounce timer fires. (Fix 1)
   */
  const flushPersistQueue = useCallback((): void => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    // Fire immediately with current queue state
    persistQueueNow(queueRef.current);
  }, [persistQueueNow]);

  // Fix 1 — flush on lifecycle background/inactive events
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        flushPersistQueue();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      // Also flush on unmount (component teardown)
      flushPersistQueue();
    };
  }, [flushPersistQueue]);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadQueue = useCallback(async (): Promise<void> => {
    try {
      const raw = await AsyncStorage.getItem(DELIVERY_QUEUE_KEY);
      if (!raw) return;

      let persisted: PersistedAction[];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        persisted = parsed;
      } catch (parseErr) {
        console.warn('[ActionQueue] Persisted queue corrupted — resetting:', parseErr);
        await AsyncStorage.removeItem(DELIVERY_QUEUE_KEY);
        return;
      }

      const now = Date.now();
      const fresh = persisted.filter(a => {
        if (now - a.enqueuedAt >= ACTION_TTL_MS) return false;
        if ((a.retries ?? 0) >= MAX_RETRIES) return false;
        return true;
      });

      if (fresh.length < persisted.length) {
        console.log(`[ActionQueue] Discarded ${persisted.length - fresh.length} stale action(s) on load`);
      }
      if (fresh.length === 0) return;

      const restored: QueuedAction[] = fresh.map(a => {
        const reconstructed = reconstructFn(a);
        return {
          retries: 0,
          nextRetryAt: 0,
          ...a,
          fn: reconstructed ?? (async (..._args: any[]) => {
            console.warn(`[ActionQueue] Placeholder fn for '${a.action}' (${a.id}) — will reconstruct at replay`);
          }),
        };
      });

      queueRef.current = restored;
      setQueue(restored);

      const liveCount = restored.filter(a => actionRegistry.has(a.action)).length;
      console.log(`[ActionQueue] Restored ${restored.length} action(s) (${liveCount} live, ${restored.length - liveCount} placeholder)`);
    } catch (err) {
      console.error('[ActionQueue] Failed to load queue:', err);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────

  const enqueue = useCallback((
    action: Omit<QueuedAction, 'retries' | 'nextRetryAt'> & Partial<Pick<QueuedAction, 'retries' | 'nextRetryAt'>>
  ) => {
    const fullAction: QueuedAction = { retries: 0, nextRetryAt: 0, ...action };

    setQueue(prev => {
      const existingIdx = prev.findIndex(a => a.id === fullAction.id);
      let next: QueuedAction[];

      if (existingIdx !== -1) {
        next = [...prev];
        next[existingIdx] = fullAction;
      } else {
        next = [...prev, fullAction];
        if (next.length > MAX_QUEUE_SIZE) {
          if (__DEV__) {
            console.warn(
              `[ActionQueue] ⚠️ Queue overflow (${next.length} > ${MAX_QUEUE_SIZE}) — ` +
              `dropping ${next.length - MAX_QUEUE_SIZE} oldest action(s). ` +
              `Driver may be offline for an extended period.`
            );
          }
          next = next.slice(next.length - MAX_QUEUE_SIZE);
        }
      }

      queueRef.current = next;
      persistQueueNow(next); // immediate write — never lose a new action
      return next;
    });
  }, [persistQueueNow]);

  /**
   * Fix 2 — nuanced pending check.
   *
   * Returns true only if the queue has a DIFFERENT action type pending for
   * this order. Allows retrying the same action (e.g. pickup failed offline,
   * driver taps pickup again — that's a dedup/replace, not a conflict).
   * Blocks forward transitions (e.g. pickup queued → driver taps markArrived).
   */
  const hasPendingActionsForOrder = useCallback((
    orderId: string,
    currentActionType?: string
  ): boolean => {
    return queueRef.current.some(
      a => a.orderId === orderId && a.action !== currentActionType
    );
  }, []);

  const replayQueue = useCallback(async (
    fetchOrderStatus: (orderId: string) => Promise<string>
  ): Promise<void> => {
    if (isReplayingRef.current) {
      console.log('[ActionQueue] Replay already in progress — skipping');
      return;
    }
    if (queueRef.current.length === 0) return;

    isReplayingRef.current = true;
    setIsSyncing(true);

    const pending = [...queueRef.current].sort((a, b) => a.enqueuedAt - b.enqueuedAt);

    const toRemove: string[] = [];
    const toUpdate = new Map<string, Partial<QueuedAction>>();
    const now = Date.now();
    const failedOrderIds = new Set<string>();

    for (const item of pending) {
      if (failedOrderIds.has(item.orderId)) {
        console.log(`[ActionQueue] Skipping ${item.id} — earlier action for order ${item.orderId} failed`);
        continue;
      }

      if (now - item.enqueuedAt >= ACTION_TTL_MS) {
        console.log(`[ActionQueue] Discarding TTL-expired action: ${item.id}`);
        toRemove.push(item.id);
        continue;
      }

      if (item.retries >= MAX_RETRIES) {
        console.warn(`[ActionQueue] Max retries exceeded for ${item.id}`);
        toRemove.push(item.id);
        Alert.alert(
          'Action Could Not Sync',
          `A queued action for order #${item.orderId.slice(-6).toUpperCase()} failed after ${MAX_RETRIES} attempts and has been removed. Please refresh to see the current order state.`
        );
        continue;
      }

      if (item.nextRetryAt > now) {
        console.log(`[ActionQueue] Backoff active for ${item.id} — ${Math.ceil((item.nextRetryAt - now) / 1000)}s remaining`);
        continue;
      }

      const reconstructed = reconstructFn(item);
      const execFn = reconstructed ?? item.fn;
      if (reconstructed) {
        const idx = queueRef.current.findIndex(a => a.id === item.id);
        if (idx !== -1) queueRef.current[idx] = { ...queueRef.current[idx], fn: reconstructed };
      }

      try {
        const currentStatus = await fetchOrderStatus(item.orderId);

        if (currentStatus === 'unknown') {
          console.warn(`[ActionQueue] Order ${item.orderId} not in cache — keeping ${item.id} with backoff`);
          const newRetries = item.retries + 1;
          toUpdate.set(item.id, {
            retries: newRetries,
            nextRetryAt: now + BASE_BACKOFF_MS * Math.pow(2, newRetries - 1),
          });
          failedOrderIds.add(item.orderId);
          continue;
        }

        const validNextStatuses = VALID_TRANSITIONS[currentStatus.toLowerCase()] ?? [];
        if (!validNextStatuses.includes(item.targetStatus.toLowerCase())) {
          console.log(`[ActionQueue] Discarding stale action ${item.id}: ${currentStatus} → ${item.targetStatus}`);
          toRemove.push(item.id);
          continue;
        }

        await execFn(...item.args);
        toRemove.push(item.id);

      } catch (err: any) {
        if (err?.status === 409) {
          toRemove.push(item.id);
          Alert.alert(
            'Order State Changed',
            'A queued action could not be applied — the order was already updated. Please refresh.'
          );
        } else if (!err?.status) {
          const newRetries = item.retries + 1;
          toUpdate.set(item.id, {
            retries: newRetries,
            nextRetryAt: now + BASE_BACKOFF_MS * Math.pow(2, newRetries - 1),
          });
          failedOrderIds.add(item.orderId);
        } else {
          toRemove.push(item.id);
          Alert.alert('Sync Error', err?.data?.error || err?.message || 'Failed to sync a queued action');
        }
      }
    }

    setQueue(prev => {
      let next = prev.filter(a => !toRemove.includes(a.id));
      if (toUpdate.size > 0) {
        next = next.map(a => {
          const patch = toUpdate.get(a.id);
          return patch ? { ...a, ...patch } : a;
        });
      }
      queueRef.current = next;
      persistQueue(next); // debounced — replay produces many updates
      return next;
    });

    setIsSyncing(false);
    isReplayingRef.current = false;
  }, [persistQueue, persistQueueNow]);

  return {
    enqueue,
    replayQueue,
    hasPendingActionsForOrder,
    isSyncing,
    queueLength: queue.length,
  };
};
