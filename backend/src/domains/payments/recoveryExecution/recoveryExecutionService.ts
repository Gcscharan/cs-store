import mongoose from "mongoose";

import { Order } from "../../../models/Order";
import { PaymentIntent } from "../models/PaymentIntent";
import { PaymentRecoveryExecutionAudit } from "../models/PaymentRecoveryExecutionAudit";
import type { PaymentIntentStatus } from "../types";
import { assertAllowedRecoveryExecution } from "./guards";
import type { RecoveryExecuteRequest, RecoveryExecuteResult } from "./types";

const MIN_REASON_LEN = 15;

function assertObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }
  return new mongoose.Types.ObjectId(id);
}

function assertReason(reason: string) {
  const r = String(reason || "").trim();
  if (!r || r.length < MIN_REASON_LEN) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }
}

function isPaidOrderStatus(ps: any): boolean {
  return String(ps || "").toUpperCase() === "PAID";
}

function isTerminal(status: any): boolean {
  const s = String(status || "").toUpperCase();
  return s === "CAPTURED" || s === "FAILED" || s === "CANCELLED" || s === "EXPIRED";
}

export async function executeRecoveryAction(
  req: RecoveryExecuteRequest,
  args?: { now?: Date }
): Promise<RecoveryExecuteResult> {
  assertReason(req.reason);

  const now = args?.now ? args.now : new Date();
  const intentObjectId = assertObjectId(req.paymentIntentId);

  const session = await mongoose.startSession();

  try {
    let out: RecoveryExecuteResult | undefined;

    await session.withTransaction(async () => {
      const intent = await PaymentIntent.findById(intentObjectId)
        .select("_id orderId status isLocked lockReason lastScannedAt")
        .session(session);

      if (!intent) {
        throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
      }

      const order = await Order.findById((intent as any).orderId).select("_id paymentStatus").session(session);
      if (!order) {
        throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
      }

      if (isPaidOrderStatus((order as any).paymentStatus)) {
        throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
      }

      const prevStatus = String((intent as any).status) as PaymentIntentStatus;
      if (isTerminal(prevStatus)) {
        throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
      }

      const { nextStatus } = assertAllowedRecoveryExecution({
        currentStatus: prevStatus,
        isLocked: !!(intent as any).isLocked,
        action: req.action,
      });

      (intent as any).status = nextStatus;
      if (nextStatus === ("VERIFYING" as any)) {
        (intent as any).lastScannedAt = now;
      }

      await intent.save({ session });

      const auditDoc = await PaymentRecoveryExecutionAudit.create(
        [
          {
            paymentIntentId: (intent as any)._id,
            orderId: (order as any)._id,
            action: req.action,
            previousStatus: prevStatus,
            newStatus: nextStatus,
            adminUserId: new mongoose.Types.ObjectId(req.adminUserId),
            adminEmail: String(req.adminEmail || ""),
            reason: String(req.reason).trim(),
            executedAt: now,
            featureFlagVersion: String(req.featureFlagVersion || ""),
          },
        ],
        { session }
      );

      out = {
        executed: true,
        paymentIntentId: String((intent as any)._id),
        orderId: String((order as any)._id),
        previousStatus: prevStatus,
        newStatus: nextStatus,
        auditId: String((auditDoc as any)[0]?._id || ""),
      };
    });

    if (!out || !out.auditId) {
      throw Object.assign(new Error("INTERNAL_ERROR"), { statusCode: 500 });
    }

    return out;
  } finally {
    session.endSession();
  }
}
