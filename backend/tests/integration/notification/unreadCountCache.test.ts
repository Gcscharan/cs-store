/**
 * Integration Tests: Redis Caching for Unread Notification Count
 *
 * Tests cache hit/miss/invalidation scenarios for the per-user unread count cache.
 * Uses the Redis in-memory mock (configured in test setup) and real MongoDB.
 *
 * Requirements: R23 (Performance & Scalability) — unread count API <100ms at 95th percentile.
 *
 * Scenarios covered:
 * 1. Cache miss → falls back to MongoDB, populates cache
 * 2. Cache hit → returns cached value without DB query
 * 3. Increment on new notification (orchestrator integration)
 * 4. Decrement on markAsRead
 * 5. Reset to 0 on markAllAsRead
 * 6. Cache invalidation → next read refreshes from MongoDB
 * 7. Performance: verify <100ms response time for unread count
 * 8. End-to-end lifecycle flow
 */

import mongoose from "mongoose";
import Notification from "../../../src/models/Notification";
import {
  getUnreadCountCached,
  incrementUnreadCount,
  decrementUnreadCount,
  resetUnreadCount,
  invalidateUnreadCount,
  buildCacheKey,
  queryAndCacheUnreadCount,
} from "../../../src/domains/communication/services/unreadCountCache";

