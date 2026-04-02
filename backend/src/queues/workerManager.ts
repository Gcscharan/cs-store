/**
 * Worker Manager
 * 
 * Manages BullMQ workers that consume jobs from queues
 * 
 * RESPONSIBILITIES:
 * - Start/stop workers
 * - Connect workers to processors
 * - Handle graceful shutdown
 * - Monitor worker health
 * - Auto-restart on crash
 */

import { Worker, WorkerOptions } from 'bullmq';
import { queueRedisConnection } from '../config/queueRedis';
import { processCorrectionJob } from './processors/correctionProcessor';
import { processClickJob } from './processors/clickProcessor';
import { processSyncJob } from './processors/syncProcessor';
import { QueueName } from './types';

export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private isShuttingDown = false;

  /**
   * Start all workers (with staggered startup to prevent DB spike)
   */
  async start(): Promise<void> {
    console.log('[WORKER_MANAGER] Starting workers...');

    try {
      // Get concurrency from env (default: 10)
      const concurrency = parseInt(process.env.QUEUE_WORKER_CONCURRENCY || '10', 10);

      // 🚨 COLD START PROTECTION: Stagger worker startup
      const workerConfigs = [
        { 
          name: QueueName.CORRECTIONS, 
          processor: processCorrectionJob,
          concurrency,
          delay: 0, // Start immediately
          limiter: { max: 100, duration: 1000 },
        },
        { 
          name: QueueName.CLICKS, 
          processor: processClickJob,
          concurrency: concurrency * 2,
          delay: 2000, // Wait 2 seconds
          limiter: { max: 200, duration: 1000 },
        },
        { 
          name: QueueName.SYNC, 
          processor: processSyncJob,
          concurrency: Math.max(5, Math.floor(concurrency / 2)),
          delay: 4000, // Wait 4 seconds
          limiter: { max: 50, duration: 1000 },
        },
      ];

      // Start workers with delays
      for (const config of workerConfigs) {
        setTimeout(() => {
          this.startWorker(config.name, config.processor, {
            concurrency: config.concurrency,
            limiter: config.limiter,
          });
          console.log(`[WORKER_MANAGER] Worker ${config.name} started after ${config.delay}ms delay`);
        }, config.delay);
      }

      console.log('[WORKER_MANAGER] All workers scheduled (staggered startup)');
    } catch (error) {
      console.error('[WORKER_MANAGER] Failed to start workers:', error);
      throw error;
    }
  }

  /**
   * Start a single worker
   */
  private async startWorker(
    queueName: string,
    processor: (job: any) => Promise<void>,
    options: Partial<WorkerOptions> = {}
  ): Promise<void> {
    const workerOptions: WorkerOptions = {
      connection: queueRedisConnection,
      concurrency: options.concurrency || 10,
      limiter: options.limiter,
      // Stalled job handling
      lockDuration: 30000, // 30 seconds
      stalledInterval: 5000, // Check every 5 seconds
      maxStalledCount: 3, // Move to failed after 3 stalls
    };

    const worker = new Worker(queueName, processor, workerOptions);

    // Event: Job completed
    worker.on('completed', (job) => {
      console.log(`[WORKER][${queueName}][COMPLETED]`, {
        jobId: job.id,
        duration: Date.now() - job.processedOn!,
      });
    });

    // Event: Job failed
    worker.on('failed', (job, error) => {
      console.error(`[WORKER][${queueName}][FAILED]`, {
        jobId: job?.id,
        error: error.message,
        attemptsMade: job?.attemptsMade,
        attemptsLeft: (job?.opts.attempts || 3) - (job?.attemptsMade || 0),
      });
    });

    // Event: Worker error
    worker.on('error', (error) => {
      console.error(`[WORKER][${queueName}][ERROR]`, {
        error: error.message,
      });

      // Auto-restart on crash (if not shutting down)
      if (!this.isShuttingDown) {
        console.log(`[WORKER][${queueName}][RESTART] Restarting worker...`);
        setTimeout(() => {
          this.restartWorker(queueName, processor, options);
        }, 5000); // Wait 5 seconds before restart
      }
    });

    // Event: Worker stalled
    worker.on('stalled', (jobId) => {
      console.warn(`[WORKER][${queueName}][STALLED]`, {
        jobId,
        message: 'Job stalled - will be retried',
      });
    });

    // Event: Worker active
    worker.on('active', (job) => {
      console.log(`[WORKER][${queueName}][ACTIVE]`, {
        jobId: job.id,
        data: job.data,
      });
    });

    this.workers.set(queueName, worker);
    console.log(`[WORKER_MANAGER] Worker started: ${queueName} (concurrency: ${workerOptions.concurrency})`);
  }

  /**
   * Restart a worker
   */
  private async restartWorker(
    queueName: string,
    processor: (job: any) => Promise<void>,
    options: Partial<WorkerOptions> = {}
  ): Promise<void> {
    try {
      // Close existing worker
      const existingWorker = this.workers.get(queueName);
      if (existingWorker) {
        await existingWorker.close();
        this.workers.delete(queueName);
      }

      // Start new worker
      await this.startWorker(queueName, processor, options);
      console.log(`[WORKER_MANAGER] Worker restarted: ${queueName}`);
    } catch (error) {
      console.error(`[WORKER_MANAGER] Failed to restart worker ${queueName}:`, error);
    }
  }

  /**
   * Stop all workers (graceful shutdown)
   */
  async stop(): Promise<void> {
    console.log('[WORKER_MANAGER] Stopping workers...');
    this.isShuttingDown = true;

    const stopPromises = Array.from(this.workers.entries()).map(
      async ([queueName, worker]) => {
        try {
          console.log(`[WORKER_MANAGER] Stopping worker: ${queueName}`);
          await worker.close();
          console.log(`[WORKER_MANAGER] Worker stopped: ${queueName}`);
        } catch (error) {
          console.error(`[WORKER_MANAGER] Error stopping worker ${queueName}:`, error);
        }
      }
    );

    await Promise.all(stopPromises);
    this.workers.clear();
    console.log('[WORKER_MANAGER] All workers stopped');
  }

  /**
   * Get worker health status
   */
  async getHealth(): Promise<{
    healthy: boolean;
    workers: Array<{
      name: string;
      isRunning: boolean;
      isPaused: boolean;
    }>;
  }> {
    const workerStatuses = await Promise.all(
      Array.from(this.workers.entries()).map(async ([name, worker]) => ({
        name,
        isRunning: worker.isRunning(),
        isPaused: await worker.isPaused(),
      }))
    );

    const healthy = workerStatuses.every((w) => w.isRunning && !w.isPaused);

    return {
      healthy,
      workers: workerStatuses,
    };
  }

  /**
   * Pause all workers
   */
  async pauseAll(): Promise<void> {
    console.log('[WORKER_MANAGER] Pausing all workers...');
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.pause())
    );
    console.log('[WORKER_MANAGER] All workers paused');
  }

  /**
   * Resume all workers
   */
  async resumeAll(): Promise<void> {
    console.log('[WORKER_MANAGER] Resuming all workers...');
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.resume())
    );
    console.log('[WORKER_MANAGER] All workers resumed');
  }
}

// Singleton instance
export const workerManager = new WorkerManager();
