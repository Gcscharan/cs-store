import crypto from "crypto";
import request from "supertest";

import app from "../../src/app";
import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";
import { WebhookEventInbox } from "../../src/domains/payments/models/WebhookEventInbox";

describe("Webhook capture idempotency (canonical truth pipeline)", () => {
  const prevWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  });

  afterAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = prevWebhookSecret;
  });

  it("processes payment.captured exactly once: inbox dedupe prevents reprocessing; ledger remains append-only", async () => {
    const user = await (global as any).createTestUser({ email: "wh-user@example.com" });
    const product = await (global as any).createTestProduct({ price: 100, stock: 10, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, { paymentStatus: "PENDING", totalAmount: 100 });

    const gatewayOrderId = "order_test_123";
    const gatewayPaymentId = "pay_test_123";

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "wh_pi_1",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 100, currency: "INR" },
      isLocked: false,
    });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            amount: 10000,
            currency: "INR",
            created_at: 1767139200,
          },
        },
      },
    };

    const bodyString = JSON.stringify(payload);
    const rawBody = Buffer.from(bodyString);
    const signature = crypto
      .createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET))
      .update(rawBody)
      .digest("hex");

    const dedupeKey = `razorpay:payment.captured:${gatewayPaymentId}`;

    const res1 = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({ ok: true });

    const ledgerAfter1 = await LedgerEntry.find({
      orderId: order._id,
      paymentIntentId: pi._id,
      eventType: "CAPTURE",
      dedupeKey,
    }).lean();

    expect(ledgerAfter1.length).toBe(1);

    const inboxAfter1 = await WebhookEventInbox.find({ dedupeKey }).lean();
    expect(inboxAfter1.length).toBe(1);

    const orderAfter1 = await Order.findById(order._id).select("paymentStatus razorpayOrderId razorpayPaymentId").lean();
    expect(String((orderAfter1 as any)?.paymentStatus || "").toUpperCase()).toBe("PAID");

    const piAfter1 = await PaymentIntent.findById(pi._id).select("status").lean();
    expect(String((piAfter1 as any)?.status || "").toUpperCase()).toBe("CAPTURED");

    const res2 = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res2.status).toBe(200);
    expect(res2.body).toEqual({ ok: true });

    const ledgerAfter2 = await LedgerEntry.find({
      orderId: order._id,
      paymentIntentId: pi._id,
      eventType: "CAPTURE",
      dedupeKey,
    }).lean();

    expect(ledgerAfter2.length).toBe(1);

    const inboxAfter2 = await WebhookEventInbox.find({ dedupeKey }).lean();
    expect(inboxAfter2.length).toBe(1);

    const orderAfter2 = await Order.findById(order._id).select("paymentStatus").lean();
    expect(String((orderAfter2 as any)?.paymentStatus || "").toUpperCase()).toBe("PAID");

    const piAfter2 = await PaymentIntent.findById(pi._id).select("status").lean();
    expect(String((piAfter2 as any)?.status || "").toUpperCase()).toBe("CAPTURED");
  });
});
