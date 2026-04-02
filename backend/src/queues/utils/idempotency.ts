/**
 * Idempotency Utilities
 * 
 * Ensures jobs can be safely retried without duplicate data
 */

import crypto from 'crypto';

/**
 * Generate deterministic job ID
 * Same input = same ID = prevents duplicates
 */
export function generateJobId(prefix: string, ...parts: string[]): string {
  const hash = crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .substring(0, 16);
  
  return `${prefix}:${hash}`;
}

/**
 * Generate correction job ID
 */
export function generateCorrectionJobId(
  userId: string | undefined,
  wrong: string,
  correct: string
): string {
  return generateJobId(
    'correction',
    userId || 'global',
    wrong.toLowerCase(),
    correct.toLowerCase()
  );
}

/**
 * Generate click job ID
 */
export function generateClickJobId(
  userId: string,
  productId: string,
  timestamp: number
): string {
  // Include timestamp to allow multiple clicks on same product
  return generateJobId('click', userId, productId, timestamp.toString());
}

/**
 * Generate sync job ID
 */
export function generateSyncJobId(userId: string, timestamp: number): string {
  return generateJobId('sync', userId, timestamp.toString());
}
