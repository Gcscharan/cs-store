import express from "express";

import {
  getPaymentsReconciliationCsvHandler,
  getPaymentsReconciliationHandler,
} from "../domains/payments/controllers/paymentsReconciliation.controller";
import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";

const router = express.Router();

router.get(
  "/reconciliation",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getPaymentsReconciliationHandler
);

router.get(
  "/reconciliation.csv",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getPaymentsReconciliationCsvHandler
);

export default router;
