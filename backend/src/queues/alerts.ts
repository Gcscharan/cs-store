/**
 * Queue Alert System
 * 
 * Monitors queue health and triggers alerts
 * Integrates with external alerting systems (Slack, PagerDuty, etc.)
 */

import { queueManager } from './queueManager';
import { workerManager } from './workerManager';
import { logger } from '../utils/logger';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Alert interface
 */
export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: any;
}

/**
 * Alert thresholds (configurable)
 */
export const ALERT_THRESHOLDS = {
  QUEUE_DEPTH_WARNING: 10000,
  QUEUE_DEPTH_CRITICAL: 50000,
  SUCCESS_RATE_WARNING: 0.95,
  SUCCESS_RATE_CRITICAL: 0.90,
  DLQ_SIZE_WARNING: 1000,
  DLQ_SIZE_CRITICAL: 5000,
  NO_ACTIVE_WORKERS: true,
  WORKER_CRASH_RATE: 0.1, // 10% of workers crashed
};

/**
 * Alert Rules
 */
export class AlertRules {
  /**
   * Check queue depth
   */
  static async checkQueueDepth(): Promise<Alert | null> {
    try {
      const health = await queueManager.healthCheck();
      
      for (const [queueName, metrics] of Object.entries(health.queues)) {
        const waiting = metrics.waiting;
        
        if (waiting > ALERT_THRESHOLDS.QUEUE_DEPTH_CRITICAL) {
          return {
            severity: AlertSeverity.CRITICAL,
            title: `Queue Depth Critical: ${queueName}`,
            message: `Queue ${queueName} has ${waiting} waiting jobs (threshold: ${ALERT_THRESHOLDS.QUEUE_DEPTH_CRITICAL})`,
            timestamp: new Date(),
            metadata: { queueName, waiting },
          };
        }
        
        if (waiting > ALERT_THRESHOLDS.QUEUE_DEPTH_WARNING) {
          return {
            severity: AlertSeverity.WARNING,
            title: `Queue Depth High: ${queueName}`,
            message: `Queue ${queueName} has ${waiting} waiting jobs (threshold: ${ALERT_THRESHOLDS.QUEUE_DEPTH_WARNING})`,
            timestamp: new Date(),
            metadata: { queueName, waiting },
          };
        }
      }
      
      return null;
    } catch (error: any) {
      logger.error('[AlertRules] Failed to check queue depth:', error.message);
      return null;
    }
  }

  /**
   * Check success rate
   */
  static async checkSuccessRate(): Promise<Alert | null> {
    try {
      const health = await queueManager.healthCheck();
      
      for (const [queueName, metrics] of Object.entries(health.queues)) {
        const total = metrics.completed + metrics.failed;
        
        if (total === 0) continue; // No data yet
        
        const successRate = metrics.completed / total;
        
        if (successRate < ALERT_THRESHOLDS.SUCCESS_RATE_CRITICAL) {
          return {
            severity: AlertSeverity.CRITICAL,
            title: `Success Rate Critical: ${queueName}`,
            message: `Queue ${queueName} has ${(successRate * 100).toFixed(1)}% success rate (threshold: ${(ALERT_THRESHOLDS.SUCCESS_RATE_CRITICAL * 100).toFixed(0)}%)`,
            timestamp: new Date(),
            metadata: { queueName, successRate, total },
          };
        }
        
        if (successRate < ALERT_THRESHOLDS.SUCCESS_RATE_WARNING) {
          return {
            severity: AlertSeverity.WARNING,
            title: `Success Rate Low: ${queueName}`,
            message: `Queue ${queueName} has ${(successRate * 100).toFixed(1)}% success rate (threshold: ${(ALERT_THRESHOLDS.SUCCESS_RATE_WARNING * 100).toFixed(0)}%)`,
            timestamp: new Date(),
            metadata: { queueName, successRate, total },
          };
        }
      }
      
      return null;
    } catch (error: any) {
      logger.error('[AlertRules] Failed to check success rate:', error.message);
      return null;
    }
  }

  /**
   * Check for active workers
   */
  static async checkActiveWorkers(): Promise<Alert | null> {
    try {
      const workerHealth = await workerManager.getHealth();
      
      if (workerHealth.workers.length === 0) {
        return {
          severity: AlertSeverity.CRITICAL,
          title: 'No Workers Initialized',
          message: 'No queue workers are initialized. Background jobs will not be processed.',
          timestamp: new Date(),
          metadata: {},
        };
      }

      for (const worker of workerHealth.workers) {
        if (!worker.isRunning || worker.isPaused) {
          return {
            severity: AlertSeverity.CRITICAL,
            title: `Worker Not Active: ${worker.name}`,
            message: `Queue worker ${worker.name} is ${worker.isPaused ? 'paused' : 'not running'}. Jobs will not be processed.`,
            timestamp: new Date(),
            metadata: { queueName: worker.name },
          };
        }
      }
      
      return null;
    } catch (error: any) {
      logger.error('[AlertRules] Failed to check active workers:', error.message);
      return null;
    }
  }

