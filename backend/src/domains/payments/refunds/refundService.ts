import mongoose from "mongoose";

import { Order } from "../../../models/Order";
import { RefundRequest, type RefundRequestStatus } from "../models/RefundRequest";
import { PaymentIntent } from "../models/PaymentIntent";
import { LedgerEntry } from "../models/LedgerEntry";
import { appendLedgerEntry } from "../services/ledgerService";

const MIN_REASON_LEN = 5;

function nonEmpty(v: any): string | undefined {
  const s = String(v || "").trim();
  return s ? s : undefined;
}

function assertObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }
  return new mongoose.Types.ObjectId(id);
}

function assertAmount(amount: any): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }
  return n;
}

function assertReason(reason: any): string | undefined {
  const r = String(reason || "").trim();
  if (!r) return undefined;
  if (r.length < MIN_REASON_LEN) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }
  return r;
}

function isPaidOrderStatus(ps: any): boolean {
  return String(ps || "").toUpperCase() === "PAID";
}

function assertAllowedRefundTransition(from: RefundRequestStatus, to: RefundRequestStatus) {
  const f = String(from || "").toUpperCase();
  const t = String(to || "").toUpperCase();

  if (f === "REQUESTED" && (t === "PROCESSING" || t === "FAILED")) return;
  if (f === "PROCESSING" && t === "COMPLETED") return;

  throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
}

async function sumCapturedAmount(args: {
  orderId: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}): Promise<number> {
  const pipeline: any[] = [
    {
      $match: {
        orderId: args.orderId,
        paymentIntentId: args.paymentIntentId,
        eventType: "CAPTURE",
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ];

  const agg = LedgerEntry.aggregate(pipeline);
  const res: any[] = args.session ? await agg.session(args.session) : await agg;
  return Number(res?.[0]?.total || 0);
}

async function sumRefundedAmountFromLedger(args: {
  orderId: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}): Promise<number> {
  const pipeline: any[] = [
    {
      $match: {
        orderId: args.orderId,
        paymentIntentId: args.paymentIntentId,
        eventType: "REFUND",
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ];

  const agg = LedgerEntry.aggregate(pipeline);
  const res: any[] = args.session ? await agg.session(args.session) : await agg;

  // Ledger refunds are stored as negative numbers.
  const totalNegative = Number(res?.[0]?.total || 0);
  return Math.abs(totalNegative);
}

async function sumReservedRefundAmountFromRequests(args: {
  orderId: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}): Promise<number> {
  const docs: any[] = await RefundRequest.find({
    orderId: args.orderId,
    paymentIntentId: args.paymentIntentId,
    status: { $in: ["REQUESTED", "PROCESSING", "COMPLETED"] },
  })
    .select("amount")
    .session(args.session ?? null)
    .lean();

  return docs.reduce((sum, d) => sum + Number(d?.amount || 0), 0);
}

export async function createRefundRequestInternal(args: {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason?: string;
  idempotencyKey: string;
}): Promise<{ created: boolean; refundRequestId: string; status: RefundRequestStatus }> {
  const orderObjectId = assertObjectId(args.orderId);
  const intentObjectId = assertObjectId(args.paymentIntentId);
  const amount = assertAmount(args.amount);
  const currency = String(args.currency || "INR").toUpperCase();
  const idempotencyKey = nonEmpty(args.idempotencyKey);
  const reason = assertReason(args.reason);

  if (!idempotencyKey) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }

  const existing = await RefundRequest.findOne({ idempotencyKey }).select("_id orderId paymentIntentId amount currency status").lean();
  if (existing) {
    const same =
      String(existing.orderId) === String(orderObjectId) &&
      String(existing.paymentIntentId) === String(intentObjectId) &&
      Number(existing.amount) === amount &&
      String(existing.currency || "").toUpperCase() === currency;

    if (!same) {
      throw Object.assign(new Error("IDEMPOTENCY_KEY_REUSED"), { statusCode: 409 });
    }

    return { created: false, refundRequestId: String(existing._id), status: String(existing.status) as any };
  }

  const session = await mongoose.startSession();

  try {
    let out: { created: boolean; refundRequestId: string; status: RefundRequestStatus } | undefined;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderObjectId).select("_id paymentStatus").session(session);
        if (!order) {
          throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
        }

        if (!isPaidOrderStatus((order as any).paymentStatus)) {
          throw Object.assign(new Error("ORDER_NOT_PAID"), { statusCode: 409 });
        }

        const intent = await PaymentIntent.findById(intentObjectId)
          .select("_id orderId gateway amount currency")
          .session(session);
        if (!intent) {
          throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
        }

        if (String((intent as any).orderId) !== String(orderObjectId)) {
          throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
        }

        const capturedTotal = await sumCapturedAmount({ orderId: orderObjectId, paymentIntentId: intentObjectId, session });
        if (!Number.isFinite(capturedTotal) || capturedTotal <= 0) {
          throw Object.assign(new Error("NO_CAPTURE"), { statusCode: 409 });
        }

        const reservedTotal = await sumReservedRefundAmountFromRequests({
          orderId: orderObjectId,
          paymentIntentId: intentObjectId,
          session,
        });

        if (reservedTotal + amount > capturedTotal) {
          throw Object.assign(new Error("OVER_REFUND"), { statusCode: 409 });
        }

        const doc = await RefundRequest.create(
          [
            {
              orderId: orderObjectId,
              paymentIntentId: intentObjectId,
              amount,
              currency,
              status: "REQUESTED",
              reason,
              idempotencyKey,
            },
          ],
          { session }
        );

        out = {
          created: true,
          refundRequestId: String((doc as any)[0]?._id || ""),
          status: "REQUESTED",
        };
      });
    } catch (e: any) {
      if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
        const existing2 = await RefundRequest.findOne({ idempotencyKey })
          .select("_id status")
          .lean();
        if (existing2) {
          return {
            created: false,
            refundRequestId: String(existing2._id),
            status: String(existing2.status) as any,
          };
        }
      }
      throw e;
    }

    if (!out || !out.refundRequestId) {
      throw Object.assign(new Error("INTERNAL_ERROR"), { statusCode: 500 });
    }

    return out;
  } finally {
    session.endSession();
  }
}

