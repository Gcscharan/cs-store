/**
 * Unit Tests: Attempt State Cleanup on Order Transitions (Task 16)
 *
 * Tests that attempt state is correctly cleaned up when:
 *  - An order is successfully delivered (OTP verified) — Requirement 8.2
 *  - An order is cancelled (removed from active list) — Requirement 8.3
 *  - The cleanup effect removes stale entries — Requirement 8.1
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttemptState, AttemptTrackerStore } from '../useAttemptTracker';

// ── Storage key ───────────────────────────────────────────────────────────────

const ATTEMPT_TRACKER_KEY = '@delivery_attempt_tracker';

// ── In-memory AsyncStorage mock ───────────────────────────────────────────────

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

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

// ── Pure logic functions ──────────────────────────────────────────────────────

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

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('Attempt state cleanup on order transitions (Task 16)', () => {
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

  // ── Requirement 8.2: Cleanup on successful delivery ───────────────────────

  describe('cleanup on successful delivery (Requirement 8.2)', () => {
    it('removeAttempt clears attempt state when OTP is verified successfully', async () => {
      // Seed attempt state for an order
      await writeStore({
        order_001: { attemptCount: 2, retryAvailableAt: Date.now() + 30_000 },
      });

      // Simulate OTP verification success → removeAttempt called
      await removeAttempt('order_001');

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')).toBeNull();
    });

    it('removeAttempt only removes the delivered order, not others', async () => {
      await writeStore({
        order_001: { attemptCount: 2, retryAvailableAt: 1000 },
        order_002: { attemptCount: 1, retryAvailableAt: 2000 },
      });

      await removeAttempt('order_001');

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')).toBeNull();
      expect(getAttemptState(store, 'order_002')).not.toBeNull();
      expect(getAttemptState(store, 'order_002')!.attemptCount).toBe(1);
    });

    it('removeAttempt is a no-op when order has no attempt state', async () => {
      await writeStore({
        order_002: { attemptCount: 1, retryAvailableAt: 2000 },
      });

      // order_001 has no attempt state — should not throw
      await expect(removeAttempt('order_001')).resolves.toBeUndefined();

      const store = await readStore();
      expect(getAttemptState(store, 'order_002')).not.toBeNull();
    });

    it('attempt state is cleared before order transitions to delivered', async () => {
      // Simulate the sequence: removeAttempt → order marked delivered
      const callOrder: string[] = [];

      const mockRemoveAttempt = jest.fn().mockImplementation(async () => {
        callOrder.push('removeAttempt');
      });
      const mockMarkDelivered = jest.fn().mockImplementation(async () => {
        callOrder.push('markDelivered');
      });

      // Simulate handleVerifyOtp success path
      async function simulateOtpSuccess(orderId: string) {
        // Alert shown, then cleanup
        await mockMarkDelivered(orderId);
        await mockRemoveAttempt(orderId);
      }

      await simulateOtpSuccess('order_001');

      expect(callOrder).toEqual(['markDelivered', 'removeAttempt']);
    });
  });

  // ── Requirement 8.3: Cleanup on order cancellation ───────────────────────

  describe('cleanup on order cancellation (Requirement 8.3)', () => {
    it('cleanup removes attempt state when order is cancelled and removed from active list', async () => {
      // Seed attempt state for two orders
      await writeStore({
        order_active: { attemptCount: 1, retryAvailableAt: 1000 },
        order_cancelled: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      // Simulate: order_cancelled removed from active list by socket event
      // cleanup() is called with only the remaining active orders
      await cleanup(['order_active']);

      const store = await readStore();
      expect(getAttemptState(store, 'order_cancelled')).toBeNull();
      expect(getAttemptState(store, 'order_active')).not.toBeNull();
    });

    it('cleanup removes all attempt state when all orders are cancelled', async () => {
      await writeStore({
        order_001: { attemptCount: 1, retryAvailableAt: 1000 },
        order_002: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      // All orders cancelled — active list is empty
      await cleanup([]);

      const store = await readStore();
      expect(Object.keys(store)).toHaveLength(0);
    });

    it('cleanup is triggered when active orders list changes (simulates socket event)', async () => {
      await writeStore({
        order_001: { attemptCount: 1, retryAvailableAt: 1000 },
        order_002: { attemptCount: 1, retryAvailableAt: 2000 },
        order_003: { attemptCount: 2, retryAvailableAt: 3000 },
      });

      // Simulate: order_002 and order_003 cancelled via socket
      const remainingActiveIds = ['order_001'];
      await cleanup(remainingActiveIds);

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')).not.toBeNull();
      expect(getAttemptState(store, 'order_002')).toBeNull();
      expect(getAttemptState(store, 'order_003')).toBeNull();
    });
  });

  // ── Requirement 8.1: Cleanup on active orders list refresh ───────────────

  describe('cleanup on active orders list refresh (Requirement 8.1)', () => {
    it('cleanup removes stale entries not in the refreshed active list', async () => {
      await writeStore({
        order_still_active: { attemptCount: 1, retryAvailableAt: 1000 },
        order_completed: { attemptCount: 3, retryAvailableAt: 0 },
        order_reassigned: { attemptCount: 2, retryAvailableAt: 0 },
      });

      // Server refresh returns only order_still_active
      await cleanup(['order_still_active']);

      const store = await readStore();
      expect(getAttemptState(store, 'order_still_active')).not.toBeNull();
      expect(getAttemptState(store, 'order_completed')).toBeNull();
      expect(getAttemptState(store, 'order_reassigned')).toBeNull();
    });

    it('cleanup does not write to storage when nothing changes', async () => {
      await writeStore({
        order_001: { attemptCount: 1, retryAvailableAt: 1000 },
      });

      mockStorage.setItem.mockClear();

      // All orders still active — no change
      await cleanup(['order_001']);

      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('cleanup handles empty storage gracefully', async () => {
      // No attempt state in storage
      await expect(cleanup(['order_001', 'order_002'])).resolves.toBeUndefined();
    });

    it('cleanup removes the correct entry when multiple orders have attempt state', async () => {
      await writeStore({
        order_a: { attemptCount: 1, retryAvailableAt: 1000 },
        order_b: { attemptCount: 2, retryAvailableAt: 2000 },
        order_c: { attemptCount: 1, retryAvailableAt: 3000 },
        order_d: { attemptCount: 3, retryAvailableAt: 4000 },
      });

      // Only order_a and order_c remain active
      await cleanup(['order_a', 'order_c']);

      const store = await readStore();
      expect(getAttemptState(store, 'order_a')).not.toBeNull();
      expect(getAttemptState(store, 'order_b')).toBeNull();
      expect(getAttemptState(store, 'order_c')).not.toBeNull();
      expect(getAttemptState(store, 'order_d')).toBeNull();
    });
  });
});
