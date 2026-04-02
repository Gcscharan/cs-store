import request from "supertest";

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";

describe("Refund execution kill switch (REFUND_EXECUTION_ENABLED)", () => {
  const prev = process.env.REFUND_EXECUTION_ENABLED;

  afterEach(() => {
    process.env.REFUND_EXECUTION_ENABLED = prev;
  });

  it("blocks admin refund initiation when disabled (503)", async () => {
    process.env.REFUND_EXECUTION_ENABLED = "false";

    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-refund-ks@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-refund-ks@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "refund_ks_pi_1",
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
      gatewayEventId: "pay_refund_ks_1",
      dedupeKey: "cap:refund_ks_1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    const res = await request(app)
      .post("/api/internal/refunds")
      .set("Authorization", `Bearer ${token}`)
      .send({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 25,
        currency: "INR",
        reason: "customer requested",
        idempotencyKey: "refund_ks_key_1",
      });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "REFUND_EXECUTION_DISABLED" });
  });

  it("allows refund history queries when disabled", async () => {
    process.env.REFUND_EXECUTION_ENABLED = "false";

    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-refund-ks2@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-refund-ks2@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const res = await request(app)
      .get(`/internal/refunds/${String(order._id)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe(String(order._id));
    expect(Array.isArray(res.body.refunds)).toBe(true);
  });
});
