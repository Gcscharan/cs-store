/**
 * Push Receipt Worker
 *
 * Closes the observability gap: "was the push actually DELIVERED?"
 *
 * When Expo accepts a push it returns a ticket (id) — that only means "accepted",
 * not "delivered". Real delivery (or post-acceptance failure, e.g. a token that
 * went stale) is reported asynchronously via Expo's getReceipts endpoint, which
 * Expo recommends polling ~15 minutes after send.
 *
 * This worker polls due PushReceipt rows, fetches their receipts in batches,
 * updates the notification delivery lifecycle to `delivered` / `failed`, cleans
 * up tokens reported as DeviceNotRegistered, and emits delivery metrics.
 */

import fetch from "node-fetch";
import { logger } from "../../../utils/logger";
import { incCounterWithLabels } from "../../../ops/opsMetrics";
import PushReceipt, { IPushReceipt } from "../../../models/PushReceipt";
import UserDeviceToken from "../../../models/UserDeviceToken";
import { User } from "../../../models/User";
import { updateLifecycleStatus } from "./deliveryTracker";

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const POLL_INTERVAL_MS = 60 * 1000; // poll every minute
const MAX_RECEIPTS_PER_TICK = 1000; // Expo allows up to 1000 receipt ids per call
const MAX_RECEIPT_ATTEMPTS = 5; // give up confirming after this many polls

interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

let started = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch receipts for a set of ticket ids from Expo.
 */
async function fetchReceipts(ids: string[]): Promise<Record<string, ExpoReceipt>> {
  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(`Expo getReceipts returned status ${response.status}`);
  }

  const json = (await response.json()) as { data?: Record<string, ExpoReceipt> };
  return json.data || {};
}

/**
 * Removes a token reported invalid by a receipt (post-acceptance DeviceNotRegistered).
 */
async function cleanupTokenFromReceipt(receipt: IPushReceipt): Promise<void> {
  if (!receipt.token) return;
  try {
    await UserDeviceToken.deleteOne({ token: receipt.token });
    if (receipt.userId) {
      await User.updateOne(
        { _id: receipt.userId, expoPushToken: receipt.token },
        { $unset: { expoPushToken: 1 } }
      );
    }
    logger.info("[PushReceiptWorker] Removed invalid token reported by receipt", {
      token: receipt.token,
    });
  } catch (err) {
    logger.warn("[PushReceiptWorker] Token cleanup from receipt failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Single poll tick — resolves due pending receipts.
 */
async function tick(): Promise<void> {
  const now = new Date();

  const due = await PushReceipt.find({
    status: "pending",
    checkAfter: { $lte: now },
  })
    .sort({ checkAfter: 1 })
    .limit(MAX_RECEIPTS_PER_TICK)
    .exec();

  if (due.length === 0) return;

  const byTicketId = new Map<string, IPushReceipt>();
  for (const r of due) byTicketId.set(r.ticketId, r);

  let receipts: Record<string, ExpoReceipt> = {};
  try {
    receipts = await fetchReceipts(Array.from(byTicketId.keys()));
  } catch (err) {
    // Expo unreachable — reschedule all for a later poll (bounded by attempts).
    logger.warn("[PushReceiptWorker] getReceipts failed, will retry", {
      error: err instanceof Error ? err.message : String(err),
      count: due.length,
    });
    for (const r of due) {
      await rescheduleOrGiveUp(r, "getReceipts unreachable");
    }
    return;
  }

  for (const [ticketId, record] of byTicketId.entries()) {
    const receipt = receipts[ticketId];

    // Expo may not have the receipt ready yet — reschedule.
    if (!receipt) {
      await rescheduleOrGiveUp(record, "receipt not ready");
      continue;
    }

    if (receipt.status === "ok") {
      await PushReceipt.updateOne(
        { _id: record._id },
        { $set: { status: "delivered" } }
      );
      if (record.notificationId) {
        updateLifecycleStatus(record.notificationId.toString(), "push", "delivered").catch(() => {});
      }
      incCounterWithLabels("push_receipts_total", { result: "delivered" }, 1);
    } else {
      // status === "error" — delivery failed after acceptance.
      const errorCode = receipt.details?.error || "Unknown";
      await PushReceipt.updateOne(
        { _id: record._id },
        { $set: { status: "failed", errorCode, lastError: receipt.message || errorCode } }
      );
      if (record.notificationId) {
        updateLifecycleStatus(
          record.notificationId.toString(),
          "push",
          "failed",
          receipt.message || errorCode
        ).catch(() => {});
      }
      incCounterWithLabels("push_receipts_total", { result: "failed", error: errorCode }, 1);

      // Self-heal: a token reported DeviceNotRegistered here must be removed.
      if (errorCode === "DeviceNotRegistered") {
        await cleanupTokenFromReceipt(record);
      }
    }
  }
}

/**
 * Reschedule a receipt for a later poll, or give up after MAX_RECEIPT_ATTEMPTS.
 */
async function rescheduleOrGiveUp(record: IPushReceipt, reason: string): Promise<void> {
  const attempts = (record.attempts || 0) + 1;
  if (attempts >= MAX_RECEIPT_ATTEMPTS) {
    // Give up confirming — leave lifecycle at 'sent'. Mark failed-to-confirm so
    // it stops being polled and gets TTL-pruned.
    await PushReceipt.updateOne(
      { _id: record._id },
      { $set: { status: "failed", attempts, lastError: `Unconfirmed: ${reason}` } }
    );
    incCounterWithLabels("push_receipts_total", { result: "unconfirmed" }, 1);
    return;
  }
  await PushReceipt.updateOne(
    { _id: record._id },
    {
      $set: {
        attempts,
        // back off ~5 min per attempt
        checkAfter: new Date(Date.now() + 5 * 60 * 1000),
        lastError: reason,
      },
    }
  );
}

async function safeTick(): Promise<void> {
  try {
    await tick();
  } catch (err) {
    logger.error("[PushReceiptWorker] Tick error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Initialize the push receipt worker. Polls every minute for due receipts.
 */
export function initializePushReceiptWorker(params?: { pollIntervalMs?: number }): void {
  if (started) return;
  started = true;

  const intervalMs = params?.pollIntervalMs || POLL_INTERVAL_MS;
  pollTimer = setInterval(() => {
    void safeTick();
  }, intervalMs);

  logger.info("[PushReceiptWorker] Push receipt worker initialized", {
    pollIntervalMs: intervalMs,
  });
}

export function stopPushReceiptWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  started = false;
}

// Exports for testing
export {
  tick as _tick,
  fetchReceipts as _fetchReceipts,
  rescheduleOrGiveUp as _rescheduleOrGiveUp,
  MAX_RECEIPT_ATTEMPTS,
  POLL_INTERVAL_MS,
};

export function _resetReceiptWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  started = false;
}
