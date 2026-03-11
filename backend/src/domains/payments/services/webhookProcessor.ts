import { logger } from '../../../utils/logger';
import crypto from "crypto";
import mongoose from "mongoose";

import { WebhookEventInbox } from "../models/WebhookEventInbox";
import { PaymentIntent } from "../models/PaymentIntent";
import { Order } from "../../../models/Order";
import { RazorpayAdapter } from "../adapters/RazorpayAdapter";
import { appendLedgerEntry } from "./ledgerService";
import * as paymentIntentStateMachine from "./paymentIntentStateMachine";
import { finalizeOrderOnCapturedPayment } from "./orderPaymentFinalizer";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";
import { incCounterWithLabels } from "../../../ops/opsMetrics";
import { capturePaymentError } from "../../../utils/logger";
import { generateInvoiceForOrder } from "../../invoice/services/invoiceService";

export async function processRazorpayWebhook(args: {
  rawBody: Buffer;
  headers: Record<string, any>;
  io?: any;
}): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }>{
  console.info("[WEBHOOK][RECEIVED]", {
    gateway: "RAZORPAY",
    hasRawBody: Buffer.isBuffer(args.rawBody),
    rawBodySize: Buffer.isBuffer(args.rawBody) ? args.rawBody.length : 0,
  });

  console.info("[BACKEND][WEBHOOK_RECEIVED]", {
    gateway: "RAZORPAY",
    hasRawBody: Buffer.isBuffer(args.rawBody),
    rawBodySize: Buffer.isBuffer(args.rawBody) ? args.rawBody.length : 0,
  });

  const adapter = new RazorpayAdapter();

  const sig = adapter.verifyWebhookSignature({ rawBody: args.rawBody, headers: args.headers });
  if (!sig.ok) {
    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "webhook", event: "SIGNATURE", result: "invalid" },
      1
    );
    return { ok: false, statusCode: 401, message: sig.reason };
  }

  console.info("[WEBHOOK][SIGNATURE_OK]", {
    gateway: "RAZORPAY",
  });

  const event = adapter.parseWebhook({ rawBody: args.rawBody });

  console.info("[WEBHOOK][EVENT_TYPE]", {
    gateway: "RAZORPAY",
    type: String((event as any)?.type || ""),
    gatewayEventId: String((event as any)?.gatewayEventId || ""),
    gatewayOrderId: String((event as any)?.gatewayOrderId || ""),
  });

  console.info("[BACKEND][WEBHOOK_RECEIVED]", {
    gateway: "RAZORPAY",
    type: String((event as any)?.type || ""),
    gatewayEventId: String((event as any)?.gatewayEventId || ""),
    gatewayOrderId: String((event as any)?.gatewayOrderId || ""),
  });

  if (event.type !== "PAYMENT_CAPTURED" && event.type !== "PAYMENT_FAILED") {
    // Acknowledge unknown / unhandled events to avoid webhook retries.
    return { ok: true };
  }

  const gatewayEventId = String(event.gatewayEventId || "").trim();
  if (!gatewayEventId) {
    return { ok: false, statusCode: 400, message: "Missing gateway event id" };
  }

  const dedupeKey =
    event.type === "PAYMENT_FAILED"
      ? `razorpay:payment.failed:${gatewayEventId}`
      : `razorpay:payment.captured:${gatewayEventId}`;

  // Inbox idempotency (safe on retries)
  try {
    await WebhookEventInbox.create({
      gateway: "RAZORPAY",
      dedupeKey,
      eventId: gatewayEventId,
      status: "RECEIVED",
      rawHeaders: args.headers,
      rawBodyHash: crypto.createHash("sha256").update(args.rawBody).digest("hex"),
    });
  } catch (e: any) {
    if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
      // If we already processed this webhook, acknowledge. Otherwise reprocess (crash-safe).
      const existing = await WebhookEventInbox.findOne({ dedupeKey }).select("status").lean();
      const st = String((existing as any)?.status || "").toUpperCase();
      if (st === "PROCESSED") return { ok: true };
    }
    throw e;
  }

  const gatewayOrderId = String(event.gatewayOrderId || "").trim();
  if (!gatewayOrderId) {
    await WebhookEventInbox.updateOne({ dedupeKey }, { $set: { status: "FAILED", error: "Missing gatewayOrderId" } });
    return { ok: false, statusCode: 400, message: "Missing gateway order id" };
  }

  const intent = await PaymentIntent.findOne({ gateway: "RAZORPAY", gatewayOrderId });
  if (!intent) {
    // Fallback path: if intent is missing, attempt to derive DB orderId from gateway notes.
    const raw: any = (event as any).rawEvent || {};
    const derivedOrderId = String(
      raw?.payload?.payment?.entity?.notes?.orderId ||
        raw?.payload?.order?.entity?.notes?.orderId ||
        ""
    ).trim();

    if (!derivedOrderId) {
      await WebhookEventInbox.updateOne(
        { dedupeKey },
        { $set: { status: "FAILED", error: "PaymentIntent not found" } }
      );
      return { ok: false, statusCode: 404, message: "PaymentIntent not found" };
    }

    // If we can map it to a DB order, finalize idempotently.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(derivedOrderId).select("paymentStatus").session(session);
        if (!order) {
          await WebhookEventInbox.updateOne(
            { dedupeKey },
            { $set: { status: "FAILED", error: "Order not found" } },
            { session }
          );
          return;
        }

        const ps = String((order as any).paymentStatus || "").toUpperCase();
        if (ps !== "PAID" && event.type === "PAYMENT_CAPTURED") {
          console.info("[WEBHOOK][PAYMENT_CAPTURED]", {
            gateway: "RAZORPAY",
            orderId: String((order as any)._id),
            gatewayOrderId,
            gatewayEventId,
          });

          const out = await finalizeOrderOnCapturedPayment({
            orderId: String((order as any)._id),
            razorpayOrderId: gatewayOrderId,
            razorpayPaymentId: gatewayEventId,
            capturedAt: event.occurredAt,
            session,
          });

          if (out.updated) {
            console.info("[ORDER][MARKED_PAID]", {
              orderId: String((order as any)._id),
              gateway: "RAZORPAY",
              gatewayOrderId,
              gatewayEventId,
            });
          }
        }

        await WebhookEventInbox.updateOne(
          { dedupeKey },
          { $set: { status: "PROCESSED", processedAt: new Date() } },
          { session }
        );
      });
    } finally {
      session.endSession();
    }

    return { ok: true };
  }

  const orderId = String((intent as any).orderId || "");
  let userId = "";
  try {
    const order = await Order.findById(orderId).select("userId").lean();
    userId = String((order as any)?.userId || "");
  } catch {
    userId = "";
  }

  // Transactional finalize:
  // - Inbox row created (dedupe)
  // - Ledger appended (dedupe)
  // - PaymentIntent transitioned
  // - Inventory committed (CAPTURED) or released (FAILED)
  // - Order marked paid only AFTER inventory commit (enforced in finalizeOrderOnCapturedPayment)
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Ledger append (append-only, dedupe by dedupeKey)
      await appendLedgerEntry({
        paymentIntentId: String(intent._id),
        orderId: String(intent.orderId),
        gateway: "RAZORPAY",
        eventType: event.type === "PAYMENT_FAILED" ? "FAIL" : "CAPTURE",
        amount: Number(event.amount || intent.amount || 0),
        currency: String(event.currency || (intent as any).currency || "INR"),
        gatewayEventId,
        dedupeKey,
        occurredAt: event.occurredAt,
        raw: event.rawEvent,
        session,
      });

      const freshIntent = await PaymentIntent.findById(intent._id).session(session);
      if (!freshIntent) {
        throw new Error("PaymentIntent not found");
      }

      if (String((freshIntent as any).status || "").toUpperCase() === "EXPIRED") {
        await WebhookEventInbox.updateOne(
          { dedupeKey },
          { $set: { status: "PROCESSED", processedAt: new Date() } },
          { session }
        );
        return;
      }

      if (event.type === "PAYMENT_FAILED") {
        const from = String((freshIntent as any).status) as any;
        if (String(from).toUpperCase() !== "FAILED") {
          try {
            paymentIntentStateMachine.assertAllowedTransition(from, "FAILED");
          } catch {
            const err: any = new Error(
              `Invalid payment intent transition (${String(from)} → FAILED) in webhook`
            );
            err.statusCode = 400;
            throw err;
          }
          (freshIntent as any).status = "FAILED" as any;
          (freshIntent as any).paymentState = "FAILED" as any;
          await (freshIntent as any).save({ session });
        }

        // Release ACTIVE reservations early on payment failure (timeout sweeper is the fallback).
        await inventoryReservationService.releaseActiveReservationsForOrder({
          session,
          orderId: new mongoose.Types.ObjectId(String((freshIntent as any).orderId)),
        });
      } else {
        console.info("[WEBHOOK][PAYMENT_CAPTURED]", {
          gateway: "RAZORPAY",
          orderId: String((freshIntent as any).orderId),
          gatewayOrderId,
          gatewayEventId,
        });

        console.info("[BACKEND][PAYMENT_CAPTURED]", {
          gateway: "RAZORPAY",
          orderId: String((freshIntent as any).orderId),
          gatewayOrderId,
          gatewayEventId,
        });

        const from = String((freshIntent as any).status) as any;
        if (String(from).toUpperCase() !== "CAPTURED") {
          try {
            paymentIntentStateMachine.assertAllowedTransition(from, "CAPTURED");
          } catch {
            const err: any = new Error(
              `Invalid payment intent transition (${String(from)} → CAPTURED) in webhook`
            );
            err.statusCode = 400;
            throw err;
          }
          (freshIntent as any).status = "CAPTURED" as any;
          (freshIntent as any).paymentState = "PAID" as any;
          await (freshIntent as any).save({ session });
        }

        // Idempotency: if the order is already PAID (e.g. verified via client-side signature
        // before the webhook arrived), acknowledge without failing/retrying.
        const existingOrder = await Order.findById(String((freshIntent as any).orderId))
          .select("paymentStatus")
          .session(session);

        const ps = String((existingOrder as any)?.paymentStatus || "").toUpperCase();
        if (ps !== "PAID") {
          // Finalize order ONLY from ledger CAPTURE.
          // This call enforces: Order.paymentStatus=PAID implies inventory committed.
          const out = await finalizeOrderOnCapturedPayment({
            orderId: String((freshIntent as any).orderId),
            razorpayOrderId: gatewayOrderId,
            razorpayPaymentId: gatewayEventId,
            capturedAt: event.occurredAt,
            session,
          });

          if (out.updated) {
            console.info("[ORDER][MARKED_PAID]", {
              orderId: String((freshIntent as any).orderId),
              gateway: "RAZORPAY",
              gatewayOrderId,
              gatewayEventId,
            });

            console.info("[BACKEND][ORDER_MARKED_PAID]", {
              orderId: String((freshIntent as any).orderId),
              gateway: "RAZORPAY",
              gatewayOrderId,
              gatewayEventId,
            });
          }
        }
      }

      await WebhookEventInbox.updateOne(
        { dedupeKey },
        { $set: { status: "PROCESSED", processedAt: new Date() } },
        { session }
      );
    });

    incCounterWithLabels(
      "payment_events_total",
      {
        gateway: "RAZORPAY",
        type: "webhook",
        event: event.type,
        result: "processed",
      },
      1
    );

    // Socket-first: emit payment completion (success/failure) after commit.
    // Non-fatal if sockets are unavailable.
    try {
      if (args.io && userId && orderId) {
        args.io.to(`user_${userId}`).emit("payment_status_update", {
          data: {
            orderId,
            gateway: "RAZORPAY",
            status: event.type === "PAYMENT_FAILED" ? "failed" : "confirmed",
            gatewayEventId,
          },
        });
      }
    } catch {
    }

    // ============================================================
    // AUTOMATIC INVOICE GENERATION (POST-TRANSACTION)
    // ============================================================
    // Invoice is generated AFTER transaction commits to ensure:
    // 1. Payment transaction integrity is preserved
    // 2. Invoice generation does not block payment flow
    // 3. Invoice remains idempotent (service checks existing invoice)
    // ============================================================
    if (event.type === "PAYMENT_CAPTURED" && orderId) {
      try {
        const invoiceResult = await generateInvoiceForOrder(orderId);
        if (invoiceResult.success && invoiceResult.invoiceNumber) {
          console.info("[INVOICE][AUTO_GENERATED]", {
            orderId,
            invoiceNumber: invoiceResult.invoiceNumber,
            source: "WEBHOOK_PAYMENT_CAPTURED",
          });
        } else if (!invoiceResult.success) {
          logger.warn("[INVOICE][AUTO_GENERATION_SKIPPED]", {
            orderId,
            reason: invoiceResult.error || "Unknown reason",
            source: "WEBHOOK_PAYMENT_CAPTURED",
          });
        }
      } catch (invoiceError: any) {
        // CRITICAL: Do NOT rollback payment transaction.
        // Invoice failure is logged but does not affect payment status.
        capturePaymentError("invoice_generation_failed", invoiceError, {
          orderId,
          gatewayEventId,
          gatewayOrderId,
          eventType: event.type,
        });
        logger.error("[INVOICE][AUTO_GENERATION_FAILED]", {
          orderId,
          error: invoiceError?.message || "Unknown error",
          source: "WEBHOOK_PAYMENT_CAPTURED",
        });
      }
    }

    return { ok: true };
  } catch (e: any) {
    capturePaymentError("Webhook processing failed", e, {
      gatewayEventId,
      gatewayOrderId,
      eventType: event.type,
    });

    try {
      await WebhookEventInbox.updateOne(
        { dedupeKey },
        { $set: { status: "FAILED", error: String(e?.message || "Webhook finalize failed") } }
      );
    } catch {
    }

    incCounterWithLabels(
      "payment_events_total",
      {
        gateway: "RAZORPAY",
        type: "webhook",
        event: event.type,
        result: "failed",
      },
      1
    );
    return { ok: false, statusCode: 500, message: "Webhook finalize failed" };
  } finally {
    session.endSession();
  }
}
