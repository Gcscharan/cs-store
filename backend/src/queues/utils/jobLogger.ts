/**
 * Job Logger Utility
 * 
 * Standardized logging for queue jobs
 * Provides structured logs with request tracing
 */

import { Job } from 'bullmq';
import { logger } from '../../utils/logger';

/**
 * Log levels
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * Job lifecycle events
 */
export enum JobEvent {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
  DROPPED = 'DROPPED',
}

/**
 * Structured log entry
 */
interface LogEntry {
  level: LogLevel;
  event: JobEvent;
  jobId: string;
  queueName: string;
  requestId?: string;
  duration?: number;
  attemptsMade?: number;
  data?: any;
  error?: string;
  timestamp: string;
}

/**
 * Job Logger
 */
export class JobLogger {
  /**
   * Log job lifecycle event
   */
  static log(
    level: LogLevel,
    event: JobEvent,
    job: Job,
    additionalData?: any
  ): void {
    const entry: LogEntry = {
      level,
      event,
      jobId: job.id || 'unknown',
      queueName: job.queueName,
      requestId: job.data?.requestId,
      attemptsMade: job.attemptsMade,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    const message = `[QUEUE][${job.queueName}][${event}]`;

    switch (level) {
      case LogLevel.INFO:
        logger.info(message, entry);
        break;
      case LogLevel.WARN:
        logger.warn(message, entry);
        break;
      case LogLevel.ERROR:
        logger.error(message, entry);
        break;
      case LogLevel.DEBUG:
        logger.debug(message, entry);
        break;
    }
  }

  /**
   * Log job queued
   */
  static queued(job: Job, data?: any): void {
    this.log(LogLevel.INFO, JobEvent.QUEUED, job, { data });
  }

  /**
   * Log job processing started
   */
  static processing(job: Job): void {
    this.log(LogLevel.INFO, JobEvent.PROCESSING, job);
  }

  /**
   * Log job completed
   */
  static completed(job: Job, duration: number, result?: any): void {
    this.log(LogLevel.INFO, JobEvent.COMPLETED, job, {
      duration,
      result,
    });
  }

  /**
   * Log job failed
   */
  static failed(job: Job, error: Error, duration: number): void {
    this.log(LogLevel.ERROR, JobEvent.FAILED, job, {
      duration,
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Log job retry
   */
  static retry(job: Job, reason: string): void {
    this.log(LogLevel.WARN, JobEvent.RETRY, job, {
      reason,
    });
  }

  /**
   * Log job dropped (won't retry)
   */
  static dropped(job: Job, reason: string): void {
    this.log(LogLevel.WARN, JobEvent.DROPPED, job, {
      reason,
    });
  }

  /**
   * Log performance metrics
   */
  static performance(
    queueName: string,
    metrics: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      avgProcessTime?: number;
    }
  ): void {
    logger.info('[QUEUE_METRIC]', {
      queue: queueName,
      ...metrics,
      timestamp: new Date().toISOString(),
    });
  }
}

export default JobLogger;
