/**
 * Correction Processor
 * 
 * Processes voice correction jobs
 * 
 * CRITICAL RULES:
 * - Must be idempotent (safe to retry)
 * - Must use upsert (no race conditions)
 * - Must classify errors (don't retry bad data)
 * - Must be fast (< 100ms)
 */

import { Job } from 'bullmq';
import VoiceCorrection from '../../models/VoiceCorrection';
import { normalize } from '../../utils/textUtils';
import { CorrectionJobData } from '../types';
import { classifyError, ErrorType } from '../utils/errorClassifier';
import { JobLogger, LogLevel, JobEvent } from '../utils/jobLogger';

/**
 * Process correction job
 * 
 * Uses MongoDB upsert to avoid race conditions
 * Safe to retry - idempotent operation
 */
export async function processCorrectionJob(
  job: Job<CorrectionJobData>
): Promise<void> {
  const startTime = Date.now();
  const { wrong, correct, productId, userId, confidence } = job.data;

  // Log processing started
  JobLogger.processing(job);

  try {
    // Validation
    if (!wrong || !correct || !productId) {
      throw new Error('INVALID_DATA');
    }

    // Normalize
    const wrongNorm = normalize(wrong);
    const correctNorm = normalize(correct);

    // Additional validation
    if (wrongNorm === correctNorm) {
      throw new Error('INVALID_DATA');
    }
    if (wrongNorm.length < 3) {
      throw new Error('INVALID_DATA');
    }

    // Upsert with atomic operations
    // This is race-condition safe - multiple workers can run this simultaneously
    await VoiceCorrection.updateOne(
      {
        wrong: wrongNorm,
        userId: userId || null,
      },
      {
        // Set on insert only (first time)
        $setOnInsert: {
          correct: correctNorm,
          productId,
          source: userId ? 'user' : 'global',
          createdAt: new Date(),
          validationScore: 0.8,
        },
        // Always increment count
        $inc: { count: 1 },
        // Take max confidence (improve over time)
        $max: { confidence: confidence || 0.7 },
        // Update last used
        $set: {
          lastUsed: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const duration = Date.now() - startTime;

    // Log success
    JobLogger.completed(job, duration, {
      wrong: wrongNorm,
      correct: correctNorm,
      userId: userId || 'global',
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorType = classifyError(error);

    // Log failure
    JobLogger.failed(job, error, duration);

    // Don't retry validation errors
    if (errorType === ErrorType.VALIDATION) {
      JobLogger.dropped(job, 'Validation error');
      return; // Job completes (won't retry)
    }

    // 🚨 FIX: Don't retry permanent errors either
    if (errorType === ErrorType.PERMANENT) {
      JobLogger.dropped(job, 'Permanent error - not retrying');
      return; // Job completes (won't retry)
    }

    // Throw for transient errors only (will retry based on queue config)
    JobLogger.retry(job, `Transient error: ${error.message}`);
    throw error;
  }
}
