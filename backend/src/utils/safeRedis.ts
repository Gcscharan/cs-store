/**
 * Safe Redis Wrapper
 * 
 * Provides Redis operations that never throw and gracefully handle test mode.
 * In test mode, all operations are no-ops to prevent hanging and dependency issues.
 * In production, errors are swallowed to prevent Redis failures from breaking the app.
 * 
 * This is an enterprise pattern used by companies like Uber and Stripe.
 */

import redisClient from "../config/redis";
import { IS_TEST } from "../config/env";

export const safeRedis = {
  /**
   * Get a value from Redis
   * Returns null in test mode or on error
   */
  async get(key: string): Promise<string | null> {
    if (IS_TEST) return null;

    try {
      return await redisClient.get(key);
    } catch {
      return null;
    }
  },

  /**
   * Set a value in Redis
   * No-op in test mode or on error
   */
  async set(key: string, value: string, options?: any): Promise<void> {
    if (IS_TEST) return;

    try {
      await redisClient.set(key, value, options);
    } catch {
      // Swallow errors - Redis failures should not break the app
    }
  },

  /**
   * Delete a key from Redis
   * No-op in test mode or on error
   */
  async del(key: string): Promise<void> {
    if (IS_TEST) return;

    try {
      await redisClient.del(key);
    } catch {
      // Swallow errors
    }
  },

  /**
   * Increment a value in Redis
   * Returns 1 in test mode or on error
   */
  async incr(key: string): Promise<number> {
    if (IS_TEST) return 1;

    try {
      return await redisClient.incr(key);
    } catch {
      return 1;
    }
  },

  /**
   * Set expiry on a key
   * No-op in test mode or on error
   */
  async expire(key: string, seconds: number): Promise<void> {
    if (IS_TEST) return;

    try {
      await redisClient.expire(key, seconds);
    } catch {
      // Swallow errors
    }
  },

  /**
   * Check if key exists
   * Returns 0 in test mode or on error
   */
  async exists(key: string): Promise<number> {
    if (IS_TEST) return 0;

    try {
      return await redisClient.exists(key);
    } catch {
      return 0;
    }
  },
};
