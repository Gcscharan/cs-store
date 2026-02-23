import express from "express";
 
import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { getPaymentRecoverySuggestion } from "../domains/payments/controllers/paymentRecoverySuggestion.controller";

const router = express.Router();

router.get(
  "/recovery-suggestion",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getPaymentRecoverySuggestion
);

export default router;
