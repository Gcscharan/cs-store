import { logger } from '../../../utils/logger';
import { PaymentIntent } from "../models/PaymentIntent";
import { Order } from "../../../models/Order";
import mongoose from "mongoose";
import type { PaymentIntentStatus } from "../types";
import * as paymentIntentStateMachine from "./paymentIntentStateMachine";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";

const SCAN_INTERVAL_MS = 5 * 60_000;
const SCAN_BATCH_LIMIT = 100; // process at most 100 intents per run to prevent DB spikes
const SCAN_INTER_ITEM_SLEEP_MS = 50; // brief pause between items under load

const THRESHOLDS_MS = {
  ORDER_CREATED: 10 * 60_000,
  PAYMENT_INITIATED: 15 * 60_000,
  PAYMENT_PROCESSING: 30 * 60_000,
  PAYMENT_RECOVERABLE: 24 * 60 * 60_000,
} as const;

type ScanCounts = {
  scanned: number;
  recoverable: number;
  locked: number;
  skippedPaid: number;
  expired: number;
};

function nowMs(d?: Date): number {
  return d ? d.getTime() : Date.now();
}

function ageMs(updatedAt: Date | string | undefined, now: number): number {
  const t = updatedAt ? new Date(updatedAt).getTime() : 0;
  return now - t;
}

function isPaidOrderStatus(ps: any): boolean {
  const v = String(ps || "").toUpperCase();
  return v === "PAID";
}

function shouldSkipPaidIntent(intentStatus: string): boolean {
  const s = String(intentStatus || "").toUpperCase();
  return s === "CAPTURED";
}

