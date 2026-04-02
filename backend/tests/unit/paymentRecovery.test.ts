import request from "supertest";

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { PaymentRecoveryAudit } from "../../src/domains/payments/models/PaymentRecoveryAudit";

describe("Internal payments manual recovery hooks", () => {
  it("rejects non-admin users", async () => {
    const user = await (global as any).createTestUser({ role: "customer", email: "cust-recovery@example.com" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .post("/api/internal/payments/recovery/507f191e810c19729de860ea/action")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "LOCK_PERMANENTLY", reason: "some long enough reason" });

    expect(res.status).toBe(403);
  });

  it("rejects invalid paymentIntentId", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-1@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const res = await request(app)
      .post("/api/internal/payments/recovery/not-an-objectid/action")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "LOCK_PERMANENTLY", reason: "some long enough reason" });

    expect(res.status).toBe(400);
  });

  it("rejects short reason", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-2@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-recovery-2@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "recovery_short_reason",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const res = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "LOCK_PERMANENTLY", reason: "too short" });

    expect(res.status).toBe(400);
    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
  });

  it("does not allow modifying CAPTURED intents", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-3@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-recovery-3@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "recovery_captured",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CAPTURED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const res = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "LOCK_PERMANENTLY", reason: "admin lock on captured should fail" });

    expect(res.status).toBe(409);

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect(fresh).not.toBeNull();
    expect((fresh as any).status).toBe("CAPTURED");
    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
  });

  it("does not allow modifying intents when order is PAID", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-4@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-recovery-4@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "recovery_paid_order",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const res = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_VERIFYING", reason: "admin verifying on paid order should fail" });

    expect(res.status).toBe(409);

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("PAYMENT_PROCESSING");
    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
  });

  it("MARK_VERIFYING allowed only from PAYMENT_PROCESSING or PAYMENT_RECOVERABLE", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-5@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-recovery-5@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "recovery_mv_bad",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const bad = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_VERIFYING", reason: "not allowed from created status" });

    expect(bad.status).toBe(409);
    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);

    await PaymentIntent.updateOne({ _id: pi._id }, { $set: { status: "PAYMENT_PROCESSING" } });

    const ok = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_VERIFYING", reason: "admin believes webhook may arrive" });

    expect(ok.status).toBe(200);
    expect(ok.body.newStatus).toBe("VERIFYING");
    expect(ok.body.previousStatus).toBe("PAYMENT_PROCESSING");
    expect(ok.body.lastScannedAt).not.toBeUndefined();

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("VERIFYING");
    expect((fresh as any).lastScannedAt).toBeDefined();

    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(1);
  });

  it("MARK_RECOVERABLE allowed only from CREATED, GATEWAY_ORDER_CREATED, PAYMENT_PROCESSING", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-6@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-recovery-6@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "recovery_mr_bad",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "VERIFYING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const bad = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_RECOVERABLE", reason: "not allowed from verifying status" });

    expect(bad.status).toBe(409);
    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);

    await PaymentIntent.updateOne({ _id: pi._id }, { $set: { status: "GATEWAY_ORDER_CREATED" } });

    const ok = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_RECOVERABLE", reason: "surface to frontend resume flow" });

    expect(ok.status).toBe(200);
    expect(ok.body.newStatus).toBe("PAYMENT_RECOVERABLE");
    expect(ok.body.previousStatus).toBe("GATEWAY_ORDER_CREATED");

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("PAYMENT_RECOVERABLE");

    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(1);
  });

  it("locked intents cannot be modified (except LOCK_PERMANENTLY idempotent ok)", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-recovery-7@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-recovery-7@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "recovery_locked",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      isLocked: true,
      lockReason: "STALE_PAYMENT_24H",
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const blocked = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_VERIFYING", reason: "should be blocked because locked" });

    expect(blocked.status).toBe(409);
    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);

    const ok = await request(app)
      .post(`/internal/payments/recovery/${String(pi._id)}/action`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "LOCK_PERMANENTLY", reason: "admin lock with explicit reason" });

    expect(ok.status).toBe(200);
    expect(ok.body.isLocked).toBe(true);
    expect(String(ok.body.lockReason || "").startsWith("ADMIN_LOCK:")).toBe(true);

    expect(await PaymentRecoveryAudit.countDocuments({ paymentIntentId: pi._id })).toBe(1);

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).isLocked).toBe(true);
    expect(String((fresh as any).lockReason || "").startsWith("ADMIN_LOCK:")).toBe(true);
  });
});
