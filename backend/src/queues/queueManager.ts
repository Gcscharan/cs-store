/**
 * Queue Manager
 * 
 * Central manager for all BullMQ queues
 * Handles queue initialization, job addition, and health checks
 */

import { Queue, QueueOptions, JobsOptions, Job } from 'bullmq';
import { queueConnectionConfig, checkQueueRedisHealth } from '../config/queueRedis';
import { logger } from '../utils/logger';
import {
  QueueName,
  QueueHealth,
  CorrectionJobData,
  ClickJobData,
  SyncJobData,
} from './types';
import {
  generateCorrectionJobId,
  generateClickJobId,
  generateSyncJobId,
} from './utils/idempotency';

/**
 * Default job options for all queues
 */
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: {
    count: 100,      // Keep last 100 completed jobs
    age: 24 * 3600,  // Keep for 24 hours
  },
  removeOnFail: {
    count: 1000,     // Keep last 1000 failed jobs
    age: 7 * 24 * 3600, // Keep for 7 days
  },
};

/**
 * Queue configuration
 */
const queueConfig: QueueOptions = {
  connection: queueConnectionConfig.connection,
  defaultJobOptions,
};

/**
 * Queue-specific configurations with limiters
 */
const queueConfigs: Record<string, any> = {
  [QueueName.CORRECTIONS]: {
    ...queueConfig,
    limiter: {
      max: 500,      // Max 500 jobs
      duration: 1000, // Per second
    },
  },
  [QueueName.CLICKS]: {
    ...queueConfig,
    limiter: {
      max: 1000,     // Higher limit for clicks (simpler operations)
      duration: 1000,
    },
  },
  [QueueName.SYNC]: {
    ...queueConfig,
    limiter: {
      max: 100,      // Lower limit for sync (batch operations)
      duration: 1000,
    },
  },
};

