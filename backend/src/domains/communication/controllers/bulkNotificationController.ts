/**
 * Bulk Notification Controller
 *
 * Admin-only endpoints for managing bulk notification jobs.
 *
 * Endpoints:
 * - POST /api/admin/notifications/bulk — Create and start a bulk job
 * - GET /api/admin/notifications/bulk/:jobId — Get job progress/status
 * - POST /api/admin/notifications/bulk/:jobId/cancel — Cancel a running job
 *
 * Requirement: R18 (Bulk Notification System)
 */

import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../../../middleware/auth";
import { logger } from "../../../utils/logger";
import {
  createAndStartBulkJob,
  getBulkJobStatus,
  cancelBulkJob,
} from "../services/bulkDispatcher";

const VALID_CATEGORIES = ["order", "delivery", "payment", "account", "promo"] as const;
const VALID_SEGMENTS = ["all_customers", "all_delivery_partners", "all_admins", "custom"] as const;

/**
 * POST /api/admin/notifications/bulk
 *
 * Creates and starts a new bulk notification job.
 * Requires admin role.
 */
export const createBulkNotification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const { title, body, category, deepLink, targetSegment, customFilter } = req.body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ message: "Title is required" });
      return;
    }

    if (!body || typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ message: "Body is required" });
      return;
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({
        message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
      return;
    }

    if (!targetSegment || !VALID_SEGMENTS.includes(targetSegment)) {
      res.status(400).json({
        message: `Target segment must be one of: ${VALID_SEGMENTS.join(", ")}`,
      });
      return;
    }

    if (targetSegment === "custom" && (!customFilter || typeof customFilter !== "object")) {
      res.status(400).json({
        message: "Custom filter is required when target segment is 'custom'",
      });
      return;
    }

    const job = await createAndStartBulkJob({
      title: title.trim(),
      body: body.trim(),
      category,
      deepLink: deepLink ? String(deepLink).trim() : undefined,
      targetSegment,
      customFilter: targetSegment === "custom" ? customFilter : undefined,
      createdBy: userId,
    });

    logger.info("[BulkNotificationController] Bulk job created", {
      jobId: job._id.toString(),
      targetSegment,
      totalUsers: job.progress.total,
      createdBy: userId,
    });

    res.status(201).json({
      message: "Bulk notification job created and started",
      job: {
        id: job._id.toString(),
        title: job.title,
        body: job.body,
        category: job.category,
        deepLink: job.deepLink,
        targetSegment: job.targetSegment,
        status: job.status,
        progress: job.progress,
        createdBy: job.createdBy.toString(),
        createdAt: job.createdAt,
      },
    });
  } catch (err) {
    logger.error("[BulkNotificationController] Failed to create bulk job", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /api/admin/notifications/bulk/:jobId
 *
 * Returns the current status and progress of a bulk notification job.
 * Requires admin role.
 */
export const getBulkNotificationStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { jobId } = req.params;

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      res.status(400).json({ message: "Invalid job ID" });
      return;
    }

    const job = await getBulkJobStatus(jobId);
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    res.status(200).json({
      job: {
        id: (job as any)._id.toString(),
        title: job.title,
        body: job.body,
        category: job.category,
        deepLink: job.deepLink,
        targetSegment: job.targetSegment,
        status: job.status,
        progress: job.progress,
        createdBy: job.createdBy.toString(),
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (err) {
    logger.error("[BulkNotificationController] Failed to get job status", {
      error: err instanceof Error ? err.message : String(err),
      jobId: req.params?.jobId,
    });
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/admin/notifications/bulk/:jobId/cancel
 *
 * Cancels a bulk notification job that is pending or processing.
 * Requires admin role.
 */
export const cancelBulkNotification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { jobId } = req.params;

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      res.status(400).json({ message: "Invalid job ID" });
      return;
    }

    const result = await cancelBulkJob(jobId);

    if (!result.success) {
      res.status(400).json({ message: result.message });
      return;
    }

    logger.info("[BulkNotificationController] Bulk job cancelled", {
      jobId,
      cancelledBy: req.user?._id?.toString(),
    });

    res.status(200).json({
      message: result.message,
      jobId,
    });
  } catch (err) {
    logger.error("[BulkNotificationController] Failed to cancel job", {
      error: err instanceof Error ? err.message : String(err),
      jobId: req.params?.jobId,
    });
    res.status(500).json({ message: "Internal server error" });
  }
};
