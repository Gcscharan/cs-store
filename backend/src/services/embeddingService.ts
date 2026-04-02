/**
 * Embedding Service
 * 
 * Node.js client for Python embedding service
 * Converts text to semantic vectors for intent understanding
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';
const EMBEDDING_TIMEOUT = 5000; // 5 seconds

interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
}

interface BatchEmbeddingResponse {
  embeddings: number[][];
  dimensions: number;
  count: number;
}

/**
 * Get embedding for single text
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!text || !text.trim()) {
      logger.warn('[EmbeddingService] Empty text provided');
      return null;
    }

    const response = await axios.post<EmbeddingResponse>(
      `${EMBEDDING_SERVICE_URL}/embed`,
      { text: text.trim() },
      { timeout: EMBEDDING_TIMEOUT }
    );

    if (!response.data || !response.data.embedding) {
      logger.error('[EmbeddingService] Invalid response from embedding service');
      return null;
    }

    return response.data.embedding;
  } catch (error: any) {
    logger.error('[EmbeddingService] Failed to get embedding:', {
      error: error.message,
      text: text.substring(0, 50),
    });
    return null;
  }
}

/**
 * Get embeddings for multiple texts (batch processing)
 * More efficient than calling getEmbedding() multiple times
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][] | null> {
  try {
    if (!texts || texts.length === 0) {
      logger.warn('[EmbeddingService] Empty texts array provided');
      return null;
    }

    const cleanTexts = texts.map(t => t.trim()).filter(t => t.length > 0);
    
    if (cleanTexts.length === 0) {
      logger.warn('[EmbeddingService] No valid texts after cleaning');
      return null;
    }

    const response = await axios.post<BatchEmbeddingResponse>(
      `${EMBEDDING_SERVICE_URL}/embed/batch`,
      { texts: cleanTexts },
      { timeout: EMBEDDING_TIMEOUT * 2 } // Longer timeout for batch
    );

    if (!response.data || !response.data.embeddings) {
      logger.error('[EmbeddingService] Invalid response from embedding service');
      return null;
    }

    return response.data.embeddings;
  } catch (error: any) {
    logger.error('[EmbeddingService] Failed to get batch embeddings:', {
      error: error.message,
      count: texts.length,
    });
    return null;
  }
}

/**
 * Check if embedding service is healthy
 */
export async function checkEmbeddingServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${EMBEDDING_SERVICE_URL}/health`, {
      timeout: 2000,
    });
    
    return response.status === 200 && response.data.status === 'healthy';
  } catch (error) {
    logger.error('[EmbeddingService] Health check failed:', error);
    return false;
  }
}

export default {
  getEmbedding,
  getBatchEmbeddings,
  checkEmbeddingServiceHealth,
};
