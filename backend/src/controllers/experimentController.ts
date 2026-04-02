/**
 * Experiment Controller
 * 
 * Admin API for A/B testing management
 */

import { Request, Response } from 'express';
import {
  createExperiment,
  getAllExperiments,
  getExperimentResults,
  stopExperiment,
  updateRollout,
  getExperimentConfig,
} from '../services/experimentService';

/**
 * POST /admin/experiments
 * 
 * Create a new experiment
 */
export const createExperimentController = async (req: Request, res: Response) => {
  try {
    const { name, description, variants, trafficSplit, rolloutPercentage, config } = req.body;

    // Validation
    if (!name || !variants || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, variants, config',
      });
    }

    if (!Array.isArray(variants) || variants.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Variants must be an array with at least 2 variants',
      });
    }

    // Validate config has all variants
    for (const variant of variants) {
      if (!config[variant]) {
        return res.status(400).json({
          success: false,
          error: `Config missing for variant: ${variant}`,
        });
      }
    }

    const experiment = await createExperiment({
      name,
      description,
      variants,
      trafficSplit,
      rolloutPercentage,
      config,
      createdBy: (req as any).user?.userId,
    });

    res.status(201).json({
      success: true,
      experiment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /admin/experiments
 * 
 * Get all experiments
 */
export const getAllExperimentsController = async (req: Request, res: Response) => {
  try {
    const experiments = await getAllExperiments();

    res.json({
      success: true,
      experiments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /admin/experiments/:name/results?hours=24
 * 
 * Get experiment results
 */
export const getExperimentResultsController = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const results = await getExperimentResults(name, hours);

    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * POST /admin/experiments/:name/stop
 * 
 * Stop an experiment
 */
export const stopExperimentController = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    await stopExperiment(name);

    res.json({
      success: true,
      message: `Experiment ${name} stopped`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * PATCH /admin/experiments/:name/rollout
 * 
 * Update rollout percentage (gradual rollout)
 */
export const updateRolloutController = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { rolloutPercentage } = req.body;

    if (typeof rolloutPercentage !== 'number' || rolloutPercentage < 0 || rolloutPercentage > 100) {
      return res.status(400).json({
        success: false,
        error: 'rolloutPercentage must be a number between 0 and 100',
      });
    }

    await updateRollout(name, rolloutPercentage);

    res.json({
      success: true,
      message: `Rollout updated to ${rolloutPercentage}%`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET /experiments/config?userId=abc123
 * 
 * Get experiment configuration for a user (PUBLIC endpoint)
 * Used by frontend to get variant and config
 */
export const getExperimentConfigController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing userId parameter',
      });
    }

    const config = await getExperimentConfig(userId);

    res.json({
      success: true,
      config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
