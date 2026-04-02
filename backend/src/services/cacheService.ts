/**
 * Cache Service Abstraction
 * 
 * Provides a cache interface abstraction to support future Redis migration
 * without changing application code. Currently implements in-memory caching
 * with 10-minute TTL and automatic cleanup.
 * 
 * Key Design Decisions:
 * - All methods return Promises for async compatibility with Redis
 * - Single source of truth: expiresAt timestamp stored with value
 * - Cleanup interval runs hourly to prevent memory leaks
 * - Factory pattern enables zero-code-change Redis migration
 */

/**
 * Cache Service Interface
 * 
 * Defines the contract for cache implementations. All methods are async
 * to support future Redis implementation without code changes.
 */
export interface CacheService {
  /**
   * Retrieve a value from cache
   * @param key - Cache key
   * @returns The cached value or null if not found/expired
   */
  get(key: string): Promise<any | null>;

  /**
   * Store a value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  set(key: string, value: any, ttlSeconds: number): Promise<void>;

  /**
   * Delete a specific cache entry
   * @param key - Cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;
}

/**
 * Cache Entry Structure
 * 
 * Single source of truth for TTL: stores expiration timestamp directly
 * with the cached value to prevent TTL duplication bugs.
 */
interface CacheEntry {
  value: any;
  expiresAt: number; // Unix timestamp when entry expires
}

/**
 * In-Memory Cache Implementation
 * 
 * Provides a simple in-memory cache with automatic expiration checking
 * and periodic cleanup. Suitable for single-instance deployments.
 * 
 * Features:
 * - Automatic expiration checking on get()
 * - Hourly cleanup to prevent memory leaks
 * - Promise-based API for Redis compatibility
 */
class InMemoryCacheService implements CacheService {
  private cache: Map<string, CacheEntry>;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
    this.cleanupTimer = null;
    this.startCleanupInterval();
  }

  /**
   * Get value from cache
   * 
   * Checks expiration timestamp and automatically evicts expired entries.
   * This is the single source of truth for expiration checking.
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Single source of truth: check expiresAt
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * 
   * Stores the value with an expiration timestamp calculated from the TTL.
   * The expiresAt timestamp is the single source of truth for expiration.
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete a specific cache entry
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Start periodic cleanup interval
   * 
   * Runs hourly to remove expired entries and prevent memory leaks.
   * This is a safety mechanism; primary expiration checking happens in get().
   */
  private startCleanupInterval(): void {
    this.cleanupTimer = setInterval(() => this.clearExpired(), this.cleanupIntervalMs);
    
    // Prevent the timer from keeping the process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clear expired entries from cache
   * 
   * Iterates through all cache entries and removes those past their
   * expiration timestamp. Called hourly by the cleanup interval.
   */
  private clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Cache Service Factory
 * 
 * Creates the appropriate cache service implementation based on configuration.
 * Currently returns InMemoryCacheService. Future enhancement: check for
 * Redis configuration and return RedisCacheService when available.
 * 
 * @returns CacheService implementation
 */
export const createCacheService = (): CacheService => {
  // Future: Check for Redis configuration
  // if (process.env.REDIS_URL) {
  //   return new RedisCacheService();
  // }
  return new InMemoryCacheService();
};

// Export InMemoryCacheService for testing purposes
export { InMemoryCacheService };
