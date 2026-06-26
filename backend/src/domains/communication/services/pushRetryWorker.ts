/**
 * Push Retry Worker
 *
 * Handles failed push notification retries with exponential backoff.
 * Follows the same polling pattern as the OutboxDispatcher.
 *
 * Retry Schedule (5 attempts total):
 *   Attempt 1: 1 minute after initial failure
 *   Attempt 2: 5 minutes after attempt 1
 *   Attempt 3: 15 minutes after attempt 2
 *   Attempt 4: 30 minutes after attempt 3
 *   Attempt 5: 1 hour after attempt 4
 *
 * After 5 failed attempts, the entry is moved to `dead_letter` status.
 * On success, the notification delivery lifecycle status is updated.
 *
 * The worker polls every 30 seconds for retries due.
 */

import { logger } from "../../../utils/logger";
import PushRetry, { IPushRetry } from "../../../models/PushRetry";
import Notification from "../../../models/Notification";
import { sendPush, PushMessage } from "./pushGateway";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Retry intervals in milliseconds: 1m, 5m, 15m, 30m, 1h */
export const RETRY_INTERVALS_MS = [
  1 * 60 * 1000,       // 1 minute
  5 * 60 * 1000,       // 5 minutes
  15 * 60 * 1000,      // 15 minutes
  30 * 60 * 1000,      // 30 minutes
  60 * 60 * 1000,      // 1 hour
];

/** Maximum number of retry attempts before dead-lettering */
export const MAX_RETRY_ATTEMPTS = 5;

/** Polling interval in milliseconds (30 seconds) */
export const POLL_INTERVAL_MS = 30 * 1000;

let started = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Retry Scheduling ─────────────────────────────────────────────────────────

/**
 * Calculates the next retry time based on the current attempt number.
 *
 * @param attempts - Current number of attempts completed (0-based)
 * @returns The Date for the next retry attempt, or null if max retries exhausted
 */
export function calculateNextRetryAt(attempts: number): Date | null {
  if (attempts >= MAX_RETRY_ATTEMPTS) {
    return null; // No more retries — dead letter
  }

  const intervalMs = RETRY_INTERVALS_MS[attempts] || RETRY_INTERVALS_MS[RETRY_INTERVALS_MS.length - 1];
  return new Date(Date.now() + intervalMs);
}

// ─── Queue Insertion ──────────────────────────────────────────────────────────

/**
 * Inserts a failed push notification into the retry queue.
 * Called by the PushGateway or Notification Orchestrator when push delivery fails
 * with a non-token-invalid error.
 *
 * @param params - The push notification details to retry
 */
export async function enqueuePushRetry(params: {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  error: string;
}): Promise<void> {
  try {
    const nextAttemptAt = calculateNextRetryAt(0);

    if (!nextAttemptAt) {
      logger.error("[PushRetryWorker] Cannot calculate next retry time", {
        notificationId: params.notificationId,
        userId: params.userId,
      });
      return;
    }

    await PushRetry.create({
      notificationId: params.notificationId,
      userId: params.userId,
      title: params.title,
      body: params.body,
      data: params.data || {},
      attempts: 0,
      nextAttemptAt,
      lastError: params.error,
      status: "pending",
    });

    logger.info("[PushRetryWorker] Enqueued push retry", {
      notificationId: params.notificationId,
      userId: params.userId,
      nextAttemptAt: nextAttemptAt.toISOString(),
      error: params.error,
    });
  } catch (err) {
    logger.error("[PushRetryWorker] Failed to enqueue push retry", {
      error: err instanceof Error ? err.message : String(err),
      notificationId: params.notificationId,
      userId: params.userId,
    });
  }
}

// ─── Worker Tick ──────────────────────────────────────────────────────────────

/**
 * Processes a single retry attempt for a pending push notification.
 */
