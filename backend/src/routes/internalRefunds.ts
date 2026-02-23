import express from "express";

import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import {
  getInternalRefundsByOrderId,
  postInternalRefunds,
} from "../domains/payments/controllers/internalRefunds.controller";

const router = express.Router();

router.post("/refunds", authenticateToken, requireRole(["admin"]), auditLog, postInternalRefunds);

router.get(
  "/refunds/:orderId",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getInternalRefundsByOrderId
);

export default router;
