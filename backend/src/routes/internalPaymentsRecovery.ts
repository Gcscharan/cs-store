import express from "express";

import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { postPaymentRecoveryAction } from "../domains/payments/controllers/paymentRecovery.controller";

const router = express.Router();

router.post(
  "/recovery/:paymentIntentId/action",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  postPaymentRecoveryAction
);

export default router;
