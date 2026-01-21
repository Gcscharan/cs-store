import crypto from "crypto";

import { WebhookEventInbox } from "../models/WebhookEventInbox";
import { PaymentIntent } from "../models/PaymentIntent";
import { RazorpayAdapter } from "../adapters/RazorpayAdapter";
import { appendLedgerEntry } from "./ledgerService";
import { assertAllowedTransition } from "./paymentIntentStateMachine";
import { finalizeOrderOnCapturedPayment } from "./orderPaymentFinalizer";

export async function processRazorpayWebhook(args: {
  rawBody: Buffer;
  headers: Record<string, any>;
}): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }>{
  const adapter = new RazorpayAdapter();

  const sig = adapter.verifyWebhookSignature({ rawBody: args.rawBody, headers: args.headers });
  if (!sig.ok) {
    return { ok: false, statusCode: 401, message: sig.reason };
  }

  const event = adapter.parseWebhook({ rawBody: args.rawBody });

  if (event.type !== "PAYMENT_CAPTURED") {
    // We only finalize on CAPTURED; acknowledge others to avoid retries.
    return { ok: true };
  }

  const gatewayEventId = String(event.gatewayEventId || "").trim();
  if (!gatewayEventId) {
    return { ok: false, statusCode: 400, message: "Missing gateway event id" };
  }

  const dedupeKey = `razorpay:payment.captured:${gatewayEventId}`;

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
      return { ok: true };
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
    await WebhookEventInbox.updateOne({ dedupeKey }, { $set: { status: "FAILED", error: "PaymentIntent not found" } });
    return { ok: false, statusCode: 404, message: "PaymentIntent not found" };
  }

  // Ledger append (append-only, dedupe by dedupeKey)
  await appendLedgerEntry({
    paymentIntentId: String(intent._id),
    orderId: String(intent.orderId),
    gateway: "RAZORPAY",
    eventType: "CAPTURE",
    amount: Number(event.amount || intent.amount),
    currency: String(event.currency || intent.currency || "INR"),
    gatewayEventId,
    dedupeKey,
    occurredAt: event.occurredAt,
    raw: event.rawEvent,
  });

  // Advance PaymentIntent state
  const from = String(intent.status) as any;
  assertAllowedTransition(from, "CAPTURED");
  intent.status = "CAPTURED" as any;
  await intent.save();

  // Finalize order ONLY from ledger CAPTURE
  await finalizeOrderOnCapturedPayment({
    orderId: String(intent.orderId),
    razorpayOrderId: gatewayOrderId,
    razorpayPaymentId: gatewayEventId,
    capturedAt: event.occurredAt,
  });

  await WebhookEventInbox.updateOne(
    { dedupeKey },
    { $set: { status: "PROCESSED", processedAt: new Date() } }
  );

  return { ok: true };
}
