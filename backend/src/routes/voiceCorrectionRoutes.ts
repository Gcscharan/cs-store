/**
 * Voice Correction Routes
 * 
 * Backend-controlled correction with experiment integrity
 */

import express from 'express';
import { correctVoiceQuery } from '../controllers/voiceCorrectionController';

const router = express.Router();

/**
 * POST /api/voice/correct
 * 
 * Apply voice correction with experiment-aware threshold
 * 
 * Body:
 * {
 *   "query": "greenlense",
 *   "userId": "user123"  // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "original": "greenlense",
 *   "corrected": "green lays",
 *   "confidence": 0.85,
 *   "matched": true,
 *   "productId": "abc123",
 *   "source": "algorithmic",
 *   "variant": "B",
 *   "experimentName": "threshold_test_v1",
 *   "thresholdUsed": 0.7,
 *   "latency": 45
 * }
 */
router.post('/correct', correctVoiceQuery);

export default router;
