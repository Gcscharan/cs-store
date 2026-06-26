import crypto from "crypto";
import Razorpay from "razorpay";

import type {
  GatewayCreateOrderInput,
  GatewayCreateOrderResult,
  GatewayRefundInput,
  GatewayRefundResult,
  NormalizedWebhookEvent,
  PaymentGatewayAdapter,
} from "./PaymentGatewayAdapter";

export class RazorpayAdapter implements PaymentGatewayAdapter {
  public readonly gateway = "RAZORPAY" as const;

  private readonly razorpay: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    const isTest = process.env.NODE_ENV === "test";

    const keyId = String(process.env.RAZORPAY_KEY_ID || (isTest ? "rzp_test_key" : "")).trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || (isTest ? "rzp_test_secret" : "")).trim();
    const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || (isTest ? "test-webhook-secret" : "")).trim();

    if (!keyId || !keySecret) {
      throw new Error("RazorpayAdapter misconfigured: RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET required");
    }
    if (!webhookSecret) {
      throw new Error("RazorpayAdapter misconfigured: RAZORPAY_WEBHOOK_SECRET required");
    }

    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;

    this.razorpay = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  async createOrder(input: GatewayCreateOrderInput): Promise<GatewayCreateOrderResult> {
    const currency = String(input.currency || "INR").toUpperCase();

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Invalid amount");
    }

    const amountInPaise = Math.round(input.amount * 100);

    const order: any = await new Promise((resolve, reject) => {
      this.razorpay.orders.create(
        {
          amount: amountInPaise,
          currency,
          receipt: input.receipt,
          notes: input.notes || {},
          payment_capture: true,
        },
        (err: any, data: any) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    });

    return {
      gateway: this.gateway,
      gatewayOrderId: String(order.id),
      checkoutPayload: {
        gateway: this.gateway,
        keyId: this.keyId,
        razorpayOrderId: String(order.id),
        amount: Number(order.amount),
        currency: String(order.currency),
      },
    };
  }

  verifyWebhookSignature(args: {
    rawBody: Buffer;
    headers: Record<string, any>;
  }): { ok: true } | { ok: false; reason: string } {
    const signatureHeader =
      (args.headers?.["x-razorpay-signature"] as string) ||
      (args.headers?.["X-Razorpay-Signature"] as string) ||
      "";

    const signature = String(signatureHeader || "").trim();
    if (!signature) return { ok: false, reason: "Missing x-razorpay-signature" };

    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(args.rawBody)
      .digest("hex");

    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(signature);
    if (expectedBuf.length !== receivedBuf.length) {
      return { ok: false, reason: "Invalid signature" };
    }

    const ok = crypto.timingSafeEqual(expectedBuf, receivedBuf);
    return ok ? { ok: true } : { ok: false, reason: "Invalid signature" };
  }

  parseWebhook(args: { rawBody: Buffer }): NormalizedWebhookEvent {
    let body: any;
    try {
      body = JSON.parse(args.rawBody.toString("utf8"));
    } catch {
      return {
        gateway: this.gateway,
        type: "UNKNOWN",
        gatewayEventId: "unknown",
        rawEvent: null,
      };
    }

    const event = String(body?.event || "");

    if (event === "order.paid") {
      // STRICT RULE: do not treat order.paid as payment capture authority.
      // Only payment.captured may mark a payment as captured/paid.
      return {
        gateway: this.gateway,
        type: "UNKNOWN",
        gatewayEventId: String(body?.id || body?.event || "unknown"),
        rawEvent: body,
      };
    }

    if (event === "payment.captured") {
      const payment = body?.payload?.payment?.entity;
      const paymentId = String(payment?.id || "");
      const gatewayOrderId = String(payment?.order_id || "");
      const amountPaise = Number(payment?.amount || 0);
      const currency = String(payment?.currency || "INR");
      const occurredAt = payment?.created_at
        ? new Date(Number(payment.created_at) * 1000)
        : undefined;

      return {
        gateway: this.gateway,
        type: "PAYMENT_CAPTURED",
        gatewayEventId: paymentId || gatewayOrderId || "unknown",
        gatewayOrderId: gatewayOrderId || undefined,
        amount: Number.isFinite(amountPaise) ? amountPaise / 100 : undefined,
        currency,
        occurredAt,
        rawEvent: body,
      };
    }

    if (event === "payment.failed") {
      const payment = body?.payload?.payment?.entity;
      const paymentId = String(payment?.id || "");
      const gatewayOrderId = String(payment?.order_id || "");

      return {
        gateway: this.gateway,
        type: "PAYMENT_FAILED",
        gatewayEventId: paymentId || gatewayOrderId || "unknown",
        gatewayOrderId: gatewayOrderId || undefined,
        rawEvent: body,
      };
    }

    if (event === "refund.processed" || event === "refund.created") {
      const refund = body?.payload?.refund?.entity;
      const refundId = String(refund?.id || "");
      const paymentId = String(refund?.payment_id || "");
      const amountPaise = Number(refund?.amount || 0);
      const currency = String(refund?.currency || "INR");
      // We stamp our RefundRequest id into refund notes when executing, so a
      // duplicated/out-of-order webhook can be matched back to the exact request.
      const refundRequestId = String(refund?.notes?.refundRequestId || "");
      const occurredAt = refund?.created_at
        ? new Date(Number(refund.created_at) * 1000)
        : undefined;

      return {
        gateway: this.gateway,
        type: "REFUND_PROCESSED",
        gatewayEventId: refundId || paymentId || "unknown",
        gatewayPaymentId: paymentId || undefined,
        gatewayRefundId: refundId || undefined,
        refundRequestId: refundRequestId || undefined,
        amount: Number.isFinite(amountPaise) ? amountPaise / 100 : undefined,
        currency,
        occurredAt,
        rawEvent: body,
      };
    }

    return {
      gateway: this.gateway,
      type: "UNKNOWN",
      gatewayEventId: String(body?.id || body?.event || "unknown"),
      rawEvent: body,
    };
  }

  /**
   * Executes a refund against Razorpay.
   *
   * Idempotency: passes an `Idempotency-Key` header so Razorpay dedupes
   * duplicate refund attempts at the provider level (a retry with the same key
   * returns the same refund instead of creating a second one). We also stamp
   * our RefundRequest id into `notes.refundRequestId` so the refund webhook can
   * be matched back to the exact request.
   */
  async refundPayment(input: GatewayRefundInput): Promise<GatewayRefundResult> {
    if (!input.gatewayPaymentId) {
      throw new Error("gatewayPaymentId is required for refund");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Invalid refund amount");
    }

    const amountInPaise = Math.round(input.amount * 100);

    const opts: any = {
      amount: amountInPaise,
      speed: "normal",
      notes: input.notes || {},
    };

    const requestOptions = input.idempotencyKey
      ? { "Idempotency-Key": input.idempotencyKey }
      : undefined;

    const refund: any = await (this.razorpay.payments as any).refund(
      input.gatewayPaymentId,
      opts,
      requestOptions
    );

    return {
      gatewayRefundId: String(refund?.id || ""),
      status: String(refund?.status || "pending"),
      amount: Number(refund?.amount || amountInPaise) / 100,
      raw: refund,
    };
  }
}