describe("Unread Notification Count Redis Cache", () => {
  let userId: string;
  let userObjectId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    userObjectId = new mongoose.Types.ObjectId();
    userId = userObjectId.toString();
  });

  describe("Cache Key Format", () => {
    it("should use correct key format: notification:unread:{userId}", () => {
      const key = buildCacheKey("abc123");
      expect(key).toBe("notification:unread:abc123");
    });

    it("should use correct key format with ObjectId string", () => {
      const objectId = new mongoose.Types.ObjectId();
      const key = buildCacheKey(objectId.toString());
      expect(key).toBe(`notification:unread:${objectId.toString()}`);
    });
  });

  describe("Cache Miss Scenarios", () => {
    it("should fall back to MongoDB on cache miss and populate cache", async () => {
      // Create some unread notifications in MongoDB
      await Notification.create([
        {
          userId: userObjectId,
          title: "Notification 1",
          message: "Body 1",
          body: "Body 1",
          category: "order",
          priority: "normal",
          isRead: false,
        },
        {
          userId: userObjectId,
          title: "Notification 2",
          message: "Body 2",
          body: "Body 2",
          category: "order",
          priority: "normal",
          isRead: false,
        },
        {
          userId: userObjectId,
          title: "Read Notification",
          message: "Body 3",
          body: "Body 3",
          category: "order",
          priority: "normal",
          isRead: true,
        },
      ]);

      // No cache entry exists — should fall back to MongoDB and return correct count
      const count = await getUnreadCountCached(userId);
      expect(count).toBe(2);

      // Second call should also return 2 (cache is now populated)
      const secondCall = await getUnreadCountCached(userId);
      expect(secondCall).toBe(2);
    });

    it("should return 0 when user has no unread notifications", async () => {
      // Create only read notifications
      await Notification.create({
        userId: userObjectId,
        title: "Read Notification",
        message: "Body",
        body: "Body",
        category: "order",
        priority: "normal",
        isRead: true,
      });

      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });

    it("should return 0 when user has no notifications at all", async () => {
      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });
  });

  describe("Cache Hit Scenarios", () => {
    it("should return cached value and not reflect subsequent MongoDB changes", async () => {
      // First call populates cache with 0 (no notifications exist)
      const firstCount = await getUnreadCountCached(userId);
      expect(firstCount).toBe(0);

      // Add a notification to MongoDB WITHOUT updating the cache
      await Notification.create({
        userId: userObjectId,
        title: "New Notif",
        message: "Body",
        body: "Body",
        category: "order",
        priority: "normal",
        isRead: false,
      });

      // Cache hit should still return 0 (stale but valid until invalidated)
      const cachedCount = await getUnreadCountCached(userId);
      expect(cachedCount).toBe(0);
    });

    it("should return correct count after cache is populated from query", async () => {
      await Notification.create([
        {
          userId: userObjectId,
          title: "N1",
          message: "B1",
          body: "B1",
          category: "order",
          priority: "normal",
          isRead: false,
        },
        {
          userId: userObjectId,
          title: "N2",
          message: "B2",
          body: "B2",
          category: "order",
          priority: "normal",
          isRead: false,
        },
        {
          userId: userObjectId,
          title: "N3",
          message: "B3",
          body: "B3",
          category: "order",
          priority: "normal",
          isRead: false,
        },
      ]);

      // Populate cache
      const count = await queryAndCacheUnreadCount(userId);
      expect(count).toBe(3);

      // Subsequent calls return cached value
      const cachedCount = await getUnreadCountCached(userId);
      expect(cachedCount).toBe(3);
    });
  });

  describe("Increment on New Notification", () => {
    it("should increment cached count after cache is populated", async () => {
      // Populate cache by querying first
      await Notification.create({
        userId: userObjectId,
        title: "Existing",
        message: "Body",
        body: "Body",
        category: "order",
        priority: "normal",
        isRead: false,
      });
      const initialCount = await getUnreadCountCached(userId);
      expect(initialCount).toBe(1);

      // Increment (simulating orchestrator creating a new notification)
      await incrementUnreadCount(userId);

      // Should reflect incremented value
      const updatedCount = await getUnreadCountCached(userId);
      expect(updatedCount).toBe(2);
    });

    it("should handle multiple increments correctly", async () => {
      // Start with populated cache
      const initialCount = await getUnreadCountCached(userId);
      expect(initialCount).toBe(0);

      // Increment 3 times
      await incrementUnreadCount(userId);
      await incrementUnreadCount(userId);
      await incrementUnreadCount(userId);

      const finalCount = await getUnreadCountCached(userId);
      expect(finalCount).toBe(3);
    });

    it("should not create cache entry when no cache exists (avoids stale entries)", async () => {
      // Don't populate cache first
      // Increment should be no-op if key doesn't exist
      await incrementUnreadCount(userId);

      // Since cache didn't exist, incrementing shouldn't create it
      // Calling getUnreadCountCached should go to MongoDB (count = 0)
      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });
  });

  describe("Decrement on Mark As Read", () => {
    it("should decrement cached count", async () => {
      // Populate cache with count of 5
      await Notification.create(
        Array.from({ length: 5 }, (_, i) => ({
          userId: userObjectId,
          title: `N${i}`,
          message: `B${i}`,
          body: `B${i}`,
          category: "order",
          priority: "normal",
          isRead: false,
        }))
      );
      const initialCount = await getUnreadCountCached(userId);
      expect(initialCount).toBe(5);

      // Decrement (simulating markAsRead)
      await decrementUnreadCount(userId);

      const updatedCount = await getUnreadCountCached(userId);
      expect(updatedCount).toBe(4);
    });

    it("should not go below 0", async () => {
      // Populate cache with 0
      const initialCount = await getUnreadCountCached(userId);
      expect(initialCount).toBe(0);

      // Decrement from 0 — should stay at 0
      await decrementUnreadCount(userId);

      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });

    it("should handle multiple decrements correctly", async () => {
      await Notification.create(
        Array.from({ length: 3 }, (_, i) => ({
          userId: userObjectId,
          title: `N${i}`,
          message: `B${i}`,
          body: `B${i}`,
          category: "order",
          priority: "normal",
          isRead: false,
        }))
      );
      await getUnreadCountCached(userId); // populate cache with 3

      await decrementUnreadCount(userId);
      await decrementUnreadCount(userId);

      const count = await getUnreadCountCached(userId);
      expect(count).toBe(1);
    });
  });

  describe("Reset on Mark All As Read", () => {
    it("should set cached count to 0", async () => {
      // Populate cache with notifications
      await Notification.create(
        Array.from({ length: 10 }, (_, i) => ({
          userId: userObjectId,
          title: `N${i}`,
          message: `B${i}`,
          body: `B${i}`,
          category: "order",
          priority: "normal",
          isRead: false,
        }))
      );
      const initialCount = await getUnreadCountCached(userId);
      expect(initialCount).toBe(10);

      // Reset (simulating markAllAsRead)
      await resetUnreadCount(userId);

      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });

    it("should set to 0 even when cache was not previously populated", async () => {
      // Reset without prior cache population
      await resetUnreadCount(userId);

      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });
  });

  describe("Cache Invalidation", () => {
    it("should force re-query from MongoDB after invalidation", async () => {
      // Create 3 unread notifications and populate cache
      await Notification.create(
        Array.from({ length: 3 }, (_, i) => ({
          userId: userObjectId,
          title: `N${i}`,
          message: `B${i}`,
          body: `B${i}`,
          category: "order",
          priority: "normal",
          isRead: false,
        }))
      );
      const firstCount = await getUnreadCountCached(userId);
      expect(firstCount).toBe(3);

      // Add another notification directly to MongoDB
      await Notification.create({
        userId: userObjectId,
        title: "New",
        message: "Body",
        body: "Body",
        category: "order",
        priority: "normal",
        isRead: false,
      });

      // Cache still returns stale count
      const staleCount = await getUnreadCountCached(userId);
      expect(staleCount).toBe(3);

      // Invalidate cache
      await invalidateUnreadCount(userId);

      // After invalidation, next call goes to MongoDB and gets fresh count
      const freshCount = await getUnreadCountCached(userId);
      expect(freshCount).toBe(4);
    });

    it("should handle invalidation when no cache exists (no-op)", async () => {
      // Should not throw
      await invalidateUnreadCount(userId);

      // Subsequent read goes to MongoDB
      const count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });
  });

  describe("Performance Benchmark", () => {
    it("should respond within 100ms for cached unread count (simulated P95)", async () => {
      // Populate cache first
      await Notification.create({
        userId: userObjectId,
        title: "Perf Test",
        message: "Body",
        body: "Body",
        category: "order",
        priority: "normal",
        isRead: false,
      });
      await getUnreadCountCached(userId); // populate cache

      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        await getUnreadCountCached(userId);
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1_000_000); // Convert to ms
      }

      // Sort times and get P95
      times.sort((a, b) => a - b);
      const p95Index = Math.floor(iterations * 0.95) - 1;
      const p95 = times[p95Index];

      // P95 should be well under 100ms (with mock Redis, should be <10ms)
      expect(p95).toBeLessThan(100);
    });

    it("should respond within 100ms even on cache miss with MongoDB fallback", async () => {
      // Create a few notifications for realistic scenario
      await Notification.create([
        {
          userId: userObjectId,
          title: "Perf N1",
          message: "B",
          body: "B",
          category: "order",
          priority: "normal",
          isRead: false,
        },
        {
          userId: userObjectId,
          title: "Perf N2",
          message: "B",
          body: "B",
          category: "order",
          priority: "normal",
          isRead: false,
        },
      ]);

      // First call: cache miss (MongoDB query + cache population)
      const start = process.hrtime.bigint();
      const count = await getUnreadCountCached(userId);
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;

      expect(count).toBe(2);
      // Even with cache miss, should be well under 100ms in test environment
      expect(durationMs).toBeLessThan(100);
    });
  });

  describe("End-to-End Cache Flow", () => {
    it("should correctly track unread count through full lifecycle: create → read → readAll", async () => {
      // 1. Start with empty state — cache miss, populates with 0
      let count = await getUnreadCountCached(userId);
      expect(count).toBe(0);

      // 2. Simulate creating 3 notifications (orchestrator increments cache each time)
      await Notification.create({
        userId: userObjectId,
        title: "N1",
        message: "B1",
        body: "B1",
        category: "order",
        priority: "normal",
        isRead: false,
      });
      await incrementUnreadCount(userId);
      count = await getUnreadCountCached(userId);
      expect(count).toBe(1);

      await Notification.create({
        userId: userObjectId,
        title: "N2",
        message: "B2",
        body: "B2",
        category: "payment",
        priority: "normal",
        isRead: false,
      });
      await incrementUnreadCount(userId);
      count = await getUnreadCountCached(userId);
      expect(count).toBe(2);

      await Notification.create({
        userId: userObjectId,
        title: "N3",
        message: "B3",
        body: "B3",
        category: "delivery",
        priority: "normal",
        isRead: false,
      });
      await incrementUnreadCount(userId);
      count = await getUnreadCountCached(userId);
      expect(count).toBe(3);

      // 3. Mark one notification as read (decrement)
      const notif = await Notification.findOne({ userId: userObjectId, isRead: false });
      if (notif) {
        notif.isRead = true;
        await notif.save();
      }
      await decrementUnreadCount(userId);
      count = await getUnreadCountCached(userId);
      expect(count).toBe(2);

      // 4. Mark all as read (reset to 0)
      await Notification.updateMany({ userId: userObjectId }, { isRead: true });
      await resetUnreadCount(userId);
      count = await getUnreadCountCached(userId);
      expect(count).toBe(0);
    });

    it("should self-heal after invalidation when cache drifts from reality", async () => {
      // Populate cache with 5
      await Notification.create(
        Array.from({ length: 5 }, (_, i) => ({
          userId: userObjectId,
          title: `N${i}`,
          message: `B${i}`,
          body: `B${i}`,
          category: "order",
          priority: "normal",
          isRead: false,
        }))
      );
      let count = await getUnreadCountCached(userId);
      expect(count).toBe(5);

      // Simulate cache drift: mark 2 as read directly in DB without updating cache
      const notifs = await Notification.find({ userId: userObjectId, isRead: false }).limit(2);
      for (const n of notifs) {
        n.isRead = true;
        await n.save();
      }

      // Cache still shows 5 (stale)
      count = await getUnreadCountCached(userId);
      expect(count).toBe(5);

      // Invalidate cache (manual repair operation)
      await invalidateUnreadCount(userId);

      // Now cache is refreshed from MongoDB (should be 3)
      count = await getUnreadCountCached(userId);
      expect(count).toBe(3);
    });
  });
});
