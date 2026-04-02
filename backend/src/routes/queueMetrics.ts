/**
 * Queue Metrics API Routes
 * 
 * Endpoints for monitoring queue system performance
 * Provides JSON and Prometheus format metrics
 */

import { Router, Request, Response } from 'express';
import { metricsCollector } from '../queues/metrics';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/metrics/queues
 * 
 * Get queue metrics in JSON format
 * 
 * Response:
 * {
 *   "queues": [...],
 *   "overall": {...},
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/queues', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.collectAllMetrics();
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    logger.error('[QueueMetrics] Failed to collect metrics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to collect queue metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/metrics/queues/:queueName
 * 
 * Get metrics for a specific queue
 */
router.get('/queues/:queueName', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const metrics = await metricsCollector.collectQueueMetrics(queueName);
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    logger.error(`[QueueMetrics] Failed to collect metrics for ${req.params.queueName}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to collect queue metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/metrics/queues/prometheus
 * 
 * Get queue metrics in Prometheus format
 * 
 * Response: text/plain with Prometheus metrics
 */
router.get('/queues/prometheus', async (req: Request, res: Response) => {
  try {
    const prometheusMetrics = await metricsCollector.getPrometheusMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(prometheusMetrics);
  } catch (error: any) {
    logger.error('[QueueMetrics] Failed to generate Prometheus metrics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Prometheus metrics',
      message: error.message,
    });
  }
});

export default router;
