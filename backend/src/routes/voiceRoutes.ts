/**
 * Voice Routes
 */

import express from 'express';
import {
  saveCorrection,
  getCorrection,
  trackClick,
  getPopularProducts,
  syncUserData,
} from '../controllers/voiceController';
import { strictLimiter, readLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Correction endpoints
router.post('/correction', strictLimiter, saveCorrection);
router.get('/correction', readLimiter, getCorrection);

// Click tracking
router.post('/click', strictLimiter, trackClick);

// Analytics
router.get('/popular', readLimiter, getPopularProducts);

// Sync
router.post('/sync', strictLimiter, syncUserData);

export default router;
