import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  getPaymentHealth,
  getPaymentReadiness,
} from "../domains/payments/services/paymentHealthService";

const router = express.Router();

/**
 * GET /api/internal/payment-health
 * Point-in-time health of the payment subsystem. Admin-only.
 * Returns 503 when unhealthy so uptime checks can alert.
 */
router.get("/payment-health", authenticateToken, requireRole(["admin"]), async (_req, res) => {
  const health = await getPaymentHealth();
  res.status(health.status === "unhealthy" ? 503 : 200).json(health);
});

/**
 * GET /api/internal/payment-readiness
 * Readiness probe — can this instance accept new payment work?
 * Unauthenticated (called by orchestrators/load balancers); exposes only
 * boolean dependency state. 200 ready / 503 not-ready.
 */
router.get("/payment-readiness", async (_req, res) => {
  const readiness = await getPaymentReadiness();
  res.status(readiness.ready ? 200 : 503).json(readiness);
});

export default router;
