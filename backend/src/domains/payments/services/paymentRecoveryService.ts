import { logger } from '../../../utils/logger';
import mongoose from "mongoose";

import { PaymentIntent } from "../models/PaymentIntent";
import { PaymentRecoveryAudit, type PaymentRecoveryAction } from "../models/PaymentRecoveryAudit";
import type { PaymentIntentStatus } from "../types";
import { Order } from "../../../models/Order";

export type PaymentRecoveryRequest = {
  paymentIntentId: string;
  action: PaymentRecoveryAction;
  reason: string;
  adminUserId: string;
  adminEmail: string;
};

export type PaymentRecoveryResult = {
  paymentIntentId: string;
  orderId: string;
  gateway: string;
  previousStatus: PaymentIntentStatus;
  newStatus: PaymentIntentStatus;
  isLocked: boolean;
  lockReason?: string;
  lastScannedAt?: Date;
  action: PaymentRecoveryAction;
};

const MIN_REASON_LEN = 10;

function assertObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error("Invalid paymentIntentId"), { statusCode: 400 });
  }
  return new mongoose.Types.ObjectId(id);
}

function assertReason(reason: string) {
  const r = String(reason || "").trim();
  if (!r || r.length < MIN_REASON_LEN) {
    throw Object.assign(new Error("reason is required (min 10 chars)"), { statusCode: 400 });
  }
}

function assertAction(action: any): asserts action is PaymentRecoveryAction {
  const a = String(action || "").trim().toUpperCase();
  if (a !== "MARK_VERIFYING" && a !== "MARK_RECOVERABLE" && a !== "LOCK_PERMANENTLY") {
    throw Object.assign(new Error("Invalid action"), { statusCode: 400 });
  }
}

function isCaptured(status: any): boolean {
  return String(status || "").toUpperCase() === "CAPTURED";
}

function isPaidOrderStatus(ps: any): boolean {
  return String(ps || "").toUpperCase() === "PAID";
}

function alreadyAdminLocked(lockReason: any): boolean {
  return String(lockReason || "").startsWith("ADMIN_LOCK:");
}

export async function runPaymentRecoveryAction(
  req: PaymentRecoveryRequest,
  args?: { now?: Date }
): Promise<PaymentRecoveryResult> {
  assertAction(req.action);
  assertReason(req.reason);

  const now = args?.now ? args.now : new Date();
  const intentObjectId = assertObjectId(req.paymentIntentId);

  const session = await mongoose.startSession();

  try {
    let out: PaymentRecoveryResult | null = null;

    await session.withTransaction(async () => {
      const intent = await PaymentIntent.findById(intentObjectId)
        .select("_id orderId gateway status isLocked lockReason lastScannedAt")
        .session(session);

      if (!intent) {
        throw Object.assign(new Error("PaymentIntent not found"), { statusCode: 404 });
      }

      const order = await Order.findById(intent.orderId)
        .select("_id paymentStatus")
        .session(session);

      if (!order) {
        throw Object.assign(new Error("Order not found"), { statusCode: 404 });
      }

      if (isCaptured(intent.status)) {
        throw Object.assign(new Error("Cannot modify CAPTURED intent"), { statusCode: 409 });
      }

      if (isPaidOrderStatus((order as any).paymentStatus)) {
        throw Object.assign(new Error("Cannot modify PAID order"), { statusCode: 409 });
      }

      const prevStatus = String(intent.status) as PaymentIntentStatus;
      let nextStatus: PaymentIntentStatus = prevStatus;

      const isLocked = !!(intent as any).isLocked;
      if (isLocked && req.action !== "LOCK_PERMANENTLY") {
        throw Object.assign(new Error("Intent is locked"), { statusCode: 409 });
      }

      let shouldSave = false;

      if (req.action === "MARK_VERIFYING") {
        if (prevStatus !== ("PAYMENT_PROCESSING" as any) && prevStatus !== ("PAYMENT_RECOVERABLE" as any)) {
          throw Object.assign(new Error("Action not allowed from current status"), { statusCode: 409 });
        }
        nextStatus = "VERIFYING" as any;
        (intent as any).status = nextStatus;
        (intent as any).lastScannedAt = now;
        shouldSave = true;
      }

      if (req.action === "MARK_RECOVERABLE") {
        if (
          prevStatus !== ("CREATED" as any) &&
          prevStatus !== ("GATEWAY_ORDER_CREATED" as any) &&
          prevStatus !== ("PAYMENT_PROCESSING" as any)
        ) {
          throw Object.assign(new Error("Action not allowed from current status"), { statusCode: 409 });
        }
        nextStatus = "PAYMENT_RECOVERABLE" as any;
        (intent as any).status = nextStatus;
        shouldSave = true;
      }

      if (req.action === "LOCK_PERMANENTLY") {
        (intent as any).isLocked = true;
        if (!alreadyAdminLocked((intent as any).lockReason)) {
          (intent as any).lockReason = `ADMIN_LOCK: ${String(req.reason).trim()}`;
          shouldSave = true;
        }
        if (!isLocked) {
          shouldSave = true;
        }
      }

      if (shouldSave) {
        await intent.save({ session });
      }

      await PaymentRecoveryAudit.create(
        [
          {
            paymentIntentId: intent._id,
            orderId: order._id,
            previousStatus: prevStatus,
            newStatus: nextStatus,
            action: req.action,
            reason: String(req.reason).trim(),
            adminUserId: new mongoose.Types.ObjectId(req.adminUserId),
            adminEmail: String(req.adminEmail || ""),
          },
        ],
        { session }
      );

      logger.info(
        `[PaymentRecovery] action=${req.action} intent=${String(intent._id)} admin=${String(req.adminEmail || "")}`
      );

      out = {
        paymentIntentId: String(intent._id),
        orderId: String(intent.orderId),
        gateway: String((intent as any).gateway),
        previousStatus: prevStatus,
        newStatus: nextStatus,
        isLocked: !!(intent as any).isLocked,
        lockReason: (intent as any).lockReason ? String((intent as any).lockReason) : undefined,
        lastScannedAt: (intent as any).lastScannedAt ? new Date((intent as any).lastScannedAt) : undefined,
        action: req.action,
      };
    });

    if (!out) {
      throw Object.assign(new Error("Recovery action failed"), { statusCode: 500 });
    }

    return out;
  } finally {
    session.endSession();
  }
}
