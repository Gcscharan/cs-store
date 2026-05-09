import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DELIVERY_CONFIG } from '../../constants/deliveryConfig';

// ─── Storage Key ────────────────────────────────────────────────────────────

const ATTEMPT_TRACKER_KEY = '@delivery_attempt_tracker';

// ─── Interfaces ─────────────────────────────────────────────────────────────

/**
 * Persisted state for a single order's delivery attempts.
 *
 * Invariants:
 *  - attemptCount >= 0
 *  - retryAvailableAt is a Unix timestamp in milliseconds (0 when no backoff is active)
 */
export interface AttemptState {
  /** Number of failed delivery attempts recorded for this order. */
  attemptCount: number;
  /** Unix timestamp (ms) after which the order becomes actionable again. */
  retryAvailableAt: number;
}

/**
 * Storage schema persisted under ATTEMPT_TRACKER_KEY.
 * A flat map of orderId → AttemptState, serialised as JSON.
 *
 * Example value stored in AsyncStorage:
 * {
 *   "order_123": { "attemptCount": 2, "retryAvailableAt": 1704067200000 },
 *   "order_456": { "attemptCount": 1, "retryAvailableAt": 1704067230000 }
 * }
 */
export type AttemptTrackerStore = Record<string, AttemptState>;

/**
 * Return type of the useAttemptTracker hook.
 */
export interface UseAttemptTrackerReturn {
  /** Get attempt state for an order, or null if no entry exists. */
  getAttemptState: (orderId: string) => AttemptState | null;

  /** Increment attempt count and set retryAvailableAt for the order. */
  incrementAttempt: (orderId: string) => Promise<AttemptState>;

  /** Remove attempt state (on delivery success or escalation). */
  removeAttempt: (orderId: string) => Promise<void>;

  /** Cleanup stale entries whose order IDs are not in the active orders list. */
  cleanup: (activeOrderIds: string[]) => Promise<void>;

  /** Returns true when Date.now() < retryAvailableAt for the given order. */
  isRetryLocked: (orderId: string) => boolean;

  /** Returns remaining backoff seconds, computed from the persisted timestamp. */
  getRemainingSeconds: (orderId: string) => number;

