import express from "express";
 
import { authenticateToken, requireRole } from "../../../middleware/auth";
import { auditLog } from "../../../middleware/auditLog";
import { paymentVerificationController } from "../controllers/paymentVerification.controller";

const router = express.Router();

router.get(
  "/verify",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  paymentVerificationController
);

export default router;
