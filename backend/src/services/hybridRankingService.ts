/**
 * Hybrid Ranking Service
 * 
 * Phase 4: Combines multiple signals for best results
 * 
 * Architecture:
 * - 40% Semantic similarity (intent understanding)
 * - 30% Fuzzy match (spelling correction)
 * - 30% Popularity (click signals)
 * 
 * This is how real systems work (Google, Amazon, Blinkit)
 */

import { logger } from '../utils/logger';
import { Product } from '../models/Product';
import { getEmbedding } from '../services/embeddingService';
import { getCachedEmbedding } from '../services/embeddingCache';
import { popularityService } from '../services/popularityService';
import { vectorSearch } from '../services/vectorSearchService';
import { cosineSimilarity } from '../utils/cosineSimilarity';
import { findBestMatch, normalize } from '../utils/voiceCorrectionBackend';
import { getUserPreferenceMap, getUserCategoryPreferenceMap } from '../services/preferenceService';

interface HybridResult {
  productId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  images: any[];
  finalScore: number;
  breakdown: {
    semanticScore: number;
    fuzzyScore: number;
    popularityScore: number;
    personalizationScore: number;
  };
}

/**
 * Normalize score to 0-1 range
 */
function normalizeScore(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

/**
 * Add diversity factor to prevent filter bubble
 * 
 * Algorithm:
 * - 90% personalized score
 * - 10% random exploration
 * 
 * This prevents users from seeing ONLY what they like
 * Keeps discovery and serendipity alive
 */
function addDiversityFactor(personalizedScore: number): number {
  const DIVERSITY_WEIGHT = 0.1;
  const randomBoost = Math.random() * DIVERSITY_WEIGHT;
  
  return Math.min(
    personalizedScore * (1 - DIVERSITY_WEIGHT) + randomBoost,
    1.0
  );
}

/**
 * Calculate popularity score for a product
 * Uses cached popularity map for performance
 */
async function getPopularityScore(productId: string, useExploration: boolean = true): Promise<number> {
  try {
    const baseScore = await popularityService.getPopularityScore(productId);
    
    // Add exploration factor to avoid popularity bias
    if (useExploration) {
      return addExplorationFactor(baseScore);
    }
    
    return baseScore;
  } catch (error) {
    logger.error('[HybridRanking] Error getting popularity score:', error);
    return 0;
  }
}

/**
 * Hybrid search combining semantic + fuzzy + popularity + personalization
 * 
 * @param query - User search query
 * @param limit - Number of results to return
 * @param weights - Custom weights (optional)
 * @param options - Search options (exploration, Qdrant, personalization, userId)
 */
export async function hybridSearch(
  query: string,
  limit: number = 10,
  weights: { semantic: number; fuzzy: number; popularity: number; personalization: number } = {
    semantic: 0.35,
    fuzzy: 0.25,
    popularity: 0.20,
    personalization: 0.20,
  },
  options: { 
    useExploration?: boolean; 
    useQdrant?: boolean;
    usePersonalization?: boolean;
    userId?: string;
  } = { 
    useExploration: true,
    useQdrant: true,
    usePersonalization: true,
  }
): Promise<HybridResult[]> {
  try {
    const startTime = Date.now();

    // Step 1: Get query embedding with caching
    let queryEmbedding: number[] | null = null;
    
    try {
      queryEmbedding = await getCachedEmbedding(query.trim(), getEmbedding);
    } catch (error) {
      logger.error('[HybridRanking] Embedding service failed, falling back to fuzzy-only:', error);
      return fuzzyOnlySearch(query, limit);
    }

    if (!queryEmbedding) {
      logger.warn('[HybridRanking] Failed to get query embedding - falling back to fuzzy only');
      return fuzzyOnlySearch(query, limit);
    }

    // Step 2: Get semantic candidates from Qdrant (ANN) or MongoDB (fallback)
    let semanticCandidates: Array<{ id: string; score: number; payload: any }> = [];
    
    if (options.useQdrant !== false) {
      try {
        // Use Qdrant for fast ANN search
        semanticCandidates = await vectorSearch(queryEmbedding, limit * 2);
        logger.debug('[HybridRanking] Using Qdrant for semantic search');
      } catch (error) {
        logger.warn('[HybridRanking] Qdrant failed, falling back to MongoDB:', error);
        semanticCandidates = await mongoSemanticSearch(queryEmbedding, limit * 2);
      }
    } else {
      // Use MongoDB (for A/B testing or when Qdrant unavailable)
      semanticCandidates = await mongoSemanticSearch(queryEmbedding, limit * 2);
    }

    if (semanticCandidates.length === 0) {
      logger.warn('[HybridRanking] No semantic candidates found');
      return fuzzyOnlySearch(query, limit);
    }

    // Step 3: Get popularity map once (cached, efficient)
    const popularityMap = await popularityService.getPopularityMap();

    // Step 4: Get user preference map (personalization)
    let preferenceMap: Record<string, number> = {};
    let categoryPreferenceMap: Record<string, number> = {};
    
    if (options.usePersonalization !== false && options.userId) {
      try {
        // Get product-level preferences
        preferenceMap = await getUserPreferenceMap(options.userId);
        
        // Get category-level preferences
        categoryPreferenceMap = await getUserCategoryPreferenceMap(options.userId);
        
        logger.debug('[HybridRanking] Loaded user preferences:', {
          userId: options.userId,
          productCount: Object.keys(preferenceMap).length,
          categoryCount: Object.keys(categoryPreferenceMap).length,
        });
      } catch (error) {
        logger.warn('[HybridRanking] Failed to load preferences, continuing without personalization:', error);
      }
    }

    // Step 5: Calculate hybrid scores for semantic candidates
    const scoredProducts = semanticCandidates.map((candidate) => {
      // 5a. Semantic score (from Qdrant/MongoDB)
      const semanticScore = candidate.score;

      // 5b. Fuzzy score (Levenshtein + phonetic)
      const normalizedQuery = normalize(query);
      const fuzzyMatch = findBestMatch(normalizedQuery);
      const fuzzyScore = fuzzyMatch && fuzzyMatch.productId === candidate.id
        ? fuzzyMatch.score
        : 0;

      // 5c. Popularity score (click signals) - with exploration factor
      const popularityScore = popularityMap[candidate.id] || 0;
      const finalPopularityScore = options.useExploration !== false
        ? addExplorationFactor(popularityScore)
        : popularityScore;

      // 5d. Personalization score (user preferences)
      // Combine product-level + category-level preferences
      const productPreferenceScore = preferenceMap[candidate.id] || 0;
      const categoryPreferenceScore = categoryPreferenceMap[candidate.payload.category] || 0;
      
      // Product preference (70%) + Category preference (30%)
      const rawPersonalizationScore = 
        productPreferenceScore * 0.7 + 
        categoryPreferenceScore * 0.3;
      
      // Add diversity factor to prevent filter bubble
      const personalizationScore = options.usePersonalization !== false && options.userId
        ? addDiversityFactor(rawPersonalizationScore)
        : 0;

      // 5e. Calculate final weighted score
      const finalScore =
        semanticScore * weights.semantic +
        fuzzyScore * weights.fuzzy +
        finalPopularityScore * weights.popularity +
        personalizationScore * weights.personalization;

      return {
        productId: candidate.id,
        name: candidate.payload.name,
        description: candidate.payload.description,
        category: candidate.payload.category,
        price: candidate.payload.price,
        images: candidate.payload.images,
        finalScore,
        breakdown: {
          semanticScore,
          fuzzyScore,
          popularityScore: finalPopularityScore,
          personalizationScore,
        },
      };
    });

    // Step 6: Sort by final score and return top K
    scoredProducts.sort((a, b) => b.finalScore - a.finalScore);
    const topResults = scoredProducts.slice(0, limit);

    const latency = Date.now() - startTime;

    logger.info('[HybridRanking] Search complete:', {
      query,
      resultsCount: topResults.length,
      latency,
      topScore: topResults[0]?.finalScore || 0,
      weights,
      usedQdrant: options.useQdrant !== false,
      usedPersonalization: options.usePersonalization !== false && !!options.userId,
    });

    return topResults;
  } catch (error: any) {
    logger.error('[HybridRanking] Error:', error);
    return fuzzyOnlySearch(query, limit);
  }
}

/**
 * MongoDB semantic search (fallback when Qdrant unavailable)
 * O(N) scan - slow but reliable
 */
async function mongoSemanticSearch(
  queryEmbedding: number[],
  limit: number
): Promise<Array<{ id: string; score: number; payload: any }>> {
  try {
    logger.info('[HybridRanking] Using MongoDB for semantic search (O(N) fallback)');

    const products = await Product.find({
      isActive: true,
      isSellable: true,
      embedding: { $exists: true, $ne: null },
    })
      .select('+embedding _id name description category price images')
      .lean();

    if (!products || products.length === 0) {
      return [];
    }

    // Calculate cosine similarity for all products
    const scored = products.map((p: any) => ({
      id: String(p._id),
      score: cosineSimilarity(queryEmbedding, p.embedding),
      payload: {
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        images: p.images,
      },
    }));

    // Sort by score and return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch (error) {
    logger.error('[HybridRanking] MongoDB semantic search failed:', error);
    return [];
  }
}

/**
 * Fallback: Fuzzy-only search when semantic search fails
 */
async function fuzzyOnlySearch(query: string, limit: number): Promise<HybridResult[]> {
  try {
    logger.info('[HybridRanking] Using fuzzy-only fallback');

    const products = await Product.find({
      isActive: true,
      isSellable: true,
    })
      .select('_id name description category price images')
      .limit(limit * 2) // Get more for filtering
      .lean();

    const normalizedQuery = normalize(query);

    // Get popularity map once
    const popularityMap = await popularityService.getPopularityMap();

    const scoredProducts = products.map((product: any) => {
      const fuzzyMatch = findBestMatch(normalizedQuery);
      const fuzzyScore = fuzzyMatch && fuzzyMatch.productId === String(product._id)
        ? fuzzyMatch.score
        : 0;

      const popularityScore = popularityMap[String(product._id)] || 0;

      // Fuzzy 50% + Popularity 50% when semantic unavailable
      const finalScore = fuzzyScore * 0.5 + popularityScore * 0.5;

      return {
        productId: String(product._id),
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        images: product.images,
        finalScore,
        breakdown: {
          semanticScore: 0,
          fuzzyScore,
          popularityScore,
          personalizationScore: 0,
        },
      };
    });

    scoredProducts.sort((a: any, b: any) => b.finalScore - a.finalScore);
    return scoredProducts.slice(0, limit);
  } catch (error) {
    logger.error('[HybridRanking] Fuzzy fallback failed:', error);
    return [];
  }
}

export default {
  hybridSearch,
};


/**
 * Add exploration factor to avoid popularity bias
 * Prevents "rich get richer" problem where new products never surface
 * 
 * Algorithm:
 * - 90% actual popularity
 * - 10% random exploration
 * 
 * This is how Amazon/Flipkart avoid showing only popular items
 */
function addExplorationFactor(popularityScore: number): number {
  const EXPLORATION_WEIGHT = 0.1;
  const randomBoost = Math.random() * EXPLORATION_WEIGHT;
  
  return Math.min(
    popularityScore * (1 - EXPLORATION_WEIGHT) + randomBoost,
    1.0
  );
}
