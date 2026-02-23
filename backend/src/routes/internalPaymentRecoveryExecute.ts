import express from "express";

import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { postPaymentRecoveryExecute } from "../domains/payments/controllers/paymentRecoveryExecute.controller";

const router = express.Router();

router.post(
  "/recovery-execute/:paymentIntentId",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  postPaymentRecoveryExecute
);

export default router;
