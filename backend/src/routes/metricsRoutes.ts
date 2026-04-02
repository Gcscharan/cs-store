import express from 'express';
import {
  getVoiceMetricsController,
  getTopFailuresController,
  getCorrectionEffectivenessController,
  getPerformanceMetricsController,
  getDashboardMetricsController,
  getAccuracyBreakdownController,
} from '../controllers/metricsController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Simple admin check middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * GET /api/metrics/voice?hours=24
 * 
 * Overall voice AI metrics
 */
router.get('/voice', authenticateToken, requireAdmin, getVoiceMetricsController);

/**
 * GET /api/metrics/voice/failures?limit=10&hours=24
 * 
 * Top failing queries
 */
router.get(
  '/voice/failures',
  authenticateToken,
  requireAdmin,
  getTopFailuresController
);

/**
 * GET /api/metrics/voice/effectiveness?hours=24
 * 
 * Correction effectiveness
 */
router.get(
  '/voice/effectiveness',
  authenticateToken,
  requireAdmin,
  getCorrectionEffectivenessController
);

/**
 * GET /api/metrics/voice/performance?hours=24
 * 
 * Performance over time
 */
router.get(
  '/voice/performance',
  authenticateToken,
  requireAdmin,
  getPerformanceMetricsController
);

/**
 * GET /api/metrics/voice/breakdown?hours=24
 * 
 * Accuracy breakdown by dimensions
 */
router.get(
  '/voice/breakdown',
  authenticateToken,
  requireAdmin,
  getAccuracyBreakdownController
);

/**
 * GET /api/metrics/dashboard?hours=24
 * 
 * Complete dashboard (all metrics)
 */
router.get(
  '/dashboard',
  authenticateToken,
  requireAdmin,
  getDashboardMetricsController
);

export default router;
