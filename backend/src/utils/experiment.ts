/**
 * Experiment Utilities
 * 
 * Deterministic user bucketing for A/B testing
 * 
 * CRITICAL RULES:
 * - Same user always gets same variant (no flickering)
 * - Deterministic (hash-based, not random)
 * - Production-safe (no state required)
 */

import crypto from 'crypto';

/**
 * Get variant for a user in an experiment
 * 
 * Uses SHA256 hash for deterministic bucketing
 * Same user + experiment = same variant always
 * 
 * @param userId - User ID
 * @param experimentName - Experiment name
 * @param trafficSplit - Split ratio (default: 0.5 = 50/50)
 * @param rolloutPercentage - Gradual rollout (default: 100 = full rollout)
 * @returns Variant ('A' or 'B')
 */
export function getVariant(
  userId: string,
  experimentName: string,
  trafficSplit: number = 0.5,
  rolloutPercentage: number = 100
): string {
  // Generate deterministic hash
  const hash = crypto
    .createHash('sha256')
    .update(userId + experimentName)
    .digest('hex');

  // Convert first 8 chars to number (0-4294967295)
  const hashNum = parseInt(hash.substring(0, 8), 16);
  
  // Get bucket (0-99)
  const bucket = hashNum % 100;

  // Check if user is in rollout
  if (bucket >= rolloutPercentage) {
    return 'A'; // Default variant (control)
  }

  // Split traffic between variants
  const splitBucket = hashNum % 100;
  const splitThreshold = trafficSplit * 100;

  return splitBucket < splitThreshold ? 'A' : 'B';
}

/**
 * Get variant with custom variants array
 * 
 * Supports more than 2 variants
 * 
 * @param userId - User ID
 * @param experimentName - Experiment name
 * @param variants - Array of variant names (e.g., ['control', 'v1', 'v2'])
 * @param rolloutPercentage - Gradual rollout
 * @returns Variant name
 */
export function getVariantMulti(
  userId: string,
  experimentName: string,
  variants: string[],
  rolloutPercentage: number = 100
): string {
  if (variants.length === 0) {
    throw new Error('Variants array cannot be empty');
  }

  if (variants.length === 1) {
    return variants[0];
  }

  // Generate deterministic hash
  const hash = crypto
    .createHash('sha256')
    .update(userId + experimentName)
    .digest('hex');

  const hashNum = parseInt(hash.substring(0, 8), 16);
  const bucket = hashNum % 100;

  // Check if user is in rollout
  if (bucket >= rolloutPercentage) {
    return variants[0]; // Default to first variant (control)
  }

  // Distribute evenly across variants
  const variantIndex = hashNum % variants.length;
  return variants[variantIndex];
}

/**
 * Check if user is in experiment
 * 
 * @param userId - User ID
 * @param experimentName - Experiment name
 * @param rolloutPercentage - Rollout percentage
 * @returns true if user is in experiment
 */
export function isUserInExperiment(
  userId: string,
  experimentName: string,
  rolloutPercentage: number
): boolean {
  const hash = crypto
    .createHash('sha256')
    .update(userId + experimentName)
    .digest('hex');

  const hashNum = parseInt(hash.substring(0, 8), 16);
  const bucket = hashNum % 100;

  return bucket < rolloutPercentage;
}

/**
 * Calculate expected distribution
 * 
 * Useful for validating bucketing logic
 * 
 * @param userIds - Array of user IDs
 * @param experimentName - Experiment name
 * @param trafficSplit - Split ratio
 * @param rolloutPercentage - Rollout percentage
 * @returns Distribution stats
 */
export function calculateDistribution(
  userIds: string[],
  experimentName: string,
  trafficSplit: number = 0.5,
  rolloutPercentage: number = 100
): {
  A: number;
  B: number;
  notInExperiment: number;
  total: number;
} {
  let countA = 0;
  let countB = 0;
  let notInExperiment = 0;

  for (const userId of userIds) {
    const hash = crypto
      .createHash('sha256')
      .update(userId + experimentName)
      .digest('hex');

    const hashNum = parseInt(hash.substring(0, 8), 16);
    const bucket = hashNum % 100;

    if (bucket >= rolloutPercentage) {
      notInExperiment++;
      continue;
    }

    const variant = getVariant(userId, experimentName, trafficSplit, rolloutPercentage);
    if (variant === 'A') {
      countA++;
    } else {
      countB++;
    }
  }

  return {
    A: countA,
    B: countB,
    notInExperiment,
    total: userIds.length,
  };
}