export async function runStuckPaymentScanOnce(args?: { now?: Date }): Promise<ScanCounts> {
  const now = nowMs(args?.now);

  const intents = await PaymentIntent.find({
    gateway: "RAZORPAY",
    status: {
      $in: [
        "CREATED",
        "GATEWAY_ORDER_CREATED",
        "PAYMENT_PROCESSING",
        "PAYMENT_RECOVERABLE",
      ],
    },
  })
    .select("_id orderId status updatedAt expiresAt isLocked lastScannedAt")
    .sort({ lastScannedAt: 1 }) // fairness: process least-recently-scanned first (nulls sort first)
    .limit(SCAN_BATCH_LIMIT) // backpressure: cap per-run work to avoid DB spikes
    .lean();

  const counts: ScanCounts = {
    scanned: intents.length,
    recoverable: 0,
    locked: 0,
    skippedPaid: 0,
    expired: 0,
  };

  for (const intent of intents as any[]) {
    const isLocked = !!intent.isLocked;
    if (isLocked) {
      // Advance lastScannedAt even for locked intents — forward progress guarantee
      await PaymentIntent.updateOne(
        { _id: intent._id },
        { $set: { lastScannedAt: new Date(now) } }
      );
      continue;
    }

    const status = String(intent.status || "") as PaymentIntentStatus;
    if (shouldSkipPaidIntent(status)) {
      counts.skippedPaid += 1;
      await PaymentIntent.updateOne(
        { _id: intent._id },
        { $set: { lastScannedAt: new Date(now) } }
      );
      continue;
    }

    const order = await Order.findById(intent.orderId).select("paymentStatus").lean();
    if (order && isPaidOrderStatus((order as any).paymentStatus)) {
      counts.skippedPaid += 1;
      // Advance lastScannedAt so this intent doesn't keep appearing at the top of the sort
      await PaymentIntent.updateOne(
        { _id: intent._id },
        { $set: { lastScannedAt: new Date(now) } }
      );
      continue;
    }

    const msOld = ageMs(intent.updatedAt, now);

    // ── SLA enforcement: expire intents past their deadline ──────────────────
    // If expiresAt has passed and the intent is still in a non-terminal state,
    // mark it EXPIRED, release inventory, and mark the order FAILED.
    // This prevents zombie orders from holding inventory indefinitely.
    const expiresAtMs = intent.expiresAt ? new Date(intent.expiresAt).getTime() : 0;
    if (expiresAtMs > 0 && now > expiresAtMs) {
      const locked = await PaymentIntent.findOneAndUpdate(
        { _id: intent._id, isLocked: { $ne: true }, status: { $nin: ['CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED'] } },
        { $set: { isLocked: true, lockReason: 'EXPIRY_ENFORCEMENT', lastScannedAt: new Date(now) } },
        { new: false }
      );
      if (locked) {
        try {
          const session = await mongoose.startSession();
          try {
            await session.withTransaction(async () => {
              // Transition intent to EXPIRED
              await PaymentIntent.updateOne(
                { _id: intent._id },
                { $set: { status: 'EXPIRED', paymentState: 'FAILED' } },
                { session }
              );
              // Release inventory so stock is not locked forever
              await inventoryReservationService.releaseActiveReservationsForOrder({
                session,
                orderId: new mongoose.Types.ObjectId(String(intent.orderId)),
              });
              // Mark order FAILED only if still PENDING (idempotent)
              await Order.updateOne(
                { _id: intent.orderId, paymentStatus: 'PENDING' },
                { $set: { paymentStatus: 'FAILED' } },
                { session }
              );
            });
            counts.expired += 1;
            logger.info('[PaymentScanner] Intent expired and order marked FAILED', {
              intentId: String(intent._id),
              orderId: String(intent.orderId),
            });
          } finally {
            session.endSession();
          }
        } catch (expireErr: any) {
          logger.error('[PaymentScanner] Failed to expire intent', {
            intentId: String(intent._id),
            error: expireErr?.message,
          });
          // Unlock so the next scan can retry
          await PaymentIntent.updateOne(
            { _id: intent._id },
            { $set: { isLocked: false }, $unset: { lockReason: '' } }
          );
        }
      }
      continue;
    }

    if (status === ("PAYMENT_RECOVERABLE" as any) && msOld > THRESHOLDS_MS.PAYMENT_RECOVERABLE) {
      const res = await PaymentIntent.updateOne(
        { _id: intent._id, isLocked: { $ne: true } },
        {
          $set: {
            isLocked: true,
            lockReason: "STALE_PAYMENT_24H",
            lastScannedAt: new Date(now),
          },
        }
      );
      if ((res as any)?.modifiedCount) {
        counts.locked += 1;
      }
      continue;
    }
    let nextStatus: PaymentIntentStatus | null = null;

    if (status === ("CREATED" as any) && msOld > THRESHOLDS_MS.ORDER_CREATED) {
      nextStatus = "PAYMENT_RECOVERABLE" as any;
    }

    if (status === ("GATEWAY_ORDER_CREATED" as any) && msOld > THRESHOLDS_MS.PAYMENT_INITIATED) {
      nextStatus = "PAYMENT_RECOVERABLE" as any;
    }

    if (status === ("PAYMENT_PROCESSING" as any) && msOld > THRESHOLDS_MS.PAYMENT_PROCESSING) {
      nextStatus = "VERIFYING" as any;
    }

    if (nextStatus) {
      paymentIntentStateMachine.assertAllowedTransition(status, nextStatus);
      const res = await PaymentIntent.updateOne(
        { _id: intent._id, isLocked: { $ne: true }, status },
        { $set: { status: nextStatus, lastScannedAt: new Date(now) }, $inc: { version: 1 } }
      );
      if ((res as any)?.modifiedCount) {
        if (nextStatus === ("PAYMENT_RECOVERABLE" as any)) counts.recoverable += 1;
      } else {
        // Version mismatch or concurrent status change — status transition skipped.
        // Still advance lastScannedAt so this intent moves to the back of the sort queue.
        await PaymentIntent.updateOne(
          { _id: intent._id },
          { $set: { lastScannedAt: new Date(now) } }
        );
      }
    } else {
      // Intent is not yet old enough to transition — advance lastScannedAt
      // so it doesn't keep appearing at the top of the sort on every run.
      await PaymentIntent.updateOne(
        { _id: intent._id },
        { $set: { lastScannedAt: new Date(now) } }
      );
    }

    // Brief yield between items to avoid saturating the DB under high load
    await new Promise(r => setTimeout(r, SCAN_INTER_ITEM_SLEEP_MS));
  }

  logger.info(
    `[PaymentScanner] scanned=${counts.scanned} recoverable=${counts.recoverable} locked=${counts.locked} expired=${counts.expired} skippedPaid=${counts.skippedPaid}`
  );

  return counts;
}

export function startStuckPaymentScanner(): NodeJS.Timeout {
  const run = async () => {
    try {
      await runStuckPaymentScanOnce();
    } catch (e) {
      logger.warn("[PaymentScanner] scan failed", e);
    }
  };

  void run();
  return setInterval(run, SCAN_INTERVAL_MS);
}
