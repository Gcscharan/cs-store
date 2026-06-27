import mongoose from "mongoose";

import { Order } from "../../../models/Order";
import { RefundRequest, type RefundRequestStatus } from "../models/RefundRequest";
import { PaymentIntent } from "../models/PaymentIntent";
import { LedgerEntry } from "../models/LedgerEntry";
import { appendLedgerEntry } from "../services/ledgerService";
import { RazorpayAdapter } from "../adapters/RazorpayAdapter";
import { isProviderUnavailableError } from "../types";
import { isRefundExecutionEnabled } from "../config/killSwitches";
import { logger } from "../../../utils/logger";
import { publish } from "../../events/eventBus";
import { stableEventId } from "../../events/eventId";
import { createRefundCompletedEvent } from "../../events/payment.events";

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
    // Captured inside the txn for the post-commit customer notification.
    let completed: { orderId: string; amount: number; currency: string } | null = null;

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
      completed = {
        orderId: String(orderObjectId),
        amount: refundAmount,
        currency: String((rr as any).currency || "INR"),
      };
    });

    if (!out) {
      throw Object.assign(new Error("INTERNAL_ERROR"), { statusCode: 500 });
    }

    // ── Post-commit customer notification (REFUND_COMPLETED) ──────────────────
    // Additive and non-throwing: the refund money path (ledger + RefundRequest)
    // is already durably committed above. Publishing here does NOT affect money
    // correctness. Exactly-once is guaranteed by the deterministic eventId
    // (OutboxEvent.eventId unique) + ProcessedEvent dedup in notificationWriter.
    // This only runs on the real PROCESSING→COMPLETED transition (a duplicate
    // refund webhook hits the COMPLETED→COMPLETED guard above and never reaches
    // here), so the customer is notified exactly once.
    if ((out as any).updated && completed) {
      try {
        const orderDoc = await Order.findById((completed as any).orderId).select("userId").lean();
        const userId = String((orderDoc as any)?.userId || "");
        if (userId) {
          const amt = (completed as any).amount;
          await publish(
            createRefundCompletedEvent({
              source: "refundService",
              actor: { type: "system" },
              eventId: stableEventId(`refund:${String(rrObjectId)}:completed`),
              userId,
              orderId: (completed as any).orderId,
              amount: amt,
              title: "Refund completed",
              body: `Your refund of ₹${amt} has been processed and will reflect in your account shortly.`,
            })
          );
        }
      } catch (e) {
        logger.warn("[Refund] post-commit REFUND_COMPLETED publish failed (non-fatal)", {
          refundRequestId: String(rrObjectId),
          error: e instanceof Error ? e.message : String(e),
        });
      }
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

/**
 * Executes a previously-created RefundRequest against the payment gateway.
 *
 * Idempotency / safety:
 * - Atomically claims the REQUESTED→PROCESSING transition (compare-and-set on
 *   status) so concurrent executors can't both call the gateway.
 * - Passes a stable gateway Idempotency-Key (the RefundRequest id) so even if
 *   the claim were bypassed, Razorpay dedupes the refund at the provider level.
 * - Stamps refundRequestId into gateway notes so the refund webhook can match
 *   back to this exact request and call markRefundCompleted.
 * - The ledger REFUND entry is written by markRefundCompleted (on the
 *   refund.processed webhook), NOT here — execution only moves money + records
 *   the gateway refund id. This keeps the ledger driven by confirmed events.
 *
 * Returns the gateway refund id; completion is finalized asynchronously by the
 * refund webhook (or, for gateways that return terminal status synchronously,
 * may be completed immediately when status === "processed").
 */
export async function executeRefund(args: {
  refundRequestId: string;
}): Promise<{ executed: boolean; gatewayRefundId: string; status: RefundRequestStatus }> {
  const rrObjectId = assertObjectId(args.refundRequestId);

  // Load the request + the payment id to refund.
  const rr = await RefundRequest.findById(rrObjectId)
    .select("_id orderId paymentIntentId amount currency status")
    .lean();
  if (!rr) {
    throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  }

  // Already-terminal/idempotent short-circuits.
  const currentStatus = String((rr as any).status) as RefundRequestStatus;
  if (currentStatus === "COMPLETED") {
    return { executed: false, gatewayRefundId: "", status: "COMPLETED" };
  }
  if (currentStatus === "FAILED") {
    throw Object.assign(new Error("REFUND_ALREADY_FAILED"), { statusCode: 409 });
  }

  // Resolve the Razorpay payment id from the order (set at capture finalization).
  const order = await Order.findById((rr as any).orderId)
    .select("razorpayPaymentId paymentStatus")
    .lean();
  const gatewayPaymentId = String((order as any)?.razorpayPaymentId || "").trim();
  if (!gatewayPaymentId) {
    throw Object.assign(new Error("NO_GATEWAY_PAYMENT_ID"), { statusCode: 409 });
  }

  // Atomic claim: only one executor may move REQUESTED → PROCESSING.
  const claim = await RefundRequest.updateOne(
    { _id: rrObjectId, status: "REQUESTED" },
    { $set: { status: "PROCESSING" } }
  );
  if (Number((claim as any).modifiedCount) === 0) {
    // Another executor already claimed it (or it's not in REQUESTED). Re-read.
    const fresh = await RefundRequest.findById(rrObjectId).select("status").lean();
    const st = String((fresh as any)?.status || "") as RefundRequestStatus;
    // PROCESSING means another worker owns it / gateway call in flight — treat as idempotent no-op.
    return { executed: false, gatewayRefundId: "", status: st };
  }

  try {
    const adapter = new RazorpayAdapter();
    const result = await adapter.refundPayment({
      gatewayPaymentId,
      amount: Number((rr as any).amount || 0),
      // Provider-level idempotency: same key → same refund, never a second one.
      idempotencyKey: `refund:${String(rrObjectId)}`,
      notes: { refundRequestId: String(rrObjectId), orderId: String((rr as any).orderId) },
    });

    if (!result.gatewayRefundId) {
      throw Object.assign(new Error("GATEWAY_NO_REFUND_ID"), { statusCode: 502 });
    }

    logger.info("[Refund] Gateway refund executed", {
      refundRequestId: String(rrObjectId),
      gatewayRefundId: result.gatewayRefundId,
      status: result.status,
    });

    // If the gateway already reports terminal success, complete now (the webhook
    // is still the authoritative path and is idempotent via dedupeKey, so a
    // later refund.processed webhook is a safe no-op).
    if (String(result.status).toLowerCase() === "processed") {
      try {
        await markRefundCompleted({
          refundRequestId: String(rrObjectId),
          gatewayRefundId: result.gatewayRefundId,
          occurredAt: new Date(),
          raw: result.raw,
        });
        return { executed: true, gatewayRefundId: result.gatewayRefundId, status: "COMPLETED" };
      } catch (e) {
        // Completion will be retried by the webhook — leave as PROCESSING.
        logger.warn("[Refund] Synchronous completion failed; awaiting webhook", {
          refundRequestId: String(rrObjectId),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { executed: true, gatewayRefundId: result.gatewayRefundId, status: "PROCESSING" };
  } catch (e: any) {
    // Distinguish AMBIGUOUS failures (timeout/network — the gateway may have
    // actually processed the refund) from DEFINITE pre-send failures.
    //
    //  - Ambiguous  → LEAVE status=PROCESSING. We do NOT know if money moved.
    //                 The refund reconciliation scanner will query Razorpay and
    //                 finalize. Reverting here would risk a second executor
    //                 (provider idempotency key still protects, but semantics
    //                 should reflect reality: "we don't know yet").
    //  - Definite   → revert PROCESSING → REQUESTED so it can be safely retried.
    const ambiguous = isProviderUnavailableError(e);

    if (ambiguous) {
      logger.opsAlert("[Refund] Gateway call ambiguous (timeout/network) — left PROCESSING for reconciliation", {
        refundRequestId: String(rrObjectId),
        error: e instanceof Error ? e.message : String(e),
      });
      // Surface as a 503 so the caller knows it's in-flight, not failed.
      const err: any = new Error("REFUND_GATEWAY_AMBIGUOUS");
      err.statusCode = 503;
      throw err;
    }

    // Definite failure before money could move — safe to revert for retry.
    await RefundRequest.updateOne(
      { _id: rrObjectId, status: "PROCESSING" },
      { $set: { status: "REQUESTED" } }
    ).catch(() => {});

    logger.error("[Refund] Gateway refund execution failed (definite); reverted to REQUESTED", {
      refundRequestId: String(rrObjectId),
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export const __private__ = {
  assertAllowedRefundTransition,
  sumCapturedAmount,
  sumRefundedAmountFromLedger,
  sumReservedRefundAmountFromRequests,
};

/**
 * Auto-refund a PAID order that is being cancelled (customer/admin cancel, or a
 * failed delivery that won't be reattempted).
 *
 * Design goals (Journey 5 invariants):
 *  - EXACTLY ONE refund per order: idempotency key `cancel_refund:{orderId}`.
 *  - Never throws back into the cancellation flow — a refund hiccup must not
 *    leave the order stuck in a non-terminal state. Ambiguous gateway outcomes
 *    are left PROCESSING for the refund reconciliation scanner to finalize.
 *  - Refunds the full captured amount for the order's captured PaymentIntent.
 *  - No-op (idempotent) if the order isn't PAID, has no capture, or a
 *    cancel-refund was already created.
 *
 * Returns a summary for logging/telemetry; callers should treat it as advisory.
 */
export async function refundPaidOrderOnCancellation(args: {
  orderId: string;
  reason?: string;
}): Promise<{ refundCreated: boolean; refundRequestId?: string; status?: RefundRequestStatus; skipped?: string }> {
  try {
    const orderObjectId = assertObjectId(args.orderId);

    const order = await Order.findById(orderObjectId)
      .select("_id paymentStatus razorpayPaymentId")
      .lean();
    if (!order) {
      return { refundCreated: false, skipped: "ORDER_NOT_FOUND" };
    }

    // Only paid orders need a money refund. COD / unpaid cancellations are no-ops.
    if (!isPaidOrderStatus((order as any).paymentStatus)) {
      return { refundCreated: false, skipped: "ORDER_NOT_PAID" };
    }

    // Find the captured PaymentIntent for this order.
    const intent = await PaymentIntent.findOne({
      orderId: orderObjectId,
      status: "CAPTURED",
    })
      .select("_id amount currency")
      .lean();

    if (!intent) {
      logger.opsAlert("[CancelRefund] PAID order has no captured PaymentIntent — manual review", {
        orderId: String(orderObjectId),
      });
      return { refundCreated: false, skipped: "NO_CAPTURED_INTENT" };
    }

    const capturedTotal = await sumCapturedAmount({
      orderId: orderObjectId,
      paymentIntentId: (intent as any)._id,
    });

    if (!Number.isFinite(capturedTotal) || capturedTotal <= 0) {
      logger.opsAlert("[CancelRefund] PAID order has no CAPTURE ledger entry — manual review", {
        orderId: String(orderObjectId),
      });
      return { refundCreated: false, skipped: "NO_CAPTURE" };
    }

    // Idempotent: stable key ensures exactly one cancel-refund per order.
    const idempotencyKey = `cancel_refund:${String(orderObjectId)}`;

    const created = await createRefundRequestInternal({
      orderId: String(orderObjectId),
      paymentIntentId: String((intent as any)._id),
      amount: capturedTotal,
      currency: String((intent as any).currency || "INR"),
      reason: args.reason && args.reason.length >= MIN_REASON_LEN ? args.reason : "Order cancelled — auto refund",
      idempotencyKey,
    });

    logger.info("[CancelRefund] Refund request ensured for cancelled order", {
      orderId: String(orderObjectId),
      refundRequestId: created.refundRequestId,
      created: created.created,
      status: created.status,
    });

    // Execute against the gateway when enabled. Leave to reconciliation if
    // ambiguous (timeout/network) — never throw back into cancellation.
    if (isRefundExecutionEnabled() && created.status === "REQUESTED") {
      try {
        const exec = await executeRefund({ refundRequestId: created.refundRequestId });
        return {
          refundCreated: created.created,
          refundRequestId: created.refundRequestId,
          status: exec.status,
        };
      } catch (e: any) {
        logger.warn("[CancelRefund] Gateway execution deferred to reconciliation", {
          orderId: String(orderObjectId),
          refundRequestId: created.refundRequestId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      refundCreated: created.created,
      refundRequestId: created.refundRequestId,
      status: created.status,
    };
  } catch (e: any) {
    // Absolutely never break cancellation because of a refund problem.
    logger.error("[CancelRefund] Failed to ensure auto-refund on cancellation", {
      orderId: args.orderId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { refundCreated: false, skipped: "ERROR" };
  }
}