export async function getRefundHistoryForOrderInternal(args: {
  orderId: string;
}): Promise<{ orderId: string; refunds: Array<{ id: string; paymentIntentId: string; amount: number; currency: string; status: RefundRequestStatus; reason?: string; createdAt: string; updatedAt: string }> }> {
  const orderObjectId = assertObjectId(args.orderId);

  const docs: any[] = await RefundRequest.find({ orderId: orderObjectId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  return {
    orderId: String(orderObjectId),
    refunds: docs.map((d) => ({
      id: String(d._id),
      paymentIntentId: String(d.paymentIntentId),
      amount: Number(d.amount || 0),
      currency: String(d.currency || "INR"),
      status: String(d.status) as any,
      reason: d.reason ? String(d.reason) : undefined,
      createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date(0)).toISOString(),
      updatedAt: (d.updatedAt instanceof Date ? d.updatedAt : new Date(0)).toISOString(),
    })),
  };
}

export async function markRefundProcessing(args: {
  refundRequestId: string;
}): Promise<{ updated: boolean; status: RefundRequestStatus }> {
  const rrObjectId = assertObjectId(args.refundRequestId);

  const doc = await RefundRequest.findById(rrObjectId).select("_id status");
  if (!doc) {
    throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  }

  const from = String((doc as any).status) as RefundRequestStatus;
  assertAllowedRefundTransition(from, "PROCESSING");

  (doc as any).status = "PROCESSING";
  await doc.save();

  return { updated: true, status: "PROCESSING" };
}

export async function markRefundCompleted(args: {
  refundRequestId: string;
  gatewayRefundId: string;
  occurredAt?: Date;
  raw?: any;
}): Promise<{ updated: boolean; status: RefundRequestStatus; ledgerCreated: boolean }> {
  const rrObjectId = assertObjectId(args.refundRequestId);
  const gatewayRefundId = nonEmpty(args.gatewayRefundId);
  if (!gatewayRefundId) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }

  const session = await mongoose.startSession();

  try {
    let out: { updated: boolean; status: RefundRequestStatus; ledgerCreated: boolean } | undefined;

    await session.withTransaction(async () => {
      const rr = await RefundRequest.findById(rrObjectId)
        .select("_id orderId paymentIntentId amount currency status")
        .session(session);

      if (!rr) {
        throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
      }

      const from = String((rr as any).status) as RefundRequestStatus;
      assertAllowedRefundTransition(from, "COMPLETED");

      const orderObjectId = (rr as any).orderId as mongoose.Types.ObjectId;
      const intentObjectId = (rr as any).paymentIntentId as mongoose.Types.ObjectId;

      const capturedTotal = await sumCapturedAmount({ orderId: orderObjectId, paymentIntentId: intentObjectId, session });
      if (!Number.isFinite(capturedTotal) || capturedTotal <= 0) {
        throw Object.assign(new Error("NO_CAPTURE"), { statusCode: 409 });
      }

      const refundedTotalCompleted = await sumRefundedAmountFromLedger({ orderId: orderObjectId, paymentIntentId: intentObjectId, session });
      const refundAmount = Number((rr as any).amount || 0);

      if (refundedTotalCompleted + refundAmount > capturedTotal) {
        throw Object.assign(new Error("OVER_REFUND"), { statusCode: 409 });
      }

      const intent = await PaymentIntent.findById(intentObjectId).select("_id gateway").session(session);
      if (!intent) {
        throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
      }

      const dedupeKey = `refund:completed:${String((rr as any)._id)}:${gatewayRefundId}`;

      const ledgerRes = await appendLedgerEntry({
        paymentIntentId: String(intentObjectId),
        orderId: String(orderObjectId),
        gateway: String((intent as any).gateway || "RAZORPAY") as any,
        eventType: "REFUND",
        refundId: String((rr as any)._id),
        amount: -Math.abs(refundAmount),
        currency: String((rr as any).currency || "INR"),
        gatewayEventId: gatewayRefundId,
        dedupeKey,
        occurredAt: args.occurredAt,
        raw: args.raw,
      });

      (rr as any).status = "COMPLETED";
      await rr.save({ session });

      out = { updated: true, status: "COMPLETED", ledgerCreated: ledgerRes.created };
    });

    if (!out) {
      throw Object.assign(new Error("INTERNAL_ERROR"), { statusCode: 500 });
    }

    return out;
  } finally {
    session.endSession();
  }
}

export async function markRefundFailed(args: {
  refundRequestId: string;
  reason?: string;
}): Promise<{ updated: boolean; status: RefundRequestStatus }> {
  const rrObjectId = assertObjectId(args.refundRequestId);

  const rr = await RefundRequest.findById(rrObjectId).select("_id status");
  if (!rr) {
    throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  }

  const from = String((rr as any).status) as RefundRequestStatus;
  assertAllowedRefundTransition(from, "FAILED");

  (rr as any).status = "FAILED";
  await rr.save();

  return { updated: true, status: "FAILED" };
}

export const __private__ = {
  assertAllowedRefundTransition,
  sumCapturedAmount,
  sumRefundedAmountFromLedger,
  sumReservedRefundAmountFromRequests,
};
