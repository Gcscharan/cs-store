/**
 * Personalized Search Controller
 * 
 * Phase 5: Personalization Engine
 * Combines all intelligence layers for personalized results
 * 
 * Architecture:
 * Query → Rewrite → Embedding → Vector Search → Hybrid Ranking (with personalization) → Results
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { hybridSearch } from '../services/hybridRankingService';
import { rewriteQuery, wasRewritten } from '../services/queryRewriteService';
import { updateSession, getSessionContext, isContextualQuery } from '../services/sessionService';

/**
 * Personalized search endpoint
 * 
 * POST /api/search/personalized
 * Body: { 
 *   query: string, 
 *   userId: string,
 *   sessionId?: string,
 *   limit?: number 
 * }
 */
export async function personalizedSearch(req: Request, res: Response): Promise<void> {
  try {
    const { query, userId, sessionId, limit = 10 } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({
        success: false,
        error: 'Query is required',
      });
      return;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'userId is required for personalized search',
      });
      return;
    }

    const startTime = Date.now();
    const originalQuery = query.trim();

    // Step 1: Check if this is a contextual query
    let contextUsed = false;
    let contextualQuery = originalQuery;
    
    if (sessionId && isContextualQuery(originalQuery)) {
      const context = await getSessionContext(userId, sessionId);
      
      if (context && context.lastClickedProduct) {
        // Contextual query detected - use last clicked product as context
        contextualQuery = `${context.lastQuery} ${originalQuery}`;
        contextUsed = true;
        
        logger.debug('[PersonalizedSearch] Contextual query detected:', {
          original: originalQuery,
          contextual: contextualQuery,
          lastProduct: context.lastClickedProduct,
        });
      }
    }

    // Step 2: Query rewriting (expand ambiguous queries)
    const rewrittenQuery = rewriteQuery(contextualQuery);
    const queryUsed = rewrittenQuery;

    logger.debug('[PersonalizedSearch] Query processing:', {
      original: originalQuery,
      contextual: contextUsed ? contextualQuery : undefined,
      rewritten: rewrittenQuery,
      wasRewritten: wasRewritten(contextualQuery, rewrittenQuery),
    });

    // Step 3: Hybrid search with personalization
    const results = await hybridSearch(
      queryUsed,
      limit,
      undefined, // Use default weights
      {
        useExploration: true,
        useQdrant: true,
        usePersonalization: true,
        userId,
      }
    );

    // Step 4: Update session context (fire-and-forget)
    if (sessionId) {
      const productIds = results.map(r => r.productId);
      updateSession(userId, sessionId, originalQuery, productIds).catch(err => {
        logger.error('[PersonalizedSearch] Failed to update session:', err);
      });
    }

    const latency = Date.now() - startTime;

    logger.info('[PersonalizedSearch] Query processed:', {
      query: originalQuery,
      userId,
      rewritten: wasRewritten(contextualQuery, rewrittenQuery),
      contextUsed,
      resultsCount: results.length,
      latency,
      topScore: results[0]?.finalScore || 0,
    });

    res.json({
      success: true,
      results,
      query: originalQuery,
      rewrittenQuery: wasRewritten(contextualQuery, rewrittenQuery) ? rewrittenQuery : undefined,
      contextUsed,
      latency,
      personalized: true,
    });
  } catch (error: any) {
    logger.error('[PersonalizedSearch] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default {
  personalizedSearch,
};
