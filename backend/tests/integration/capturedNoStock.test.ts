import crypto from "crypto";
import request from "supertest";

import app from "../../src/app";
import { Order } from "../../src/models/Order";
import { OutboxEvent } from "../../src/models/OutboxEvent";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";
import { RefundRequest } from "../../src/domains/payments/models/RefundRequest";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";

/**
 * INV-1 integration: payment captured but inventory unavailable (sold out during
 * a slow capture). Deterministic outcome:
 *   - CAPTURE ledger entry IS recorded (money moved)
 *   - order is NOT marked PAID; capturedNoStock=true
 *   - an auto-refund RefundRequest is created
 *   - a customer notification event is published
 *   - webhook returns 200 (no infinite reconciliation loop)
 */
describe("INV-1: payment captured but out of stock → auto-refund", () => {
  const prev = process.env.RAZORPAY_WEBHOOK_SECRET;
  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
    process.env.REFUND_EXECUTION_ENABLED = "false"; // keep gateway refund out of this test; reconciliation/manual handles execution
  });
  afterAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = prev;
  });

  function sign(payload: object) {
    const bodyString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET))
      .update(Buffer.from(bodyString))
      .digest("hex");
    return { bodyString, signature };
  }

  it("records capture, does NOT mark PAID, flags capturedNoStock, creates refund", async () => {
    const user = await (global as any).createTestUser({ email: "inv1-nostock@example.com" });
    // Stock 0 + no active reservation → re-reserve at capture time will fail.
    const product = await (global as any).createTestProduct({ price: 300, stock: 0, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, {
      paymentStatus: "PENDING",
      totalAmount: 300,
    });

    const gatewayOrderId = "order_inv1_1";
    const gatewayPaymentId = "pay_inv1_1";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "inv1_pi_1",
      gateway: "RAZORPAY",
      amount: 300,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 300, currency: "INR" },
      isLocked: false,
    });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            amount: 30000,
            currency: "INR",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    };
    const { bodyString, signature } = sign(payload);

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    // Webhook acknowledges (no infinite retry loop).
    expect(res.status).toBe(200);

    // CAPTURE ledger entry recorded — money provably moved.
    const captures = await LedgerEntry.find({ orderId: order._id, eventType: "CAPTURE" }).lean();
    expect(captures.length).toBe(1);
    expect(captures[0].amount).toBe(300);

    // Order is NOT PAID and is flagged captured-no-stock.
    const updated = await Order.findById(order._id).select("paymentStatus capturedNoStock").lean();
    expect(String((updated as any)?.paymentStatus || "").toUpperCase()).not.toBe("PAID");
    expect((updated as any)?.capturedNoStock).toBe(true);

    // Auto-refund request created (idempotent key).
    const refunds = await RefundRequest.find({ orderId: order._id }).lean();
    expect(refunds.length).toBe(1);
    expect(refunds[0].amount).toBe(300);
    expect(String(refunds[0].idempotencyKey)).toContain("captured_no_stock");

    // Customer notification event published.
    const notifyEvents = await OutboxEvent.find({
      eventType: "PAYMENT_FAILED",
      "data.orderId": String(order._id),
    }).lean();
    expect(notifyEvents.length).toBe(1);
  });

  it("is idempotent — duplicate webhook does not create a second refund", async () => {
    const user = await (global as any).createTestUser({ email: "inv1-dup@example.com" });
    const product = await (global as any).createTestProduct({ price: 300, stock: 0, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, { paymentStatus: "PENDING", totalAmount: 300 });

    const gatewayOrderId = "order_inv1_dup";
    const gatewayPaymentId = "pay_inv1_dup";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "inv1_pi_dup",
      gateway: "RAZORPAY",
      amount: 300,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 300, currency: "INR" },
      isLocked: false,
    });

    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: gatewayPaymentId, order_id: gatewayOrderId, amount: 30000, currency: "INR", created_at: Math.floor(Date.now() / 1000) } } },
    };
    const { bodyString, signature } = sign(payload);

    const send = () =>
      request(app)
        .post("/api/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(bodyString);

    await send();
    await send(); // duplicate delivery

    const refunds = await RefundRequest.find({ orderId: order._id }).lean();
    expect(refunds.length).toBe(1); // exactly one refund despite duplicate webhook

    const captures = await LedgerEntry.find({ orderId: order._id, eventType: "CAPTURE" }).lean();
    expect(captures.length).toBe(1); // exactly one capture ledger entry
  });
});
