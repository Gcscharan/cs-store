/**
 * Refund Reconciliation Service
 *
 * Makes refund completion independent of webhook delivery — the same philosophy
 * as payment reconciliation. If a `refund.processed` webhook is lost or delayed,
 * this scanner queries Razorpay directly and finalizes the refund locally.
 *
 * Loop (every few minutes):
 *   RefundRequest.status == PROCESSING, older than N minutes
 *     → fetch the payment's refunds from Razorpay
 *     → match our refund (by notes.refundRequestId, else by amount)
 *     → if gateway status == "processed" → markRefundCompleted (idempotent)
 *
 * Safety:
 * - Only acts on PROCESSING requests (already claimed + gateway call attempted).
 * - markRefundCompleted is idempotent (ledger dedupeKey + status guard), so a
 *   racing webhook and this scanner can't double-credit.
 * - Read-only Razorpay access here; the only write is the local completion.
 */

import { RefundRequest } from "../models/RefundRequest";
import { Order } from "../../../models/Order";
import { markRefundCompleted } from "../refunds/refundService";
import { RazorpayReadonlyClient } from "../verification/razorpayReadonlyClient";
import { logger, capturePaymentError } from "../../../utils/logger";
import { incCounterWithLabels } from "../../../ops/opsMetrics";

const RECONCILIATION_INTERVAL_MS = 5 * 60_000;       // every 5 min
const PROCESSING_AGE_THRESHOLD_MS = 2 * 60_000;      // only refunds stuck >2 min
const BATCH_LIMIT = 100;
const INTER_ITEM_SLEEP_MS = 100;

let started = false;

export interface RefundReconciliationCounts {
  scanned: number;
  completed: number;
  still_pending: number;
  errors: number;
}

function makeReadonlyClient(): RazorpayReadonlyClient | null {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) return null;
  // RazorpayReadonlyClient reads credentials from env internally.
  return new RazorpayReadonlyClient();
}

export async function runRefundReconciliationOnce(args?: { now?: Date }): Promise<RefundReconciliationCounts> {
  const now = args?.now ? args.now.getTime() : Date.now();
  const cutoff = new Date(now - PROCESSING_AGE_THRESHOLD_MS);

  const counts: RefundReconciliationCounts = { scanned: 0, completed: 0, still_pending: 0, errors: 0 };

  const stuck = await RefundRequest.find({
    status: "PROCESSING",
    updatedAt: { $lt: cutoff },
  })
    .select("_id orderId paymentIntentId amount")
    .limit(BATCH_LIMIT)
    .lean();

  counts.scanned = stuck.length;
  if (stuck.length === 0) return counts;

  const client = makeReadonlyClient();
  if (!client) {
    logger.error("[RefundReconciliation] Razorpay credentials not configured");
    counts.errors = stuck.length;
    return counts;
  }

  for (const rr of stuck as any[]) {
    const refundRequestId = String(rr._id);
    try {
      // Resolve the gateway payment id from the order.
      const order = await Order.findById(rr.orderId).select("razorpayPaymentId").lean();
      const gatewayPaymentId = String((order as any)?.razorpayPaymentId || "").trim();
      if (!gatewayPaymentId) {
        counts.errors += 1;
        logger.warn("[RefundReconciliation] No gateway payment id for order", { refundRequestId, orderId: String(rr.orderId) });
        continue;
      }

      // Fetch all refunds for this payment from Razorpay.
      const refunds = await client.fetchPaymentRefunds(gatewayPaymentId);
      const items: any[] = (refunds as any)?.items || [];

      // Match our refund: prefer notes.refundRequestId, fall back to amount + processed status.
      const amountPaise = Math.round(Number(rr.amount || 0) * 100);
      const match =
        items.find((r) => String(r?.notes?.refundRequestId || "") === refundRequestId) ||
        items.find(
          (r) => Number(r?.amount || 0) === amountPaise && String(r?.status || "").toLowerCase() === "processed"
        );

      if (match && String(match.status || "").toLowerCase() === "processed") {
        await markRefundCompleted({
          refundRequestId,
          gatewayRefundId: String(match.id),
          occurredAt: match.created_at ? new Date(Number(match.created_at) * 1000) : new Date(),
          raw: match,
        });
        counts.completed += 1;
        incCounterWithLabels("refund_reconciliation_total", { result: "completed" }, 1);
        logger.info("[RefundReconciliation] Completed refund via reconciliation (webhook missed/delayed)", {
          refundRequestId,
          gatewayRefundId: String(match.id),
        });
      } else {
        counts.still_pending += 1;
        incCounterWithLabels("refund_reconciliation_total", { result: "still_pending" }, 1);
      }
    } catch (e) {
      counts.errors += 1;
      capturePaymentError("[RefundReconciliation] Failed to reconcile refund", e as Error, { refundRequestId });
    }

    await new Promise((r) => setTimeout(r, INTER_ITEM_SLEEP_MS));
  }

  logger.info("[RefundReconciliation] Scan complete", { ...counts });
  return counts;
}

export function initializeRefundReconciliation(params?: { intervalMs?: number }): void {
  if (started) return;
  started = true;

  let consecutiveFailures = 0;
  const FAILURE_THRESHOLD = 10;
  const intervalMs = Number(params?.intervalMs || RECONCILIATION_INTERVAL_MS);

  const tick = async () => {
    try {
      await runRefundReconciliationOnce();
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures += 1;
      logger.error("[RefundReconciliation] Scan failed", e as Error);
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        logger.error("[REFUND_RECONCILIATION_FATAL] Too many consecutive failures. Crashing.");
        process.exit(1);
      }
    }
  };

  void tick();
  setInterval(() => void tick(), intervalMs);

  logger.info("[RefundReconciliation] Service initialized", { intervalMs });
}

export function _resetRefundReconciliation(): void {
  started = false;
}
