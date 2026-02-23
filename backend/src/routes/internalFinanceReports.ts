import express from "express";

import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { getFinanceHealthHandler } from "../domains/finance/controllers/internalFinanceHealth.controller";
import {
  getGatewayPerformanceCsvHandler,
  getGatewayPerformanceHandler,
  getNetRevenueCsvHandler,
  getNetRevenueHandler,
  getRefundLedgerCsvHandler,
  getRefundLedgerHandler,
  getRevenueLedgerCsvHandler,
  getRevenueLedgerHandler,
} from "../domains/finance/controllers/internalFinanceReports.controller";

const router = express.Router();

router.get(
  "/health",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getFinanceHealthHandler
);

router.get(
  "/revenue-ledger",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRevenueLedgerHandler
);

router.get(
  "/revenue-ledger.csv",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRevenueLedgerCsvHandler
);

router.get(
  "/refund-ledger",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRefundLedgerHandler
);

router.get(
  "/refund-ledger.csv",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRefundLedgerCsvHandler
);

router.get(
  "/net-revenue",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getNetRevenueHandler
);

router.get(
  "/net-revenue.csv",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getNetRevenueCsvHandler
);

router.get(
  "/gateway-performance",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getGatewayPerformanceHandler
);

router.get(
  "/gateway-performance.csv",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getGatewayPerformanceCsvHandler
);

export default router;
