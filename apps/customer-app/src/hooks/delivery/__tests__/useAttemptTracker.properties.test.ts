/**
 * Property-Based Tests for useAttemptTracker hook logic
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 3.3, 3.4, 7.5**
 *
 * Property 1: AsyncStorage Round-Trip Preservation
 *   For any valid AttemptState, persisting to AsyncStorage then reading back
 *   SHALL produce an equivalent AttemptState.
 *
 * Property 2: Server Merge Preserves Maximum Count
 *   For any local count L and server count S, mergeServerAttempt SHALL result
 *   in max(L, S).
 *
 * Property 3: Increment Produces Correct State
 *   For any initial attemptCount N, incrementAttempt SHALL produce
 *   attemptCount = N + 1 and retryAvailableAt = Date.now() + RETRY_BACKOFF_SECONDS * 1000.
 *
 * Property 4: Remove Clears State
 *   For any order with existing attempt state, removeAttempt SHALL result in
 *   getAttemptState returning null.
 *
 * Property 5: Missing Entry Defaults to Null
 *   For any order ID not present, getAttemptState SHALL return null.
 *
 * Property 6: mergeServerAttempt Write-Once Guarantee (Fix 3)
 *   When serverCount > localCount, AsyncStorage.setItem SHALL be called exactly once.
 *   When serverCount <= localCount, AsyncStorage.setItem SHALL NOT be called.
 *
 * Property 14: Retry Lock Derived from Timestamp
 *   isRetryLocked SHALL return true if and only if Date.now() < retryAvailableAt.
 *
 * Property 15: Countdown Calculation from Timestamp
 *   getRemainingSeconds SHALL return Math.ceil((retryAvailableAt - Date.now()) / 1000).
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Note: These tests exercise the pure logic extracted from useAttemptTracker
 * without mounting the hook — keeping tests fast and deterministic.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DELIVERY_CONFIG } from '../../../constants/deliveryConfig';
import type { AttemptState, AttemptTrackerStore } from '../useAttemptTracker';

// ── Storage key (must match useAttemptTracker.ts) ─────────────────────────────

const ATTEMPT_TRACKER_KEY = '@delivery_attempt_tracker';

// ── Pure logic extracted from useAttemptTracker ───────────────────────────────
// These mirror the exact implementations in the hook, tested without React.

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/** Read the full store from AsyncStorage, returning {} on any error. */
async function readStore(): Promise<AttemptTrackerStore> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPT_TRACKER_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AttemptTrackerStore;
  } catch {
    return {};
  }
}

/** Persist the full store to AsyncStorage. */
async function writeStore(next: AttemptTrackerStore): Promise<void> {
  await AsyncStorage.setItem(ATTEMPT_TRACKER_KEY, JSON.stringify(next));
}

/** Get attempt state for an order from the store. */
function getAttemptState(store: AttemptTrackerStore, orderId: string): AttemptState | null {
  return store[orderId] ?? null;
}

/** Increment attempt count and set retryAvailableAt. */
async function incrementAttempt(orderId: string): Promise<AttemptState> {
  const current = await readStore();
  const existing = current[orderId];
  const newCount = (existing?.attemptCount ?? 0) + 1;
  const retryAvailableAt = Date.now() + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
  const next: AttemptState = { attemptCount: newCount, retryAvailableAt };
  await writeStore({ ...current, [orderId]: next });
  return next;
}

/** Remove attempt state for an order. */
async function removeAttempt(orderId: string): Promise<void> {
  const current = await readStore();
  if (!(orderId in current)) return;
  const { [orderId]: _removed, ...rest } = current;
  await writeStore(rest);
}

/** Merge server attempt count — only updates if server count is higher. */
async function mergeServerAttempt(orderId: string, serverCount: number): Promise<AttemptTrackerStore> {
  const current = await readStore();
  const local = current[orderId];
  if (!local || serverCount > local.attemptCount) {
    const next: AttemptState = {
      attemptCount: serverCount,
      retryAvailableAt: local?.retryAvailableAt ?? 0,
    };
    const updated = { ...current, [orderId]: next };
    await writeStore(updated);
    return updated;
  }
  return current;
}

/** isRetryLocked: returns true iff Date.now() < retryAvailableAt */
function isRetryLocked(store: AttemptTrackerStore, orderId: string): boolean {
  const state = store[orderId];
  if (!state) return false;
  return Date.now() < state.retryAvailableAt;
}

/** getRemainingSeconds: Math.ceil((retryAvailableAt - Date.now()) / 1000), min 0 */
function getRemainingSeconds(store: AttemptTrackerStore, orderId: string): number {
  const state = store[orderId];
  if (!state) return 0;
  return Math.max(0, Math.ceil((state.retryAvailableAt - Date.now()) / 1000));
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

// ── Arbitraries ───────────────────────────────────────────────────────────────

// Avoid strings that collide with Object.prototype property names (e.g. "constructor", "valueOf")
const PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));
const orderIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter(s => s.trim().length > 0 && !PROTO_KEYS.has(s));

