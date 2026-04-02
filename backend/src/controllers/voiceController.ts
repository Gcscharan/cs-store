/**
 * Voice Controller
 * 
 * Handles voice correction learning and retrieval
 * 
 * UPDATED: Now uses async queue for writes (saveCorrection, trackClick, syncUserData)
 */

import { Request, Response } from 'express';
import VoiceCorrection from '../models/VoiceCorrection';
import ProductClick from '../models/ProductClick';
import { normalize } from '../utils/textUtils';
import { queueManager } from '../queues/queueManager';
import { QueueName } from '../queues/types';
import { generateJobId } from '../queues/utils/idempotency';
import { fallbackBuffer } from '../queues/fallbackBuffer';
import { updateUserPreference } from '../services/preferenceService';
import { updateSessionClick } from '../services/sessionService';

/**
 * POST /voice/correction
 * 
 * Save a learned correction with validation
 * 
 * UPDATED: Now uses async queue (fire-and-forget)
 * Returns 202 Accepted immediately
 */
export const saveCorrection = async (req: Request, res: Response) => {
  try {
    const { wrong, correct, productId, userId, confidence = 0.7 } = req.body;
    
    // Validation
    if (!wrong || !correct || !productId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: wrong, correct, productId',
      });
    }
    
    // 🚨 CRITICAL: Normalize BEFORE any processing
    const wrongNorm = normalize(wrong);
    const correctNorm = normalize(correct);
    
    // 🚨 VALIDATION 1: Confidence gating
    if (confidence < 0.7) {
      return res.status(400).json({
        success: false,
        error: 'Confidence too low (< 0.7)',
      });
    }
    
    // 🚨 VALIDATION 2: Ignore useless data
    if (wrongNorm === correctNorm) {
      return res.status(400).json({
        success: false,
        error: 'Input and output are identical',
      });
    }
    
    // 🚨 VALIDATION 3: Minimum length
    if (wrongNorm.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Query too short (< 3 characters)',
      });
    }
    
    // 🚨 BACKPRESSURE: Check queue health before accepting
    const health = await queueManager.getHealth();
    if (!health.healthy) {
      return res.status(503).json({
        success: false,
        error: 'Queue unavailable. Please try again later.',
      });
    }
    
    // 🚨 NEW: Add to queue (fire-and-forget)
    try {
      // 🚨 BACKPRESSURE: Check queue depth before accepting
      const health = await queueManager.getHealth();
      const MAX_QUEUE_SIZE = 50000;
      
      const correctionsQueue = health.queues.find(q => q.name === 'corrections');
      if (correctionsQueue && correctionsQueue.waiting > MAX_QUEUE_SIZE) {
        console.warn('[VoiceController] ⚠️ Queue overloaded:', {
          waiting: correctionsQueue.waiting,
          max: MAX_QUEUE_SIZE,
        });
        
        return res.status(503).json({
          success: false,
          error: 'System overloaded. Try again later.',
          queueDepth: correctionsQueue.waiting,
        });
      }
      
      const jobData = {
        wrong: wrongNorm,
        correct: correctNorm,
        productId,
        userId: userId || null,
        confidence,
      };
      
      const jobId = generateJobId('correction', wrongNorm, correctNorm, userId || 'global');
      
      await queueManager.addJob('corrections', jobData, {
        jobId, // Deterministic ID (prevents duplicates)
        removeOnComplete: 1000, // Keep last 1000 completed jobs
        removeOnFail: 5000, // Keep last 5000 failed jobs
      });
      
      console.log('[VoiceController] ✅ Correction queued:', {
        jobId,
        wrong: wrongNorm,
        correct: correctNorm,
        userId: userId || 'global',
      });
      
      // Return 202 Accepted (job queued, will be processed async)
      return res.status(202).json({
        success: true,
        jobId,
        message: 'Correction queued for processing',
      });
    } catch (queueError: any) {
      // 🚨 BACKPRESSURE: Queue overloaded
      if (queueError.message === 'QUEUE_OVERLOADED') {
        console.error('[VoiceController] Queue overloaded');
        return res.status(503).json({
          success: false,
          error: 'System overloaded. Please try again later.',
        });
      }
      
      console.error('[VoiceController] Queue error, falling back to direct DB:', queueError);
      
      // Recreate jobData and jobId for fallback
      const fallbackJobData = {
        wrong: wrongNorm,
        correct: correctNorm,
        productId,
        userId: userId || null,
        confidence,
      };
      const fallbackJobId = generateJobId('correction', wrongNorm, correctNorm, userId || 'global');
      
      // 🚨 SAFE FALLBACK: Buffer job for retry (safer than direct DB write)
      const buffered = fallbackBuffer.add('corrections', fallbackJobData, {
        jobId: fallbackJobId,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });

      // 🚨 BUFFER FULL: Reject request
      if (!buffered) {
        return res.status(503).json({
          success: false,
          error: 'System overloaded (buffer full). Please try again later.',
        });
      }
      
      console.log('[VoiceController] ⚠️ Correction buffered (queue unavailable):', {
        jobId: fallbackJobId,
        wrong: wrongNorm,
        correct: correctNorm,
        userId: userId || 'global',
      });
      
      return res.status(202).json({
        success: true,
        jobId: fallbackJobId,
        buffered: true,
        message: 'Correction buffered for processing',
      });
    }
  } catch (error: any) {
    console.error('[VoiceController] saveCorrection error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /voice/correction?query=greenlense&userId=abc
 * 
 * Get best correction for a query
 * Priority: User corrections > Global corrections
 */
export const getCorrection = async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter',
      });
    }
    
    const queryNorm = normalize(query);
    
    // 🚨 PRIORITY 1: User-specific corrections
    if (userId) {
      const userCorrection = await VoiceCorrection.findOne({
        wrong: queryNorm,
        userId: userId as string,
        confidence: { $gte: 0.7 },
      }).sort({ confidence: -1, count: -1 });
      
      if (userCorrection) {
        // Update last used
        userCorrection.lastUsed = new Date();
        await userCorrection.save();
        
        return res.json({
          success: true,
          correction: userCorrection,
          source: 'user',
        });
      }
    }
    
    // 🚨 PRIORITY 2: Global corrections
    const globalCorrection = await VoiceCorrection.findOne({
      wrong: queryNorm,
      userId: null,
      confidence: { $gte: 0.8 },
      validationScore: { $gte: 0.7 },
    }).sort({ confidence: -1, count: -1 });
    
    if (globalCorrection) {
      return res.json({
        success: true,
        correction: globalCorrection,
        source: 'global',
      });
    }
    
    // No correction found
    res.json({
      success: true,
      correction: null,
      source: 'none',
    });
  } catch (error: any) {
    console.error('[VoiceController] getCorrection error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /voice/click
 * 
 * Track product click for popularity ranking + personalization
 * 
 * UPDATED: Now uses async queue (fire-and-forget)
 * Returns 202 Accepted immediately
 * 
 * Phase 5: Also updates user preferences for personalization
 */
export const trackClick = async (req: Request, res: Response) => {
  try {
    const { productId, productName, userId, query, isVoice = false, sessionId, category } = req.body;
    
    if (!productId || !productName || !userId || !query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }
    
    // 🚨 PHASE 5: Update user preference (real-time learning)
    if (userId) {
      updateUserPreference(userId, productId, category).catch(err => {
        console.error('[VoiceController] Failed to update preference:', err);
        // Don't block - preference update is not critical
      });
      
      // Update session context
      if (sessionId) {
        updateSessionClick(userId, sessionId, productId).catch(err => {
          console.error('[VoiceController] Failed to update session:', err);
        });
      }
    }
    
    // 🚨 NEW: Add to queue (fire-and-forget)
    try {
      // 🚨 BACKPRESSURE: Check queue depth
      const health = await queueManager.getHealth();
      const MAX_QUEUE_SIZE = 50000;
      
      const clicksQueue = health.queues.find(q => q.name === 'clicks');
      if (clicksQueue && clicksQueue.waiting > MAX_QUEUE_SIZE) {
        console.warn('[VoiceController] ⚠️ Clicks queue overloaded:', {
          waiting: clicksQueue.waiting,
          max: MAX_QUEUE_SIZE,
        });
        
        return res.status(503).json({
          success: false,
          error: 'System overloaded. Try again later.',
        });
      }
      
      const jobData = {
        productId,
        productName,
        userId,
        query: normalize(query),
        isVoice,
        sessionId,
      };
      
      const jobId = generateJobId('click', userId, productId, Date.now().toString());
      
      await queueManager.addJob('clicks', jobData, {
        jobId,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      
      console.log('[VoiceController] ✅ Click queued:', {
        jobId,
        productId,
        userId,
      });
      
      // Return 202 Accepted
      return res.status(202).json({
        success: true,
        jobId,
        message: 'Click queued for processing',
      });
    } catch (queueError: any) {
      console.error('[VoiceController] Queue error, falling back to direct DB:', queueError);
      
      // 🚨 FALLBACK: Direct DB write
      const click = new ProductClick({
        productId,
        productName,
        userId,
        query: normalize(query),
        isVoice,
        timestamp: new Date(),
        sessionId,
      });
      
      await click.save();
      
      return res.status(201).json({
        success: true,
        click,
        message: 'Click saved (fallback)',
      });
    }
  } catch (error: any) {
    console.error('[VoiceController] trackClick error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /voice/popular?limit=10
 * 
 * Get popular products based on clicks
 */
export const getPopularProducts = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const days = parseInt(req.query.days as string) || 30;
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    // Aggregate clicks by product
    const popular = await ProductClick.aggregate([
      {
        $match: {
          timestamp: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          totalClicks: { $sum: 1 },
          voiceClicks: {
            $sum: { $cond: ['$isVoice', 1, 0] },
          },
          lastClicked: { $max: '$timestamp' },
        },
      },
      {
        $sort: { totalClicks: -1 },
      },
      {
        $limit: limit,
      },
    ]);
    
    res.json({
      success: true,
      products: popular,
      period: `${days} days`,
    });
  } catch (error: any) {
    console.error('[VoiceController] getPopularProducts error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /voice/sync
 * 
 * Sync user data with backend
 * 
 * UPDATED: Now uses async queue for batch processing
 * Returns 202 Accepted immediately
 */
export const syncUserData = async (req: Request, res: Response) => {
  try {
    const { userId, corrections, rankings } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId',
      });
    }
    
    // 🚨 NEW: Add to queue (fire-and-forget)
    try {
      if (corrections && Array.isArray(corrections) && corrections.length > 0) {
        const jobData = {
          userId,
          corrections,
        };
        
        const jobId = generateJobId('sync', userId, Date.now().toString());
        
        await queueManager.addJob('sync', jobData, {
          jobId,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        });
        
        console.log('[VoiceController] ✅ Sync queued:', {
          jobId,
          userId,
          corrections: corrections.length,
        });
      }
      
      // Get global corrections for user (read operation - not queued)
      const globalCorrections = await VoiceCorrection.find({
        userId: null,
        confidence: { $gte: 0.8 },
        validationScore: { $gte: 0.7 },
      })
        .sort({ confidence: -1, count: -1 })
        .limit(100);
      
      // Return 202 Accepted
      return res.status(202).json({
        success: true,
        globalCorrections,
        message: 'Sync queued for processing',
      });
    } catch (queueError: any) {
      console.error('[VoiceController] Queue error, falling back to direct DB:', queueError);
      
      // 🚨 FALLBACK: Direct DB write
      if (corrections && Array.isArray(corrections)) {
        for (const corr of corrections) {
          await VoiceCorrection.findOneAndUpdate(
            { wrong: corr.wrong, userId },
            {
              $set: {
                correct: corr.correct,
                productId: corr.productId,
                confidence: corr.confidence,
                validationScore: corr.validationScore,
                lastUsed: new Date(corr.lastUsed),
              },
              $inc: { count: 1 },
            },
            { upsert: true, new: true }
          );
        }
      }
      
      // Get global corrections
      const globalCorrections = await VoiceCorrection.find({
        userId: null,
        confidence: { $gte: 0.8 },
        validationScore: { $gte: 0.7 },
      })
        .sort({ confidence: -1, count: -1 })
        .limit(100);
      
      return res.json({
        success: true,
        globalCorrections,
        message: 'Sync complete (fallback)',
      });
    }
  } catch (error: any) {
    console.error('[VoiceController] syncUserData error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
