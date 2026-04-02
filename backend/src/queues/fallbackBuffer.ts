/**
 * Fallback Buffer
 * 
 * Buffers jobs when queue is unavailable
 * Retries when queue becomes healthy
 * 
 * SAFER than direct DB writes
 */

import { logger } from '../utils/logger';
import { queueManager } from './queueManager';

interface BufferedJob {
  queueName: string;
  data: any;
  options?: any;
  timestamp: number;
}

class FallbackBuffer {
  private buffer: BufferedJob[] = [];
  private maxSize = 10000; // Max buffered jobs
  private retryInterval: NodeJS.Timeout | null = null;

  /**
   * Add job to buffer
   */
  add(queueName: string, data: any, options?: any): boolean {
    if (this.buffer.length >= this.maxSize) {
      logger.error('[FallbackBuffer] Buffer full, dropping job', {
        bufferSize: this.buffer.length,
        maxSize: this.maxSize,
      });
      return false; // Buffer full
    }

    this.buffer.push({
      queueName,
      data,
      options,
      timestamp: Date.now(),
    });

    logger.warn('[FallbackBuffer] Job buffered:', {
      queueName,
      bufferSize: this.buffer.length,
    });

    // 🚨 CRASH RECOVERY: Persist to disk
    this.persistToDisk({ queueName, data, options, timestamp: Date.now() });

    return true; // Successfully buffered
  }

  /**
   * Persist job to disk for crash recovery
   */
  private persistToDisk(job: BufferedJob): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(process.cwd(), 'fallback-buffer.log');
      
      fs.appendFileSync(logPath, JSON.stringify(job) + '\n');
    } catch (error: any) {
      logger.error('[FallbackBuffer] Failed to persist to disk:', error.message);
    }
  }

  /**
   * Start retry loop
   */
  start(): void {
    if (this.retryInterval) {
      return;
    }

    this.retryInterval = setInterval(async () => {
      await this.flush();
    }, 5000); // Try every 5 seconds

    logger.info('[FallbackBuffer] Retry loop started');
  }

  /**
   * Flush buffer to queue
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Check if queue is healthy
    const healthy = await queueManager.isHealthy();
    if (!healthy) {
      logger.warn('[FallbackBuffer] Queue still unhealthy, keeping buffer');
      return;
    }

    logger.info(`[FallbackBuffer] Flushing ${this.buffer.length} jobs...`);

    const jobs = [...this.buffer];
    this.buffer = [];

    for (const job of jobs) {
      try {
        await queueManager.addJob(job.queueName, job.data, job.options);
        logger.info('[FallbackBuffer] Job flushed:', { queueName: job.queueName });
      } catch (error: any) {
        logger.error('[FallbackBuffer] Failed to flush job:', error.message);
        // Re-add to buffer
        this.buffer.push(job);
      }
    }

    logger.info(`[FallbackBuffer] Flush complete. Remaining: ${this.buffer.length}`);
  }

  /**
   * Stop retry loop
   */
  stop(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }
}

// Singleton
export const fallbackBuffer = new FallbackBuffer();
