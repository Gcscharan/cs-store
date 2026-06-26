/**
 * Push Gateway
 *
 * Enhanced wrapper around PushNotificationService that adds:
 * - 500ms batching window: collects push notifications and sends in a single Expo API call (max 100 per batch)
 * - Token cleanup: removes invalid expoPushToken on DeviceNotRegistered error
 * - Rate-limit detection: exponential backoff (1s, 2s, 4s, 8s, 16s) on 429 response, up to 5 retries
 * - Android notification channels: includes channelId based on notification category
 *
 * This is a NEW wrapper — the original PushNotificationService is not modified.
 */

import fetch from "node-fetch";
import { logger } from "../../../utils/logger";
import { User } from "../../../models/User";
import UserDeviceToken from "../../../models/UserDeviceToken";
import PushReceipt from "../../../models/PushReceipt";
import { NotificationCategory } from "../templates/notificationTemplates";
import { updateLifecycleStatus } from "./deliveryTracker";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  category?: NotificationCategory;
  sound?: boolean;
  priority?: "default" | "normal" | "high";
  notificationId?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

// ─── Android Channel Mapping ──────────────────────────────────────────────────

const CATEGORY_CHANNEL_MAP: Record<string, string> = {
  order: "orders",
  delivery: "orders",
  payment: "payments",
  promo: "promotions",
  account: "default",
};

/**
 * Maps a notification category to the corresponding Android notification channel ID.
 */
export function getAndroidChannelId(category?: NotificationCategory): string {
  if (!category) return "default";
  return CATEGORY_CHANNEL_MAP[category] || "default";
}

// ─── Batch Queue ──────────────────────────────────────────────────────────────

