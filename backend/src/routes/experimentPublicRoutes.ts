/**
 * Experiment Public Routes
 * 
 * Public endpoints for A/B testing (no auth required)
 */

import express from 'express';
import { getExperimentConfigController } from '../controllers/experimentController';

const router = express.Router();

/**
 * GET /experiments/config?userId=abc123
 * 
 * Get experiment configuration for a user
 * Returns variant and config for active experiment
 * 
 * PUBLIC endpoint (no auth required)
 */
router.get('/config', getExperimentConfigController);

export default router;