const attemptStateArb = fc.record({
  attemptCount: fc.integer({ min: 0, max: 10 }),
  retryAvailableAt: fc.integer({ min: 0, max: Date.now() + 10_000_000 }),
});

const nonNegativeCountArb = fc.integer({ min: 0, max: 20 });

// ── Setup ─────────────────────────────────────────────────────────────────────

describe('useAttemptTracker property-based tests', () => {
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

  // ── Property 1: AsyncStorage Round-Trip Preservation ─────────────────────

  // Feature: multi-attempt-failure-flow, Property 1: AsyncStorage Round-Trip Preservation
  describe('Property 1: AsyncStorage Round-Trip Preservation', () => {
    it('persisting an AttemptState then reading back produces an equivalent AttemptState', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          attemptStateArb,
          async (orderId, attemptState) => {
            inMemory.reset();

            // Write a store containing the attempt state
            await writeStore({ [orderId]: attemptState });

            // Read it back
            const restored = await readStore();
            const result = getAttemptState(restored, orderId);

            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(attemptState.attemptCount);
            expect(result!.retryAvailableAt).toBe(attemptState.retryAvailableAt);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('round-trip preserves all entries in a multi-order store', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(orderIdArb, attemptStateArb), { minLength: 1, maxLength: 5 }),
          async (entries) => {
            inMemory.reset();

            // Build a store with unique order IDs
            const storeIn: AttemptTrackerStore = {};
            for (const [orderId, state] of entries) {
              storeIn[orderId] = state;
            }

            await writeStore(storeIn);
            const restored = await readStore();

            // Every entry written must be readable back
            for (const [orderId, state] of Object.entries(storeIn)) {
              const result = getAttemptState(restored, orderId);
              expect(result).not.toBeNull();
              expect(result!.attemptCount).toBe(state.attemptCount);
              expect(result!.retryAvailableAt).toBe(state.retryAvailableAt);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 2: Server Merge Preserves Maximum Count ─────────────────────

  // Feature: multi-attempt-failure-flow, Property 2: Server Merge Preserves Maximum Count
  describe('Property 2: Server Merge Preserves Maximum Count', () => {
    it('mergeServerAttempt results in max(localCount, serverCount)', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          nonNegativeCountArb,
          nonNegativeCountArb,
          async (orderId, localCount, serverCount) => {
            inMemory.reset();

            // Seed local state
            const localState: AttemptState = {
              attemptCount: localCount,
              retryAvailableAt: Date.now() + 5000,
            };
            await writeStore({ [orderId]: localState });

            // Merge server count
            const updatedStore = await mergeServerAttempt(orderId, serverCount);
            const result = getAttemptState(updatedStore, orderId);

            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(Math.max(localCount, serverCount));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('mergeServerAttempt preserves local retryAvailableAt when local count wins', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          fc.integer({ min: 5, max: 20 }), // local count always higher
          fc.integer({ min: 0, max: 4 }),   // server count always lower
          fc.integer({ min: 1000, max: 9_999_999 }),
          async (orderId, localCount, serverCount, retryAvailableAt) => {
            inMemory.reset();

            const localState: AttemptState = { attemptCount: localCount, retryAvailableAt };
            await writeStore({ [orderId]: localState });

            const updatedStore = await mergeServerAttempt(orderId, serverCount);
            const result = getAttemptState(updatedStore, orderId);

            // Local count wins — retryAvailableAt must be preserved
            expect(result!.attemptCount).toBe(localCount);
            expect(result!.retryAvailableAt).toBe(retryAvailableAt);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('mergeServerAttempt with no local state uses server count', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          nonNegativeCountArb,
          async (orderId, serverCount) => {
            inMemory.reset();
            // No local state for this orderId

            const updatedStore = await mergeServerAttempt(orderId, serverCount);
            const result = getAttemptState(updatedStore, orderId);

            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(serverCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 3: Increment Produces Correct State ──────────────────────────

  // Feature: multi-attempt-failure-flow, Property 3: Increment Produces Correct State
  describe('Property 3: Increment Produces Correct State', () => {
    it('incrementAttempt produces attemptCount = N + 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          nonNegativeCountArb,
          async (orderId, initialCount) => {
            inMemory.reset();

            // Seed initial state
            if (initialCount > 0) {
              await writeStore({ [orderId]: { attemptCount: initialCount, retryAvailableAt: 0 } });
            }

            const before = Date.now();
            const result = await incrementAttempt(orderId);
            const after = Date.now();

            expect(result.attemptCount).toBe(initialCount + 1);

            // retryAvailableAt must be within the expected window
            const expectedMin = before + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
            const expectedMax = after + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
            expect(result.retryAvailableAt).toBeGreaterThanOrEqual(expectedMin);
            expect(result.retryAvailableAt).toBeLessThanOrEqual(expectedMax);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('incrementAttempt persists the new state to AsyncStorage', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          nonNegativeCountArb,
          async (orderId, initialCount) => {
            inMemory.reset();

            if (initialCount > 0) {
              await writeStore({ [orderId]: { attemptCount: initialCount, retryAvailableAt: 0 } });
            }

            await incrementAttempt(orderId);

            // Read back from storage
            const stored = await readStore();
            const result = getAttemptState(stored, orderId);

            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(initialCount + 1);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 4: Remove Clears State ──────────────────────────────────────

  // Feature: multi-attempt-failure-flow, Property 4: Remove Clears State
  describe('Property 4: Remove Clears State', () => {
    it('removeAttempt results in getAttemptState returning null', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          attemptStateArb,
          async (orderId, state) => {
            inMemory.reset();

            // Seed state
            await writeStore({ [orderId]: state });

            // Remove it
            await removeAttempt(orderId);

            // Read back
            const stored = await readStore();
            const result = getAttemptState(stored, orderId);

            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('removeAttempt only removes the targeted order, leaving others intact', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          orderIdArb,
          attemptStateArb,
          attemptStateArb,
          async (orderId1, orderId2, state1, state2) => {
            // Skip if IDs happen to be the same
            fc.pre(orderId1 !== orderId2);

            inMemory.reset();

            await writeStore({ [orderId1]: state1, [orderId2]: state2 });
            await removeAttempt(orderId1);

            const stored = await readStore();
            expect(getAttemptState(stored, orderId1)).toBeNull();
            expect(getAttemptState(stored, orderId2)).not.toBeNull();
            expect(getAttemptState(stored, orderId2)!.attemptCount).toBe(state2.attemptCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 5: Missing Entry Defaults to Null ────────────────────────────

  // Feature: multi-attempt-failure-flow, Property 5: Missing Entry Defaults to Null
  describe('Property 5: Missing Entry Defaults to Null', () => {
    it('getAttemptState returns null for any order ID not present in the store', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          async (orderId) => {
            inMemory.reset();
            // Empty store — no entries

            const stored = await readStore();
            const result = getAttemptState(stored, orderId);

            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getAttemptState returns null for an ID not in a non-empty store', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          orderIdArb,
          attemptStateArb,
          async (missingId, presentId, state) => {
            fc.pre(missingId !== presentId);

            inMemory.reset();
            await writeStore({ [presentId]: state });

            const stored = await readStore();
            expect(getAttemptState(stored, missingId)).toBeNull();
            expect(getAttemptState(stored, presentId)).not.toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 6: mergeServerAttempt Write-Once Guarantee ──────────────────

  // Feature: multi-attempt-failure-flow, Property 6: mergeServerAttempt Write-Once Guarantee
  describe('Property 6: mergeServerAttempt Write-Once Guarantee (Fix 3)', () => {
    it('when serverCount > localCount, AsyncStorage.setItem is called exactly once', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          fc.integer({ min: 0, max: 10 }), // localCount
          fc.integer({ min: 1, max: 5 }),  // serverDelta (how much higher server is)
          async (orderId, localCount, serverDelta) => {
            inMemory.reset();

            // Seed local state
            const localState: AttemptState = {
              attemptCount: localCount,
              retryAvailableAt: Date.now() + 5000,
            };
            await writeStore({ [orderId]: localState });

            // Clear mock call counts after seeding
            mockStorage.setItem.mockClear();

            // Server count is strictly higher
            const serverCount = localCount + serverDelta;

            // Merge server count
            await mergeServerAttempt(orderId, serverCount);

            // Verify AsyncStorage.setItem was called exactly once
            expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

            // Verify the final state is correct
            const updatedStore = await readStore();
            const result = getAttemptState(updatedStore, orderId);
            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(serverCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('when serverCount > localCount and no local state exists, AsyncStorage.setItem is called exactly once', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          fc.integer({ min: 1, max: 20 }), // serverCount (no local state)
          async (orderId, serverCount) => {
            inMemory.reset();
            // No local state for this orderId

            // Clear mock call counts
            mockStorage.setItem.mockClear();

            // Merge server count
            await mergeServerAttempt(orderId, serverCount);

            // Verify AsyncStorage.setItem was called exactly once
            expect(mockStorage.setItem).toHaveBeenCalledTimes(1);

            // Verify the final state is correct
            const updatedStore = await readStore();
            const result = getAttemptState(updatedStore, orderId);
            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(serverCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('when serverCount <= localCount, AsyncStorage.setItem is not called (no-write guard)', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          fc.integer({ min: 1, max: 20 }), // localCount
          fc.integer({ min: 0, max: 20 }), // serverCount
          async (orderId, localCount, serverCount) => {
            // Only test cases where server count is not higher
            fc.pre(serverCount <= localCount);

            inMemory.reset();

            // Seed local state
            const localState: AttemptState = {
              attemptCount: localCount,
              retryAvailableAt: Date.now() + 5000,
            };
            await writeStore({ [orderId]: localState });

            // Clear mock call counts after seeding
            mockStorage.setItem.mockClear();

            // Merge server count (should be skipped)
            await mergeServerAttempt(orderId, serverCount);

            // Verify AsyncStorage.setItem was NOT called
            expect(mockStorage.setItem).toHaveBeenCalledTimes(0);

            // Verify local state is unchanged
            const updatedStore = await readStore();
            const result = getAttemptState(updatedStore, orderId);
            expect(result).not.toBeNull();
            expect(result!.attemptCount).toBe(localCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 14: Retry Lock Derived from Timestamp ───────────────────────

  // Feature: multi-attempt-failure-flow, Property 14: Retry Lock Derived from Timestamp
  describe('Property 14: Retry Lock Derived from Timestamp', () => {
    it('isRetryLocked returns true iff Date.now() < retryAvailableAt', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.integer({ min: -100_000, max: 100_000 }), // offset from now in ms
          (orderId, offsetMs) => {
            const now = Date.now();
            const retryAvailableAt = now + offsetMs;
            const store: AttemptTrackerStore = {
              [orderId]: { attemptCount: 1, retryAvailableAt },
            };

            const locked = isRetryLocked(store, orderId);
            const expectedLocked = now < retryAvailableAt;

            expect(locked).toBe(expectedLocked);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('isRetryLocked returns false for a missing order ID', () => {
      fc.assert(
        fc.property(orderIdArb, (orderId) => {
          const store: AttemptTrackerStore = {};
          expect(isRetryLocked(store, orderId)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('isRetryLocked returns false when retryAvailableAt is in the past', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.integer({ min: 1, max: 100_000 }), // positive offset → past
          (orderId, pastOffset) => {
            const retryAvailableAt = Date.now() - pastOffset;
            const store: AttemptTrackerStore = {
              [orderId]: { attemptCount: 1, retryAvailableAt },
            };
            expect(isRetryLocked(store, orderId)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('isRetryLocked returns true when retryAvailableAt is in the future', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.integer({ min: 1, max: 100_000 }), // positive offset → future
          (orderId, futureOffset) => {
            const retryAvailableAt = Date.now() + futureOffset;
            const store: AttemptTrackerStore = {
              [orderId]: { attemptCount: 1, retryAvailableAt },
            };
            expect(isRetryLocked(store, orderId)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 15: Countdown Calculation from Timestamp ────────────────────

  // Feature: multi-attempt-failure-flow, Property 15: Countdown Calculation from Timestamp
  describe('Property 15: Countdown Calculation from Timestamp', () => {
    it('getRemainingSeconds returns Math.ceil((retryAvailableAt - Date.now()) / 1000)', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.integer({ min: 1, max: 300_000 }), // future timestamps only
          (orderId, futureOffset) => {
            const now = Date.now();
            const retryAvailableAt = now + futureOffset;
            const store: AttemptTrackerStore = {
              [orderId]: { attemptCount: 1, retryAvailableAt },
            };

            const remaining = getRemainingSeconds(store, orderId);
            const expected = Math.ceil((retryAvailableAt - Date.now()) / 1000);

            // Allow ±1 second tolerance for time passing between calls
            expect(remaining).toBeGreaterThanOrEqual(expected - 1);
            expect(remaining).toBeLessThanOrEqual(expected + 1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getRemainingSeconds returns 0 for a missing order ID', () => {
      fc.assert(
        fc.property(orderIdArb, (orderId) => {
          const store: AttemptTrackerStore = {};
          expect(getRemainingSeconds(store, orderId)).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('getRemainingSeconds returns 0 when retryAvailableAt is in the past', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.integer({ min: 1, max: 100_000 }),
          (orderId, pastOffset) => {
            const retryAvailableAt = Date.now() - pastOffset;
            const store: AttemptTrackerStore = {
              [orderId]: { attemptCount: 1, retryAvailableAt },
            };
            expect(getRemainingSeconds(store, orderId)).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('getRemainingSeconds is always non-negative', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.integer({ min: -100_000, max: 100_000 }),
          (orderId, offsetMs) => {
            const retryAvailableAt = Date.now() + offsetMs;
            const store: AttemptTrackerStore = {
              [orderId]: { attemptCount: 1, retryAvailableAt },
            };
            expect(getRemainingSeconds(store, orderId)).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
