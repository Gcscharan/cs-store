/**
 * Click Processor
 * 
 * Processes product click tracking jobs
 * 
 * CRITICAL RULES:
 * - High volume (must be fast)
 * - Simple insert (no complex logic)
 * - Idempotent (safe to retry)
 */

import { Job } from 'bullmq';
import ProductClick from '../../models/ProductClick';
import { normalize } from '../../utils/textUtils';
import { ClickJobData } from '../types';
import { classifyError, ErrorType } from '../utils/errorClassifier';
import { JobLogger } from '../utils/jobLogger';

/**
 * Process click job
 * 
 * Simple insert - no upsert needed
 * Clicks are append-only events
 */
export async function processClickJob(job: Job<ClickJobData>): Promise<void> {
  const startTime = Date.now();
  const { productId, productName, userId, query, isVoice, sessionId } = job.data;

  JobLogger.processing(job);

  try {
    // Validation
    if (!productId || !productName || !userId || !query) {
      throw new Error('INVALID_DATA');
    }

    // Create click record
    await ProductClick.create({
      productId,
      productName,
      userId,
      query: normalize(query),
      isVoice,
      timestamp: new Date(),
      sessionId,
    });

    const duration = Date.now() - startTime;

    JobLogger.completed(job, duration, { productId, userId });
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
