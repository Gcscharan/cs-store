import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { verifyPayment } from '../controllers/verificationController';
import { getPaymentMetrics, resetPaymentMetrics } from '../controllers/metricsController';

/**
 * Payment Routes
 * 
 * Routes for payment-related operations including verification and metrics.
 * All routes require authentication to ensure only the order owner
 * can access payment information.
 * 
 * Requirements: TR-003, NFR-004
 */

const router = Router();

/**
 * GET /api/payments/verify/:orderId
 * 
 * Verify payment status for an order by checking with Razorpay API.
 * This endpoint is called by the mobile app during polling after
 * the user completes payment in their UPI app.
 * 
 * Authentication: Required (authenticateToken middleware)
 * Authorization: User must own the order
 * 
 * @param orderId - Order ID to verify (URL parameter)
 * @returns Payment verification response with status
 * 
 * Requirements: TR-003, BR-002
 */
router.get('/verify/:orderId', authenticateToken, verifyPayment);

/**
 * GET /api/payments/metrics
 * 
 * Get payment metrics summary for observability.
 * Tracks payment success rate, verification time, polling attempts, and webhook delivery.
 * 
 * Authentication: Required (authenticateToken middleware)
 * Note: In production, this should be protected by admin-only middleware
 * 
 * @returns Payment metrics summary
 * 
 * Requirements: NFR-004 (Observability)
 */
router.get('/metrics', authenticateToken, getPaymentMetrics);

/**
 * POST /api/payments/metrics/reset
 * 
 * Reset payment metrics (for testing/debugging).
 * 
 * Authentication: Required (authenticateToken middleware)
 * Note: In production, this should be protected by admin-only middleware
 * 
 * @returns Success message
 * 
 * Requirements: NFR-004 (Observability)
 */
router.post('/metrics/reset', authenticateToken, resetPaymentMetrics);

export default router;
