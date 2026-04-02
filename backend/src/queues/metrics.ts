/**
 * Queue Metrics Collector
 * 
 * Collects and aggregates metrics from BullMQ queues
 * Provides data for monitoring, alerting, and dashboards
 */

import { Queue } from 'bullmq';
import { queueManager } from './queueManager';
import { workerManager } from './workerManager';
import { QueueName } from './types';
import { logger } from '../utils/logger';

/**
 * Queue metrics interface
 */
export interface QueueMetrics {
  name: string;
  depth: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  rates: {
    completedRate: number;  // jobs/sec
    failedRate: number;     // jobs/sec
    processingRate: number; // jobs/sec
  };
  latency: {
    avgWaitTime: number;    // ms
    avgProcessTime: number; // ms
  };
  workers: {
    active: number;
    idle: number;
    total: number;
  };
}

/**
 * System-wide metrics
 */
export interface SystemMetrics {
  queues: QueueMetrics[];
  overall: {
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    totalWorkers: number;
    successRate: number;
    avgLatency: number;
  };
  timestamp: Date;
}

/**
 * Metrics history for rate calculation
 */
interface MetricsSnapshot {
  timestamp: number;
  completed: number;
  failed: number;
  active: number;
}

class MetricsCollector {
  private history: Map<string, MetricsSnapshot[]> = new Map();
  private readonly HISTORY_SIZE = 60; // Keep last 60 snapshots (1 minute at 1s intervals)

