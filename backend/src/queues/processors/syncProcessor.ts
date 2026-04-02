/**
 * Sync Processor
 * 
 * Processes user data sync jobs
 * 
 * CRITICAL RULES:
 * - Batch operations (multiple corrections at once)
 * - Use transactions for consistency
 * - Idempotent (safe to retry)
 */

import { Job } from 'bullmq';
import VoiceCorrection from '../../models/VoiceCorrection';
import { SyncJobData } from '../types';
import { classifyError, ErrorType } from '../utils/errorClassifier';
import { JobLogger } from '../utils/jobLogger';

/**
 * Process sync job
 * 
 * Syncs user corrections to backend
 * Uses bulk operations for performance
 */
export async function processSyncJob(job: Job<SyncJobData>): Promise<void> {
  const startTime = Date.now();
  const { userId, corrections } = job.data;

  JobLogger.processing(job);

  try {
    // Validation
    if (!userId) {
      throw new Error('INVALID_DATA');
    }

    if (!corrections || !Array.isArray(corrections)) {
      throw new Error('INVALID_DATA');
    }

    // Skip if no corrections to sync
    if (corrections.length === 0) {
      JobLogger.log(
        JobLogger.constructor.name === 'JobLogger' ? 'INFO' as any : 0,
        'COMPLETED' as any,
        job,
        { reason: 'No corrections to sync' }
      );
      return;
    }

    // Prepare bulk operations
    const bulkOps = corrections.map((corr) => ({
      updateOne: {
        filter: {
          wrong: corr.wrong,
          userId,
        },
        update: {
          $setOnInsert: {
            correct: corr.correct,
            productId: corr.productId,
            source: 'user' as const,
            createdAt: new Date(),
          },
          $inc: { count: 1 },
          $max: { confidence: corr.confidence || 0.7 },
          $set: {
            validationScore: corr.validationScore || 0.8,
            lastUsed: new Date(corr.lastUsed || Date.now()),
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    // Execute bulk operation
    const result = await VoiceCorrection.bulkWrite(bulkOps);

    const duration = Date.now() - startTime;

    JobLogger.completed(job, duration, {
      userId,
      corrections: corrections.length,
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorType = classifyError(error);

    JobLogger.failed(job, error, duration);

    // Don't retry validation errors
    if (errorType === ErrorType.VALIDATION) {
      JobLogger.dropped(job, 'Validation error');
      return;
    }

    // 🚨 FIX: Don't retry permanent errors
    if (errorType === ErrorType.PERMANENT) {
      JobLogger.dropped(job, 'Permanent error - not retrying');
      return;
    }

    // Throw for transient errors only
    JobLogger.retry(job, `Transient error: ${error.message}`);
    throw error;
  }
}
