/**
 * Property-based invariants for the unread-count cache.
 *
 * The reviewer flagged the prior get-then-set decrement as race-prone. The cache
 * now uses atomic Redis INCR/DECR with a 0 floor. These properties assert the
 * core invariants hold under arbitrary interleavings of increments and decrements:
 *
 *   UC-1  The cached count is NEVER negative.
 *   UC-2  After N increments and M decrements (starting from a seeded base),
 *         the count equals max(0, base + N - M) — i.e. decrements floor at 0
 *         and never "owe" against future increments incorrectly.
 *   UC-3  Concurrent inc/dec (Promise.all) never corrupt the count vs the same
 *         operations applied sequentially (atomicity).
 */

import fc from "fast-check";

import {
  buildCacheKey,
  incrementUnreadCount,
  decrementUnreadCount,
  resetUnreadCount,
  getUnreadCountCached,
} from "../../src/domains/communication/services/unreadCountCache";
import redisClient from "../../src/config/redis";

// getUnreadCountCached falls back to Mongo on cache miss; for these tests we only
// exercise the cache path, so we read the raw key directly to assert the cached value.
async function readRawCount(userId: string): Promise<number> {
  const raw = await redisClient.get(buildCacheKey(userId));
  return raw === null || raw === undefined ? NaN : parseInt(raw, 10);
}

async function seed(userId: string, value: number): Promise<void> {
  await redisClient.set(buildCacheKey(userId), String(value), { EX: 300 });
}

describe("Property: unread-count cache invariants", () => {
  beforeEach(() => {
    const g = globalThis as any;
    if (typeof g.__resetRedisMockStore === "function") g.__resetRedisMockStore();
  });

  it("UC-1 + UC-2: count never goes negative and floors at 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 50 }),  // base
        fc.integer({ min: 0, max: 50 }),  // increments
        fc.integer({ min: 0, max: 80 }),  // decrements (can exceed to test floor)
        async (base, incs, decs) => {
          const userId = `uc-${base}-${incs}-${decs}-${Math.random()}`;
          await seed(userId, base);

          for (let i = 0; i < incs; i++) await incrementUnreadCount(userId);
          for (let i = 0; i < decs; i++) await decrementUnreadCount(userId);

          const count = await readRawCount(userId);

          // UC-1: never negative
          expect(count).toBeGreaterThanOrEqual(0);
          // UC-2: equals the clamped expected value
          expect(count).toBe(Math.max(0, base + incs - decs));
        }
      ),
      { numRuns: 30 }
    );
  });

  it("UC-3: concurrent inc/dec yields the same result as sequential (atomicity)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 40 }),  // base (kept >= decs so no flooring noise)
        fc.integer({ min: 0, max: 30 }),  // increments
        fc.integer({ min: 0, max: 5 }),   // decrements (<= base)
        async (base, incs, decs) => {
          const userId = `ucc-${base}-${incs}-${decs}-${Math.random()}`;
          await seed(userId, base);

          // Fire all operations concurrently.
          const ops: Promise<void>[] = [];
          for (let i = 0; i < incs; i++) ops.push(incrementUnreadCount(userId));
          for (let i = 0; i < decs; i++) ops.push(decrementUnreadCount(userId));
          await Promise.all(ops);

          const count = await readRawCount(userId);
          // With base >= decs, no flooring occurs, so the exact arithmetic must hold
          // regardless of interleaving — proving the operations are atomic.
          expect(count).toBe(base + incs - decs);
        }
      ),
      { numRuns: 30 }
    );
  });

  it("reset drives the count to exactly 0", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async (base) => {
        const userId = `ucr-${base}-${Math.random()}`;
        await seed(userId, base);
        await resetUnreadCount(userId);
        const count = await readRawCount(userId);
        expect(count).toBe(0);
      }),
      { numRuns: 15 }
    );
  });
});
