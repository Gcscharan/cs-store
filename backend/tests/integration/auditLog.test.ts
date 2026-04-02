import request from "supertest";

import app from "../../src/app";
import { AuditLog } from "../../src/models/AuditLog";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";

describe("Audit logging hardening", () => {
  it("writes an audit record exactly once for refund creation", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "audit-admin@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "audit-user@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "audit_pi_1",
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
      gatewayEventId: "pay_audit_1",
      dedupeKey: "cap:audit_1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    await request(app)
      .post("/api/internal/refunds")
      .set("Authorization", `Bearer ${token}`)
      .send({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 25,
        currency: "INR",
        reason: "customer requested",
        idempotencyKey: "audit_refund_key_1",
      })
      .expect(200);

    const count = await AuditLog.countDocuments({
      actorId: String(admin._id),
      action: "POST /internal/refunds",
      entityType: "PaymentIntent",
      entityId: String(pi._id),
    });

    expect(count).toBe(1);
  });

  it("does not block the main request when audit persistence fails", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "audit-admin2@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const spy = jest.spyOn(AuditLog, "create").mockRejectedValueOnce(new Error("audit down"));

    const res = await request(app)
      .get("/api/internal/finance/health")
      .set("Authorization", `Bearer ${token}`);

    spy.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("checks");
  });
});
