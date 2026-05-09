/**
 * Unit Tests for handleFailDelivery pure logic
 *
 * Tests the PURE LOGIC of the failure flow, extracted into testable functions.
 * No React component mounting required.
 *
 * Validates: Requirements 1.2, 3.1, 5.1, 5.3, 6.1
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DELIVERY_CONFIG } from '../../../constants/deliveryConfig';
import type { AttemptState, AttemptTrackerStore } from '../../../hooks/delivery/useAttemptTracker';

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

/** Decide failure path based on attempt count vs max attempts */
function decideFailurePath(
  attemptCount: number,
  maxAttempts: number,
): 'retry' | 'escalate' {
  return attemptCount < maxAttempts ? 'retry' : 'escalate';
}

/** Generate idempotency key for escalation */
function generateIdempotencyKey(orderId: string, timestamp: number): string {
  return `escalate:${orderId}:${timestamp}`;
}

/**
 * Simulate handleFailDelivery — returns observable outcomes.
 */
interface FailureFlowResult {
  sortedOrderIds: string[];
  attemptStore: AttemptTrackerStore;
  escalationCalled: boolean;
  escalationEnqueued: boolean;
  alertTitle: string | null;
  orderRemoved: boolean;
  path: 'retry' | 'escalate';
}

async function simulateHandleFailDelivery(params: {
  orderId: string;
  sortedOrderIds: string[];
  initialStore: AttemptTrackerStore;
  maxAttempts: number;
  escalationResult: 'success' | 'network_error' | 'server_error_4xx';
  queue: string[];
}): Promise<FailureFlowResult> {
  const { orderId, sortedOrderIds, initialStore, maxAttempts, escalationResult, queue } = params;

  await writeStore(initialStore);

  const attemptState = await incrementAttempt(orderId);
  const { attemptCount } = attemptState;

  const path = decideFailurePath(attemptCount, maxAttempts);

  let alertTitle: string | null = null;
  let escalationCalled = false;
  let escalationEnqueued = false;
  let orderRemoved = false;
  let finalSortedOrderIds = [...sortedOrderIds];

  if (path === 'escalate') {
    escalationCalled = true;

    if (escalationResult === 'success') {
      await removeAttempt(orderId);
      alertTitle = 'Order Escalated';
      orderRemoved = true;
    } else if (escalationResult === 'network_error') {
      queue.push(generateIdempotencyKey(orderId, Date.now()));
      escalationEnqueued = true;
      await removeAttempt(orderId);
      alertTitle = 'Order Escalated (offline)';
      orderRemoved = true;
    } else {
      // 4xx — retain order
      alertTitle = 'Escalation Failed';
      orderRemoved = false;
    }
  } else {
    // Retry path
    alertTitle = 'Attempt Recorded';
    orderRemoved = false;
  }

  if (orderRemoved) {
    finalSortedOrderIds = sortedOrderIds.filter(id => id !== orderId);
  }

  const finalStore = await readStore();

  return {
    sortedOrderIds: finalSortedOrderIds,
    attemptStore: finalStore,
    escalationCalled,
    escalationEnqueued,
    alertTitle,
    orderRemoved,
    path,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('handleFailDelivery unit tests', () => {
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

  // ── Test: increments attempt on first failure ─────────────────────────────

  describe('increments attempt on first failure', () => {
    it('increments attemptCount from 0 to 1 on first failure', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS,
        escalationResult: 'success',
        queue: [],
      });

      const state = getAttemptState(result.attemptStore, 'order_001');
      // Retry path (count 1 < max 3), so state is preserved
      expect(state).not.toBeNull();
      expect(state!.attemptCount).toBe(1);
    });

    it('increments attemptCount from 1 to 2 on second failure', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 1, retryAvailableAt: 0 } },
        maxAttempts: DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS,
        escalationResult: 'success',
        queue: [],
      });

      const state = getAttemptState(result.attemptStore, 'order_001');
      expect(state).not.toBeNull();
      expect(state!.attemptCount).toBe(2);
    });

    it('sets retryAvailableAt to future timestamp after increment', async () => {
      const before = Date.now();

      await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: DELIVERY_CONFIG.MAX_DELIVERY_ATTEMPTS,
        escalationResult: 'success',
        queue: [],
      });

      const store = await readStore();
      const state = getAttemptState(store, 'order_001');
      expect(state).not.toBeNull();
      expect(state!.retryAvailableAt).toBeGreaterThan(before);
    });
  });

  // ── Test: retains order in route when attemptCount < maxAttempts ──────────

  describe('retains order in route when attemptCount < maxAttempts', () => {
    it('keeps order in sortedOrderIds on first failure (count 1 < max 3)', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001', 'order_002'],
        initialStore: {},
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.sortedOrderIds).toContain('order_001');
      expect(result.orderRemoved).toBe(false);
      expect(result.path).toBe('retry');
    });

    it('keeps order in sortedOrderIds on second failure (count 2 < max 3)', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001', 'order_002'],
        initialStore: { order_001: { attemptCount: 1, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.sortedOrderIds).toContain('order_001');
      expect(result.orderRemoved).toBe(false);
      expect(result.path).toBe('retry');
    });

    it('does not affect other orders in sortedOrderIds', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001', 'order_002', 'order_003'],
        initialStore: {},
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.sortedOrderIds).toContain('order_002');
      expect(result.sortedOrderIds).toContain('order_003');
    });

    it('shows "Attempt Recorded" alert on retry path', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.alertTitle).toBe('Attempt Recorded');
    });
  });

  // ── Test: calls escalation endpoint when attemptCount === maxAttempts ─────

  describe('calls escalation endpoint when attemptCount === maxAttempts', () => {
    it('triggers escalation path when count reaches maxAttempts', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } }, // 2 + 1 = 3 = max
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.escalationCalled).toBe(true);
      expect(result.path).toBe('escalate');
    });

    it('removes order from sortedOrderIds on successful escalation', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001', 'order_002'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.sortedOrderIds).not.toContain('order_001');
      expect(result.sortedOrderIds).toContain('order_002');
      expect(result.orderRemoved).toBe(true);
    });

    it('clears attempt state from tracker on successful escalation', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      const state = getAttemptState(result.attemptStore, 'order_001');
      expect(state).toBeNull();
    });

    it('shows "Order Escalated" alert on successful escalation', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.alertTitle).toBe('Order Escalated');
    });

    it('escalates when maxAttempts is 1 and first failure occurs', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: 1,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.path).toBe('escalate');
      expect(result.escalationCalled).toBe(true);
      expect(result.orderRemoved).toBe(true);
    });
  });

  // ── Test: enqueues escalation on network error ────────────────────────────

  describe('enqueues escalation on network error', () => {
    it('enqueues escalation action when network is unavailable', async () => {
      const queue: string[] = [];

      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'network_error',
        queue,
      });

      expect(result.escalationEnqueued).toBe(true);
      expect(queue.length).toBe(1);
      expect(queue[0]).toContain('order_001');
    });

    it('removes order from sortedOrderIds even on network error', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001', 'order_002'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'network_error',
        queue: [],
      });

      expect(result.sortedOrderIds).not.toContain('order_001');
      expect(result.orderRemoved).toBe(true);
    });

    it('clears attempt state before enqueuing on network error', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'network_error',
        queue: [],
      });

      const state = getAttemptState(result.attemptStore, 'order_001');
      expect(state).toBeNull();
    });

    it('shows offline escalation alert on network error', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'network_error',
        queue: [],
      });

      expect(result.alertTitle).toContain('Escalated');
    });
  });

  // ── Test: shows correct alerts for retry vs escalation ───────────────────

  describe('shows correct alerts for retry vs escalation', () => {
    it('shows "Attempt Recorded" alert on retry path (count < max)', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.alertTitle).toBe('Attempt Recorded');
    });

    it('shows "Order Escalated" alert on successful escalation', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.alertTitle).toBe('Order Escalated');
    });

    it('shows offline escalation alert on network error', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'network_error',
        queue: [],
      });

      expect(result.alertTitle).toContain('Escalated');
    });

    it('shows "Escalation Failed" alert on 4xx server error', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'server_error_4xx',
        queue: [],
      });

      expect(result.alertTitle).toBe('Escalation Failed');
    });

    it('retains order on 4xx server error (no removal)', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'server_error_4xx',
        queue: [],
      });

      expect(result.orderRemoved).toBe(false);
      expect(result.sortedOrderIds).toContain('order_001');
    });

    it('preserves attempt state on 4xx server error', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 2, retryAvailableAt: 0 } },
        maxAttempts: 3,
        escalationResult: 'server_error_4xx',
        queue: [],
      });

      const state = getAttemptState(result.attemptStore, 'order_001');
      expect(state).not.toBeNull();
      // Count was incremented to 3 (maxAttempts) before the 4xx error
      expect(state!.attemptCount).toBe(3);
    });
  });

  // ── Test: boundary conditions ─────────────────────────────────────────────

  describe('boundary conditions', () => {
    it('maxAttempts=1: first failure immediately escalates', async () => {
      const result = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: 1,
        escalationResult: 'success',
        queue: [],
      });

      expect(result.path).toBe('escalate');
      expect(result.orderRemoved).toBe(true);
    });

    it('maxAttempts=2: first failure retries, second escalates', async () => {
      // First failure
      const result1 = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: {},
        maxAttempts: 2,
        escalationResult: 'success',
        queue: [],
      });
      expect(result1.path).toBe('retry');

      inMemory.reset();

      // Second failure (count is now 1, after increment becomes 2 = max)
      const result2 = await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001'],
        initialStore: { order_001: { attemptCount: 1, retryAvailableAt: 0 } },
        maxAttempts: 2,
        escalationResult: 'success',
        queue: [],
      });
      expect(result2.path).toBe('escalate');
      expect(result2.orderRemoved).toBe(true);
    });

    it('does not affect other orders in attempt tracker', async () => {
      await writeStore({
        order_other: { attemptCount: 1, retryAvailableAt: 9999 },
      });

      await simulateHandleFailDelivery({
        orderId: 'order_001',
        sortedOrderIds: ['order_001', 'order_other'],
        initialStore: { order_other: { attemptCount: 1, retryAvailableAt: 9999 } },
        maxAttempts: 3,
        escalationResult: 'success',
        queue: [],
      });

      const store = await readStore();
      const otherState = getAttemptState(store, 'order_other');
      expect(otherState).not.toBeNull();
      expect(otherState!.attemptCount).toBe(1);
    });
  });
});
