import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  getNotificationHealth,
  getNotificationHealthHistory,
  getNotificationReadiness,
} from "../domains/communication/services/notificationHealthService";

const router = express.Router();

/**
 * GET /api/internal/notification-health
 *
 * Real-time health model for the notification subsystem (outbox, push, receipts,
 * redis). For ops dashboards, uptime probes, and on-call triage.
 *
 * Returns HTTP 200 when healthy/degraded, 503 when overall status is unhealthy
 * so external uptime checks can alert.
 *
 * Admin-only.
 */
router.get(
  "/notification-health",
  authenticateToken,
  requireRole(["admin"]),
  async (_req, res) => {
    const health = await getNotificationHealth();
    const httpStatus = health.status === "unhealthy" ? 503 : 200;
    res.status(httpStatus).json(health);
  }
);

/**
 * GET /api/internal/notification-health/history?hours=24
 *
 * Trend statistics over a rolling window (avg/min/max score, recoveries,
 * escalations, peak backlog) from periodic snapshots written by the
 * RecoveryManager. Gives operators trend context, not just a point-in-time view.
 *
 * Admin-only.
 */
router.get(
  "/notification-health/history",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    const hoursRaw = Number(req.query.hours);
    const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 && hoursRaw <= 168 ? hoursRaw : 24;
    const history = await getNotificationHealthHistory(hours);
    res.status(200).json(history);
  }
);

/**
 * GET /api/internal/notification-readiness
 *
 * Readiness probe — "can this instance accept new notification work?". Distinct
 * from health. Returns 200 when ready, 503 when not, suited to k8s/Railway
 * readiness probes and blue-green cutover gates.
 *
 * NOTE: intentionally NOT admin-gated — readiness probes are called by
 * orchestrators/load balancers without auth. It exposes only boolean dependency
 * state, no sensitive data.
 */
router.get("/notification-readiness", async (_req, res) => {
  const readiness = await getNotificationReadiness();
  res.status(readiness.ready ? 200 : 503).json(readiness);
});

export default router;
