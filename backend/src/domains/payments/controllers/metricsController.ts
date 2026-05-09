import { Request, Response } from 'express';
import { paymentMetricsService } from '../services/paymentMetricsService';
import { logger } from '../../../utils/logger';

/**
 * Payment Metrics Controller
 * 
 * Provides endpoints to query payment metrics for observability.
 * 
 * Requirements: NFR-004 (Observability)
 */

/**
 * Get payment metrics summary
 * 
 * @route GET /api/payments/metrics
 * @access Admin only (should be protected by admin middleware)
 * @returns Payment metrics summary
 */
export const getPaymentMetrics = async (req: Request, res: Response) => {
  try {
    const summary = paymentMetricsService.getMetricsSummary();
    
    logger.info('[PaymentMetrics] Metrics requested', {
      requestedBy: (req as any).user?._id?.toString(),
    });
    
    return res.json({
      success: true,
      metrics: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[PaymentMetrics] Error fetching metrics', {
      error: error.message,
      stack: error.stack,
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment metrics',
    });
  }
};

/**
 * Reset payment metrics (for testing/debugging)
 * 
 * @route POST /api/payments/metrics/reset
 * @access Admin only (should be protected by admin middleware)
 * @returns Success message
 */
export const resetPaymentMetrics = async (req: Request, res: Response) => {
  try {
    paymentMetricsService.reset();
    
    logger.info('[PaymentMetrics] Metrics reset', {
      resetBy: (req as any).user?._id?.toString(),
    });
    
    return res.json({
      success: true,
      message: 'Payment metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[PaymentMetrics] Error resetting metrics', {
      error: error.message,
      stack: error.stack,
    });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to reset payment metrics',
    });
  }
};
