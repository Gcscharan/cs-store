/**
 * Voice Metrics Logging Route
 * 
 * Frontend calls this to log search outcomes
 * Automatically handles A/B testing variant assignment
 */

import express from 'express';
import { logVoiceSearch } from '../services/metricsService';
import { getExperimentConfig } from '../services/experimentService';

const router = express.Router();

/**
 * POST /api/voice/log-search
 * 
 * Log a voice search outcome
 * 
 * Called by frontend after user interaction
 * Automatically assigns A/B testing variant if experiment is active
 */
router.post('/log-search', async (req, res) => {
  try {
    const {
      query,
      correctedTo,
      productId,
      correctedProductId,
      success,
      confidence,
      latency,
      queueDelay,
      userId,
      sessionId,
    } = req.body;

    // Validation
    if (!query || !correctedTo || typeof success !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: query, correctedTo, success',
      });
    }

    // 🧪 A/B TESTING: Get experiment config if userId provided
    let variant: string | undefined;
    let experimentName: string | undefined;
    
    if (userId) {
      try {
        const experimentConfig = await getExperimentConfig(userId);
        if (experimentConfig) {
          variant = experimentConfig.variant;
          experimentName = experimentConfig.experimentName;
        }
      } catch (error) {
        // Experiment service error - continue without variant
        console.error('[VoiceMetricsLog] Experiment config error:', error);
      }
    }

    // Log asynchronously (don't block response)
    logVoiceSearch({
      query,
      correctedTo,
      productId,
      correctedProductId,
      success,
      confidence: confidence || 0,
      latency: latency || 0,
      queueDelay,
      userId,
      sessionId,
      variant,           // 🧪 A/B testing variant
      experimentName,    // 🧪 A/B testing experiment
    }).catch((error) => {
      console.error('[VoiceMetricsLog] Failed to log:', error);
    });

    res.status(202).json({
      success: true,
      message: 'Search logged',
      variant,           // Return variant to frontend (optional)
      experimentName,    // Return experiment name (optional)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
