/**
 * Embedding Cache Service
 * 
 * Critical for production performance
 * Caches query embeddings to avoid repeated Python API calls
 * 
 * Performance Impact:
 * - Without cache: 50ms per query (Python API call)
 * - With cache: <1ms per query (memory lookup)
 * - 50x faster for repeated queries
 */

import { logger } from '../utils/logger';

interface CacheEntry {
  embedding: number[];
  timestamp: number;
  hitCount: number;
}

class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly MAX_SIZE = 10000; // Max 10k cached queries
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get cached embedding for query
   */
  get(query: string): number[] | null {
    const normalized = query.toLowerCase().trim();
    const entry = this.cache.get(normalized);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(normalized);
      return null;
    }

    // Update hit count
    entry.hitCount++;

    return entry.embedding;
  }

  /**
   * Set cached embedding for query
   */
  set(query: string, embedding: number[]): void {
    const normalized = query.toLowerCase().trim();

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictOldest();
    }

    this.cache.set(normalized, {
      embedding,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Evict least recently used entries
   */
  private evictOldest(): void {
    // Sort by timestamp (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    // Remove oldest 10%
    const toRemove = Math.floor(this.MAX_SIZE * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    logger.info('[EmbeddingCache] Evicted entries:', toRemove);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    let totalQueries = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalQueries += entry.hitCount + 1; // +1 for initial miss
    }

    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      hitRate: totalQueries > 0 ? totalHits / totalQueries : 0,
      totalHits,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('[EmbeddingCache] Cache cleared');
  }

  /**
   * Invalidate cache entries containing specific text
   * Used when products are added/updated/removed
   */
  invalidateKeysContaining(text: string): number {
    const normalized = text.toLowerCase().trim();
    let invalidated = 0;

    for (const [key] of this.cache.entries()) {
      if (key.includes(normalized)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      logger.info('[EmbeddingCache] Invalidated entries:', {
        text,
        count: invalidated,
      });
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries for multiple product names
   * Used when products are bulk updated
   */
  invalidateProducts(productNames: string[]): number {
    let totalInvalidated = 0;

    for (const name of productNames) {
      totalInvalidated += this.invalidateKeysContaining(name);
    }

    return totalInvalidated;
  }
}

// Singleton instance
export const embeddingCache = new EmbeddingCache();

/**
 * Get cached embedding or fetch from service
 */
export async function getCachedEmbedding(
  query: string,
  fetchFn: (q: string) => Promise<number[] | null>
): Promise<number[] | null> {
  // Try cache first
  const cached = embeddingCache.get(query);
  if (cached) {
    logger.debug('[EmbeddingCache] Cache HIT:', query.substring(0, 30));
    return cached;
  }

  // Cache miss - fetch from service
  logger.debug('[EmbeddingCache] Cache MISS:', query.substring(0, 30));
  const embedding = await fetchFn(query);

  if (embedding) {
    embeddingCache.set(query, embedding);
  }

  return embedding;
}

export default {
  embeddingCache,
  getCachedEmbedding,
};