  /**
   * Check DLQ (Dead Letter Queue) size
   */
  static async checkDLQSize(): Promise<Alert | null> {
    try {
      const health = await queueManager.healthCheck();
      
      for (const [queueName, metrics] of Object.entries(health.queues)) {
        const failed = metrics.failed;
        
        if (failed > ALERT_THRESHOLDS.DLQ_SIZE_CRITICAL) {
          return {
            severity: AlertSeverity.CRITICAL,
            title: `DLQ Size Critical: ${queueName}`,
            message: `Queue ${queueName} has ${failed} failed jobs (threshold: ${ALERT_THRESHOLDS.DLQ_SIZE_CRITICAL})`,
            timestamp: new Date(),
            metadata: { queueName, failed },
          };
        }
        
        if (failed > ALERT_THRESHOLDS.DLQ_SIZE_WARNING) {
          return {
            severity: AlertSeverity.WARNING,
            title: `DLQ Size High: ${queueName}`,
            message: `Queue ${queueName} has ${failed} failed jobs (threshold: ${ALERT_THRESHOLDS.DLQ_SIZE_WARNING})`,
            timestamp: new Date(),
            metadata: { queueName, failed },
          };
        }
      }
      
      return null;
    } catch (error: any) {
      logger.error('[AlertRules] Failed to check DLQ size:', error.message);
      return null;
    }
  }

  /**
   * Run all alert checks
   */
  static async runAllChecks(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    const checks = [
      this.checkQueueDepth(),
      this.checkSuccessRate(),
      this.checkActiveWorkers(),
      this.checkDLQSize(),
    ];
    
    const results = await Promise.all(checks);
    
    for (const alert of results) {
      if (alert) {
        alerts.push(alert);
      }
    }
    
    return alerts;
  }
}

/**
 * Alert Manager
 * 
 * Manages alert delivery to external systems
 */
export class AlertManager {
  private alertHistory: Alert[] = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Send alert to external system
   * 
   * PRODUCTION: Implement actual integrations
   * - Slack webhook
   * - PagerDuty API
   * - Email
   * - SMS
   */
  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Log alert
      const logMethod = alert.severity === AlertSeverity.CRITICAL ? 'error' : 'warn';
      logger[logMethod]('[ALERT]', {
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
      });

      // Store in history
      this.alertHistory.push(alert);
      if (this.alertHistory.length > this.MAX_HISTORY) {
        this.alertHistory.shift();
      }

      // PRODUCTION: Send to external systems
      await this.sendToSlack(alert);
      
      if (alert.severity === AlertSeverity.CRITICAL) {
        await this.sendToPagerDuty(alert);
      }
    } catch (error: any) {
      logger.error('[AlertManager] Failed to send alert:', error.message);
    }
  }

  /**
   * Send alert to Slack
   * 
   * PRODUCTION: Implement Slack webhook
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      logger.debug('[AlertManager] Slack webhook not configured');
      return;
    }

    try {
      // TODO: Implement Slack webhook call
      logger.info('[AlertManager] Would send to Slack:', alert.title);
    } catch (error: any) {
      logger.error('[AlertManager] Failed to send to Slack:', error.message);
    }
  }

  /**
   * Send alert to PagerDuty
   * 
   * PRODUCTION: Implement PagerDuty API
   */
  private async sendToPagerDuty(alert: Alert): Promise<void> {
    const apiKey = process.env.PAGERDUTY_API_KEY;
    
    if (!apiKey) {
      logger.debug('[AlertManager] PagerDuty not configured');
      return;
    }

    try {
      // TODO: Implement PagerDuty API call
      logger.info('[AlertManager] Would send to PagerDuty:', alert.title);
    } catch (error: any) {
      logger.error('[AlertManager] Failed to send to PagerDuty:', error.message);
    }
  }

  /**
   * Get alert history
   */
  getHistory(): Alert[] {
    return [...this.alertHistory];
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
  }
}

/**
 * Alert Monitor
 * 
 * Runs periodic checks and sends alerts
 */
export class AlertMonitor {
  private intervalId?: NodeJS.Timeout;
  private alertManager: AlertManager;
  private readonly CHECK_INTERVAL = 60000; // 1 minute

  constructor() {
    this.alertManager = new AlertManager();
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('[AlertMonitor] Already running');
      return;
    }

    logger.info('[AlertMonitor] Starting alert monitoring...');
    
    // Run checks immediately
    this.runChecks();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, this.CHECK_INTERVAL);
    
    logger.info('[AlertMonitor] ✅ Alert monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('[AlertMonitor] Alert monitoring stopped');
    }
  }

  /**
   * Run alert checks
   */
  private async runChecks(): Promise<void> {
    try {
      const alerts = await AlertRules.runAllChecks();
      
      for (const alert of alerts) {
        await this.alertManager.sendAlert(alert);
      }
      
      if (alerts.length > 0) {
        logger.warn(`[AlertMonitor] ${alerts.length} alert(s) triggered`);
      }
    } catch (error: any) {
      logger.error('[AlertMonitor] Failed to run checks:', error.message);
    }
  }

  /**
   * Get alert manager
   */
  getAlertManager(): AlertManager {
    return this.alertManager;
  }
}

// Singleton instance
export const alertMonitor = new AlertMonitor();

export default alertMonitor;