class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize all queues
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[QueueManager] Already initialized');
      return;
    }

    try {
      logger.info('[QueueManager] Initializing queues...');

      // Check Redis health first
      const health = await checkQueueRedisHealth();
      if (!health.healthy) {
        throw new Error(`Redis unhealthy: ${health.error}`);
      }

      // Create queues
      this.createQueue(QueueName.CORRECTIONS);
      this.createQueue(QueueName.CLICKS);
      this.createQueue(QueueName.SYNC);

      this.initialized = true;
      logger.info('[QueueManager] ✅ All queues initialized');
      logger.info(`[QueueManager] Queues: ${Array.from(this.queues.keys()).join(', ')}`);
    } catch (error: any) {
      logger.error('[QueueManager] ❌ Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a queue
   */
  private createQueue(name: QueueName): void {
    if (this.queues.has(name)) {
      logger.warn(`[QueueManager] Queue ${name} already exists`);
      return;
    }

    // Use queue-specific config with limiter
    const config = queueConfigs[name] || queueConfig;
    const queue = new Queue(name, config);

    // Queue event listeners
    queue.on('error', (error) => {
      logger.error(`[QueueManager][${name}] Error:`, error.message);
    });

    queue.on('waiting', (job: any) => {
      logger.debug(`[QueueManager][${name}] Job ${job.id} waiting`);
    });

    this.queues.set(name, queue);
    logger.info(`[QueueManager] Created queue: ${name}`);
  }

  /**
   * Get a queue by name
   */
  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found. Did you call initialize()?`);
    }
    return queue;
  }

  /**
   * Generic method to add a job to any queue
   * 
   * INCLUDES BACKPRESSURE PROTECTION
   */
  async addJob(
    queueName: string,
    data: any,
    options?: JobsOptions
  ): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // 🚨 BACKPRESSURE: Check queue depth before adding
    const MAX_QUEUE_SIZE = 50000;
    const counts = await queue.getJobCounts('waiting');
    
    if (counts.waiting > MAX_QUEUE_SIZE) {
      logger.error(`[QueueManager] Queue ${queueName} overloaded: ${counts.waiting} waiting jobs`);
      throw new Error('QUEUE_OVERLOADED');
    }

    const job = await queue.add('process', data, options);
    logger.info(`[QueueManager] Job added to ${queueName}: ${job.id}`);
    return job;
  }

  /**
   * Add a correction job
   */
  async addCorrectionJob(
    data: CorrectionJobData,
    options?: JobsOptions
  ): Promise<Job<CorrectionJobData>> {
    const queue = this.getQueue(QueueName.CORRECTIONS);
    
    // Generate deterministic job ID (prevents duplicates)
    const jobId = generateCorrectionJobId(data.userId, data.wrong, data.correct);
    
    const job = await queue.add('process-correction', data, {
      ...options,
      jobId,
    });

    logger.info(`[QueueManager] Correction job added: ${job.id}`);
    return job;
  }

  /**
   * Add a click job
   */
  async addClickJob(
    data: ClickJobData,
    options?: JobsOptions
  ): Promise<Job<ClickJobData>> {
    const queue = this.getQueue(QueueName.CLICKS);
    
    // Generate deterministic job ID
    const jobId = generateClickJobId(data.userId, data.productId, data.timestamp);
    
    const job = await queue.add('process-click', data, {
      ...options,
      jobId,
    });

    logger.info(`[QueueManager] Click job added: ${job.id}`);
    return job;
  }

  /**
   * Add a sync job
   */
  async addSyncJob(
    data: SyncJobData,
    options?: JobsOptions
  ): Promise<Job<SyncJobData>> {
    const queue = this.getQueue(QueueName.SYNC);
    
    // Generate deterministic job ID
    const jobId = generateSyncJobId(data.userId, data.timestamp);
    
    const job = await queue.add('process-sync', data, {
      ...options,
      jobId,
    });

    logger.info(`[QueueManager] Sync job added: ${job.id}`);
    return job;
  }

  /**
   * Get queue health status
   */
  async healthCheck(): Promise<QueueHealth> {
    try {
      // Check Redis health
      const redisHealth = await checkQueueRedisHealth();

      // Get metrics for each queue
      const queueMetrics: QueueHealth['queues'] = {};

      for (const [name, queue] of this.queues) {
        const counts = await queue.getJobCounts();
        queueMetrics[name] = {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          workers: 0, // Will be updated by worker manager
        };

        // 🚨 METRICS LOGGING: Poor man's monitoring
        logger.info('[QUEUE_METRIC]', {
          queue: name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          failed: counts.failed || 0,
          completed: counts.completed || 0,
        });
      }

      // Determine overall status
      let status: QueueHealth['status'] = 'healthy';
      
      if (!redisHealth.healthy) {
        status = 'unhealthy';
      } else {
        // Check if any queue has too many waiting jobs
        for (const metrics of Object.values(queueMetrics)) {
          if (metrics.waiting > 10000) {
            status = 'degraded';
            break;
          }
        }
      }

      return {
        status,
        queues: queueMetrics,
        redis: {
          connected: redisHealth.healthy,
          error: redisHealth.error,
        },
      };
    } catch (error: any) {
      logger.error('[QueueManager] Health check failed:', error.message);
      return {
        status: 'unhealthy',
        queues: {},
        redis: {
          connected: false,
          error: error.message,
        },
      };
    }
  }

  /**
   * Get simplified health status (for health endpoint)
   */
  async getHealth(): Promise<{
    healthy: boolean;
    queues: Array<{ name: string; waiting: number; active: number; failed: number }>;
  }> {
    try {
      const health = await this.healthCheck();
      
      const queues = Object.entries(health.queues).map(([name, metrics]) => ({
        name,
        waiting: metrics.waiting,
        active: metrics.active,
        failed: metrics.failed,
      }));
      
      return {
        healthy: health.status === 'healthy',
        queues,
      };
    } catch (error) {
      return {
        healthy: false,
        queues: [],
      };
    }
  }

  /**
   * Get failed jobs from a queue (DLQ access)
   */
  async getFailedJobs(queueName: string, start = 0, end = 50): Promise<any[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failed = await queue.getFailed(start, end);
    return failed.map((job) => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }));
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    logger.info(`[QueueManager] Job ${jobId} retried`);
  }

  /**
   * Auto-retry failed jobs (runs periodically)
   */
  async autoRetryFailedJobs(): Promise<void> {
    for (const [name, queue] of this.queues) {
      try {
        const failed = await queue.getFailed(0, 50);
        
        for (const job of failed) {
          // 🚨 SAFETY: Don't retry permanent/validation errors
          const errorType = this.classifyJobError(job.failedReason);
          if (errorType === 'PERMANENT' || errorType === 'VALIDATION') {
            logger.warn(`[QueueManager] Skipping auto-retry for ${job.id}: ${errorType} error`);
            continue;
          }

          // Only retry if attempts < 5
          if (job.attemptsMade < 5) {
            await job.retry();
            logger.info(`[QueueManager] Auto-retried job ${job.id} from ${name}`);
          }
        }
      } catch (error: any) {
        logger.error(`[QueueManager] Auto-retry failed for ${name}:`, error.message);
      }
    }
  }

  /**
   * Classify job error (simple version for DLQ)
   */
  private classifyJobError(failedReason?: string): 'TRANSIENT' | 'PERMANENT' | 'VALIDATION' {
    if (!failedReason) return 'PERMANENT';

    const reason = failedReason.toLowerCase();

    // Validation errors
    if (reason.includes('invalid_data') || reason.includes('validation')) {
      return 'VALIDATION';
    }

    // Transient errors
    if (reason.includes('network') || reason.includes('timeout') || reason.includes('connection')) {
      return 'TRANSIENT';
    }

    // Default: permanent
    return 'PERMANENT';
  }

  /**
   * Check if queue system is healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await this.healthCheck();
    return health.status === 'healthy';
  }

  /**
   * Close all queues
   */
  async close(): Promise<void> {
    logger.info('[QueueManager] Closing all queues...');

    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
        logger.info(`[QueueManager] Closed queue: ${name}`);
      } catch (error: any) {
        logger.error(`[QueueManager] Error closing queue ${name}:`, error.message);
      }
    }

    this.queues.clear();
    this.initialized = false;
    logger.info('[QueueManager] ✅ All queues closed');
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const queueManager = new QueueManager();

export default queueManager;
