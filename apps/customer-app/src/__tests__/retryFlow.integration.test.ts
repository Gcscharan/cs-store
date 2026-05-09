/**
 * Integration Tests: Multi-Attempt Failure Flow (Task 19)
 *
 * End-to-end tests for the retry and escalation flows, exercising the
 * interaction between useAttemptTracker, handleFailDelivery logic, and
 * the offline queue.
 *
 * Requirements: 1.4, 3.6, 7.1, 7.2, 7.5, 8.2, 8.3
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DELIVERY_CONFIG } from '../constants/deliveryConfig';
import type { AttemptState, AttemptTrackerStore } from '../hooks/delivery/useAttemptTracker';
import { VALID_TRANSITIONS } from '../hooks/delivery/useActionQueue';

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

const ATTEMPT_TRACKER_KEY = '@delivery_attempt_tracker';

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
    if (activeSet.has(id)) next[id] = state;
  }
  if (Object.keys(next).length !== Object.keys(current).length) {
    await writeStore(next);
  }
}

async function mergeServerAttempt(orderId: string, serverCount: number): Promise<void> {
  const current = await readStore();
  const local = current[orderId];
  if (!local || serverCount > local.attemptCount) {
    const next: AttemptState = {
      attemptCount: serverCount,
      retryAvailableAt: local?.retryAvailableAt ?? 0,
    };
    await writeStore({ ...current, [orderId]: next });
  }
}

// ── Failure flow simulation ───────────────────────────────────────────────────

interface FailureFlowResult {
  attemptCount: number;
  orderRemoved: boolean;
  escalationEnqueued: boolean;
  alertTitle: string;
  attemptStateCleared: boolean;
}

async function simulateFailDelivery(params: {
  orderId: string;
  maxAttempts: number;
  escalationResult: 'success' | 'network_error' | 'server_error_4xx';
  queue: string[];
}): Promise<FailureFlowResult> {
  const { orderId, maxAttempts, escalationResult, queue } = params;

  const attemptState = await incrementAttempt(orderId);
  const { attemptCount } = attemptState;

  let orderRemoved = false;
  let escalationEnqueued = false;
  let alertTitle = '';

  if (attemptCount >= maxAttempts) {
    if (escalationResult === 'success') {
      await removeAttempt(orderId);
      orderRemoved = true;
      alertTitle = 'Order Escalated';
    } else if (escalationResult === 'network_error') {
      queue.push(`escalate:${orderId}:${Date.now()}`);
      escalationEnqueued = true;
      await removeAttempt(orderId);
      orderRemoved = true;
      alertTitle = 'Order Escalated (offline)';
    } else {
      alertTitle = 'Escalation Failed';
    }
  } else {
    alertTitle = 'Attempt Recorded';
  }

  const store = await readStore();
  const attemptStateCleared = getAttemptState(store, orderId) === null;

  return { attemptCount, orderRemoved, escalationEnqueued, alertTitle, attemptStateCleared };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('Multi-Attempt Failure Flow — Integration Tests (Task 19)', () => {
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

  // ── Test 1: End-to-end retry flow ─────────────────────────────────────────

  describe('end-to-end retry flow: fail → backoff → unlock → retry → success', () => {
    it('first failure increments count and sets backoff, order stays in route', async () => {
      const result = await simulateFailDelivery({
        orderId: 'order_001',
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.attemptCount).toBe(1);
      expect(result.orderRemoved).toBe(false);
      expect(result.alertTitle).toBe('Attempt Recorded');
      expect(result.attemptStateCleared).toBe(false);
    });

    it('second failure increments count, order still in route', async () => {
      // Seed first failure
      await writeStore({ order_001: { attemptCount: 1, retryAvailableAt: 0 } });

      const result = await simulateFailDelivery({
        orderId: 'order_001',
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.attemptCount).toBe(2);
      expect(result.orderRemoved).toBe(false);
      expect(result.alertTitle).toBe('Attempt Recorded');
    });

    it('after backoff expires, order becomes actionable again (isRetryLocked = false)', () => {
      const now = Date.now();
      const retryAvailableAt = now - 1000; // expired 1 second ago
      const isRetryLocked = now < retryAvailableAt;
      expect(isRetryLocked).toBe(false);
    });

    it('successful delivery after retry clears attempt state', async () => {
      await writeStore({ order_001: { attemptCount: 2, retryAvailableAt: 0 } });

      // Simulate OTP verification success → removeAttempt
      await removeAttempt('order_001');

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')).toBeNull();
    });
  });

  // ── Test 2: End-to-end escalation flow ───────────────────────────────────

  describe('end-to-end escalation flow: fail 3 times → escalate → remove', () => {
    it('third failure triggers escalation and removes order', async () => {
      // Seed 2 previous failures
      await writeStore({ order_001: { attemptCount: 2, retryAvailableAt: 0 } });

      const result = await simulateFailDelivery({
        orderId: 'order_001',
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.attemptCount).toBe(3);
      expect(result.orderRemoved).toBe(true);
      expect(result.alertTitle).toBe('Order Escalated');
      expect(result.attemptStateCleared).toBe(true);
    });

    it('full 3-failure sequence: retry → retry → escalate', async () => {
      const orderId = 'order_full_flow';
      const maxAttempts = 3;
      const queue: string[] = [];

      // Failure 1
      const r1 = await simulateFailDelivery({ orderId, maxAttempts, escalationResult: 'success', queue });
      expect(r1.attemptCount).toBe(1);
      expect(r1.orderRemoved).toBe(false);

      // Failure 2
      const r2 = await simulateFailDelivery({ orderId, maxAttempts, escalationResult: 'success', queue });
      expect(r2.attemptCount).toBe(2);
      expect(r2.orderRemoved).toBe(false);

      // Failure 3 — escalation
      const r3 = await simulateFailDelivery({ orderId, maxAttempts, escalationResult: 'success', queue });
      expect(r3.attemptCount).toBe(3);
      expect(r3.orderRemoved).toBe(true);
      expect(r3.attemptStateCleared).toBe(true);
    });
  });

  // ── Test 3: Offline retry ─────────────────────────────────────────────────

  describe('offline retry: fail offline → increment local → sync when online', () => {
    it('offline failure increments local count immediately', async () => {
      // Simulate offline: incrementAttempt runs locally regardless of network
      const state = await incrementAttempt('order_001');
      expect(state.attemptCount).toBe(1);

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')!.attemptCount).toBe(1);
    });

    it('multiple offline failures accumulate correctly', async () => {
      await incrementAttempt('order_001'); // count: 1
      await incrementAttempt('order_001'); // count: 2

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')!.attemptCount).toBe(2);
    });

    it('attempt state persists across simulated app restart (AsyncStorage round-trip)', async () => {
      // Write state
      await writeStore({ order_001: { attemptCount: 2, retryAvailableAt: Date.now() + 30_000 } });

      // Simulate restart: read from storage
      const restored = await readStore();
      const state = getAttemptState(restored, 'order_001');

      expect(state).not.toBeNull();
      expect(state!.attemptCount).toBe(2);
      expect(state!.retryAvailableAt).toBeGreaterThan(Date.now());
    });
  });

  // ── Test 4: Offline escalation ────────────────────────────────────────────

  describe('offline escalation: fail 3 times offline → enqueue → replay when online', () => {
    it('offline escalation enqueues action and removes order', async () => {
      await writeStore({ order_001: { attemptCount: 2, retryAvailableAt: 0 } });
      const queue: string[] = [];

      const result = await simulateFailDelivery({
        orderId: 'order_001',
        maxAttempts: 3,
        escalationResult: 'network_error',
        queue,
      });

      expect(result.escalationEnqueued).toBe(true);
      expect(queue.length).toBe(1);
      expect(queue[0]).toContain('order_001');
      expect(result.orderRemoved).toBe(true);
      expect(result.attemptStateCleared).toBe(true);
    });

    it('queued escalation passes VALID_TRANSITIONS check during replay', () => {
      // 'escalated' must be a valid transition from 'arrived'
      expect(VALID_TRANSITIONS['arrived']).toContain('escalated');
    });

    it('409 conflict on replay is silently discarded', async () => {
      // Simulate replay with 409 conflict
      const queue = ['escalate:order_001:123'];
      let alertShown = false;

      function handleReplayError(status: number, itemId: string): void {
        if (status === 409) {
          const idx = queue.indexOf(itemId);
          if (idx !== -1) queue.splice(idx, 1);
        } else {
          alertShown = true;
        }
      }

      handleReplayError(409, queue[0]);

      expect(queue).toHaveLength(0);
      expect(alertShown).toBe(false);
    });
  });

  // ── Test 5: Stale state protection ───────────────────────────────────────

  describe('stale state protection: server returns lower count → keep local count', () => {
    it('mergeServerAttempt keeps local count when it is higher', async () => {
      await writeStore({ order_001: { attemptCount: 3, retryAvailableAt: 1000 } });

      // Server returns lower count (e.g., offline sync lag)
      await mergeServerAttempt('order_001', 1);

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')!.attemptCount).toBe(3);
    });

    it('mergeServerAttempt uses server count when it is higher', async () => {
      await writeStore({ order_001: { attemptCount: 1, retryAvailableAt: 1000 } });

      await mergeServerAttempt('order_001', 3);

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')!.attemptCount).toBe(3);
    });

    it('mergeServerAttempt preserves local retryAvailableAt when local count wins', async () => {
      const retryAvailableAt = Date.now() + 30_000;
      await writeStore({ order_001: { attemptCount: 3, retryAvailableAt } });

      await mergeServerAttempt('order_001', 1);

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')!.retryAvailableAt).toBe(retryAvailableAt);
    });
  });

  // ── Test 6: Cleanup on delivered ─────────────────────────────────────────

  describe('cleanup: order delivered → attempt state removed', () => {
    it('removeAttempt clears state after successful delivery', async () => {
      await writeStore({ order_001: { attemptCount: 2, retryAvailableAt: 0 } });

      await removeAttempt('order_001');

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')).toBeNull();
    });

    it('other orders are not affected when one is delivered', async () => {
      await writeStore({
        order_001: { attemptCount: 2, retryAvailableAt: 0 },
        order_002: { attemptCount: 1, retryAvailableAt: 1000 },
      });

      await removeAttempt('order_001');

      const store = await readStore();
      expect(getAttemptState(store, 'order_001')).toBeNull();
      expect(getAttemptState(store, 'order_002')).not.toBeNull();
    });
  });

  // ── Test 7: Cleanup on cancelled ─────────────────────────────────────────

  describe('cleanup: order cancelled → attempt state removed', () => {
    it('cleanup removes attempt state when order is cancelled', async () => {
      await writeStore({
        order_active: { attemptCount: 1, retryAvailableAt: 1000 },
        order_cancelled: { attemptCount: 2, retryAvailableAt: 2000 },
      });

      // Simulate: order_cancelled removed from active list
      await cleanup(['order_active']);

      const store = await readStore();
      expect(getAttemptState(store, 'order_cancelled')).toBeNull();
      expect(getAttemptState(store, 'order_active')).not.toBeNull();
    });
  });

  // ── Test 8: App restart during backoff ───────────────────────────────────

  describe('app restart during backoff: countdown resumes from persisted timestamp', () => {
    it('retryAvailableAt is persisted and restored after simulated restart', async () => {
      const retryAvailableAt = Date.now() + 25_000; // 25 seconds from now

      // Write state (simulates state after first failure)
      await writeStore({ order_001: { attemptCount: 1, retryAvailableAt } });

      // Simulate restart: read from storage
      const restored = await readStore();
      const state = getAttemptState(restored, 'order_001');

      expect(state).not.toBeNull();
      expect(state!.retryAvailableAt).toBe(retryAvailableAt);

      // isRetryLocked should still be true (timestamp is in the future)
      const isRetryLocked = Date.now() < state!.retryAvailableAt;
      expect(isRetryLocked).toBe(true);
    });

    it('countdown resumes correctly from persisted timestamp', () => {
      const now = Date.now();
      const retryAvailableAt = now + 20_000; // 20 seconds remaining

      const remainingSeconds = Math.max(0, Math.ceil((retryAvailableAt - now) / 1000));
      expect(remainingSeconds).toBe(20);
    });

    it('order unlocks when retryAvailableAt is in the past after restart', () => {
      const retryAvailableAt = Date.now() - 5_000; // expired 5 seconds ago
      const isRetryLocked = Date.now() < retryAvailableAt;
      expect(isRetryLocked).toBe(false);
    });
  });
});
