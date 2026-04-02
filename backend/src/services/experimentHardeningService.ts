/**
 * Experiment Hardening Service
 * 
 * Elite-level experiment validation and safety checks
 * Prevents false conclusions and broken experiments
 */

import { logger } from '../utils/logger';

/**
 * Sample Ratio Mismatch (SRM) Check
 * 
 * Detects if traffic split is biased
 * Even big companies fail here
 * 
 * @param variantCounts - { A: 1000, B: 1200 }
 * @param expectedSplit - 0.5 for 50/50
 * @param tolerance - 0.05 = 5% tolerance
 * @returns true if SRM detected (BAD)
 */
export function checkSRM(
  variantCounts: Record<string, number>,
  expectedSplit: number = 0.5,
  tolerance: number = 0.05
): {
  hasSRM: boolean;
  details: Record<string, { actual: number; expected: number; diff: number }>;
} {
  const variants = Object.keys(variantCounts);
  const total = Object.values(variantCounts).reduce((sum, count) => sum + count, 0);
  
  if (total === 0) {
    return { hasSRM: false, details: {} };
  }
  
  const details: Record<string, { actual: number; expected: number; diff: number }> = {};
  let hasSRM = false;
  
  for (const variant of variants) {
    const count = variantCounts[variant];
    const actualRatio = count / total;
    const expectedRatio = expectedSplit;
    const diff = Math.abs(actualRatio - expectedRatio);
    
    details[variant] = {
      actual: Math.round(actualRatio * 100) / 100,
      expected: Math.round(expectedRatio * 100) / 100,
      diff: Math.round(diff * 100) / 100,
    };
    
    // Check if difference exceeds tolerance
    if (diff > tolerance) {
      hasSRM = true;
    }
  }
  
  if (hasSRM) {
    logger.warn('[ExperimentHardening] SRM detected:', details);
  }
  
  return { hasSRM, details };
}

/**
 * Minimum Sample Size Check
 * 
 * Prevents declaring winner with insufficient data
 * 
 * @param total - Total sample size
 * @param minSampleSize - Minimum required (default: 1000)
 * @returns true if sample size is sufficient
 */
export function checkMinimumSampleSize(
  total: number,
  minSampleSize: number = 1000
): {
  sufficient: boolean;
  total: number;
  required: number;
  message: string;
} {
  const sufficient = total >= minSampleSize;
  
  return {
    sufficient,
    total,
    required: minSampleSize,
    message: sufficient
      ? 'Sample size sufficient'
      : `Need ${minSampleSize - total} more samples`,
  };
}

/**
 * Guardrail Metrics Check
 * 
 * Ensures experiment doesn't degrade critical metrics
 * 
 * @param variantMetrics - Metrics for each variant
 * @param baseline - Baseline metrics (usually variant A)
 * @param thresholds - Max allowed degradation
 * @returns Guardrail violations
 */
export function checkGuardrails(
  variantMetrics: Record<string, {
    accuracy: number;
    trueAccuracy: number;
    avgLatency: number;
    falseCorrectionRate?: number;
  }>,
  baseline: string,
  thresholds: {
    maxLatencyIncrease: number;      // e.g., 1.2 = 20% increase max
    minAccuracyRatio: number;        // e.g., 0.95 = 5% decrease max
    maxFalseCorrectionRate: number;  // e.g., 0.15 = 15% max
  } = {
    maxLatencyIncrease: 1.2,
    minAccuracyRatio: 0.95,
    maxFalseCorrectionRate: 0.15,
  }
): {
  violations: Array<{
    variant: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'critical' | 'warning';
  }>;
  shouldStop: boolean;
} {
  const violations: Array<{
    variant: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'critical' | 'warning';
  }> = [];
  
  const baselineMetrics = variantMetrics[baseline];
  if (!baselineMetrics) {
    logger.error('[ExperimentHardening] Baseline variant not found:', baseline);
    return { violations: [], shouldStop: false };
  }
  
  for (const [variant, metrics] of Object.entries(variantMetrics)) {
    if (variant === baseline) continue;
    
    // Check latency increase
    const latencyRatio = metrics.avgLatency / baselineMetrics.avgLatency;
    if (latencyRatio > thresholds.maxLatencyIncrease) {
      violations.push({
        variant,
        metric: 'latency',
        value: latencyRatio,
        threshold: thresholds.maxLatencyIncrease,
        severity: latencyRatio > thresholds.maxLatencyIncrease * 1.1 ? 'critical' : 'warning',
      });
    }
    
    // Check accuracy decrease
    const accuracyRatio = metrics.trueAccuracy / baselineMetrics.trueAccuracy;
    if (accuracyRatio < thresholds.minAccuracyRatio) {
      violations.push({
        variant,
        metric: 'accuracy',
        value: accuracyRatio,
        threshold: thresholds.minAccuracyRatio,
        severity: accuracyRatio < thresholds.minAccuracyRatio * 0.9 ? 'critical' : 'warning',
      });
    }
    
    // Check false correction rate
    if (metrics.falseCorrectionRate !== undefined) {
      if (metrics.falseCorrectionRate > thresholds.maxFalseCorrectionRate) {
        violations.push({
          variant,
          metric: 'falseCorrectionRate',
          value: metrics.falseCorrectionRate,
          threshold: thresholds.maxFalseCorrectionRate,
          severity: metrics.falseCorrectionRate > thresholds.maxFalseCorrectionRate * 1.2 ? 'critical' : 'warning',
        });
      }
    }
  }
  
  // Should stop if any critical violations
  const shouldStop = violations.some(v => v.severity === 'critical');
  
  if (violations.length > 0) {
    logger.warn('[ExperimentHardening] Guardrail violations:', violations);
  }
  
  return { violations, shouldStop };
}

