import request from "supertest";

jest.mock("../../src/domains/payments/verification/razorpayVerificationService", () => ({
  verifyRazorpayPayment: jest.fn(),
}));

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { verifyRazorpayPayment } from "../../src/domains/payments/verification/razorpayVerificationService";

type Mocked = jest.Mock;

async function makeAdminToken(email: string) {
  const admin = await (global as any).createTestUser({ role: "admin", email });
  return (global as any).getAuthToken(admin);
}

describe("GET /internal/payments/verify (STEP 3B.2)", () => {
  beforeEach(() => {
    (verifyRazorpayPayment as unknown as Mocked).mockReset();
  });

  it("rejects non-admin", async () => {
    const user = await (global as any).createTestUser({ role: "customer", email: "cust-pv@example.com" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`)
      .query({ razorpayPaymentId: "pay_x" });

    expect(res.status).toBe(403);
  });

  it("rejects missing params", async () => {
    const token = await makeAdminToken("admin-pv-1@example.com");

    const res = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "INVALID_INPUT" });
  });

  it("WEBHOOK_MISSING when gateway captured but internal not PAID; no DB mutation", async () => {
    const token = await makeAdminToken("admin-pv-2@example.com");

    const customer = await (global as any).createTestUser({ email: "cust-pv-2@example.com" });
    const order = await (global as any).createTestOrder(customer, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "pv_webhook_missing",
      gateway: "RAZORPAY",
      amount: 19900,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId: "order_123",
      isLocked: false,
    });

    (verifyRazorpayPayment as unknown as Mocked).mockResolvedValueOnce({
      gateway: "RAZORPAY",
      order: { id: "order_123", amount: 19900, currency: "INR", status: "paid", attempts: 1 },
      payment: {
        id: "pay_123",
        status: "captured",
        method: "upi",
        amount: 19900,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      refunds: [],
      fetchedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const before = await PaymentIntent.findById(pi._id).lean();

    const res = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: String(pi._id) });

    expect(res.status).toBe(200);
    expect(res.body.assessment.discrepancy).toBe("WEBHOOK_MISSING");

    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(1);
    expect((verifyRazorpayPayment as unknown as Mocked).mock.calls[0][0]).toEqual({
      razorpayOrderId: "order_123",
      razorpayPaymentId: undefined,
    });

    const after = await PaymentIntent.findById(pi._id).lean();
    expect(after).toEqual(before);
  });

  it("discrepancy classifications: AWAITING_CAPTURE / GATEWAY_FAILED / NO_GATEWAY_PAYMENT / CONSISTENT_PAID", async () => {
    const token = await makeAdminToken("admin-pv-3@example.com");

    (verifyRazorpayPayment as unknown as Mocked).mockResolvedValueOnce({
      gateway: "RAZORPAY",
      payment: { id: "pay_auth", status: "authorized", method: "card", amount: 100, createdAt: new Date() },
      refunds: [],
      fetchedAt: new Date(),
    });

    const a = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`)
      .query({ razorpayPaymentId: "pay_auth" });

    expect(a.status).toBe(200);
    expect(a.body.assessment.discrepancy).toBe("AWAITING_CAPTURE");

    (verifyRazorpayPayment as unknown as Mocked).mockResolvedValueOnce({
      gateway: "RAZORPAY",
      payment: { id: "pay_fail", status: "failed", method: "upi", amount: 100, createdAt: new Date() },
      refunds: [],
      fetchedAt: new Date(),
    });

    const b = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`)
      .query({ razorpayPaymentId: "pay_fail" });

    expect(b.status).toBe(200);
    expect(b.body.assessment.discrepancy).toBe("GATEWAY_FAILED");

    (verifyRazorpayPayment as unknown as Mocked).mockResolvedValueOnce({
      gateway: "RAZORPAY",
      order: { id: "order_only", amount: 100, currency: "INR", status: "created", attempts: 0 },
      refunds: [],
      fetchedAt: new Date(),
    });

    const c = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`)
      .query({ razorpayOrderId: "order_only" });

    expect(c.status).toBe(200);
    expect(c.body.assessment.discrepancy).toBe("NO_GATEWAY_PAYMENT");

    const customer = await (global as any).createTestUser({ email: "cust-pv-3@example.com" });
    const paidOrder = await (global as any).createTestPaidOrder(customer);

    const pi = await PaymentIntent.create({
      orderId: paidOrder._id,
      attemptNo: 1,
      idempotencyKey: "pv_consistent_paid",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "VERIFYING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId: "order_paid",
      isLocked: false,
    });

    (verifyRazorpayPayment as unknown as Mocked).mockResolvedValueOnce({
      gateway: "RAZORPAY",
      order: { id: "order_paid", amount: 100, currency: "INR", status: "paid", attempts: 1 },
      payment: { id: "pay_paid", status: "captured", method: "upi", amount: 100, createdAt: new Date() },
      refunds: [],
      fetchedAt: new Date(),
    });

    const d = await request(app)
      .get("/api/internal/payments/verify")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: String(pi._id) });

    expect(d.status).toBe(200);
    expect(d.body.assessment.discrepancy).toBe("CONSISTENT_PAID");
  });
});
