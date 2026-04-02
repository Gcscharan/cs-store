/**
 * Feature Flags API
 * 
 * GET  /api/config/feature-flags     → returns current flags for mobile
 * PUT  /api/admin/feature-flags      → admin updates flags (kill-switches)
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";
import { authenticateToken as requireAuth } from "../middleware/auth";

const router = Router();

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// ── In-memory flag store (production: use Redis/DB) ──
let flags: Record<string, boolean> = {
  socketEnabled: true,
  paymentRecovery: true,
  realtimeTracking: true,
  offlineQueue: true,
  kycEnabled: true,
  upiVerificationRequired: true,
  sentryEnabled: true,
};

/**
 * GET /api/config/feature-flags
 * Public — returns current flag values for mobile clients
 */
router.get("/config/feature-flags", (req: Request, res: Response) => {
  res.json({ flags, updatedAt: new Date().toISOString() });
});

/**
 * PUT /api/admin/feature-flags
 * Admin only — update flag values (kill-switches)
 * SECURITY: Requires authenticated admin user
 */
router.put("/admin/feature-flags", requireAuth, requireAdmin, (req: Request, res: Response) => {
  const updates = req.body;

  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ error: "Body must be an object of flag key-value pairs" });
  }

  const changed: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (key in flags && typeof value === "boolean") {
      const old = flags[key];
      flags[key] = value;
      if (old !== value) {
        changed.push(`${key}: ${old} → ${value}`);
      }
    }
  }

  if (changed.length > 0) {
    logger.admin("Feature flags updated", {
      changes: changed,
      updatedBy: (req as any).user?._id || "unknown",
    });
  }

  res.json({ flags, changed, updatedAt: new Date().toISOString() });
});

export default router;
