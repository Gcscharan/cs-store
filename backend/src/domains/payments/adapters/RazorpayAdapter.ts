import crypto from "crypto";
import Razorpay from "razorpay";

import type {
  GatewayCreateOrderInput,
  GatewayCreateOrderResult,
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
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();

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

    return {
      gateway: this.gateway,
      type: "UNKNOWN",
      gatewayEventId: String(body?.id || body?.event || "unknown"),
      rawEvent: body,
    };
  }
}
