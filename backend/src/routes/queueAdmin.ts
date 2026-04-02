import express from 'express';
import { queueManager } from '../queues/queueManager';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Simple admin check middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * GET /admin/queues/failed/:queueName
 * 
 * Get failed jobs from DLQ
 */
router.get(
  '/failed/:queueName',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { queueName } = req.params;
      const start = parseInt(req.query.start as string) || 0;
      const end = parseInt(req.query.end as string) || 50;

      const failed = await queueManager.getFailedJobs(queueName, start, end);

      res.json({
        success: true,
        queue: queueName,
        failed,
        count: failed.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /admin/queues/retry/:queueName/:jobId
 * 
 * Retry a failed job
 */
router.post(
  '/retry/:queueName/:jobId',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { queueName, jobId } = req.params;

      await queueManager.retryJob(queueName, jobId);

      res.json({
        success: true,
        message: `Job ${jobId} retried`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /admin/queues/auto-retry
 * 
 * Trigger auto-retry of failed jobs
 */
router.post(
  '/auto-retry',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await queueManager.autoRetryFailedJobs();

      res.json({
        success: true,
        message: 'Auto-retry triggered',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
