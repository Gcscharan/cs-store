import mongoose from "mongoose";
import Razorpay from "razorpay";
import { Order } from "../../../models/Order";
import { PaymentIntent } from "../models/PaymentIntent";
import { processRazorpayWebhook } from "./webhookProcessor";
import { logger, capturePaymentError } from "../../../utils/logger";

const RECONCILIATION_INTERVAL_MS = 5 * 60_000; // 5 minutes
const ORDER_AGE_THRESHOLD_MS = 5 * 60_000; // 5 minutes

type ReconciliationCounts = {
  scanned: number;
  reconciled_success: number;
  reconciled_failed: number;
  skipped_paid: number;
  errors: number;
};

type RazorpayPaymentStatus = "captured" | "authorized" | "created" | "failed" | "refunded";

let started = false;

function nowMs(d?: Date): number {
  return d ? d.getTime() : Date.now();
}

/**
 * Fetch payment status from Razorpay for a given gateway order ID
 */
async function fetchRazorpayPaymentStatus(
  razorpay: Razorpay,
  gatewayOrderId: string
): Promise<{ status: RazorpayPaymentStatus; paymentId?: string; capturedAt?: Date } | null> {
  try {
    // Fetch payments for the order
    const payments: any = await new Promise((resolve, reject) => {
      razorpay.orders.fetchPayments(gatewayOrderId, (err: any, data: any) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });

    if (!payments || !Array.isArray(payments.items) || payments.items.length === 0) {
      return null;
    }

    // Find the latest captured or failed payment
    const sortedPayments = payments.items.sort((a: any, b: any) => {
      const aTime = Number(a.created_at || 0);
      const bTime = Number(b.created_at || 0);
      return bTime - aTime;
    });

    const latestPayment = sortedPayments[0];
    const status = String(latestPayment?.status || "").toLowerCase() as RazorpayPaymentStatus;
    const paymentId = latestPayment?.id ? String(latestPayment.id) : undefined;
    const capturedAt = latestPayment?.created_at
      ? new Date(Number(latestPayment.created_at) * 1000)
      : undefined;

    return { status, paymentId, capturedAt };
  } catch (error) {
    logger.error("Failed to fetch Razorpay payment status", error as Error, {
      gatewayOrderId,
    });
    return null;
  }
}

function buildSyntheticCapturedWebhook(args: {
  gatewayOrderId: string;
  razorpayPaymentId?: string;
  capturedAt?: Date;
}): { rawBody: Buffer; headers: Record<string, any> } {
  const occurredAt = args.capturedAt || new Date();
  const payload = {
    type: "PAYMENT_CAPTURED",
    gatewayEventId: String(args.razorpayPaymentId || `reconciliation_${args.gatewayOrderId}_${occurredAt.getTime()}`),
    gatewayOrderId: args.gatewayOrderId,
    occurredAt: occurredAt.toISOString(),
    amount: 0,
    currency: "INR",
    rawEvent: {
      payload: {
        payment: {
          entity: {
            id: String(
              args.razorpayPaymentId || `reconciliation_${args.gatewayOrderId}_${occurredAt.getTime()}`
            ),
            order_id: args.gatewayOrderId,
            status: "captured",
            created_at: Math.floor(occurredAt.getTime() / 1000),
            notes: {},
          },
        },
        order: {
          entity: {
            id: args.gatewayOrderId,
            notes: {},
          },
        },
      },
    },
  };

  return {
    rawBody: Buffer.from(JSON.stringify(payload), "utf8"),
    headers: {
      "x-razorpay-signature": "reconciliation-bypass",
      "x-internal-reconciliation": "true",
    },
  };
}

/**
 * Run a single reconciliation scan
 * Finds orders stuck in PENDING_PAYMENT with a PaymentIntent and reconciles with Razorpay
 */
export async function runReconciliationScanOnce(args?: { now?: Date }): Promise<ReconciliationCounts> {
  const now = nowMs(args?.now);
  const cutoffTime = new Date(now - ORDER_AGE_THRESHOLD_MS);

  const counts: ReconciliationCounts = {
    scanned: 0,
    reconciled_success: 0,
    reconciled_failed: 0,
    skipped_paid: 0,
    errors: 0,
  };

  // Find PaymentIntents that are in non-terminal states with gatewayOrderId
  const intents = await PaymentIntent.find({
    gateway: "RAZORPAY",
    status: { $in: ["GATEWAY_ORDER_CREATED", "PAYMENT_PROCESSING", "VERIFYING", "PAYMENT_RECOVERABLE"] },
    gatewayOrderId: { $exists: true, $ne: null },
    updatedAt: { $lt: cutoffTime },
    isLocked: { $ne: true },
  })
    .select("_id orderId status gatewayOrderId updatedAt")
    .lean();

  counts.scanned = intents.length;

  if (intents.length === 0) {
    return counts;
  }

  // Initialize Razorpay client
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    logger.error("Cannot run reconciliation: Razorpay credentials not configured");
    counts.errors = intents.length;
    return counts;
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  for (const intent of intents as any[]) {
    const orderId = String(intent.orderId);
    const gatewayOrderId = String(intent.gatewayOrderId);

    try {
      // Check if order is already PAID (skip for idempotency)
      const order = await Order.findById(orderId).select("paymentStatus").lean();
      if (!order) {
        logger.warn("Order not found during reconciliation", { orderId });
        continue;
      }

      const ps = String((order as any).paymentStatus || "").toUpperCase();
      if (ps === "PAID") {
        counts.skipped_paid += 1;
        // Update scan timestamp for consistency
        await PaymentIntent.updateOne(
          { _id: intent._id },
          { $set: { lastScannedAt: new Date(now) } }
        );
        continue;
      }

      // Fetch payment status from Razorpay
      const paymentInfo = await fetchRazorpayPaymentStatus(razorpay, gatewayOrderId);

      if (!paymentInfo) {
        logger.info("No payment found at Razorpay for order", {
          orderId,
          gatewayOrderId,
        });
        continue;
      }

      if (paymentInfo.status === "captured") {
        // Payment was captured at gateway but not marked PAID internally
        logger.info("reconciled_success: Payment captured at gateway, marking order PAID", {
          orderId,
          gatewayOrderId,
          paymentId: paymentInfo.paymentId,
        });

        const synthetic = buildSyntheticCapturedWebhook({
          gatewayOrderId,
          razorpayPaymentId: paymentInfo.paymentId,
          capturedAt: paymentInfo.capturedAt,
        });

        const out = await processRazorpayWebhook({
          rawBody: synthetic.rawBody,
          headers: synthetic.headers,
        });

        if (out.ok) {
          // Keep scan timestamp consistent even if the internal webhook path already updated intent status.
          await PaymentIntent.updateOne(
            { _id: intent._id },
            { $set: { lastScannedAt: new Date(now) } }
          );

          counts.reconciled_success += 1;
          logger.info("reconciled_success: Order marked PAID via reconciliation", {
            orderId,
            gatewayOrderId,
          });
        } else {
          counts.errors += 1;
          capturePaymentError("reconciliation_error: Synthetic webhook processing failed", new Error(out.message), {
            orderId,
            gatewayOrderId,
            statusCode: out.statusCode,
          });
        }
      } else if (paymentInfo.status === "failed") {
        // Payment failed at gateway
        logger.info("reconciled_failed: Payment failed at gateway", {
          orderId,
          gatewayOrderId,
          paymentId: paymentInfo.paymentId,
        });

        // Update PaymentIntent status to FAILED
        await PaymentIntent.updateOne(
          { _id: intent._id },
          { $set: { lastScannedAt: new Date(now) } }
        );

        // Update Order paymentStatus to FAILED
        await Order.updateOne(
          { _id: orderId, paymentStatus: "PENDING" },
          { $set: { paymentStatus: "FAILED" } }
        );

        counts.reconciled_failed += 1;
      }
      // Other statuses (authorized, created, refunded) - no action needed
    } catch (error) {
      counts.errors += 1;
      capturePaymentError("reconciliation_error: Failed to reconcile order", error as Error, {
        orderId,
        gatewayOrderId,
      });
    }
  }

  logger.info("Reconciliation scan complete", {
    scanned: counts.scanned,
    reconciled_success: counts.reconciled_success,
    reconciled_failed: counts.reconciled_failed,
    skipped_paid: counts.skipped_paid,
    errors: counts.errors,
  });

  return counts;
}

/**
 * Start the reconciliation cron job
 * Runs every 5 minutes
 */
export function initializePaymentReconciliation(params?: {
  intervalMs?: number;
}): void {
  if (started) {
    logger.warn("Payment reconciliation already started, skipping duplicate initialization");
    return;
  }
  started = true;

  let consecutiveFailures = 0;
  const FAILURE_THRESHOLD = 10;

  const intervalMs = Number(params?.intervalMs || RECONCILIATION_INTERVAL_MS);

  const tick = async () => {
    try {
      await runReconciliationScanOnce();
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures += 1;
      logger.error("Reconciliation scan failed", e as Error);

      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        logger.error("[PAYMENT_RECONCILIATION_FATAL] Too many consecutive failures. Crashing.");
        process.exit(1);
      }
    }
  };

  // Run immediately on start
  void tick();

  // Schedule recurring runs
  setInterval(() => {
    void tick();
  }, intervalMs);

  logger.info("Payment reconciliation service initialized", {
    intervalMs,
  });
}
