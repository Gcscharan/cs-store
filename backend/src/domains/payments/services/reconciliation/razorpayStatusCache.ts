/**
 * In-process truth cache for Razorpay payment status lookups.
 *
 * Prevents API storms during reconciliation runs by caching the result of each
 * Razorpay status fetch for the duration of a single run. One cache instance is
 * created per run and cleared at run end — no stale data leaks across runs.
 *
 * Design reference: §15.1 (Razorpay Truth Cache — Issue 1)
 *
 * Production note: Replace with a Redis-backed cache for multi-process safety
 * when running multiple reconciliation workers in parallel.
 */

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Normalised view of a Razorpay payment's status, shared across all
 * reconciliation sub-services that need to inspect gateway state.
 */
export interface RazorpayPaymentInfo {
  status: 'captured' | 'authorized' | 'created' | 'failed' | 'refunded';
  captured: boolean;
  authorized: boolean;
  paymentId?: string;
  capturedAt?: Date;
  amountPaise: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: RazorpayPaymentInfo;
  expiresAt: number; // Unix timestamp in ms
}

// ---------------------------------------------------------------------------
// RazorpayStatusCache
// ---------------------------------------------------------------------------

/**
 * In-process LRU-style TTL cache keyed by `gatewayOrderId`.
 *
 * Lifecycle:
 *   1. Create one instance at the start of each reconciliation run.
 *   2. Pass the instance into the scanner(s) for that run.
 *   3. Call `clear()` at run end (success or failure) to prevent stale data
 *      from persisting into the next run.
 */
export class RazorpayStatusCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  /**
   * @param ttlMs - Time-to-live for each cache entry in milliseconds.
   *                Defaults to 5 minutes (5 * 60_000).
   */
  constructor(ttlMs = 5 * 60_000) {
    if (ttlMs < 1) {
      throw new RangeError(`RazorpayStatusCache: ttlMs must be >= 1, got ${ttlMs}`);
    }
    this.ttlMs = ttlMs;
  }

  /**
   * Returns the cached `RazorpayPaymentInfo` for `gatewayOrderId` if it exists
   * and has not expired. Returns `null` otherwise.
   *
   * Expired entries are evicted lazily on access.
   */
  get(gatewayOrderId: string): RazorpayPaymentInfo | null {
    const entry = this.cache.get(gatewayOrderId);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(gatewayOrderId);
      return null;
    }
    return entry.data;
  }

  /**
   * Stores `data` under `gatewayOrderId` with a TTL timestamp.
   * Overwrites any existing entry for the same key.
   */
  set(gatewayOrderId: string, data: RazorpayPaymentInfo): void {
    this.cache.set(gatewayOrderId, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Removes all entries from the cache.
   *
   * Call this at the end of each reconciliation run (in both the success and
   * error paths) to ensure no stale Razorpay data persists into the next run.
   */
  clear(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Introspection helpers (useful for tests and metrics)
  // ---------------------------------------------------------------------------

  /** Number of entries currently held in the cache (including expired ones not yet evicted). */
  get size(): number {
    return this.cache.size;
  }
}
