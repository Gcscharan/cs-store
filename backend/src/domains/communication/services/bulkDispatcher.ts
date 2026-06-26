/**
 * Bulk Dispatcher Service
 *
 * Handles sending notifications to large user segments (all customers,
 * all delivery partners, all admins, or custom filters).
 *
 * Features:
 * - Processes users in batches of 100 with 1-second delay between batches
 * - Checks individual user preferences before sending (skips if category disabled)
 * - Supports mid-execution cancellation
 * - Tracks progress (total, sent, failed)
 *
 * Requirement: R18 (Bulk Notification System)
 */

import mongoose from "mongoose";
import { User, IUser } from "../../../models/User";
import Notification from "../../../models/Notification";
import BulkNotificationJob, {
  IBulkNotificationJob,
  TargetSegment,
  BulkJobStatus,
} from "../../../models/BulkNotificationJob";
import { logger } from "../../../utils/logger";

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1000;

/**
 * In-memory set of job IDs that have been cancelled.
 * Checked between batches to stop processing quickly.
 */
const cancelledJobs = new Set<string>();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds a MongoDB query filter for the target user segment.
 */
function buildSegmentFilter(
  segment: TargetSegment,
  customFilter?: Record<string, any>
): Record<string, any> {
  const baseFilter: Record<string, any> = { isDeleted: { $ne: true } };

  switch (segment) {
    case "all_customers":
      return { ...baseFilter, role: "customer" };
    case "all_delivery_partners":
      return { ...baseFilter, role: "delivery" };
    case "all_admins":
      return { ...baseFilter, role: "admin" };
    case "custom":
      return { ...baseFilter, ...(customFilter || {}) };
    default:
      return baseFilter;
  }
}

/**
 * Maps notification category to the user preference key for push/in-app channels.
 */
const categoryToPreferenceKey: Record<string, string> = {
  order: "myOrders",
  delivery: "myOrders",
  payment: "silentPay",
  account: "feedback",
  promo: "newOffers",
};

/**
 * Checks if a user has the given notification category enabled.
 * Returns true if the user should receive the notification.
 * Defaults to enabled if no preferences are set.
 */