/**
 * Statistical Significance Check
 * 
 * Simple z-test for proportions
 * 
 * @param variantA - { successes: 850, total: 1000 }
 * @param variantB - { successes: 890, total: 1000 }
 * @param confidenceLevel - 0.95 for 95% confidence
 * @returns true if difference is statistically significant
 */
export function checkStatisticalSignificance(
  variantA: { successes: number; total: number },
  variantB: { successes: number; total: number },
  confidenceLevel: number = 0.95
): {
  significant: boolean;
  pValue: number;
  zScore: number;
  confidenceLevel: number;
} {
  const pA = variantA.successes / variantA.total;
  const pB = variantB.successes / variantB.total;
  
  // Pooled proportion
  const pPool = (variantA.successes + variantB.successes) / (variantA.total + variantB.total);
  
  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / variantA.total + 1 / variantB.total));
  
  // Z-score
  const zScore = (pB - pA) / se;
  
  // P-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
  
  // Critical value for confidence level
  const alpha = 1 - confidenceLevel;
  const significant = pValue < alpha;
  
  return {
    significant,
    pValue: Math.round(pValue * 10000) / 10000,
    zScore: Math.round(zScore * 100) / 100,
    confidenceLevel,
  };
}

/**
 * Normal CDF approximation
 * Used for p-value calculation
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Auto-Winner Detection
 * 
 * Determines if we can declare a winner
 * 
 * @param variantMetrics - Metrics for each variant
 * @param minImprovement - Minimum improvement to declare winner (e.g., 0.02 = 2%)
 * @param minSampleSize - Minimum sample size per variant
 * @returns Winner info or null
 */
export function detectWinner(
  variantMetrics: Record<string, {
    total: number;
    accuracy: number;
    trueAccuracy: number;
    avgLatency: number;
  }>,
  minImprovement: number = 0.02,
  minSampleSize: number = 1000
): {
  winner: string | null;
  improvement: number;
  confidence: number;
  reason: string;
} {
  const variants = Object.keys(variantMetrics);
  
  // Check minimum sample size
  for (const variant of variants) {
    if (variantMetrics[variant].total < minSampleSize) {
      return {
        winner: null,
        improvement: 0,
        confidence: 0,
        reason: `Insufficient data (need ${minSampleSize} samples per variant)`,
      };
    }
  }
  
  // Find best variant by true accuracy
  let bestVariant: string | null = null;
  let bestAccuracy = 0;
  
  for (const [variant, metrics] of Object.entries(variantMetrics)) {
    if (metrics.trueAccuracy > bestAccuracy) {
      bestAccuracy = metrics.trueAccuracy;
      bestVariant = variant;
    }
  }
  
  if (!bestVariant) {
    return {
      winner: null,
      improvement: 0,
      confidence: 0,
      reason: 'No clear winner',
    };
  }
  
  // Calculate improvement over baseline (assume 'A' is baseline, fallback to first variant)
  const baseline = variants.includes('A') ? 'A' : variants[0];
  const baselineAccuracy = variantMetrics[baseline].trueAccuracy;
  const improvement = bestAccuracy - baselineAccuracy;
  
  // Check if improvement meets threshold
  if (improvement < minImprovement) {
    return {
      winner: null,
      improvement,
      confidence: 0,
      reason: `Improvement too small (${Math.round(improvement * 100)}% < ${Math.round(minImprovement * 100)}%)`,
    };
  }
  
  // Check statistical significance
  const sigTest = checkStatisticalSignificance(
    {
      successes: Math.round(variantMetrics[baseline].trueAccuracy * variantMetrics[baseline].total),
      total: variantMetrics[baseline].total,
    },
    {
      successes: Math.round(variantMetrics[bestVariant].trueAccuracy * variantMetrics[bestVariant].total),
      total: variantMetrics[bestVariant].total,
    }
  );
  
  if (!sigTest.significant) {
    return {
      winner: null,
      improvement,
      confidence: 1 - sigTest.pValue,
      reason: `Not statistically significant (p=${sigTest.pValue})`,
    };
  }
  
  return {
    winner: bestVariant,
    improvement,
    confidence: 1 - sigTest.pValue,
    reason: `Winner detected with ${Math.round((1 - sigTest.pValue) * 100)}% confidence`,
  };
}
