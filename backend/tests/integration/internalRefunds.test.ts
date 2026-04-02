import request from "supertest";

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";

describe("Internal refunds (admin-only)", () => {
  it("creates an idempotent refund request and allows fetching refund history", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-refund-1@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-refund-1@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "refund_int_pi_1",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CAPTURED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    await appendLedgerEntry({
      paymentIntentId: String(pi._id),
      orderId: String(order._id),
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: 100,
      currency: "INR",
      gatewayEventId: "pay_refund_int_1",
      dedupeKey: "cap:refund_int_1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    const body = {
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 25,
      currency: "INR",
      reason: "customer requested",
      idempotencyKey: "refund_int_key_1",
    };

    const res1 = await request(app)
      .post("/api/internal/refunds")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res1.status).toBe(200);
    expect(res1.body.created).toBe(true);
    expect(typeof res1.body.refundRequestId).toBe("string");
    expect(res1.body.status).toBe("REQUESTED");

    const res2 = await request(app)
      .post("/api/internal/refunds")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(res2.status).toBe(200);
    expect(res2.body.created).toBe(false);
    expect(res2.body.refundRequestId).toBe(res1.body.refundRequestId);

    const history = await request(app)
      .get(`/internal/refunds/${String(order._id)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(history.status).toBe(200);
    expect(history.body.orderId).toBe(String(order._id));
    expect(Array.isArray(history.body.refunds)).toBe(true);
    expect(history.body.refunds.length).toBe(1);
    expect(history.body.refunds[0].id).toBe(res1.body.refundRequestId);
    expect(history.body.refunds[0].amount).toBe(25);
    expect(history.body.refunds[0].currency).toBe("INR");
    expect(history.body.refunds[0].status).toBe("REQUESTED");
  });

  it("rejects non-admin users", async () => {
    const user = await (global as any).createTestUser({ role: "customer", email: "cust-refund-1@example.com" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .post("/api/internal/refunds")
      .set("Authorization", `Bearer ${token}`)
      .send({
        orderId: "507f191e810c19729de860ea",
        paymentIntentId: "507f191e810c19729de860eb",
        amount: 10,
        currency: "INR",
        reason: "customer requested",
        idempotencyKey: "refund_int_non_admin",
      });

    expect([401, 403]).toContain(res.status);
  });
});
