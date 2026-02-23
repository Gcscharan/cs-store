import request from "supertest";

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";
import {
  createRefundRequestInternal,
  markRefundCompleted,
  markRefundProcessing,
} from "../../src/domains/payments/refunds/refundService";

describe("Order details exposes refunds (customer-safe)", () => {
  it("GET /api/orders/:id includes refunds[] when RefundRequest exists", async () => {
    const customer = await (global as any).createTestUser({ email: "cust-refund-visible@example.com" });
    const token = await (global as any).getAuthToken(customer);

    const order = await (global as any).createTestPaidOrder(customer);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "ord_ref_vis_pi",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CAPTURED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
      gatewayOrderId: "order_ref_vis_1",
    });

    await appendLedgerEntry({
      paymentIntentId: String(pi._id),
      orderId: String(order._id),
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: 100,
      currency: "INR",
      gatewayEventId: "pay_ref_vis_1",
      dedupeKey: "cap:ref_vis_1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    const created = await createRefundRequestInternal({
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 25,
      currency: "INR",
      reason: "tests",
      idempotencyKey: "ord_ref_vis_refund_1",
    });

    await markRefundProcessing({
      refundRequestId: created.refundRequestId,
    });

    await markRefundCompleted({
      refundRequestId: created.refundRequestId,
      gatewayRefundId: "rf_gateway_1",
      occurredAt: new Date("2026-01-02T00:00:00.000Z"),
      raw: { status: "processed" },
    });

    const res = await request(app)
      .get(`/api/orders/${String(order._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty("order");
    expect(Array.isArray(res.body.order.refunds)).toBe(true);
    expect(res.body.order.refunds.length).toBe(1);

    const r = res.body.order.refunds[0];
    expect(r.refundId).toBe(created.refundRequestId);
    expect(r.amount).toBe(25);
    expect(r.status).toBe("COMPLETED");
    expect(typeof r.createdAt).toBe("string");
    expect(r.completedAt).toBe("2026-01-02T00:00:00.000Z");

    expect(r).not.toHaveProperty("idempotencyKey");
    expect(r).not.toHaveProperty("paymentIntentId");
    expect(r).not.toHaveProperty("reason");
  });

  it("GET /api/orders/:id returns refunds=[] when no refunds exist", async () => {
    const customer = await (global as any).createTestUser({ email: "cust-refund-empty@example.com" });
    const token = await (global as any).getAuthToken(customer);

    const order = await (global as any).createTestOrder(customer, { paymentStatus: "pending" });

    const res = await request(app)
      .get(`/api/orders/${String(order._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty("order");
    expect(Array.isArray(res.body.order.refunds)).toBe(true);
    expect(res.body.order.refunds.length).toBe(0);
  });
});
