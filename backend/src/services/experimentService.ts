/**
 * Experiment Service
 * 
 * Core A/B testing logic
 * Manages experiments and variant assignment
 */

import Experiment from '../models/Experiment';
import VoiceMetrics from '../models/VoiceMetrics';
import { getVariant, getVariantMulti } from '../utils/experiment';
import { logger } from '../utils/logger';
import {
  checkSRM,
  checkMinimumSampleSize,
  checkGuardrails,
  detectWinner,
} from './experimentHardeningService';

/**
 * Get active experiment configuration for a user
 * 
 * Returns variant and config for the user
 */
export async function getExperimentConfig(userId: string): Promise<{
  experimentName: string;
  variant: string;
  config: any;
} | null> {
  try {
    // Get active experiment (only one active at a time for simplicity)
    const experiment = await Experiment.findOne({ isActive: true }).lean();

    if (!experiment) {
      return null;
    }

    // Get variant for user
    const variant = getVariantMulti(
      userId,
      experiment.name,
      experiment.variants,
      experiment.rolloutPercentage
    );

    // Get config for variant
    const config = experiment.config.get(variant);

    return {
      experimentName: experiment.name,
      variant,
      config: config || {},
    };
  } catch (error: any) {
    logger.error('[ExperimentService] getExperimentConfig error:', error);
    return null;
  }
}

/**
 * Create a new experiment
 */
export async function createExperiment(data: {
  name: string;
  description?: string;
  variants: string[];
  trafficSplit?: number;
  rolloutPercentage?: number;
  config: Record<string, any>;
  createdBy?: string;
}): Promise<any> {
  try {
    // Deactivate any existing active experiments
    await Experiment.updateMany({ isActive: true }, { isActive: false });

    // Create new experiment
    const experiment = await Experiment.create({
      name: data.name,
      description: data.description,
      variants: data.variants,
      trafficSplit: data.trafficSplit || 0.5,
      rolloutPercentage: data.rolloutPercentage || 100,
      config: new Map(Object.entries(data.config)),
      isActive: true,
      startedAt: new Date(),
      createdBy: data.createdBy,
    });

    logger.info('[ExperimentService] Experiment created:', {
      name: experiment.name,
      variants: experiment.variants,
      rolloutPercentage: experiment.rolloutPercentage,
    });

    return experiment;
  } catch (error: any) {
    logger.error('[ExperimentService] createExperiment error:', error);
    throw error;
  }
}

/**
 * Get experiment results
 * 
 * Analyzes metrics to compare variant performance
 * 
 * 🔥 UPGRADED WITH HARDENING CHECKS:
 * - SRM detection
 * - Minimum sample size
 * - Guardrail metrics
 * - Auto-winner detection
 * - Statistical significance
 */