  /** Merge server attempt count — only updates local state if server count is higher. */
  mergeServerAttempt: (orderId: string, serverCount: number) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAttemptTracker
 *
 * Manages per-order delivery attempt counts and retry timestamps, backed by
 * AsyncStorage so state survives app restarts.
 *
 * Storage key : @delivery_attempt_tracker
 * Storage value: JSON-serialised AttemptTrackerStore
 *
 * Requirements: 1.1, 1.4
 */
export function useAttemptTracker(): UseAttemptTrackerReturn {
  // In-memory mirror of the AsyncStorage store, initialised lazily on first read.
  const [store, setStore] = useState<AttemptTrackerStore>({});

  // Tracks whether the initial load from AsyncStorage has completed.
  const loadedRef = useRef(false);

  // Promise coalescing — prevents concurrent ensureLoaded calls from each
  // getting an empty {} from the stale closure (Fix for race condition #6)
  const loadPromiseRef = useRef<Promise<AttemptTrackerStore> | null>(null);

  // ── Internal helpers ──────────────────────────────────────────────────────

  /** Read the full store from AsyncStorage, returning {} on any error. */
  const readStore = useCallback(async (): Promise<AttemptTrackerStore> => {
    try {
      const raw = await AsyncStorage.getItem(ATTEMPT_TRACKER_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as AttemptTrackerStore;
    } catch (error) {
      console.error('[AttemptTracker] Failed to read storage:', error);
      return {};
    }
  }, []);

  /** Persist the full store to AsyncStorage and update in-memory state. */
  const writeStore = useCallback(
    async (next: AttemptTrackerStore): Promise<void> => {
      try {
        await AsyncStorage.setItem(ATTEMPT_TRACKER_KEY, JSON.stringify(next));
        setStore(next);
      } catch (error) {
        console.error('[AttemptTracker] Failed to write storage:', error);
      }
    },
    [],
  );

  /**
   * Ensure the in-memory store is populated from AsyncStorage.
   * Uses promise coalescing so concurrent calls all await the same load
   * operation instead of each getting a stale empty {} from the closure.
   */
  const ensureLoaded = useCallback(async (): Promise<AttemptTrackerStore> => {
    if (loadedRef.current) return store; // fast path: already loaded

    if (!loadPromiseRef.current) {
      // First caller creates the load promise
      loadPromiseRef.current = readStore().then(loaded => {
        loadedRef.current = true;
        setStore(loaded);
        loadPromiseRef.current = null; // clear so future calls use fast path
        return loaded;
      });
    }

    // All concurrent callers await the same promise — no stale {} returned
    return loadPromiseRef.current;
  }, [store, readStore]);

  // ── Public API ────────────────────────────────────────────────────────────

  const getAttemptState = useCallback(
    (orderId: string): AttemptState | null => {
      return store[orderId] ?? null;
    },
    [store],
  );

  const incrementAttempt = useCallback(
    async (orderId: string): Promise<AttemptState> => {
      // Always read directly from AsyncStorage — never from the potentially
      // stale in-memory store — to guarantee atomic read-modify-write (Fix #7)
      const current = await readStore();
      const existing = current[orderId];
      const newCount = (existing?.attemptCount ?? 0) + 1;
      const retryAvailableAt =
        Date.now() + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
      const next: AttemptState = { attemptCount: newCount, retryAvailableAt };
      await writeStore({ ...current, [orderId]: next });
      return next;
    },
    [readStore, writeStore],
  );

  const removeAttempt = useCallback(
    async (orderId: string): Promise<void> => {
      const current = await ensureLoaded();
      if (!(orderId in current)) return;
      const { [orderId]: _removed, ...rest } = current;
      await writeStore(rest);
    },
    [ensureLoaded, writeStore],
  );

  const cleanup = useCallback(
    async (activeOrderIds: string[]): Promise<void> => {
      const current = await ensureLoaded();
      const activeSet = new Set(activeOrderIds);
      const next: AttemptTrackerStore = {};
      for (const [id, state] of Object.entries(current)) {
        if (activeSet.has(id)) {
          next[id] = state;
        }
      }
      // Only write if something actually changed.
      if (Object.keys(next).length !== Object.keys(current).length) {
        await writeStore(next);
      }
    },
    [ensureLoaded, writeStore],
  );

  const isRetryLocked = useCallback(
    (orderId: string): boolean => {
      const state = store[orderId];
      if (!state) return false;
      return Date.now() < state.retryAvailableAt;
    },
    [store],
  );

  const getRemainingSeconds = useCallback(
    (orderId: string): number => {
      const state = store[orderId];
      if (!state) return 0;
      return Math.max(
        0,
        Math.ceil((state.retryAvailableAt - Date.now()) / 1000),
      );
    },
    [store],
  );

  const mergeServerAttempt = useCallback(
    async (orderId: string, serverCount: number): Promise<void> => {
      const current = await ensureLoaded();
      const local = current[orderId];
      // Only update if server count is strictly higher than local count.
      if (!local || serverCount > local.attemptCount) {
        const next: AttemptState = {
          attemptCount: serverCount,
          retryAvailableAt: local?.retryAvailableAt ?? 0,
        };
        await writeStore({ ...current, [orderId]: next });
      }
      // Otherwise keep local count (offline safety — Requirement 1.7).
    },
    [ensureLoaded, writeStore],
  );

  return {
    getAttemptState,
    incrementAttempt,
    removeAttempt,
    cleanup,
    isRetryLocked,
    getRemainingSeconds,
    mergeServerAttempt,
  };
}