  /**
   * Collect metrics for a single queue
   */
  async collectQueueMetrics(queueName: string): Promise<QueueMetrics> {
    try {
      const queue = queueManager.getQueue(queueName as QueueName);
      
      // Get job counts
      const counts = await queue.getJobCounts();
      
      // Get worker metrics
      const workerHealth = await workerManager.getHealth();
      const worker = workerHealth.workers.find(w => w.name === queueName);
      const workerMetrics = {
        active: worker?.isRunning && !worker?.isPaused ? 1 : 0,
        idle: worker?.isRunning && worker?.isPaused ? 1 : 0,
        total: worker ? 1 : 0,
      };

      // Calculate rates
      const rates = this.calculateRates(queueName, counts);

      // Calculate latency (simplified - would need job timing data for accuracy)
      const latency = await this.calculateLatency(queue);

      return {
        name: queueName,
        depth: {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: counts.paused || 0,
        },
        rates,
        latency,
        workers: workerMetrics,
      };
    } catch (error: any) {
      logger.error(`[MetricsCollector] Failed to collect metrics for ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Collect metrics for all queues
   */
  async collectAllMetrics(): Promise<SystemMetrics> {
    try {
      const queueNames = queueManager.getQueueNames();
      
      // Collect metrics for each queue
      const queueMetrics = await Promise.all(
        queueNames.map(name => this.collectQueueMetrics(name))
      );

      // Calculate overall metrics
      const overall = this.calculateOverallMetrics(queueMetrics);

      return {
        queues: queueMetrics,
        overall,
        timestamp: new Date(),
      };
    } catch (error: any) {
      logger.error('[MetricsCollector] Failed to collect all metrics:', error.message);
      throw error;
    }
  }

  /**
   * Calculate rates (jobs/sec) for a queue
   */
  private calculateRates(queueName: string, counts: any): QueueMetrics['rates'] {
    const now = Date.now();
    const snapshot: MetricsSnapshot = {
      timestamp: now,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      active: counts.active || 0,
    };

    // Get or create history for this queue
    if (!this.history.has(queueName)) {
      this.history.set(queueName, []);
    }

    const history = this.history.get(queueName)!;
    history.push(snapshot);

    // Keep only recent history
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }

    // Calculate rates if we have enough history (at least 2 snapshots)
    if (history.length < 2) {
      return {
        completedRate: 0,
        failedRate: 0,
        processingRate: 0,
      };
    }

    // Compare with snapshot from 10 seconds ago (or oldest available)
    const oldSnapshot = history[Math.max(0, history.length - 10)];
    const timeDiff = (now - oldSnapshot.timestamp) / 1000; // seconds

    const completedDiff = snapshot.completed - oldSnapshot.completed;
    const failedDiff = snapshot.failed - oldSnapshot.failed;
    const processingDiff = completedDiff + failedDiff;

    return {
      completedRate: Math.max(0, completedDiff / timeDiff),
      failedRate: Math.max(0, failedDiff / timeDiff),
      processingRate: Math.max(0, processingDiff / timeDiff),
    };
  }

  /**
   * Calculate latency metrics for a queue
   * 
   * NOTE: This is simplified. For accurate latency:
   * - Track job timestamps in job data
   * - Calculate wait time = processedOn - timestamp
   * - Calculate process time = finishedOn - processedOn
   */
  private async calculateLatency(queue: Queue): Promise<QueueMetrics['latency']> {
    try {
      // Sample recent completed jobs
      const completed = await queue.getCompleted(0, 10);
      
      if (completed.length === 0) {
        return {
          avgWaitTime: 0,
          avgProcessTime: 0,
        };
      }

      let totalWaitTime = 0;
      let totalProcessTime = 0;
      let validSamples = 0;

      for (const job of completed) {
        if (job.timestamp && job.processedOn && job.finishedOn) {
          const waitTime = job.processedOn - job.timestamp;
          const processTime = job.finishedOn - job.processedOn;
          
          totalWaitTime += waitTime;
          totalProcessTime += processTime;
          validSamples++;
        }
      }

      if (validSamples === 0) {
        return {
          avgWaitTime: 0,
          avgProcessTime: 0,
        };
      }

      return {
        avgWaitTime: totalWaitTime / validSamples,
        avgProcessTime: totalProcessTime / validSamples,
      };
    } catch (error: any) {
      logger.error('[MetricsCollector] Failed to calculate latency:', error.message);
      return {
        avgWaitTime: 0,
        avgProcessTime: 0,
      };
    }
  }

  /**
   * Calculate overall system metrics
   */
  private calculateOverallMetrics(queueMetrics: QueueMetrics[]): SystemMetrics['overall'] {
    let totalWaiting = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalWorkers = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const queue of queueMetrics) {
      totalWaiting += queue.depth.waiting;
      totalActive += queue.depth.active;
      totalCompleted += queue.depth.completed;
      totalFailed += queue.depth.failed;
      totalWorkers += queue.workers.total;

      if (queue.latency.avgProcessTime > 0) {
        totalLatency += queue.latency.avgProcessTime;
        latencyCount++;
      }
    }

    const totalProcessed = totalCompleted + totalFailed;
    const successRate = totalProcessed > 0 ? totalCompleted / totalProcessed : 1;
    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;

    return {
      totalWaiting,
      totalActive,
      totalCompleted,
      totalFailed,
      totalWorkers,
      successRate,
      avgLatency,
    };
  }

  /**
   * Get metrics in Prometheus format (optional)
   * 
   * Example output:
   * ```
   * # HELP queue_waiting_jobs Number of waiting jobs
   * # TYPE queue_waiting_jobs gauge
   * queue_waiting_jobs{queue="corrections"} 42
   * ```
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      const metrics = await this.collectAllMetrics();
      const lines: string[] = [];

      // Queue depth metrics
      lines.push('# HELP queue_waiting_jobs Number of waiting jobs');
      lines.push('# TYPE queue_waiting_jobs gauge');
      for (const queue of metrics.queues) {
        lines.push(`queue_waiting_jobs{queue="${queue.name}"} ${queue.depth.waiting}`);
      }

      lines.push('# HELP queue_active_jobs Number of active jobs');
      lines.push('# TYPE queue_active_jobs gauge');
      for (const queue of metrics.queues) {
        lines.push(`queue_active_jobs{queue="${queue.name}"} ${queue.depth.active}`);
      }

      lines.push('# HELP queue_failed_jobs Number of failed jobs');
      lines.push('# TYPE queue_failed_jobs gauge');
      for (const queue of metrics.queues) {
        lines.push(`queue_failed_jobs{queue="${queue.name}"} ${queue.depth.failed}`);
      }

      // Rate metrics
      lines.push('# HELP queue_processing_rate Jobs processed per second');
      lines.push('# TYPE queue_processing_rate gauge');
      for (const queue of metrics.queues) {
        lines.push(`queue_processing_rate{queue="${queue.name}"} ${queue.rates.processingRate.toFixed(2)}`);
      }

      // Latency metrics
      lines.push('# HELP queue_avg_latency_ms Average processing latency in milliseconds');
      lines.push('# TYPE queue_avg_latency_ms gauge');
      for (const queue of metrics.queues) {
        lines.push(`queue_avg_latency_ms{queue="${queue.name}"} ${queue.latency.avgProcessTime.toFixed(2)}`);
      }

      // Worker metrics
      lines.push('# HELP queue_workers_total Total number of workers');
      lines.push('# TYPE queue_workers_total gauge');
      for (const queue of metrics.queues) {
        lines.push(`queue_workers_total{queue="${queue.name}"} ${queue.workers.total}`);
      }

      // Overall metrics
      lines.push('# HELP system_success_rate Overall success rate');
      lines.push('# TYPE system_success_rate gauge');
      lines.push(`system_success_rate ${metrics.overall.successRate.toFixed(4)}`);

      return lines.join('\n');
    } catch (error: any) {
      logger.error('[MetricsCollector] Failed to generate Prometheus metrics:', error.message);
      throw error;
    }
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.history.clear();
    logger.info('[MetricsCollector] Metrics history cleared');
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

export default metricsCollector;
