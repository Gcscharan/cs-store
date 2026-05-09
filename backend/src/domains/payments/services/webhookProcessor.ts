import { logger } from '../../../utils/logger';
import crypto from "crypto";
import mongoose from "mongoose";

import { WebhookEventInbox } from "../models/WebhookEventInbox";
import { PaymentIntent } from "../models/PaymentIntent";
import { Order } from "../../../models/Order";
import { InventoryReservation } from "../../../models/InventoryReservation";
import { RazorpayAdapter } from "../adapters/RazorpayAdapter";
import { appendLedgerEntry } from "./ledgerService";
import * as paymentIntentStateMachine from "./paymentIntentStateMachine";
import { finalizeOrderOnCapturedPayment } from "./orderPaymentFinalizer";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";
import { incCounterWithLabels } from "../../../ops/opsMetrics";
import { capturePaymentError } from "../../../utils/logger";
import { generateInvoiceForOrder } from "../../invoice/services/invoiceService";
import { paymentMetricsService } from "./paymentMetricsService";

export async function processRazorpayWebhook(args: {
  rawBody: Buffer;
  headers: Record<string, any>;
  io?: any;
}): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }>{
  // NFR-004: Log webhook received with details
  logger.info('[Webhook] Processing Razorpay webhook', {
    gateway: 'RAZORPAY',
    hasRawBody: Buffer.isBuffer(args.rawBody),
    rawBodySize: Buffer.isBuffer(args.rawBody) ? args.rawBody.length : 0,
    timestamp: new Date().toISOString(),
  });

  const adapter = new RazorpayAdapter();

  const sig = adapter.verifyWebhookSignature({ rawBody: args.rawBody, headers: args.headers });
  if (!sig.ok) {
    // NFR-004: Log signature verification failure
    logger.error('[Webhook] Signature verification failed', {
      gateway: 'RAZORPAY',
      reason: sig.reason,
    });
    
    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "webhook", event: "SIGNATURE", result: "invalid" },
      1
    );
    return { ok: false, statusCode: 401, message: sig.reason };
  }

  // NFR-004: Log successful signature verification
  logger.info('[Webhook] Signature verified successfully', {
    gateway: 'RAZORPAY',
  });

  const event = adapter.parseWebhook({ rawBody: args.rawBody });

  // NFR-004: Log webhook event type and IDs
  logger.info('[Webhook] Webhook event parsed', {
    gateway: 'RAZORPAY',
    eventType: String((event as any)?.type || ''),
    gatewayEventId: String((event as any)?.gatewayEventId || ''),
    gatewayOrderId: String((event as any)?.gatewayOrderId || ''),
  });

  // Track webhook received
  paymentMetricsService.trackWebhookReceived({
    eventType: String((event as any)?.type || ''),
    razorpayOrderId: String((event as any)?.gatewayOrderId || ''),
    razorpayPaymentId: String((event as any)?.gatewayEventId || ''),
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
    // Fallback path: PaymentIntent not found for this gatewayOrderId.
    // Since orderBuilder.ts now always creates a PaymentIntent at checkout,
    // reaching here means the intent row is genuinely missing (data inconsistency).
    // Log as a critical alert for ops visibility — do NOT finalize payment.
    // This prevents a missing-intent from silently bypassing the active-attempt guard.
    const raw: any = (event as any).rawEvent || {};
    const derivedOrderId = String(
      raw?.payload?.payment?.entity?.notes?.orderId ||
        raw?.payload?.order?.entity?.notes?.orderId ||
        ""
    ).trim();

    logger.error("[WEBHOOK][INTENT_MISSING] PaymentIntent not found — will NOT finalize payment", {
      gatewayOrderId,
      gatewayEventId,
      eventType: event.type,
      derivedOrderId: derivedOrderId || "(none)",
      note: "orderBuilder should always create PaymentIntent at checkout — investigate missing row",
    });

    await WebhookEventInbox.updateOne(
      { dedupeKey },
      { $set: { status: "FAILED", error: "PaymentIntent not found — finalization skipped for safety" } }
    );
    // Return ok: true so Razorpay does not retry — the missing intent is a data problem, not a transient one.
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
        // NFR-004: Log payment failed event
        logger.info('[Webhook] Payment failed event received', {
          gateway: 'RAZORPAY',
          orderId: String((freshIntent as any).orderId),
          gatewayOrderId,
          gatewayEventId,
        });

        // Track metrics: payment failure
        paymentMetricsService.trackPaymentFailure({
          orderId: String((freshIntent as any).orderId),
          razorpayOrderId: gatewayOrderId,
          reason: 'payment_failed_webhook',
        });

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
          // Optimistic lock: only write if version hasn't changed since we read freshIntent
          const failRes = await PaymentIntent.updateOne(
            { _id: freshIntent._id, version: (freshIntent as any).version ?? 0 },
            {
              $set: { status: "FAILED" as any, paymentState: "FAILED" as any },
              $inc: { version: 1 },
            },
            { session }
          );
          if (Number((failRes as any).modifiedCount) === 0) {
            // Another worker already transitioned this intent — idempotent, continue
            logger.info('[Webhook] PaymentIntent already transitioned by concurrent worker (FAILED)', {
              intentId: String(freshIntent._id),
            });
          }
        }

        // Release ACTIVE reservations early on payment failure (timeout sweeper is the fallback).
        await inventoryReservationService.releaseActiveReservationsForOrder({
          session,
          orderId: new mongoose.Types.ObjectId(String((freshIntent as any).orderId)),
        });
      } else {
        // NFR-004: Log payment captured event
        logger.info('[Webhook] Payment captured event received', {
          gateway: 'RAZORPAY',
          orderId: String((freshIntent as any).orderId),
          gatewayOrderId,
          gatewayEventId,
          verificationMethod: 'webhook',
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
          // Optimistic lock: only write if version hasn't changed since we read freshIntent
          const captureRes = await PaymentIntent.updateOne(
            { _id: freshIntent._id, version: (freshIntent as any).version ?? 0 },
            {
              $set: { status: "CAPTURED" as any, paymentState: "PAID" as any },
              $inc: { version: 1 },
            },
            { session }
          );
          if (Number((captureRes as any).modifiedCount) === 0) {
            // Another worker already transitioned — idempotent, continue to order finalization
            logger.info('[Webhook] PaymentIntent already transitioned by concurrent worker (CAPTURED)', {
              intentId: String(freshIntent._id),
            });
          }
        }

        // Idempotency: if the order is already PAID (e.g. verified via client-side signature
        // before the webhook arrived), acknowledge without failing/retrying.
        const existingOrder = await Order.findById(String((freshIntent as any).orderId))
          .select("paymentStatus totalAmount activePaymentIntentId")
          .session(session);

        // Active intent guard: only the current active attempt may mark the order PAID.
        // If the order was retried after this attempt was created, a newer intent is now
        // active and this webhook is for a stale attempt — ignore it.
        const activeIntentId = String((existingOrder as any)?.activePaymentIntentId || '');
        const thisIntentId = String((freshIntent as any)._id || '');
        if (activeIntentId && thisIntentId && activeIntentId !== thisIntentId) {
          logger.warn('[Webhook] Stale payment intent — ignoring PAYMENT_CAPTURED for old attempt', {
            orderId: String((freshIntent as any).orderId),
            activePaymentIntentId: activeIntentId,
            webhookIntentId: thisIntentId,
            gatewayOrderId,
          });
          await WebhookEventInbox.updateOne(
            { dedupeKey },
            { $set: { status: "PROCESSED", processedAt: new Date() } },
            { session }
          );
          return;
        }

        const ps = String((existingOrder as any)?.paymentStatus || "").toUpperCase();
        if (ps !== "PAID") {
          // 🚨 CRITICAL SECURITY FIX #3: AMOUNT VALIDATION (ANTI-FRAUD)
          // Verify payment amount matches order total before marking as PAID
          const orderTotal = Number((existingOrder as any)?.totalAmount || 0);
          const paymentAmount = Number(event.amount || 0);
          const expectedAmountPaise = Math.round(orderTotal * 100);
          
          if (paymentAmount !== expectedAmountPaise) {
            logger.error("[WEBHOOK][AMOUNT_MISMATCH] Payment amount does not match order total", {
              orderId: String((existingOrder as any)?._id),
              orderTotal,
              expectedAmountPaise,
              paymentAmount,
              difference: paymentAmount - expectedAmountPaise,
            });
            
            await WebhookEventInbox.updateOne(
              { dedupeKey },
              { 
                $set: { 
                  status: "FAILED", 
                  error: `Amount mismatch: expected ${expectedAmountPaise} paise, got ${paymentAmount} paise` 
                } 
              },
              { session }
            );
            
            const err: any = new Error("Amount mismatch - possible fraud attempt");
            err.statusCode = 400;
            throw err;
          }
          
          // CRITICAL: Commit inventory BEFORE finalization
          // Inventory locking invariant: Never set Order.paymentStatus=PAID unless inventory is committed
          const orderItems = Array.isArray((existingOrder as any)?.items) ? ((existingOrder as any).items as any[]) : [];
          const items = orderItems.map((it: any) => ({
            productId: it.productId,
            qty: Number(it.qty ?? it.quantity ?? 0),
          }));

          if (items.length > 0) {
            await inventoryReservationService.reserveForOrder({
              session,
              orderId: new mongoose.Types.ObjectId(String((freshIntent as any).orderId)),
              ttlMs: 30 * 60_000,
              items,
            });

            const res = await inventoryReservationService.commitReservationsForOrder({
              session,
              orderId: new mongoose.Types.ObjectId(String((freshIntent as any).orderId)),
            });

            if (!res.committed) {
              // Either already committed, or missing reservations. Refuse to mark paid if nothing was committed
              // and there is no evidence of a previous commit.
              const committedCount = await InventoryReservation.countDocuments({
                orderId: new mongoose.Types.ObjectId(String((freshIntent as any).orderId)),
                status: "COMMITTED",
              }).session(session);
              if (Number(committedCount || 0) === 0) {
                const err: any = new Error("Inventory commit missing for paid order");
                err.statusCode = 409;
                throw err;
              }
            }
          }
          
          // Finalize order ONLY from ledger CAPTURE.
          // Inventory commit happens BEFORE this call (above).
          const out = await finalizeOrderOnCapturedPayment({
            orderId: String((freshIntent as any).orderId),
            razorpayOrderId: gatewayOrderId,
            razorpayPaymentId: gatewayEventId,
            capturedAt: event.occurredAt,
            confirmedBy: 'WEBHOOK',
            session,
          });

          if (out.updated) {
            logger.info("[ORDER][MARKED_PAID]", {
              orderId: String((freshIntent as any).orderId),
              gateway: "RAZORPAY",
              gatewayOrderId,
              gatewayEventId,
              verificationMethod: "webhook",
            });

            // Track metrics: payment success via webhook
            // Calculate verification time from order creation to webhook
            const order = await Order.findById(String((freshIntent as any).orderId))
              .select('createdAt')
              .session(session);
            const verificationTimeMs = order 
              ? Date.now() - new Date(order.createdAt).getTime()
              : 0;

            paymentMetricsService.trackPaymentSuccess({
              orderId: String((freshIntent as any).orderId),
              razorpayOrderId: gatewayOrderId,
              razorpayPaymentId: gatewayEventId,
              verificationTimeMs,
              verificationMethod: 'webhook',
            });
          } else {
            // Order already finalized by another worker (webhook retry or concurrent polling)
            logger.info("[ORDER][ALREADY_FINALIZED]", {
              orderId: String((freshIntent as any).orderId),
              gateway: "RAZORPAY",
              gatewayOrderId,
              gatewayEventId,
              verificationMethod: "webhook",
              note: "Another worker already finalized this order (idempotent)",
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
