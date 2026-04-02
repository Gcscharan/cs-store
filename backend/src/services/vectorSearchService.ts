/**
 * Vector Search Service
 * 
 * ANN (Approximate Nearest Neighbor) search using Qdrant
 * Replaces O(N) MongoDB scan with O(log N) vector search
 */

import { qdrant, COLLECTION_NAME } from './qdrantClient';
import { logger } from '../utils/logger';

interface VectorSearchResult {
  id: string;
  score: number;
  payload: {
    name: string;
    description: string;
    category: string;
    price: number;
    images: any[];
  };
}

/**
 * Search for similar products using vector similarity
 * 
 * @param queryVector - Query embedding (384 dimensions)
 * @param limit - Number of results to return
 * @param filter - Optional filter (e.g., category)
 * @returns Array of similar products with scores
 */
export async function vectorSearch(
  queryVector: number[],
  limit: number = 20,
  filter?: { category?: string }
): Promise<VectorSearchResult[]> {
  try {
    const startTime = Date.now();

    // Build filter if provided
    const qdrantFilter = filter?.category
      ? {
          must: [
            {
              key: 'category',
              match: { value: filter.category },
            },
          ],
        }
      : undefined;

    // Search Qdrant
    const results = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit,
      filter: qdrantFilter,
      with_payload: true,
    });

    const latency = Date.now() - startTime;

    logger.info('[VectorSearch] Search complete:', {
      resultsCount: results.length,
      latency,
      filter: filter?.category || 'none',
    });

    return results.map((r: any) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload,
    }));
  } catch (error: any) {
    logger.error('[VectorSearch] Search failed:', error);
    throw error;
  }
}

/**
 * Upsert product embedding to Qdrant
 * Used for real-time sync when products are created/updated
 */
export async function upsertProductVector(
  productId: string,
  embedding: number[],
  payload: {
    name: string;
    description: string;
    category: string;
    price: number;
    images: any[];
  }
): Promise<void> {
  try {
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: productId,
          vector: embedding,
          payload,
        },
      ],
    });

    logger.info('[VectorSearch] Product upserted:', productId);
  } catch (error: any) {
    logger.error('[VectorSearch] Upsert failed:', error);
    throw error;
  }
}

/**
 * Delete product from Qdrant
 * Used when products are deleted
 */
export async function deleteProductVector(productId: string): Promise<void> {
  try {
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      points: [productId],
    });

    logger.info('[VectorSearch] Product deleted:', productId);
  } catch (error: any) {
    logger.error('[VectorSearch] Delete failed:', error);
    throw error;
  }
}

export default {
  vectorSearch,
  upsertProductVector,
  deleteProductVector,
};
