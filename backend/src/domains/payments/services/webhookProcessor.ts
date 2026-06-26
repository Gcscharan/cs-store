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
import { InventoryReservationConflictError } from "../../orders/services/inventoryReservationService";
import { incCounterWithLabels } from "../../../ops/opsMetrics";
import { capturePaymentError } from "../../../utils/logger";
import { generateInvoiceForOrder } from "../../invoice/services/invoiceService";
import { paymentMetricsService } from "./paymentMetricsService";
import { publish } from "../../events/eventBus";
import { stableEventId } from "../../events/eventId";
import { createPaymentSuccessEvent, createPaymentFailedEvent } from "../../events/payment.events";
import { RefundRequest } from "../models/RefundRequest";
import { markRefundCompleted, executeRefund } from "../refunds/refundService";

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

  if (event.type !== "PAYMENT_CAPTURED" && event.type !== "PAYMENT_FAILED" && event.type !== "REFUND_PROCESSED") {
    // Acknowledge unknown / unhandled events to avoid webhook retries.
    return { ok: true };
  }

  const gatewayEventId = String(event.gatewayEventId || "").trim();
  if (!gatewayEventId) {
    return { ok: false, statusCode: 400, message: "Missing gateway event id" };
  }

  // ── Refund webhook: confirm a refund actually moved money at the gateway ──
  // This is the authoritative completion path. It is idempotent: the ledger
  // REFUND entry is deduped by dedupeKey, and markRefundCompleted is a no-op
  // once the request is COMPLETED. Also handles DASHBOARD refunds (refunds
  // issued manually in Razorpay) so the ledger never diverges from the gateway.
  if (event.type === "REFUND_PROCESSED") {
    return processRefundWebhook(event, args);
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
  // INV-1: set inside the txn when capture succeeded but inventory was unavailable.
  // The auto-refund + notification run AFTER the txn commits (durability first).
  let capturedNoStockOrderId = "";
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

        // Publish PAYMENT_FAILED event to the event bus within the transaction context
        if (userId) {
          await publish(
            createPaymentFailedEvent({
              source: "webhookProcessor",
              actor: { type: "system" },
              eventId: stableEventId(`payment:${String((freshIntent as any).orderId)}:failed`),
              userId,
              orderId: String((freshIntent as any).orderId),
              paymentId: gatewayEventId,
              amount: Number(event.amount || intent.amount || 0),
            }),
            { session }
          );
        }
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
          .select("paymentStatus totalAmount activePaymentIntentId items")
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
          // Note: event.amount is in rupees (RazorpayAdapter converts paise→rupees)
          // and orderTotal is also in rupees, so compare directly.
          const orderTotal = Number((existingOrder as any)?.totalAmount || 0);
          const paymentAmount = Number(event.amount || 0);
          
          if (paymentAmount !== orderTotal) {
            logger.error("[WEBHOOK][AMOUNT_MISMATCH] Payment amount does not match order total", {
              orderId: String((existingOrder as any)?._id),
              orderTotal,
              paymentAmount,
              difference: paymentAmount - orderTotal,
            });
            
            await WebhookEventInbox.updateOne(
              { dedupeKey },
              { 
                $set: { 
                  status: "FAILED", 
                  error: `Amount mismatch: expected ${orderTotal}, got ${paymentAmount}` 
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

          let inventoryCommitted = true;

          if (items.length > 0) {
            try {
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
            } catch (invErr: any) {
              // INV-1: payment captured but the item sold out during a slow capture
              // (reservation expired → swept → bought by someone else). We must NOT
              // throw (that would roll back the CAPTURE ledger entry and loop forever
              // in reconciliation). Instead: keep the ledger CAPTURE (money DID move),
              // do NOT mark the order PAID, flag it captured-no-stock, and auto-refund.
              const isStockConflict =
                invErr instanceof InventoryReservationConflictError ||
                Number(invErr?.statusCode) === 409;

              if (!isStockConflict) {
                throw invErr; // unexpected error — let the transaction roll back & retry
              }

              inventoryCommitted = false;

              logger.opsAlert("[ORDER][CAPTURED_NO_STOCK] Payment captured but inventory unavailable — auto-refunding", {
                orderId: String((freshIntent as any).orderId),
                gatewayOrderId,
                gatewayEventId,
              });

              // Mark the order with the terminal captured-no-stock flag (NOT PAID).
              // Uses updateOne with non-status fields to avoid the orderStatus guard.
              await Order.updateOne(
                { _id: (freshIntent as any).orderId },
                { $set: { capturedNoStock: true, capturedNoStockAt: new Date() } },
                { session }
              );

              await WebhookEventInbox.updateOne(
                { dedupeKey },
                { $set: { status: "PROCESSED", processedAt: new Date() } },
                { session }
              );
            }
          }

          if (!inventoryCommitted) {
            // Schedule the auto-refund + customer notification AFTER the transaction
            // commits (so the CAPTURE ledger + capturedNoStock flag are durable first).
            capturedNoStockOrderId = String((freshIntent as any).orderId);
            return; // exit the withTransaction callback — do NOT finalize as PAID
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

            // Publish PAYMENT_SUCCESS event to the event bus within the transaction context
            if (userId) {
              await publish(
                createPaymentSuccessEvent({
                  source: "webhookProcessor",
                  actor: { type: "system" },
                  eventId: stableEventId(`payment:${String((freshIntent as any).orderId)}:success`),
                  userId,
                  orderId: String((freshIntent as any).orderId),
                  paymentId: gatewayEventId,
                  amount: Number(event.amount || intent.amount || 0),
                }),
                { session }
              );
            }

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

    // ── INV-1: captured-but-out-of-stock → auto-refund + notify (post-commit) ──
    // Runs only after the txn durably persisted the CAPTURE ledger entry and the
    // capturedNoStock flag. The refund money path reverses the capture; the order
    // is left in its non-PAID terminal captured-no-stock state.
    if (capturedNoStockOrderId) {
      await handleCapturedNoStock({
        orderId: capturedNoStockOrderId,
        paymentIntentId: String(intent._id),
        userId,
        io: args.io,
      });
    }

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

/**
 * Processes a refund.processed webhook.
 *
 * Two cases:
 *  1. App-initiated refund — the refund carries our refundRequestId in notes.
 *     We finalize via markRefundCompleted (idempotent; appends the REFUND ledger
 *     entry + transitions the RefundRequest to COMPLETED).
 *  2. DASHBOARD refund — a refund issued manually in the Razorpay dashboard has
 *     no refundRequestId. Without handling this, the ledger would say "refunded 0"
 *     while the gateway moved real money. We record a synthetic REFUND ledger
 *     entry (deduped by the gateway refund id) so the ledger NEVER diverges from
 *     the gateway. This closes the audit's W-2 blind spot.
 *
 * Idempotent: WebhookEventInbox dedupes the delivery; the ledger dedupeKey
 * dedupes the money movement; markRefundCompleted is a no-op once COMPLETED.
 */
async function processRefundWebhook(
  event: any,
  args: { rawBody: Buffer; headers: Record<string, any>; io?: any }
): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }> {
  const gatewayRefundId = String(event.gatewayRefundId || event.gatewayEventId || "").trim();
  const refundRequestId = String(event.refundRequestId || "").trim();
  const dedupeKey = `razorpay:refund.processed:${gatewayRefundId}`;

  // Webhook inbox dedupe (safe on Razorpay retries).
  try {
    await WebhookEventInbox.create({
      gateway: "RAZORPAY",
      dedupeKey,
      eventId: gatewayRefundId,
      status: "RECEIVED",
      rawHeaders: args.headers,
      rawBodyHash: crypto.createHash("sha256").update(args.rawBody).digest("hex"),
    });
  } catch (e: any) {
    if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
      const existing = await WebhookEventInbox.findOne({ dedupeKey }).select("status").lean();
      if (String((existing as any)?.status || "").toUpperCase() === "PROCESSED") {
        return { ok: true };
      }
    } else {
      throw e;
    }
  }

  try {
    if (refundRequestId && mongoose.Types.ObjectId.isValid(refundRequestId)) {
      // Case 1: app-initiated refund — finalize via the canonical path.
      await markRefundCompleted({
        refundRequestId,
        gatewayRefundId,
        occurredAt: event.occurredAt,
        raw: event.rawEvent,
      });
      logger.info("[Webhook][Refund] App-initiated refund completed", {
        refundRequestId,
        gatewayRefundId,
      });
    } else {
      // Case 2: dashboard refund — record a synthetic REFUND ledger entry so the
      // ledger matches the gateway. We resolve the paymentIntent/order from the
      // payment id the refund targeted.
      const gatewayPaymentId = String(event.gatewayPaymentId || "").trim();
      const amount = Number(event.amount || 0);

      if (!gatewayPaymentId || !Number.isFinite(amount) || amount <= 0) {
        // Can't attribute it — acknowledge to stop retries but flag for ops.
        logger.opsAlert("[Webhook][Refund] Dashboard refund could not be attributed to a payment", {
          gatewayRefundId,
          gatewayPaymentId,
          amount,
        });
        await WebhookEventInbox.updateOne(
          { dedupeKey },
          { $set: { status: "FAILED", error: "Unattributable dashboard refund" } }
        );
        return { ok: true };
      }

      // Find the order/intent by the captured payment id.
      const order = await Order.findOne({ razorpayPaymentId: gatewayPaymentId })
        .select("_id")
        .lean();
      const intent = await PaymentIntent.findOne({
        ...(order ? { orderId: (order as any)._id } : {}),
        status: "CAPTURED",
      })
        .select("_id orderId gateway")
        .lean();

      if (!order || !intent) {
        logger.opsAlert("[Webhook][Refund] Dashboard refund: no matching captured order/intent", {
          gatewayRefundId,
          gatewayPaymentId,
        });
        await WebhookEventInbox.updateOne(
          { dedupeKey },
          { $set: { status: "FAILED", error: "No matching captured order/intent" } }
        );
        return { ok: true };
      }

      // Append a synthetic REFUND ledger entry (negative, deduped by refund id).
      await appendLedgerEntry({
        paymentIntentId: String((intent as any)._id),
        orderId: String((order as any)._id),
        gateway: String((intent as any).gateway || "RAZORPAY") as any,
        eventType: "REFUND",
        refundId: `dashboard:${gatewayRefundId}`,
        amount: -Math.abs(amount),
        currency: String(event.currency || "INR"),
        gatewayEventId: gatewayRefundId,
        dedupeKey: `refund:dashboard:${gatewayRefundId}`,
        occurredAt: event.occurredAt,
        raw: event.rawEvent,
      });

      logger.info("[Webhook][Refund] Dashboard refund recorded to ledger", {
        gatewayRefundId,
        gatewayPaymentId,
        orderId: String((order as any)._id),
        amount,
      });
    }

    await WebhookEventInbox.updateOne(
      { dedupeKey },
      { $set: { status: "PROCESSED", processedAt: new Date() } }
    );

    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "webhook", event: "REFUND_PROCESSED", result: "processed" },
      1
    );

    return { ok: true };
  } catch (e: any) {
    capturePaymentError("Refund webhook processing failed", e, { gatewayRefundId, refundRequestId });
    await WebhookEventInbox.updateOne(
      { dedupeKey },
      { $set: { status: "FAILED", error: String(e?.message || "refund webhook failed") } }
    ).catch(() => {});
    return { ok: false, statusCode: 500, message: "Refund webhook processing failed" };
  }
}

/**
 * INV-1 outcome handler: payment captured but inventory could not be committed.
 *
 * Deterministic business process (per architecture decision):
 *   1. Auto-create a refund request for the captured amount (idempotent per order
 *      via a stable idempotency key) — the money path reversal.
 *   2. Execute the refund against the gateway (kill-switch + 3-layer idempotency).
 *   3. Notify the customer ("Payment Captured — Out of Stock", refund initiated).
 *   4. opsAlert the merchant (already emitted at detection time).
 *
 * The order is left NOT PAID with capturedNoStock=true (terminal). No retry loop,
 * no stuck order. Fully idempotent: a duplicate webhook re-enters here but the
 * refund idempotency key + RefundRequest dedupe prevent a second refund.
 */
async function handleCapturedNoStock(args: {
  orderId: string;
  paymentIntentId: string;
  userId: string;
  io?: any;
}): Promise<void> {
  const { orderId, paymentIntentId, userId, io } = args;

  try {
    // Captured amount for this intent (from the immutable ledger).
    const { LedgerEntry } = await import("../models/LedgerEntry");
    const agg = await LedgerEntry.aggregate([
      {
        $match: {
          orderId: new mongoose.Types.ObjectId(orderId),
          paymentIntentId: new mongoose.Types.ObjectId(paymentIntentId),
          eventType: "CAPTURE",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const capturedAmount = Number(agg?.[0]?.total || 0);

    if (!Number.isFinite(capturedAmount) || capturedAmount <= 0) {
      logger.opsAlert("[INV-1] captured-no-stock but no CAPTURE ledger amount found — manual review", {
        orderId,
        paymentIntentId,
      });
      return;
    }

    // Idempotent refund request: stable key per order so a duplicate webhook can't
    // create a second refund. createRefundRequestInternal requires order PAID, which
    // we intentionally did NOT set — so create the RefundRequest directly here. The
    // captured ledger entry is the authorization (money provably moved).
    const idempotencyKey = `captured_no_stock:${orderId}:${paymentIntentId}`;
    let refundRequestId = "";

    const existing = await RefundRequest.findOne({ idempotencyKey }).select("_id").lean();
    if (existing) {
      refundRequestId = String((existing as any)._id);
    } else {
      try {
        const doc = await RefundRequest.create({
          orderId: new mongoose.Types.ObjectId(orderId),
          paymentIntentId: new mongoose.Types.ObjectId(paymentIntentId),
          amount: capturedAmount,
          currency: "INR",
          status: "REQUESTED",
          reason: "Payment captured but item out of stock (auto-refund)",
          idempotencyKey,
        });
        refundRequestId = String((doc as any)._id);
      } catch (e: any) {
        if (e?.code === 11000 || String(e?.message || "").includes("E11000")) {
          const r = await RefundRequest.findOne({ idempotencyKey }).select("_id").lean();
          refundRequestId = String((r as any)?._id || "");
        } else {
          throw e;
        }
      }
    }

    // Execute the refund (idempotent; safe to re-run). Failures here are retried
    // by the refund reconciliation scanner — never throws out of this handler.
    if (refundRequestId) {
      try {
        await executeRefund({ refundRequestId });
      } catch (e) {
        logger.warn("[INV-1] Auto-refund execution deferred to reconciliation", {
          orderId,
          refundRequestId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Notify the customer through the production notification pipeline.
    if (userId) {
      try {
        await publish(
          createPaymentFailedEvent({
            source: "webhookProcessor:capturedNoStock",
            actor: { type: "system" },
            eventId: stableEventId(`payment:${orderId}:captured_no_stock`),
            userId,
            orderId,
            paymentId: paymentIntentId,
            amount: capturedAmount,
            title: "Refund Initiated — Item Unavailable",
            body: "Your payment was received but the item went out of stock. We've started a full refund.",
          })
        );
      } catch {
        // Notification is non-critical to the money path.
      }

      // Real-time hint for the app.
      try {
        if (io) {
          io.to(`user_${userId}`).emit("payment_status_update", {
            data: { orderId, status: "captured_no_stock", refundInitiated: true },
          });
        }
      } catch {
        // ignore
      }
    }

    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "captured_no_stock", event: "AUTO_REFUND", result: "initiated" },
      1
    );
  } catch (e) {
    // Last-resort: never throw from the post-commit handler. The capture is durable
    // and the order is flagged capturedNoStock; ops has been alerted to reconcile.
    capturePaymentError("[INV-1] captured-no-stock handler failed", e as Error, { orderId, paymentIntentId });
  }
}
