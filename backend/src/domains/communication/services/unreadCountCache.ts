/**
 * Unread Notification Count Cache (Redis)
 *
 * Provides a Redis-based cache for per-user unread notification counts.
 * - Cache key: `notification:unread:{userId}`
 * - TTL: 5 minutes (safety net for stale data)
 * - Falls back to MongoDB count query on cache miss
 * - Invalidated on: new notification (increment), markAsRead (decrement), markAllAsRead (set to 0)
 *
 * Requirements: R23 (Performance & Scalability) — unread count API <100ms at 95th percentile.
 */

import redisClient from "../../../config/redis";
import Notification from "../../../models/Notification";
import mongoose from "mongoose";
import { logger } from "../../../utils/logger";

const CACHE_KEY_PREFIX = "notification:unread:";
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Build the Redis cache key for a user's unread count.
 */
export function buildCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

/**
 * Get the unread notification count for a user.
 * Attempts Redis cache first; falls back to MongoDB on cache miss or error.
 */
export async function getUnreadCountCached(userId: string): Promise<number> {
  const cacheKey = buildCacheKey(userId);

  try {
    const cached = await redisClient.get(cacheKey);

    if (cached !== null && cached !== undefined) {
      const count = parseInt(cached, 10);
      if (Number.isFinite(count) && count >= 0) {
        return count;
      }
    }
  } catch (err) {
    // Redis failure is non-critical — fall through to MongoDB
    logger.warn("[UnreadCountCache] Redis get failed, falling back to MongoDB", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cache miss or Redis failure — query MongoDB
  return queryAndCacheUnreadCount(userId);
}

/**
 * Query MongoDB for the unread count and populate the cache.
 */
export async function queryAndCacheUnreadCount(userId: string): Promise<number> {
  const objectId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;

  const count = await Notification.countDocuments({
    userId: objectId,
    isRead: false,
  });

  // Attempt to cache the result
  try {
    const cacheKey = buildCacheKey(userId);
    await redisClient.set(cacheKey, String(count), { EX: CACHE_TTL_SECONDS });
  } catch (err) {
    // Non-critical — count was already obtained from MongoDB
    logger.warn("[UnreadCountCache] Redis set failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return count;
}

/**
 * Increment the cached unread count by 1 (called after a new notification is created).
 * If no cache entry exists, this is a no-op (next getUnreadCount will populate from MongoDB).
 */
export async function incrementUnreadCount(userId: string): Promise<void> {
  const cacheKey = buildCacheKey(userId);

  try {
    // Only increment if the key exists (avoids creating stale entries)
    const exists = await redisClient.exists(cacheKey);
    if (exists) {
      await redisClient.incr(cacheKey);
      // Refresh TTL on update
      await redisClient.expire(cacheKey, CACHE_TTL_SECONDS);
    }
  } catch (err) {
    // Non-critical — cache will self-heal on next read
    logger.warn("[UnreadCountCache] Redis increment failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Decrement the cached unread count by 1 (called when a notification is marked as read).
 * Ensures the count never goes below 0.
 * If no cache entry exists, this is a no-op.
 *
 * Uses an atomic Redis DECR so concurrent decrements can't race (the previous
 * get-then-set implementation could double-count under concurrency). If DECR
 * drives the value negative (e.g. an over-decrement), it is re-clamped to 0.
 */
export async function decrementUnreadCount(userId: string): Promise<void> {
  const cacheKey = buildCacheKey(userId);

  try {
    const exists = await redisClient.exists(cacheKey);
    if (!exists) return;

    // Atomic decrement — safe under concurrent callers.
    const newValue = await redisClient.decr(cacheKey);

    if (newValue < 0) {
      // Never allow a negative unread count (invariant). Clamp back to 0.
      await redisClient.set(cacheKey, "0", { EX: CACHE_TTL_SECONDS });
    } else {
      // Refresh TTL on update.
      await redisClient.expire(cacheKey, CACHE_TTL_SECONDS);
    }
  } catch (err) {
    // Non-critical — cache will self-heal on next read
    logger.warn("[UnreadCountCache] Redis decrement failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Set the cached unread count to 0 (called when all notifications are marked as read).
 */
export async function resetUnreadCount(userId: string): Promise<void> {
  const cacheKey = buildCacheKey(userId);

  try {
    await redisClient.set(cacheKey, "0", { EX: CACHE_TTL_SECONDS });
  } catch (err) {
    // Non-critical — cache will self-heal on next read
    logger.warn("[UnreadCountCache] Redis reset failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate (delete) the cached unread count for a user.
 * Forces the next read to fetch fresh data from MongoDB.
 */
export async function invalidateUnreadCount(userId: string): Promise<void> {
  const cacheKey = buildCacheKey(userId);

  try {
    await redisClient.del(cacheKey);
  } catch (err) {
    logger.warn("[UnreadCountCache] Redis invalidate failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
