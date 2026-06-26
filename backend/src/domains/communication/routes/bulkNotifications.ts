/**
 * Bulk Notification Routes
 *
 * Admin-only routes for bulk notification management.
 * Mounted at: /api/admin/notifications/bulk
 *
 * Requirement: R18 (Bulk Notification System), R22 (Security and Role Isolation)
 */

import express from "express";
import { authenticateToken, requireRole } from "../../../middleware/auth";
import {
  createBulkNotification,
  getBulkNotificationStatus,
  cancelBulkNotification,
} from "../controllers/bulkNotificationController";

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireRole(["admin"]));

// POST /api/admin/notifications/bulk — Create and start a bulk notification job
router.post("/", createBulkNotification);

// GET /api/admin/notifications/bulk/:jobId — Get job progress/status
router.get("/:jobId", getBulkNotificationStatus);

// POST /api/admin/notifications/bulk/:jobId/cancel — Cancel a running job
router.post("/:jobId/cancel", cancelBulkNotification);

export default router;
