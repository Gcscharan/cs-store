import { PaymentIntent } from "../models/PaymentIntent";
import { Order } from "../../../models/Order";
import type { PaymentIntentStatus } from "../types";
import * as paymentIntentStateMachine from "./paymentIntentStateMachine";

const SCAN_INTERVAL_MS = 5 * 60_000;

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
    .select("_id orderId status updatedAt isLocked")
    .lean();

  const counts: ScanCounts = {
    scanned: intents.length,
    recoverable: 0,
    locked: 0,
    skippedPaid: 0,
  };

  for (const intent of intents as any[]) {
    const isLocked = !!intent.isLocked;
    if (isLocked) continue;

    const status = String(intent.status || "") as PaymentIntentStatus;
    if (shouldSkipPaidIntent(status)) {
      counts.skippedPaid += 1;
      continue;
    }

    const order = await Order.findById(intent.orderId).select("paymentStatus").lean();
    if (order && isPaidOrderStatus((order as any).paymentStatus)) {
      counts.skippedPaid += 1;
      continue;
    }

    const msOld = ageMs(intent.updatedAt, now);

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
        { $set: { status: nextStatus, lastScannedAt: new Date(now) } }
      );
      if ((res as any)?.modifiedCount) {
        if (nextStatus === ("PAYMENT_RECOVERABLE" as any)) counts.recoverable += 1;
      }
    }
  }

  console.log(
    `[PaymentScanner] scanned=${counts.scanned} recoverable=${counts.recoverable} locked=${counts.locked} skippedPaid=${counts.skippedPaid}`
  );

  return counts;
}

export function startStuckPaymentScanner(): NodeJS.Timeout {
  const run = async () => {
    try {
      await runStuckPaymentScanOnce();
    } catch (e) {
      console.warn("[PaymentScanner] scan failed", e);
    }
  };

  void run();
  return setInterval(run, SCAN_INTERVAL_MS);
}
