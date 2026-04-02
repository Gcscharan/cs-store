import request from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";

async function setUpdatedAt(id: any, updatedAt: Date) {
  await PaymentIntent.updateOne(
    { _id: id },
    { $set: { updatedAt } },
    { timestamps: false } as any
  );
}

describe("Internal payments reconciliation (read-only)", () => {
  const fixedNow = new Date("2026-01-22T12:00:00.000Z");

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(fixedNow.getTime());
  });

  afterEach(() => {
    (Date.now as any).mockRestore?.();
  });

  it("rejects non-admin users", async () => {
    const user = await (global as any).createTestUser({ role: "customer" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .get("/api/internal/payments/reconciliation")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns only non-terminal intents and excludes PAID orders", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u2@example.com" });
    const orderPending = await (global as any).createTestOrder(u, { paymentStatus: "pending" });
    const orderPaid = await (global as any).createTestPaidOrder(u);

    const base = {
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      expiresAt: new Date(fixedNow.getTime() + 60 * 60_000),
    };

    const i1 = await PaymentIntent.create({
      ...base,
      attemptNo: 1,
      orderId: orderPending._id,
      idempotencyKey: "recon_i1",
      status: "PAYMENT_RECOVERABLE",
      isLocked: true,
      lockReason: "STALE_PAYMENT_24H",
    });

    const i2 = await PaymentIntent.create({
      ...base,
      attemptNo: 2,
      orderId: orderPending._id,
      idempotencyKey: "recon_i2",
      status: "CAPTURED",
    });

    const i3 = await PaymentIntent.create({
      ...base,
      attemptNo: 1,
      orderId: orderPaid._id,
      idempotencyKey: "recon_i3",
      status: "PAYMENT_PROCESSING",
    });

    await setUpdatedAt(i1._id, new Date(fixedNow.getTime() - 60 * 60_000)); // 60m old
    await setUpdatedAt(i2._id, new Date(fixedNow.getTime() - 10 * 60_000));
    await setUpdatedAt(i3._id, new Date(fixedNow.getTime() - 40 * 60_000));

    const res = await request(app)
      .get("/api/internal/payments/reconciliation")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Only i1 should remain (non-terminal + order not PAID)
    expect(res.body.length).toBe(1);
    expect(res.body[0].paymentIntentId).toBe(String(i1._id));

    // no secrets
    expect("amount" in res.body[0]).toBe(false);
    expect("checkoutPayload" in res.body[0]).toBe(false);
  });

  it("computes ageMinutes and sorts oldest first", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin2@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u3@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const base = {
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      expiresAt: new Date(fixedNow.getTime() + 60 * 60_000),
    };

    const older = await PaymentIntent.create({
      ...base,
      attemptNo: 1,
      orderId: order._id,
      idempotencyKey: "recon_age_older",
      status: "PAYMENT_PROCESSING",
    });

    const newer = await PaymentIntent.create({
      ...base,
      attemptNo: 2,
      orderId: order._id,
      idempotencyKey: "recon_age_newer",
      status: "CREATED",
    });

    await setUpdatedAt(older._id, new Date(fixedNow.getTime() - 90 * 60_000));
    await setUpdatedAt(newer._id, new Date(fixedNow.getTime() - 20 * 60_000));

    const res = await request(app)
      .get("/api/internal/payments/reconciliation")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    expect(res.body.length).toBe(2);
    expect(res.body[0].paymentIntentId).toBe(String(older._id));
    expect(res.body[0].ageMinutes).toBe(90);
    expect(res.body[1].paymentIntentId).toBe(String(newer._id));
    expect(res.body[1].ageMinutes).toBe(20);
  });

  it("applies filters and supports cursor pagination", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin3@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u4@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const base = {
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      expiresAt: new Date(fixedNow.getTime() + 60 * 60_000),
    };

    const a = await PaymentIntent.create({
      ...base,
      attemptNo: 1,
      orderId: order._id,
      idempotencyKey: "recon_page_a",
      status: "PAYMENT_RECOVERABLE",
      isLocked: true,
      lockReason: "STALE_PAYMENT_24H",
    });

    const b = await PaymentIntent.create({
      ...base,
      attemptNo: 2,
      orderId: order._id,
      idempotencyKey: "recon_page_b",
      status: "PAYMENT_RECOVERABLE",
      isLocked: true,
      lockReason: "STALE_PAYMENT_24H",
    });

    const c = await PaymentIntent.create({
      ...base,
      attemptNo: 3,
      orderId: order._id,
      idempotencyKey: "recon_page_c",
      status: "PAYMENT_PROCESSING",
      isLocked: false,
    });

    await setUpdatedAt(a._id, new Date(fixedNow.getTime() - 120 * 60_000));
    await setUpdatedAt(b._id, new Date(fixedNow.getTime() - 110 * 60_000));
    await setUpdatedAt(c._id, new Date(fixedNow.getTime() - 100 * 60_000));

    // Filter to locked recoverable only and paginate
    const res1 = await request(app)
      .get("/api/internal/payments/reconciliation")
      .query({ status: "PAYMENT_RECOVERABLE", isLocked: "true", limit: 1 })
      .set("Authorization", `Bearer ${token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.length).toBe(1);
    expect(res1.body[0].status).toBe("PAYMENT_RECOVERABLE");
    expect(res1.body[0].isLocked).toBe(true);

    const cursor = res1.header["x-next-cursor"];
    expect(typeof cursor).toBe("string");

    const res2 = await request(app)
      .get("/api/internal/payments/reconciliation")
      .query({ status: "PAYMENT_RECOVERABLE", isLocked: "true", limit: 2, cursor })
      .set("Authorization", `Bearer ${token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.length).toBe(1);
    expect(res2.body[0].status).toBe("PAYMENT_RECOVERABLE");

    // Ensure processing intent is excluded by status filter
    const ids = new Set([String(a._id), String(b._id)]);
    expect(ids.has(res1.body[0].paymentIntentId)).toBe(true);
    expect(ids.has(res2.body[0].paymentIntentId)).toBe(true);
    expect(res2.body[0].paymentIntentId).not.toBe(res1.body[0].paymentIntentId);

    // sanity: endpoint is read-only (no state changes)
    const doc = await PaymentIntent.findById(a._id).lean();
    expect(doc).not.toBeNull();
    expect((doc as any).isLocked).toBe(true);
  });

  it("returns empty for terminal-only status filter", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin4@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const res = await request(app)
      .get("/api/internal/payments/reconciliation")
      .query({ status: "CAPTURED" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
