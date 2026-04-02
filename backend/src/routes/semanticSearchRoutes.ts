/**
 * Semantic Search Routes
 * 
 * Phase 4: Semantic AI Layer
 */

import express from 'express';
import { semanticSearch } from '../controllers/semanticSearchController';
import { hybridSearch } from '../services/hybridRankingService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/search/semantic
 * Pure semantic search (intent understanding only)
 */
router.post('/semantic', semanticSearch);

/**
 * POST /api/search/hybrid
 * Hybrid search (semantic + fuzzy + popularity)
 * This is the recommended endpoint for production
 */
router.post('/hybrid', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({
        success: false,
        error: 'Query is required',
      });
      return;
    }

    const startTime = Date.now();
    const results = await hybridSearch(query.trim(), limit);
    const latency = Date.now() - startTime;

    res.json({
      success: true,
      results,
      query,
      latency,
      searchType: 'hybrid',
    });
  } catch (error: any) {
    logger.error('[HybridSearch] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
