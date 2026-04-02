/**
 * Voice Correction Controller
 * 
 * 🔥 PRODUCTION-GRADE CORRECTION WITH EXPERIMENT INTEGRITY
 * 
 * Backend controls correction logic to ensure:
 * - Same variant → Same decision logic → Same metrics
 * - No frontend/backend mismatch
 * - 100% experiment integrity
 */

import { Request, Response } from 'express';
import { getExperimentConfig } from '../services/experimentService';
import { logger } from '../utils/logger';

/**
 * POST /api/voice/correct
 * 
 * Apply voice correction with experiment-aware threshold
 * 
 * 🔥 CRITICAL: This is where experiment affects REAL behavior
 * 
 * Body:
 * {
 *   "query": "greenlense",
 *   "userId": "user123"
 * }
 * 
 * Response:
 * {
 *   "original": "greenlense",
 *   "corrected": "green lays",
 *   "confidence": 0.85,
 *   "matched": true,
 *   "productId": "abc123",
 *   "source": "algorithmic",
 *   "variant": "B",
 *   "experimentName": "threshold_test_v1",
 *   "thresholdUsed": 0.7
 * }
 */
export const correctVoiceQuery = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { query, userId, requestId } = req.body;
    
    // Validation
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query parameter',
      });
    }
    
    // 🔥 IDEMPOTENCY: Check if we've already processed this request
    // Prevents duplicate processing on timeout/retry storms
    if (requestId) {
      const cacheKey = `voice:correction:${requestId}`;
      
      try {
        // Check Redis cache for previous result
        const { default: redis } = await import('../config/redis');
        
        if (redis && redis.isReady) {
          const cachedResult = await redis.get(cacheKey);
          
          if (cachedResult) {
            logger.info('[VoiceCorrection] ✅ Returning cached result (idempotency):', {
              requestId,
              query,
            });
            
            return res.json(JSON.parse(cachedResult));
          }
        }
      } catch (cacheError) {
        // Cache check failed, continue with processing
        logger.warn('[VoiceCorrection] Cache check failed, processing request:', cacheError);
      }
    }
    
    // 🧪 STEP 1: Get experiment config (if userId provided)
    let experimentConfig: any = null;
    let threshold = 0.6; // Default threshold
    
    if (userId) {
      try {
        experimentConfig = await getExperimentConfig(userId);
        
        if (experimentConfig && experimentConfig.config.threshold) {
          threshold = experimentConfig.config.threshold;
          
          logger.info('[VoiceCorrection] Applying experiment threshold:', {
            userId,
            experimentName: experimentConfig.experimentName,
            variant: experimentConfig.variant,
            threshold,
          });
        }
      } catch (error) {
        logger.error('[VoiceCorrection] Error getting experiment config:', error);
        // Continue with default threshold
      }
    }
    
    // 🔥 STEP 2: Apply correction with experiment-aware threshold
    // Import correction logic dynamically to avoid circular deps
    const { correctVoiceQuery: correctFn } = require('../utils/voiceCorrectionBackend');
    
    const result = await correctFn(query, threshold, userId);
    
    // 🔥 STEP 3: Add experiment metadata to response
    const response = {
      success: true,
      ...result,
      variant: experimentConfig?.variant,
      experimentName: experimentConfig?.experimentName,
      thresholdUsed: threshold,
      latency: Date.now() - startTime,
    };
    
    // 🔥 STEP 4: Cache result for idempotency (5 minute TTL)
    if (requestId) {
      try {
        const { default: redis } = await import('../config/redis');
        
        if (redis && redis.isReady) {
          await redis.setEx(
            `voice:correction:${requestId}`,
            300, // 5 minutes
            JSON.stringify(response)
          );
        }
      } catch (cacheError) {
        // Cache write failed, log but don't fail request
        logger.warn('[VoiceCorrection] Failed to cache result:', cacheError);
      }
    }
    
    logger.info('[VoiceCorrection] Correction applied:', {
      query,
      corrected: result.corrected,
      confidence: result.confidence,
      variant: experimentConfig?.variant,
      threshold,
      latency: response.latency,
      requestId,
    });
    
    res.json(response);
  } catch (error: any) {
    logger.error('[VoiceCorrection] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