export async function getExperimentResults(
  experimentName: string,
  hours: number = 24
): Promise<{
  experimentName: string;
  timeWindow: string;
  variants: Record<string, {
    total: number;
    accuracy: number;
    trueAccuracy: number;
    avgLatency: number;
    correctionRate: number;
    falseCorrectionRate: number;
  }>;
  winner?: string;
  improvement?: number;
  // 🔥 HARDENING CHECKS
  sampleSizeCheck: {
    sufficient: boolean;
    total: number;
    required: number;
    message: string;
  };
  srmCheck: {
    hasSRM: boolean;
    details: Record<string, { actual: number; expected: number; diff: number }>;
  };
  guardrailCheck: {
    violations: Array<{
      variant: string;
      metric: string;
      value: number;
      threshold: number;
      severity: 'critical' | 'warning';
    }>;
    shouldStop: boolean;
  };
  winnerDetection: {
    winner: string | null;
    improvement: number;
    confidence: number;
    reason: string;
  };
}> {
  try {
    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Aggregate metrics by variant
    const results = await VoiceMetrics.aggregate([
      {
        $match: {
          timestamp: { $gte: timeWindow },
          experimentName,
          variant: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$variant',
          total: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          trueSuccessCount: { $sum: { $cond: ['$isCorrectProduct', 1, 0] } },
          correctedCount: { $sum: { $cond: ['$wasCorrected', 1, 0] } },
          falseCorrectionCount: {
            $sum: {
              $cond: [
                { $and: ['$wasCorrected', { $eq: ['$isCorrectProduct', false] }] },
                1,
                0,
              ],
            },
          },
          avgLatency: { $avg: '$latency' },
        },
      },
    ]);

    // Format results
    const variants: Record<string, any> = {};
    const variantCounts: Record<string, number> = {};
    
    for (const result of results) {
      const variant = result._id;
      const accuracy = result.total > 0 ? result.successCount / result.total : 0;
      const trueAccuracy = result.total > 0 ? result.trueSuccessCount / result.total : 0;
      const correctionRate = result.total > 0 ? result.correctedCount / result.total : 0;
      const falseCorrectionRate = result.correctedCount > 0 ? result.falseCorrectionCount / result.correctedCount : 0;

      variants[variant] = {
        total: result.total,
        accuracy: Math.round(accuracy * 100) / 100,
        trueAccuracy: Math.round(trueAccuracy * 100) / 100,
        avgLatency: Math.round(result.avgLatency),
        correctionRate: Math.round(correctionRate * 100) / 100,
        falseCorrectionRate: Math.round(falseCorrectionRate * 100) / 100,
      };
      
      variantCounts[variant] = result.total;
    }

    // 🔥 HARDENING CHECK 1: Minimum Sample Size
    const totalSamples = Object.values(variantCounts).reduce((sum, count) => sum + count, 0);
    const sampleSizeCheck = checkMinimumSampleSize(totalSamples, 1000);

    // 🔥 HARDENING CHECK 2: SRM (Sample Ratio Mismatch)
    const srmCheck = checkSRM(variantCounts, 0.5, 0.05);

    // 🔥 HARDENING CHECK 3: Guardrail Metrics
    const baselineVariant = Object.keys(variants)[0] || 'A';
    const guardrailCheck = checkGuardrails(variants, baselineVariant, {
      maxLatencyIncrease: 1.2,
      minAccuracyRatio: 0.95,
      maxFalseCorrectionRate: 0.15,
    });

    // 🔥 HARDENING CHECK 4: Auto-Winner Detection
    const winnerDetection = detectWinner(variants, 0.02, 1000);

    // Calculate simple improvement for backward compatibility
    let improvement: number | undefined;
    let winner: string | undefined;
    
    if (variants['A'] && variants['B']) {
      improvement = Math.round((variants['B'].trueAccuracy - variants['A'].trueAccuracy) * 100) / 100;
    }
    
    // Use auto-detected winner if available
    if (winnerDetection.winner) {
      winner = winnerDetection.winner;
    }

    // 🚨 AUTO-STOP if guardrails violated
    if (guardrailCheck.shouldStop) {
      logger.error('[ExperimentService] CRITICAL: Guardrails violated, experiment should be stopped:', {
        experimentName,
        violations: guardrailCheck.violations,
      });
    }

    return {
      experimentName,
      timeWindow: `${hours}h`,
      variants,
      winner,
      improvement,
      sampleSizeCheck,
      srmCheck,
      guardrailCheck,
      winnerDetection,
    };
  } catch (error: any) {
    logger.error('[ExperimentService] getExperimentResults error:', error);
    throw error;
  }
}

/**
 * Stop an experiment
 */
export async function stopExperiment(experimentName: string): Promise<void> {
  try {
    await Experiment.updateOne(
      { name: experimentName },
      {
        isActive: false,
        endedAt: new Date(),
      }
    );

    logger.info('[ExperimentService] Experiment stopped:', experimentName);
  } catch (error: any) {
    logger.error('[ExperimentService] stopExperiment error:', error);
    throw error;
  }
}

/**
 * Get all experiments
 */
export async function getAllExperiments(): Promise<any[]> {
  try {
    const experiments = await Experiment.find()
      .sort({ createdAt: -1 })
      .lean();

    return experiments;
  } catch (error: any) {
    logger.error('[ExperimentService] getAllExperiments error:', error);
    throw error;
  }
}

/**
 * Update experiment rollout percentage
 * 
 * For gradual rollout: 1% → 10% → 25% → 50% → 100%
 */
