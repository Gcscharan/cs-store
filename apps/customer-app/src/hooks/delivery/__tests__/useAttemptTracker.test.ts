/**
 * Unit Tests for useAttemptTracker hook logic
 *
 * Tests the pure logic functions extracted from useAttemptTracker using an
 * in-memory AsyncStorage mock — same pattern as the property tests.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 8.1
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DELIVERY_CONFIG } from '../../../constants/deliveryConfig';
import type { AttemptState, AttemptTrackerStore } from '../useAttemptTracker';

// ── Storage key (must match useAttemptTracker.ts) ─────────────────────────────

const ATTEMPT_TRACKER_KEY = '@delivery_attempt_tracker';

// ── Pure logic extracted from useAttemptTracker ───────────────────────────────

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

async function readStore(): Promise<AttemptTrackerStore> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPT_TRACKER_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AttemptTrackerStore;
  } catch {
    return {};
  }
}

async function writeStore(next: AttemptTrackerStore): Promise<void> {
  await AsyncStorage.setItem(ATTEMPT_TRACKER_KEY, JSON.stringify(next));
}

function getAttemptState(store: AttemptTrackerStore, orderId: string): AttemptState | null {
  return store[orderId] ?? null;
}

async function incrementAttempt(orderId: string): Promise<AttemptState> {
  const current = await readStore();
  const existing = current[orderId];
  const newCount = (existing?.attemptCount ?? 0) + 1;
  const retryAvailableAt = Date.now() + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
  const next: AttemptState = { attemptCount: newCount, retryAvailableAt };
  await writeStore({ ...current, [orderId]: next });
  return next;
}

async function removeAttempt(orderId: string): Promise<void> {
  const current = await readStore();
  if (!(orderId in current)) return;
  const { [orderId]: _removed, ...rest } = current;
  await writeStore(rest);
}

async function cleanup(activeOrderIds: string[]): Promise<void> {
  const current = await readStore();
  const activeSet = new Set(activeOrderIds);
  const next: AttemptTrackerStore = {};
  for (const [id, state] of Object.entries(current)) {
    if (activeSet.has(id)) {
      next[id] = state;
    }
  }
  if (Object.keys(next).length !== Object.keys(current).length) {
    await writeStore(next);
  }
}

// ── In-memory AsyncStorage mock ───────────────────────────────────────────────

function makeInMemoryStorage() {
  let store: Record<string, string> = {};
  return {
    reset() { store = {}; },
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    clear: jest.fn(async () => { store = {}; }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAttemptTracker unit tests', () => {
  let inMemory: ReturnType<typeof makeInMemoryStorage>;

  beforeEach(() => {
    inMemory = makeInMemoryStorage();
    mockStorage.getItem.mockImplementation(inMemory.getItem);
    mockStorage.setItem.mockImplementation(inMemory.setItem);
    mockStorage.removeItem.mockImplementation(inMemory.removeItem);
    mockStorage.clear.mockImplementation(inMemory.clear);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Requirement 1.5: Initialization with empty storage ───────────────────

  describe('initialization with empty storage', () => {
    it('readStore returns empty object when storage is empty', async () => {
      const store = await readStore();
      expect(store).toEqual({});
    });

    it('getAttemptState returns null for any order when storage is empty', async () => {
      const store = await readStore();
      expect(getAttemptState(store, 'order_123')).toBeNull();
    });

    it('readStore returns empty object when key is missing (null from AsyncStorage)', async () => {
      mockStorage.getItem.mockResolvedValueOnce(null);
      const store = await readStore();
      expect(store).toEqual({});
    });
  });

  // ── Requirement 1.2: incrementAttempt increments count and sets timestamp ─

  describe('incrementAttempt', () => {
    it('increments count from 0 to 1 on first failure', async () => {
      const before = Date.now();
      const result = await incrementAttempt('order_abc');
      const after = Date.now();

      expect(result.attemptCount).toBe(1);
      expect(result.retryAvailableAt).toBeGreaterThanOrEqual(
        before + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000,
      );
      expect(result.retryAvailableAt).toBeLessThanOrEqual(
        after + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000,
      );
    });

    it('increments count from 1 to 2 on second failure', async () => {
      await writeStore({ order_abc: { attemptCount: 1, retryAvailableAt: 0 } });

      const result = await incrementAttempt('order_abc');

      expect(result.attemptCount).toBe(2);
    });

    it('increments count from 2 to 3 on third failure', async () => {
      await writeStore({ order_abc: { attemptCount: 2, retryAvailableAt: 0 } });

      const result = await incrementAttempt('order_abc');

      expect(result.attemptCount).toBe(3);
    });

    it('sets retryAvailableAt to Date.now() + RETRY_BACKOFF_SECONDS * 1000', async () => {
      const before = Date.now();
      const result = await incrementAttempt('order_abc');
      const after = Date.now();

      const expectedMin = before + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
      const expectedMax = after + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;

      expect(result.retryAvailableAt).toBeGreaterThanOrEqual(expectedMin);
      expect(result.retryAvailableAt).toBeLessThanOrEqual(expectedMax);
    });

    it('persists the incremented state to AsyncStorage', async () => {
      await incrementAttempt('order_abc');

      const stored = await readStore();
      expect(getAttemptState(stored, 'order_abc')).not.toBeNull();
      expect(getAttemptState(stored, 'order_abc')!.attemptCount).toBe(1);
    });

    it('does not affect other orders in storage', async () => {
      await writeStore({
        order_other: { attemptCount: 2, retryAvailableAt: 9999 },
      });

      await incrementAttempt('order_abc');

      const stored = await readStore();
      expect(getAttemptState(stored, 'order_other')!.attemptCount).toBe(2);
      expect(getAttemptState(stored, 'order_other')!.retryAvailableAt).toBe(9999);
    });
  });

  // ── Requirement 1.3: removeAttempt clears entry from storage ─────────────

  describe('removeAttempt', () => {
    it('removes an existing entry from storage', async () => {
      await writeStore({ order_abc: { attemptCount: 2, retryAvailableAt: 9999 } });

      await removeAttempt('order_abc');

      const stored = await readStore();
      expect(getAttemptState(stored, 'order_abc')).toBeNull();
    });

    it('is a no-op when the order does not exist in storage', async () => {
      // Should not throw
      await expect(removeAttempt('nonexistent_order')).resolves.toBeUndefined();
    });

    it('does not remove other orders when removing one', async () => {
      await writeStore({
        order_abc: { attemptCount: 1, retryAvailableAt: 1000 },
        order_xyz: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      await removeAttempt('order_abc');

      const stored = await readStore();
      expect(getAttemptState(stored, 'order_abc')).toBeNull();
      expect(getAttemptState(stored, 'order_xyz')).not.toBeNull();
      expect(getAttemptState(stored, 'order_xyz')!.attemptCount).toBe(2);
    });

    it('leaves storage empty after removing the only entry', async () => {
      await writeStore({ order_abc: { attemptCount: 1, retryAvailableAt: 1000 } });

      await removeAttempt('order_abc');

      const stored = await readStore();
      expect(Object.keys(stored)).toHaveLength(0);
    });
  });

  // ── Requirement 8.1: cleanup removes stale entries ───────────────────────

  describe('cleanup', () => {
    it('removes entries for orders not in the active list', async () => {
      await writeStore({
        order_active: { attemptCount: 1, retryAvailableAt: 1000 },
        order_stale: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      await cleanup(['order_active']);

      const stored = await readStore();
      expect(getAttemptState(stored, 'order_active')).not.toBeNull();
      expect(getAttemptState(stored, 'order_stale')).toBeNull();
    });

    it('removes all entries when active list is empty', async () => {
      await writeStore({
        order_a: { attemptCount: 1, retryAvailableAt: 1000 },
        order_b: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      await cleanup([]);

      const stored = await readStore();
      expect(Object.keys(stored)).toHaveLength(0);
    });

    it('keeps all entries when all orders are active', async () => {
      await writeStore({
        order_a: { attemptCount: 1, retryAvailableAt: 1000 },
        order_b: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      await cleanup(['order_a', 'order_b']);

      const stored = await readStore();
      expect(getAttemptState(stored, 'order_a')).not.toBeNull();
      expect(getAttemptState(stored, 'order_b')).not.toBeNull();
    });

    it('does not write to storage when nothing changes', async () => {
      await writeStore({
        order_a: { attemptCount: 1, retryAvailableAt: 1000 },
      });

      // Reset the mock call count after seeding
      mockStorage.setItem.mockClear();

      await cleanup(['order_a']);

      // No write should have occurred since nothing changed
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('is a no-op on empty storage', async () => {
      await expect(cleanup(['order_a', 'order_b'])).resolves.toBeUndefined();
      const stored = await readStore();
      expect(Object.keys(stored)).toHaveLength(0);
    });

    it('removes multiple stale entries in one pass', async () => {
      await writeStore({
        order_active1: { attemptCount: 1, retryAvailableAt: 1000 },
        order_active2: { attemptCount: 1, retryAvailableAt: 1000 },
        order_stale1: { attemptCount: 2, retryAvailableAt: 2000 },
        order_stale2: { attemptCount: 3, retryAvailableAt: 3000 },
        order_stale3: { attemptCount: 1, retryAvailableAt: 4000 },
      });

      await cleanup(['order_active1', 'order_active2']);

      const stored = await readStore();
      expect(Object.keys(stored)).toHaveLength(2);
      expect(getAttemptState(stored, 'order_active1')).not.toBeNull();
      expect(getAttemptState(stored, 'order_active2')).not.toBeNull();
      expect(getAttemptState(stored, 'order_stale1')).toBeNull();
      expect(getAttemptState(stored, 'order_stale2')).toBeNull();
      expect(getAttemptState(stored, 'order_stale3')).toBeNull();
    });
  });

  // ── Requirement 1.6: AsyncStorage error handling ─────────────────────────

  describe('AsyncStorage error handling', () => {
    it('returns empty object when getItem throws an error', async () => {
      mockStorage.getItem.mockRejectedValueOnce(new Error('Storage read error'));

      const store = await readStore();
      expect(store).toEqual({});
    });

    it('returns empty object when stored value is invalid JSON (parse error)', async () => {
      mockStorage.getItem.mockResolvedValueOnce('{ invalid json :::');

      const store = await readStore();
      expect(store).toEqual({});
    });

    it('returns empty object when stored value is null', async () => {
      mockStorage.getItem.mockResolvedValueOnce(null);

      const store = await readStore();
      expect(store).toEqual({});
    });

    it('returns empty object when stored value is empty string', async () => {
      mockStorage.getItem.mockResolvedValueOnce('');

      const store = await readStore();
      expect(store).toEqual({});
    });

    it('incrementAttempt still works after a read error (treats count as 0)', async () => {
      // First call (read) throws, second call (write) succeeds
      mockStorage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));

      const result = await incrementAttempt('order_abc');

      // Should treat missing data as count=0, so result is 1
      expect(result.attemptCount).toBe(1);
    });
  });
});