async function processRetry(retry: IPushRetry): Promise<void> {
  const retryId = retry._id.toString();
  const userId = retry.userId.toString();
  const notificationId = retry.notificationId.toString();

  logger.info("[PushRetryWorker] Processing retry", {
    retryId,
    userId,
    notificationId,
    attempt: retry.attempts + 1,
  });

  try {
    // Attempt push delivery
    const pushMessage: PushMessage = {
      userId,
      title: retry.title,
      body: retry.body,
      data: retry.data || {},
    };

    await sendPush(pushMessage);

    // Success — mark as succeeded
    await PushRetry.updateOne(
      { _id: retry._id },
      {
        $set: {
          status: "succeeded",
          lastError: null,
        },
        $inc: { attempts: 1 },
      }
    );

    // Update notification lifecycle status (if notification exists)
    try {
      await Notification.updateOne(
        { _id: retry.notificationId },
        {
          $set: {
            "lifecycle.push.status": "delivered",
            "lifecycle.push.updatedAt": new Date(),
          },
        }
      );
    } catch {
      // Non-critical: lifecycle field may not exist yet (Phase C)
    }

    logger.info("[PushRetryWorker] Retry succeeded", {
      retryId,
      userId,
      notificationId,
      totalAttempts: retry.attempts + 1,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newAttempts = retry.attempts + 1;

    if (newAttempts >= MAX_RETRY_ATTEMPTS) {
      // Dead-letter — all retries exhausted
      await PushRetry.updateOne(
        { _id: retry._id },
        {
          $set: {
            status: "dead_letter",
            lastError: errorMsg,
            attempts: newAttempts,
          },
        }
      );

      logger.opsAlert("[PushRetryWorker] Push retry exhausted — moved to dead letter", {
        retryId,
        userId,
        notificationId,
        totalAttempts: newAttempts,
        lastError: errorMsg,
      });
    } else {
      // Schedule next retry
      const nextAttemptAt = calculateNextRetryAt(newAttempts);

      await PushRetry.updateOne(
        { _id: retry._id },
        {
          $set: {
            attempts: newAttempts,
            nextAttemptAt,
            lastError: errorMsg,
          },
        }
      );

      logger.warn("[PushRetryWorker] Retry failed, scheduled next attempt", {
        retryId,
        userId,
        notificationId,
        attempt: newAttempts,
        nextAttemptAt: nextAttemptAt?.toISOString(),
        error: errorMsg,
      });
    }
  }
}

/**
 * Single poll tick — finds and processes all pending retries that are due.
 */
async function tick(): Promise<void> {
  const now = new Date();

  // Find pending retries where nextAttemptAt <= now
  const dueRetries = await PushRetry.find({
    status: "pending",
    nextAttemptAt: { $lte: now },
  })
    .sort({ nextAttemptAt: 1 })
    .limit(50) // Process up to 50 retries per tick to avoid blocking
    .exec();

  if (dueRetries.length === 0) {
    return;
  }

  logger.info("[PushRetryWorker] Found due retries", {
    count: dueRetries.length,
  });

  // Process each retry independently
  for (const retry of dueRetries) {
    try {
      await processRetry(retry);
    } catch (err) {
      logger.error("[PushRetryWorker] Unexpected error processing retry", {
        retryId: retry._id.toString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Initializes the Push Retry Worker.
 * Starts polling every 30 seconds for pending retries that are due.
 */
export function initializePushRetryWorker(params?: {
  pollIntervalMs?: number;
}): void {
  if (started) return;
  started = true;

  const intervalMs = params?.pollIntervalMs || POLL_INTERVAL_MS;

  pollTimer = setInterval(() => {
    void safeTick();
  }, intervalMs);

  // Warm start — process any backlog immediately
  void safeTick();

  logger.info("[PushRetryWorker] Push retry worker initialized", {
    pollIntervalMs: intervalMs,
    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    retrySchedule: "1m, 5m, 15m, 30m, 1h",
  });
}

/**
 * Stops the Push Retry Worker.
 */
export function stopPushRetryWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  started = false;
  logger.info("[PushRetryWorker] Push retry worker stopped");
}

/**
 * Safe tick wrapper — catches unexpected errors to prevent worker crashes.
 */
async function safeTick(): Promise<void> {
  try {
    await tick();
  } catch (err) {
    logger.error("[PushRetryWorker] Tick error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export {
  tick as _tick,
  processRetry as _processRetry,
  safeTick as _safeTick,
};

/**
 * Resets the worker state (for testing only).
 */
export function _resetWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  started = false;
}
