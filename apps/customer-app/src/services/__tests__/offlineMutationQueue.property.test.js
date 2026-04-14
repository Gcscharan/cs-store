/**
 * Property-Based Tests for offlineMutationQueue
 *
 * Property 10: Offline queue is FIFO and bounded
 * Generate a random sequence of 1–30 mutations to enqueue; assert queue never
 * exceeds 20 entries; assert replay order matches enqueue order for the retained entries.
 *
 * **Validates: Requirements 9b.3, 9b.5, 9b.6, 9b.7**
 */

const fc = require('fast-check');
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { offlineMutationQueue, MAX_QUEUE_SIZE } = require('../offlineMutationQueue');

// Mock AsyncStorage with an in-memory store so we can test real queue behavior
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  const mock = {
    getItem: jest.fn(async (key) => store[key] ?? null),
    setItem: jest.fn(async (key, value) => { store[key] = value; }),
    __reset: () => { store = {}; },
  };
  return mock;
});

const ACTIONS = ['pickupOrder', 'startDelivery', 'markArrived', 'verifyDeliveryOtp', 'recordDeliveryAttempt'];

const mutationArb = fc.record({
  action: fc.constantFrom(...ACTIONS),
  orderId: fc.string({ minLength: 5, maxLength: 20 }),
  args: fc.record({ idempotencyKey: fc.string({ minLength: 1, maxLength: 10 }) }),
});

describe('Property 10: Offline queue is FIFO and bounded', () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
  });

  it('queue never exceeds 20 entries regardless of how many are enqueued', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mutationArb, { minLength: 1, maxLength: 30 }),
        async (mutations) => {
          AsyncStorage.__reset();

          for (const m of mutations) {
            await offlineMutationQueue.enqueue(m);
          }

          const queue = await offlineMutationQueue.getAll();
          expect(queue.length).toBeLessThanOrEqual(MAX_QUEUE_SIZE);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('retained entries are in FIFO order (oldest-first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mutationArb, { minLength: 1, maxLength: 30 }),
        async (mutations) => {
          AsyncStorage.__reset();

          for (const m of mutations) {
            await offlineMutationQueue.enqueue(m);
          }

          const queue = await offlineMutationQueue.getAll();

          // Verify enqueuedAt timestamps are non-decreasing (FIFO order)
          for (let i = 1; i < queue.length; i++) {
            const prev = new Date(queue[i - 1].enqueuedAt).getTime();
            const curr = new Date(queue[i].enqueuedAt).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when more than 20 mutations are enqueued, the retained entries are the most recent ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mutationArb, { minLength: 21, maxLength: 30 }),
        async (mutations) => {
          AsyncStorage.__reset();

          const enqueuedOrderIds = [];
          for (let i = 0; i < mutations.length; i++) {
            const uniqueM = { ...mutations[i], orderId: `order-${i}` };
            await offlineMutationQueue.enqueue(uniqueM);
            enqueuedOrderIds.push(uniqueM.orderId);
          }

          const queue = await offlineMutationQueue.getAll();
          expect(queue.length).toBe(MAX_QUEUE_SIZE);

          // The retained entries should be the last MAX_QUEUE_SIZE enqueued
          const expectedOrderIds = enqueuedOrderIds.slice(enqueuedOrderIds.length - MAX_QUEUE_SIZE);
          const actualOrderIds = queue.map((e) => e.orderId);
          expect(actualOrderIds).toEqual(expectedOrderIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('remove operation preserves FIFO order of remaining entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mutationArb, { minLength: 2, maxLength: 10 }),
        async (mutations) => {
          AsyncStorage.__reset();

          for (const m of mutations) {
            await offlineMutationQueue.enqueue(m);
          }

          const before = await offlineMutationQueue.getAll();
          if (before.length < 2) return; // skip if not enough entries

          // Remove the first entry
          const removedId = before[0].id;
          await offlineMutationQueue.remove(removedId);

          const after = await offlineMutationQueue.getAll();
          expect(after.length).toBe(before.length - 1);
          expect(after.find((e) => e.id === removedId)).toBeUndefined();

          // Remaining entries preserve their relative order
          const remainingBefore = before.slice(1);
          for (let i = 0; i < after.length; i++) {
            expect(after[i].id).toBe(remainingBefore[i].id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('incrementRetry keeps entry in queue with incremented count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(mutationArb, { minLength: 1, maxLength: 5 }),
        fc.nat({ max: 3 }), // number of retries to simulate
        async (mutations, retries) => {
          AsyncStorage.__reset();

          for (const m of mutations) {
            await offlineMutationQueue.enqueue(m);
          }

          const before = await offlineMutationQueue.getAll();
          if (before.length === 0) return;

          const targetId = before[0].id;
          const initialRetryCount = before[0].retryCount;

          for (let i = 0; i < retries; i++) {
            await offlineMutationQueue.incrementRetry(targetId);
          }

          const after = await offlineMutationQueue.getAll();
          const target = after.find((e) => e.id === targetId);
          expect(target).toBeDefined();
          expect(target.retryCount).toBe(initialRetryCount + retries);
          // Queue length unchanged
          expect(after.length).toBe(before.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