interface QueuedPush {
  message: ExpoPushMessage;
  userId: string;
  notificationId?: string;
  resolve: (value: void) => void;
  reject: (reason: any) => void;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_WINDOW_MS = 500;
const MAX_BATCH_SIZE = 100;
const MAX_RATE_LIMIT_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

let batchQueue: QueuedPush[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Rate Limiting State ──────────────────────────────────────────────────────

let currentRetryAttempt = 0;
let rateLimitedUntil: number = 0;

/**
 * Resets rate limit state (for testing only).
 */
export function _resetRateLimitState(): void {
  currentRetryAttempt = 0;
  rateLimitedUntil = 0;
}

/**
 * Resets the batch queue (for testing only).
 */
export function _resetBatchQueue(): void {
  batchQueue = [];
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
}

/**
 * Exposes the batch queue length (for testing only).
 */
export function _getBatchQueueLength(): number {
  return batchQueue.length;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends a push notification to a user via the batching gateway.
 *
 * The message is queued and sent in the next batch (within 500ms window).
 * Returns a promise that resolves when the notification is successfully sent,
 * or rejects if delivery fails after retries.
 */
/**
 * Collects all active push tokens for a user.
 *
 * Primary source is the multi-device `UserDeviceToken` registry. Falls back to
 * the legacy `User.expoPushToken` field if the registry has no rows yet (user
 * hasn't re-registered since the multi-device migration). De-duplicates so a
 * token present in both places is only pushed once.
 */
async function getUserPushTokens(userId: string): Promise<string[]> {
  const tokens = new Set<string>();

  try {
    const deviceRows = await UserDeviceToken.find({ userId })
      .select("token")
      .lean();
    for (const row of deviceRows) {
      if (row?.token) tokens.add(String(row.token));
    }
  } catch (err) {
    logger.warn(`[PushGateway] Failed to read device registry for ${userId}, falling back to legacy token`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Legacy fallback (and back-compat for not-yet-migrated users)
  if (tokens.size === 0) {
    const user = await User.findById(userId).select("expoPushToken").lean();
    if (user?.expoPushToken) tokens.add(String(user.expoPushToken));
  }

  return Array.from(tokens);
}

/**
 * Sends a push notification to ALL of a user's registered devices via the
 * batching gateway.
 *
 * Each device token is queued as its own Expo message and sent in the next
 * batch (within the 500ms window). The returned promise resolves once every
 * device message has been processed (sent or gracefully handled).
 */
export async function sendPush(message: PushMessage): Promise<void> {
  const tokens = await getUserPushTokens(message.userId);

  if (tokens.length === 0) {
    logger.debug(`[PushGateway] User ${message.userId} has no push tokens, skipping`);
    return;
  }

  const channelId = getAndroidChannelId(message.category);

  // Enqueue one message per device and await all of them.
  await Promise.all(
    tokens.map(
      (token) =>
        new Promise<void>((resolve, reject) => {
          const expoMessage: ExpoPushMessage = {
            to: token,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: message.sound !== false ? "default" : null,
            priority: message.priority || "default",
            channelId,
          };

          batchQueue.push({
            message: expoMessage,
            userId: message.userId,
            notificationId: message.notificationId,
            resolve,
            reject,
          });

          // Start batch timer if not already running
          if (!batchTimer) {
            batchTimer = setTimeout(() => {
              flushBatch();
            }, BATCH_WINDOW_MS);
          }

          // If batch is full, flush immediately
          if (batchQueue.length >= MAX_BATCH_SIZE) {
            if (batchTimer) {
              clearTimeout(batchTimer);
              batchTimer = null;
            }
            flushBatch();
          }
        })
    )
  );
}

/**
 * Forces the batch queue to flush immediately.
 * Useful for graceful shutdown scenarios.
 */
export async function flushBatch(): Promise<void> {
  if (batchQueue.length === 0) {
    batchTimer = null;
    return;
  }

  // Take current batch (up to MAX_BATCH_SIZE)
  const batch = batchQueue.splice(0, MAX_BATCH_SIZE);
  batchTimer = null;

  // If there are still items in the queue, schedule another flush
  if (batchQueue.length > 0) {
    batchTimer = setTimeout(() => {
      flushBatch();
    }, BATCH_WINDOW_MS);
  }

  await sendBatchWithRetry(batch, 0);
}

// ─── Internal Batch Sending ───────────────────────────────────────────────────

/**
 * Sends a batch of push messages to Expo Push API with rate-limit retry support.
 */
async function sendBatchWithRetry(batch: QueuedPush[], attempt: number): Promise<void> {
  // Check if we're in a rate-limited state
  const now = Date.now();
  if (rateLimitedUntil > now) {
    const waitTime = rateLimitedUntil - now;
    logger.info(`[PushGateway] Rate limited, waiting ${waitTime}ms before retry`);
    await sleep(waitTime);
  }

  const messages = batch.map((item) => item.message);

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      if (attempt >= MAX_RATE_LIMIT_RETRIES) {
        logger.error("[PushGateway] Rate limit retries exhausted", {
          attempts: attempt,
          batchSize: batch.length,
        });
        // Reject all items in the batch
        for (const item of batch) {
          item.reject(new Error("Rate limit retries exhausted"));
        }
        currentRetryAttempt = 0;
        return;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      rateLimitedUntil = Date.now() + backoffMs;
      currentRetryAttempt = attempt + 1;

      logger.warn(`[PushGateway] Rate limited (429). Backing off ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`, {
        attempt: attempt + 1,
        backoffMs,
        batchSize: batch.length,
      });

      await sleep(backoffMs);
      return sendBatchWithRetry(batch, attempt + 1);
    }

    if (!response.ok) {
      logger.error("[PushGateway] Expo API returned non-OK status", {
        status: response.status,
        batchSize: batch.length,
      });
      for (const item of batch) {
        item.reject(new Error(`Expo API returned status ${response.status}`));
      }
      return;
    }

    // Reset rate limit state on success
    currentRetryAttempt = 0;
    rateLimitedUntil = 0;

    const result: ExpoPushResponse = (await response.json()) as ExpoPushResponse;

    // Process individual ticket results
    await processTickets(batch, result.data);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[PushGateway] Error sending batch to Expo API", {
      error: errorMsg,
      batchSize: batch.length,
    });

    for (const item of batch) {
      item.reject(err);
    }
  }
}

/**
 * Processes individual ticket responses from Expo.
 * Handles DeviceNotRegistered errors by cleaning up invalid tokens.
 * Updates delivery lifecycle tracking status.
 */
async function processTickets(batch: QueuedPush[], tickets: ExpoPushTicket[]): Promise<void> {
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    const ticket = tickets[i];

    if (!ticket) {
      // No ticket for this message — shouldn't happen but handle gracefully
      item.resolve();
      continue;
    }

    if (ticket.status === "ok") {
      logger.info(`[PushGateway] Push sent successfully`, {
        userId: item.userId,
        ticketId: ticket.id,
      });

      // Update lifecycle to 'sent' — Expo accepted the notification
      if (item.notificationId) {
        updateLifecycleStatus(item.notificationId, "push", "sent").catch(() => {
          // Non-critical — lifecycle tracking should never block
        });
      }

      // Record the ticket for async RECEIPT polling. Expo only confirms actual
      // delivery (or post-acceptance failure) via getReceipts, available ~15min
      // later. The pushReceiptWorker polls these and updates lifecycle to
      // delivered/failed. Best-effort — never blocks delivery.
      if (ticket.id) {
        PushReceipt.create({
          ticketId: ticket.id,
          ...(item.notificationId ? { notificationId: item.notificationId } : {}),
          ...(item.userId ? { userId: item.userId } : {}),
          token: item.message.to,
          status: "pending",
          // Expo recommends waiting ~15 minutes before checking receipts.
          checkAfter: new Date(Date.now() + 15 * 60 * 1000),
          attempts: 0,
        }).catch(() => {
          // Duplicate ticket id or write failure — non-critical.
        });
      }

      item.resolve();
    } else if (ticket.status === "error") {
      const errorType = ticket.details?.error;

      if (errorType === "DeviceNotRegistered") {
        // Token is invalid — remove only THIS device token (not all the user's devices)
        await cleanupInvalidToken(item.userId, item.message.to);
        logger.warn(`[PushGateway] DeviceNotRegistered — token removed for user ${item.userId}`);

        // Update lifecycle to 'failed'
        if (item.notificationId) {
          updateLifecycleStatus(item.notificationId, "push", "failed", "DeviceNotRegistered").catch(() => {});
        }

        item.resolve(); // Don't reject, since we handled the invalid token gracefully
      } else {
        logger.error(`[PushGateway] Push ticket error`, {
          userId: item.userId,
          error: ticket.message,
          errorType,
        });

        // Update lifecycle to 'failed'
        if (item.notificationId) {
          updateLifecycleStatus(item.notificationId, "push", "failed", ticket.message || errorType).catch(() => {});
        }

        item.reject(new Error(ticket.message || `Push error: ${errorType}`));
      }
    }
  }
}

// ─── Token Cleanup ────────────────────────────────────────────────────────────

/**
 * Removes a single invalid device token.
 * Called when Expo returns a DeviceNotRegistered error for a specific token.
 *
 * Only the dead device is removed from the registry — the user's other devices
 * keep receiving notifications. The legacy `User.expoPushToken` field is only
 * cleared if it happens to match the dead token (so it doesn't keep being used).
 */
async function cleanupInvalidToken(userId: string, token?: string): Promise<void> {
  try {
    if (token) {
      // Remove the specific dead token from the multi-device registry.
      await UserDeviceToken.deleteOne({ token });

      // Clear the legacy field only if it points at this dead token.
      await User.updateOne(
        { _id: userId, expoPushToken: token },
        { $unset: { expoPushToken: 1 } }
      );
      logger.info(`[PushGateway] Removed invalid device token for user ${userId}`);
    } else {
      // No token context — fall back to clearing the legacy field only.
      await User.findByIdAndUpdate(userId, { $unset: { expoPushToken: 1 } });
      logger.info(`[PushGateway] Removed legacy expoPushToken for user ${userId}`);
    }
  } catch (err) {
    logger.error(`[PushGateway] Failed to remove invalid token for user ${userId}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export {
  cleanupInvalidToken as _cleanupInvalidToken,
  processTickets as _processTickets,
  sendBatchWithRetry as _sendBatchWithRetry,
  BATCH_WINDOW_MS,
  MAX_BATCH_SIZE,
  MAX_RATE_LIMIT_RETRIES,
  INITIAL_BACKOFF_MS,
  EXPO_PUSH_URL,
};

export type { QueuedPush, ExpoPushMessage, ExpoPushTicket, ExpoPushResponse };
