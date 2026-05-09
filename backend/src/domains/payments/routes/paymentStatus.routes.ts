import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { getPaymentStatus } from '../controllers/paymentStatus.controller';

const router = Router();

// Auth required — only the order owner should see payment status
router.get('/:orderId', authenticateToken, getPaymentStatus);

export default router;
