/**
 * Bull Board Dashboard
 * 
 * Visual monitoring interface for BullMQ queues
 * Provides real-time queue metrics, job inspection, and management
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Request, Response, NextFunction } from 'express';
import { queueManager } from './queueManager';
import { QueueName } from './types';
import { logger } from '../utils/logger';

/**
 * Authentication middleware for Bull Board
 * 
 * PRODUCTION: Replace with real authentication
 * Options:
 * - JWT token validation
 * - Session-based auth
 * - OAuth integration
 * - API key validation
 */
export const bullBoardAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Check for admin authentication
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin authentication required',
    });
    return;
  }

  // Extract token
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  // PRODUCTION: Validate JWT token or session
  // For now, check against admin secret
  const adminSecret = process.env.BULL_BOARD_ADMIN_SECRET || 'admin-secret-change-in-production';
  
  if (token !== adminSecret) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid admin credentials',
    });
    return;
  }

  // Admin authenticated
  logger.info('[BullBoard] Admin access granted');
  next();
};

/**
 * Initialize Bull Board dashboard
 * 
 * Returns Express adapter that can be mounted in app
 */
export function initializeBullBoard(): ExpressAdapter {
  try {
    logger.info('[BullBoard] Initializing dashboard...');

    // Create Express adapter
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    // Get all queues from queue manager
    const correctionQueue = queueManager.getQueue(QueueName.CORRECTIONS);
    const clickQueue = queueManager.getQueue(QueueName.CLICKS);
    const syncQueue = queueManager.getQueue(QueueName.SYNC);

    // Create Bull Board with all queues
    createBullBoard({
      queues: [
        new BullMQAdapter(correctionQueue),
        new BullMQAdapter(clickQueue),
        new BullMQAdapter(syncQueue),
      ],
      serverAdapter,
    });

    logger.info('[BullBoard] ✅ Dashboard initialized');
    logger.info('[BullBoard] Access at: /admin/queues');
    
    return serverAdapter;
  } catch (error: any) {
    logger.error('[BullBoard] ❌ Initialization failed:', error.message);
    throw error;
  }
}

/**
 * Get dashboard router with authentication
 * 
 * Usage in app.ts:
 * ```
 * import { getDashboardRouter } from './queues/dashboard';
 * app.use('/admin/queues', getDashboardRouter());
 * ```
 */
export function getDashboardRouter() {
  const serverAdapter = initializeBullBoard();
  const router = serverAdapter.getRouter();
  
  // Apply authentication to all dashboard routes
  router.use(bullBoardAuth);
  
  return router;
}

export default {
  initializeBullBoard,
  getDashboardRouter,
  bullBoardAuth,
};