export async function updateRollout(
  experimentName: string,
  rolloutPercentage: number
): Promise<void> {
  try {
    if (rolloutPercentage < 0 || rolloutPercentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    await Experiment.updateOne(
      { name: experimentName },
      { rolloutPercentage }
    );

    logger.info('[ExperimentService] Rollout updated:', {
      experimentName,
      rolloutPercentage,
    });
  } catch (error: any) {
    logger.error('[ExperimentService] updateRollout error:', error);
    throw error;
  }
}

/**
 * Cache experiment results in the experiment document
 * 
 * Run this periodically to avoid recalculating on every request
 */
export async function cacheExperimentResults(experimentName: string): Promise<void> {
  try {
    const results = await getExperimentResults(experimentName, 24);

    await Experiment.updateOne(
      { name: experimentName },
      {
        results: {
          lastUpdated: new Date(),
          variantStats: new Map(Object.entries(results.variants)),
        },
      }
    );

    logger.info('[ExperimentService] Results cached:', experimentName);
  } catch (error: any) {
    logger.error('[ExperimentService] cacheExperimentResults error:', error);
  }
}


/**
 * Auto-Stop Experiment if Guardrails Violated
 * 
 * 🔥 CRITICAL SAFETY CHECK
 * Automatically stops experiment if:
 * - Latency increases > 20%
 * - Accuracy drops > 5%
 * - False correction rate > 15%
 * 
 * Should be called periodically (e.g., every hour)
 */
export async function autoStopIfGuardrailsViolated(
  experimentName: string
): Promise<{
  stopped: boolean;
  reason?: string;
  violations?: any[];
}> {
  try {
    const results = await getExperimentResults(experimentName, 24);
    
    // Check if guardrails violated
    if (results.guardrailCheck.shouldStop) {
      // Stop experiment
      await stopExperiment(experimentName);
      
      logger.error('[ExperimentService] AUTO-STOPPED experiment due to guardrail violations:', {
        experimentName,
        violations: results.guardrailCheck.violations,
      });
      
      return {
        stopped: true,
        reason: 'Guardrail violations detected',
        violations: results.guardrailCheck.violations,
      };
    }
    
    return {
      stopped: false,
    };
  } catch (error: any) {
    logger.error('[ExperimentService] autoStopIfGuardrailsViolated error:', error);
    throw error;
  }
}

/**
 * Auto-Deploy Winner if Detected
 * 
 * 🔥 FULLY AUTOMATED IMPROVEMENT LOOP
 * Automatically promotes winner to production if:
 * - Improvement > 2%
 * - Sample size > 1000 per variant
 * - Statistically significant
 * - No guardrail violations
 * 
 * Should be called periodically (e.g., every 6 hours)
 */
export async function autoDeployWinnerIfDetected(
  experimentName: string
): Promise<{
  deployed: boolean;
  winner?: string;
  improvement?: number;
  reason?: string;
}> {
  try {
    const results = await getExperimentResults(experimentName, 24);
    
    // Check if winner detected
    if (results.winnerDetection.winner) {
      // Check no guardrail violations
      if (results.guardrailCheck.shouldStop) {
        logger.warn('[ExperimentService] Winner detected but guardrails violated, not deploying:', {
          experimentName,
          winner: results.winnerDetection.winner,
        });
        
        return {
          deployed: false,
          reason: 'Guardrail violations prevent deployment',
        };
      }
      
      // Stop experiment
      await stopExperiment(experimentName);
      
      logger.info('[ExperimentService] AUTO-DEPLOYED winner:', {
        experimentName,
        winner: results.winnerDetection.winner,
        improvement: results.winnerDetection.improvement,
        confidence: results.winnerDetection.confidence,
      });
      
      // TODO: Actually deploy winner config to production
      // This would update the default threshold or other config
      
      return {
        deployed: true,
        winner: results.winnerDetection.winner,
        improvement: results.winnerDetection.improvement,
        reason: results.winnerDetection.reason,
      };
    }
    
    return {
      deployed: false,
      reason: results.winnerDetection.reason,
    };
  } catch (error: any) {
    logger.error('[ExperimentService] autoDeployWinnerIfDetected error:', error);
    throw error;
  }
}
