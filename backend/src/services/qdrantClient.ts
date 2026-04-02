/**
 * Qdrant Client
 * 
 * Vector database client for scalable semantic search
 * Replaces O(N) MongoDB scan with O(log N) ANN search
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../utils/logger';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'products';

/**
 * Qdrant client instance
 */
export const qdrant = new QdrantClient({
  url: QDRANT_URL,
});

/**
 * Check if Qdrant is healthy
 */
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    await qdrant.getCollections();
    return true;
  } catch (error) {
    logger.error('[Qdrant] Health check failed:', error);
    return false;
  }
}

/**
 * Check if collection exists
 */
export async function collectionExists(name: string = COLLECTION_NAME): Promise<boolean> {
  try {
    const collections = await qdrant.getCollections();
    return collections.collections.some(c => c.name === name);
  } catch (error) {
    logger.error('[Qdrant] Failed to check collection:', error);
    return false;
  }
}

export { COLLECTION_NAME };

export default {
  qdrant,
  checkQdrantHealth,
  collectionExists,
  COLLECTION_NAME,
};
