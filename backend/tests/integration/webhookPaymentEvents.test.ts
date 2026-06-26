import crypto from "crypto";
import request from "supertest";

import app from "../../src/app";
import { Order } from "../../src/models/Order";
import { OutboxEvent } from "../../src/models/OutboxEvent";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { WebhookEventInbox } from "../../src/domains/payments/models/WebhookEventInbox";

/**
 * Integration tests verifying that payment events (PAYMENT_SUCCESS, PAYMENT_FAILED)
 * are published to the event bus when the webhook processor handles payment state changes.
 *
 * This validates the bug fix: payment event factories existed in payment.events.ts
 * but were NOT published from the webhook processor. The fix adds publish() calls
 * after payment state changes within the transaction context.
 */
describe("Webhook processor publishes payment events to event bus", () => {
  const prevWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  });

  afterAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = prevWebhookSecret;
  });

  function buildWebhookPayload(eventName: string, gatewayPaymentId: string, gatewayOrderId: string, amountPaise: number) {
    return {
      event: eventName,
      payload: {
        payment: {
          entity: {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            amount: amountPaise,
            currency: "INR",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };
  }

  function signPayload(payload: object): { bodyString: string; signature: string } {
    const bodyString = JSON.stringify(payload);
    const rawBody = Buffer.from(bodyString);
    const signature = crypto
      .createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET))
      .update(rawBody)
      .digest("hex");
    return { bodyString, signature };
  }

  it("publishes PAYMENT_SUCCESS event to OutboxEvent after successful payment capture", async () => {
    const user = await (global as any).createTestUser({ email: "payment-success-event@example.com" });
    const product = await (global as any).createTestProduct({ price: 200, stock: 10, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, {
      paymentStatus: "PENDING",
      totalAmount: 200,
    });

    const gatewayOrderId = "order_evt_success_1";
    const gatewayPaymentId = "pay_evt_success_1";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "evt_pi_success_1",
      gateway: "RAZORPAY",
      amount: 200,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 200, currency: "INR" },
      isLocked: false,
    });

    const payload = buildWebhookPayload("payment.captured", gatewayPaymentId, gatewayOrderId, 20000);
    const { bodyString, signature } = signPayload(payload);

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify PAYMENT_SUCCESS event was published to OutboxEvent
    const successEvents = await OutboxEvent.find({
      eventType: "PAYMENT_SUCCESS",
      "data.orderId": String(order._id),
    }).lean();
    expect(successEvents.length).toBe(1);

    const evt = successEvents[0];
    expect(evt.status).toBe("PENDING");
    expect(evt.source).toBe("webhookProcessor");
    expect(evt.actor).toEqual({ type: "system" });
    expect(evt.data.userId).toBe(String(user._id));
    expect(evt.data.orderId).toBe(String(order._id));
    expect(evt.data.paymentId).toBe(gatewayPaymentId);
    expect(evt.data.amount).toBe(200);

    // Verify order was also marked as paid
    const updatedOrder = await Order.findById(order._id).select("paymentStatus").lean();
    expect(String((updatedOrder as any)?.paymentStatus || "").toUpperCase()).toBe("PAID");
  });

  it("publishes PAYMENT_FAILED event to OutboxEvent after payment failure", async () => {
    const user = await (global as any).createTestUser({ email: "payment-failed-event@example.com" });
    const product = await (global as any).createTestProduct({ price: 150, stock: 10, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, {
      paymentStatus: "PENDING",
      totalAmount: 150,
    });

    const gatewayOrderId = "order_evt_fail_1";
    const gatewayPaymentId = "pay_evt_fail_1";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "evt_pi_fail_1",
      gateway: "RAZORPAY",
      amount: 150,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 150, currency: "INR" },
      isLocked: false,
    });

    const payload = buildWebhookPayload("payment.failed", gatewayPaymentId, gatewayOrderId, 15000);
    const { bodyString, signature } = signPayload(payload);

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify PAYMENT_FAILED event was published to OutboxEvent
    const failedEvents = await OutboxEvent.find({
      eventType: "PAYMENT_FAILED",
      "data.orderId": String(order._id),
    }).lean();
    expect(failedEvents.length).toBe(1);

    const evt = failedEvents[0];
    expect(evt.status).toBe("PENDING");
    expect(evt.source).toBe("webhookProcessor");
    expect(evt.actor).toEqual({ type: "system" });
    expect(evt.data.userId).toBe(String(user._id));
    expect(evt.data.orderId).toBe(String(order._id));
    expect(evt.data.paymentId).toBe(gatewayPaymentId);
    expect(evt.data.amount).toBe(150);

    // Verify PaymentIntent was transitioned to FAILED
    const pi = await PaymentIntent.findOne({ gatewayOrderId }).select("status").lean();
    expect(String((pi as any)?.status || "").toUpperCase()).toBe("FAILED");
  });

  it("does NOT publish PAYMENT_SUCCESS event when order is already paid (idempotent)", async () => {
    const user = await (global as any).createTestUser({ email: "payment-already-paid@example.com" });
    const product = await (global as any).createTestProduct({ price: 300, stock: 10, reservedStock: 0 });
    // Create order that's already PAID
    const order = await (global as any).createTestOrder(user, product, {
      paymentStatus: "PAID",
      totalAmount: 300,
    });

    const gatewayOrderId = "order_evt_idempotent_1";
    const gatewayPaymentId = "pay_evt_idempotent_1";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "evt_pi_idempotent_1",
      gateway: "RAZORPAY",
      amount: 300,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 300, currency: "INR" },
      isLocked: false,
    });

    const payload = buildWebhookPayload("payment.captured", gatewayPaymentId, gatewayOrderId, 30000);
    const { bodyString, signature } = signPayload(payload);

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res.status).toBe(200);

    // Should NOT publish PAYMENT_SUCCESS because order was already paid
    const successEvents = await OutboxEvent.find({
      eventType: "PAYMENT_SUCCESS",
      "data.orderId": String(order._id),
    }).lean();
    expect(successEvents.length).toBe(0);
  });

  it("publishes event with correct eventId (unique UUID) for deduplication", async () => {
    const user = await (global as any).createTestUser({ email: "payment-uuid-event@example.com" });
    const product = await (global as any).createTestProduct({ price: 50, stock: 10, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, {
      paymentStatus: "PENDING",
      totalAmount: 50,
    });

    const gatewayOrderId = "order_evt_uuid_1";
    const gatewayPaymentId = "pay_evt_uuid_1";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "evt_pi_uuid_1",
      gateway: "RAZORPAY",
      amount: 50,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 50, currency: "INR" },
      isLocked: false,
    });

    const payload = buildWebhookPayload("payment.failed", gatewayPaymentId, gatewayOrderId, 5000);
    const { bodyString, signature } = signPayload(payload);

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res.status).toBe(200);

    const failedEvents = await OutboxEvent.find({
      eventType: "PAYMENT_FAILED",
      "data.orderId": String(order._id),
    }).lean();
    expect(failedEvents.length).toBe(1);

    // Verify eventId is populated (UUID format from the factory)
    expect(failedEvents[0].eventId).toBeDefined();
    expect(failedEvents[0].eventId.length).toBeGreaterThan(0);
    // Verify version is set
    expect(failedEvents[0].version).toBe(1);
  });
});
