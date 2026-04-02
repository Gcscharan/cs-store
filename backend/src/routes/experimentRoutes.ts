/**
 * Experiment Routes
 * 
 * Admin-only A/B testing management
 */

import express from 'express';
import {
  createExperimentController,
  getAllExperimentsController,
  getExperimentResultsController,
  stopExperimentController,
  updateRolloutController,
} from '../controllers/experimentController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Admin check middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * POST /admin/experiments
 * 
 * Create a new experiment
 * 
 * Body:
 * {
 *   "name": "threshold_test_v1",
 *   "description": "Testing threshold 0.6 vs 0.7",
 *   "variants": ["A", "B"],
 *   "trafficSplit": 0.5,
 *   "rolloutPercentage": 10,
 *   "config": {
 *     "A": { "threshold": 0.6 },
 *     "B": { "threshold": 0.7 }
 *   }
 * }
 */
router.post('/', authenticateToken, requireAdmin, createExperimentController);

/**
 * GET /admin/experiments
 * 
 * Get all experiments
 */
router.get('/', authenticateToken, requireAdmin, getAllExperimentsController);

/**
 * GET /admin/experiments/:name/results?hours=24
 * 
 * Get experiment results
 */
router.get('/:name/results', authenticateToken, requireAdmin, getExperimentResultsController);

/**
 * POST /admin/experiments/:name/stop
 * 
 * Stop an experiment
 */
router.post('/:name/stop', authenticateToken, requireAdmin, stopExperimentController);

/**
 * PATCH /admin/experiments/:name/rollout
 * 
 * Update rollout percentage (gradual rollout)
 * 
 * Body:
 * {
 *   "rolloutPercentage": 25
 * }
 */
router.patch('/:name/rollout', authenticateToken, requireAdmin, updateRolloutController);

export default router;
