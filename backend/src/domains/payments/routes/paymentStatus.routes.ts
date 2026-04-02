import { Router } from 'express';
import { getPaymentStatus } from '../controllers/paymentStatus.controller';

const router = Router();

router.get('/:orderId', getPaymentStatus);

export default router;
