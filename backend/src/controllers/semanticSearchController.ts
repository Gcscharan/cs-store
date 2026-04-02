/**
 * Semantic Search Controller
 * 
 * Phase 5: Personalized Semantic Search
 * Understands user intent + personalizes results
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { hybridSearch } from '../services/hybridRankingService';
import { rewriteQuery, wasRewritten } from '../services/queryRewriteService';
import { updateSession } from '../services/sessionService';

/**
 * Semantic search endpoint
 * 
 * POST /api/search/semantic
 * Body: { query: string, limit?: number, userId?: string, sessionId?: string }
 */
export async function semanticSearch(req: Request, res: Response): Promise<void> {
  try {
    const { query, limit = 10, userId, sessionId } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({
        success: false,
        error: 'Query is required',
      });
      return;
    }

    const startTime = Date.now();
    const originalQuery = query.trim();

    // Step 1: Query rewriting (expand ambiguous queries)
    const rewrittenQuery = rewriteQuery(originalQuery);
    const queryUsed = rewrittenQuery;

    logger.debug('[SemanticSearch] Query processing:', {
      original: originalQuery,
      rewritten: rewrittenQuery,
      wasRewritten: wasRewritten(originalQuery, rewrittenQuery),
    });

    // Step 2: Hybrid search with personalization
    const results = await hybridSearch(
      queryUsed,
      limit,
      undefined, // Use default weights
      {
        useExploration: true,
        useQdrant: true,
        usePersonalization: !!userId,
        userId,
      }
    );

    // Step 3: Update session context (fire-and-forget)
    if (userId && sessionId) {
      const productIds = results.map(r => r.productId);
      updateSession(userId, sessionId, originalQuery, productIds).catch(err => {
        logger.error('[SemanticSearch] Failed to update session:', err);
      });
    }

    const latency = Date.now() - startTime;

    logger.info('[SemanticSearch] Query processed:', {
      query: originalQuery,
      rewritten: wasRewritten(originalQuery, rewrittenQuery),
      resultsCount: results.length,
      latency,
      topScore: results[0]?.finalScore || 0,
      personalized: !!userId,
    });

    res.json({
      success: true,
      results,
      query: originalQuery,
      rewrittenQuery: wasRewritten(originalQuery, rewrittenQuery) ? rewrittenQuery : undefined,
      latency,
      personalized: !!userId,
    });
  } catch (error: any) {
    logger.error('[SemanticSearch] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default {
  semanticSearch,
};