function isUserCategoryEnabled(
  user: Pick<IUser, "notificationPreferences">,
  category: string
): boolean {
  const prefs = user.notificationPreferences;
  if (!prefs || Object.keys(prefs).length === 0) {
    return true; // Default: all enabled
  }

  const preferenceKey = categoryToPreferenceKey[category] || "myOrders";

  // Check push channel
  const pushPrefs = prefs.push;
  if (pushPrefs) {
    if (pushPrefs.enabled === false) {
      return false;
    }
    if (pushPrefs.categories) {
      const categoryValue = (pushPrefs.categories as any)[preferenceKey];
      if (categoryValue === false) {
        return false;
      }
    }
  }

  // Check in-app channel
  const inappPrefs = prefs.inapp;
  if (inappPrefs) {
    if (inappPrefs.enabled === false) {
      return false;
    }
    if (inappPrefs.categories) {
      const categoryValue = (inappPrefs.categories as any)[preferenceKey];
      if (categoryValue === false) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Creates a delay (promise-based setTimeout).
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Core Dispatcher ─────────────────────────────────────────────────────────

export interface CreateBulkJobParams {
  title: string;
  body: string;
  category: "order" | "delivery" | "payment" | "account" | "promo";
  deepLink?: string;
  targetSegment: TargetSegment;
  customFilter?: Record<string, any>;
  createdBy: string;
}

/**
 * Creates a new bulk notification job and starts processing it.
 * Returns the job document immediately; processing runs in background.
 */
export async function createAndStartBulkJob(
  params: CreateBulkJobParams
): Promise<IBulkNotificationJob> {
  const { title, body, category, deepLink, targetSegment, customFilter, createdBy } = params;

  // Count total users for the segment
  const segmentFilter = buildSegmentFilter(targetSegment, customFilter);
  const totalUsers = await User.countDocuments(segmentFilter);

  // Create the job record
  const job = await BulkNotificationJob.create({
    title,
    body,
    category,
    deepLink,
    targetSegment,
    customFilter,
    status: "pending" as BulkJobStatus,
    progress: { total: totalUsers, sent: 0, failed: 0 },
    createdBy: new mongoose.Types.ObjectId(createdBy),
  });

  // Start processing in the background (non-blocking)
  processJob(job._id.toString()).catch((err) => {
    logger.error("[BulkDispatcher] Unhandled error in processJob", {
      jobId: job._id.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return job;
}

/**
 * Processes a bulk notification job in batches.
 * Runs asynchronously and updates job progress in the database.
 */
export async function processJob(jobId: string): Promise<void> {
  const job = await BulkNotificationJob.findById(jobId);
  if (!job) {
    logger.error("[BulkDispatcher] Job not found", { jobId });
    return;
  }

  // Update status to processing
  job.status = "processing";
  job.startedAt = new Date();
  await job.save();

  const segmentFilter = buildSegmentFilter(job.targetSegment, job.customFilter);
  let skip = 0;
  let sent = 0;
  let failed = 0;

  while (true) {
    // Check for cancellation between batches
    if (cancelledJobs.has(jobId)) {
      cancelledJobs.delete(jobId);
      job.status = "cancelled";
      job.completedAt = new Date();
      job.progress = { total: job.progress.total, sent, failed };
      await job.save();
      logger.info("[BulkDispatcher] Job cancelled", { jobId, sent, failed });
      return;
    }

    // Also check DB status in case cancellation happened externally
    const freshJob = await BulkNotificationJob.findById(jobId).select("status").lean();
    if (freshJob?.status === "cancelled") {
      cancelledJobs.delete(jobId);
      logger.info("[BulkDispatcher] Job cancelled (DB check)", { jobId, sent, failed });
      return;
    }

    // Fetch next batch of users
    const users = await User.find(segmentFilter)
      .select("_id notificationPreferences")
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (users.length === 0) {
      break; // No more users to process
    }

    // Process each user in the batch
    for (const user of users) {
      try {
        // Check user preferences - skip if category disabled
        if (!isUserCategoryEnabled(user, job.category)) {
          // User has disabled this category — skip, but don't count as failed
          continue;
        }

        // Create in-app notification for the user
        await Notification.create({
          userId: user._id,
          title: job.title,
          message: job.body,
          body: job.body,
          category: job.category,
          priority: "normal",
          isRead: false,
          ...(job.deepLink ? { deepLink: job.deepLink } : {}),
          eventType: "BULK_NOTIFICATION",
          meta: { bulkJobId: jobId },
        });

        sent++;
      } catch (err) {
        failed++;
        logger.error("[BulkDispatcher] Failed to send notification to user", {
          jobId,
          userId: user._id?.toString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Update progress in the database
    await BulkNotificationJob.updateOne(
      { _id: jobId },
      { $set: { "progress.sent": sent, "progress.failed": failed } }
    );

    skip += BATCH_SIZE;

    // Delay between batches to prevent system overload
    if (users.length === BATCH_SIZE) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // Mark job as completed
  await BulkNotificationJob.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        "progress.sent": sent,
        "progress.failed": failed,
      },
    }
  );

  logger.info("[BulkDispatcher] Job completed", { jobId, sent, failed });
}

/**
 * Cancels a bulk notification job.
 * Sets the in-memory cancellation flag for fast stop (within 5 seconds).
 * Also updates the database status for persistence.
 */
export async function cancelBulkJob(
  jobId: string
): Promise<{ success: boolean; message: string }> {
  const job = await BulkNotificationJob.findById(jobId);
  if (!job) {
    return { success: false, message: "Job not found" };
  }

  if (job.status === "completed") {
    return { success: false, message: "Job already completed" };
  }

  if (job.status === "cancelled") {
    return { success: false, message: "Job already cancelled" };
  }

  // Set in-memory flag for fast cancellation
  cancelledJobs.add(jobId);

  // Update DB status
  job.status = "cancelled";
  job.completedAt = new Date();
  await job.save();

  logger.info("[BulkDispatcher] Job cancellation requested", { jobId });
  return { success: true, message: "Job cancellation initiated" };
}

/**
 * Gets the current status and progress of a bulk notification job.
 */
export async function getBulkJobStatus(
  jobId: string
): Promise<IBulkNotificationJob | null> {
  return BulkNotificationJob.findById(jobId).lean() as any;
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export {
  buildSegmentFilter as _buildSegmentFilter,
  isUserCategoryEnabled as _isUserCategoryEnabled,
  cancelledJobs as _cancelledJobs,
  BATCH_SIZE,
  BATCH_DELAY_MS,
};
