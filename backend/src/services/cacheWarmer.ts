/**
 * Cache Warmer Service
 * 
 * Warms embedding cache on server startup to avoid cold start
 * First 100 users get fast responses instead of slow cache misses
 */

import { logger } from '../utils/logger';
import { getEmbedding } from './embeddingService';
import { embeddingCache } from './embeddingCache';

/**
 * Common search queries to warm cache
 * Based on typical user behavior
 */
const COMMON_QUERIES = [
  // Beverages
  'milk',
  'coke',
  'pepsi',
  'water',
  'juice',
  'tea',
  'coffee',
  
  // Snacks
  'chips',
  'biscuits',
  'namkeen',
  'cookies',
  
  // Groceries
  'rice',
  'wheat',
  'flour',
  'oil',
  'sugar',
  'salt',
  
  // Dairy
  'butter',
  'cheese',
  'curd',
  'paneer',
  
  // Common phrases
  'something cold',
  'something sweet',
  'something salty',
  'movie snacks',
  'breakfast items',
  'healthy snacks',
];

/**
 * Warm embedding cache with common queries
 * Run on server startup to avoid cold start
 */
export async function warmEmbeddingCache(): Promise<void> {
  try {
    logger.info('[CacheWarmer] Starting cache warmup...');
    
    const startTime = Date.now();
    let warmed = 0;
    let failed = 0;

    // Warm cache with common queries
    for (const query of COMMON_QUERIES) {
      try {
        const embedding = await getEmbedding(query);
        if (embedding) {
          embeddingCache.set(query, embedding);
          warmed++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.warn('[CacheWarmer] Failed to warm query:', query);
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('[CacheWarmer] ✅ Cache warmup complete:', {
      warmed,
      failed,
      total: COMMON_QUERIES.length,
      duration,
    });
  } catch (error: any) {
    logger.error('[CacheWarmer] ❌ Cache warmup failed:', error);
    // Don't throw - allow server to start even if warmup fails
  }
}

/**
 * Get common queries (for testing/monitoring)
 */
export function getCommonQueries(): string[] {
  return [...COMMON_QUERIES];
}

export default {
  warmEmbeddingCache,
  getCommonQueries,
};
