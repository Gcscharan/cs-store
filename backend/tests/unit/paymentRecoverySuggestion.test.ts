import request from "supertest";

jest.mock("../../src/domains/payments/services/paymentVerificationFacade", () => ({
  runInternalPaymentVerification: jest.fn(),
}));

jest.mock("../../src/domains/payments/verification/razorpayVerificationService", () => ({
  verifyRazorpayPayment: jest.fn(),
}));

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { runInternalPaymentVerification } from "../../src/domains/payments/services/paymentVerificationFacade";
import { verifyRazorpayPayment } from "../../src/domains/payments/verification/razorpayVerificationService";

type Mocked = jest.Mock;

async function adminToken(email: string) {
  const admin = await (global as any).createTestUser({ role: "admin", email });
  return (global as any).getAuthToken(admin);
}

describe("GET /internal/payments/recovery-suggestion (STEP 3B.3)", () => {
  beforeEach(() => {
    (runInternalPaymentVerification as unknown as Mocked).mockReset();
    (verifyRazorpayPayment as unknown as Mocked).mockReset();
    process.env.PAYMENT_AUTO_RECOVERY_ENABLED = "";
  });

  it("rejects non-admin", async () => {
    const user = await (global as any).createTestUser({ role: "customer", email: "cust-rs@example.com" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: "507f191e810c19729de860ea" });

    expect(res.status).toBe(403);
  });

  it("rejects missing params or both params", async () => {
    const token = await adminToken("admin-rs-1@example.com");

    const a = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`);
    expect(a.status).toBe(400);

    const b = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .query({ orderId: "507f191e810c19729de860ea", paymentIntentId: "507f191e810c19729de860ea" });
    expect(b.status).toBe(400);
  });

  it("WEBHOOK_MISSING -> MARK_VERIFYING (HIGH), and no Razorpay client invocation", async () => {
    const token = await adminToken("admin-rs-2@example.com");

    const customer = await (global as any).createTestUser({ email: "cust-rs-2@example.com" });
    const order = await (global as any).createTestOrder(customer, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "rs_webhook_missing",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId: "order_123",
      isLocked: false,
    });

    (runInternalPaymentVerification as unknown as Mocked).mockResolvedValueOnce({
      source: "RAZORPAY",
      verifiedAt: new Date(),
      internal: { paymentIntentId: String(pi._id), orderId: String(order._id), status: "PAYMENT_PROCESSING", isLocked: false },
      gateway: { order: { id: "order_123", status: "paid", amount: 100, currency: "INR" }, payment: { id: "pay_1", status: "captured", method: "upi" }, refunds: [] },
      assessment: { isPaidAtGateway: true, isPaidInternally: false, discrepancy: "WEBHOOK_MISSING" },
    });

    const before = await PaymentIntent.findById(pi._id).lean();

    const res = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: String(pi._id) });

    expect(res.status).toBe(200);
    expect(res.body.discrepancy).toBe("WEBHOOK_MISSING");
    expect(res.body.suggestion.recommendedAction).toBe("MARK_VERIFYING");
    expect(res.body.suggestion.confidence).toBe("HIGH");
    expect(res.body.suggestion.canAutoExecute).toBe(false);

    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);

    const after = await PaymentIntent.findById(pi._id).lean();
    expect(after).toEqual(before);
  });

  it("canAutoExecute=true only when feature flag enabled and FSM allows action", async () => {
    process.env.PAYMENT_AUTO_RECOVERY_ENABLED = "true";
    const token = await adminToken("admin-rs-auto-1@example.com");

    const customer = await (global as any).createTestUser({ email: "cust-rs-auto-1@example.com" });
    const order = await (global as any).createTestOrder(customer, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "rs_auto_exec",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId: "order_123_auto",
      isLocked: false,
    });

    (runInternalPaymentVerification as unknown as Mocked).mockResolvedValueOnce({
      source: "RAZORPAY",
      verifiedAt: new Date(),
      internal: { paymentIntentId: String(pi._id), orderId: String(order._id), status: "PAYMENT_PROCESSING", isLocked: false },
      gateway: { order: { id: "order_123_auto", status: "paid", amount: 100, currency: "INR" }, payment: { id: "pay_auto", status: "captured", method: "upi" }, refunds: [] },
      assessment: { isPaidAtGateway: true, isPaidInternally: false, discrepancy: "WEBHOOK_MISSING" },
    });

    const res = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: String(pi._id) });

    expect(res.status).toBe(200);
    expect(res.body.suggestion.recommendedAction).toBe("MARK_VERIFYING");
    expect(res.body.suggestion.canAutoExecute).toBe(true);
  });

  it("locked intents always return NO_ACTION", async () => {
    const token = await adminToken("admin-rs-3@example.com");

    const customer = await (global as any).createTestUser({ email: "cust-rs-3@example.com" });
    const order = await (global as any).createTestOrder(customer, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "rs_locked",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_RECOVERABLE",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: true,
      lockReason: "STALE_PAYMENT_24H",
    });

    const before = await PaymentIntent.findById(pi._id).lean();

    const res = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: String(pi._id) });

    expect(res.status).toBe(200);
    expect(res.body.suggestion.recommendedAction).toBe("NO_ACTION");
    expect(res.body.suggestion.canAutoExecute).toBe(false);

    expect(runInternalPaymentVerification).toHaveBeenCalledTimes(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);

    const after = await PaymentIntent.findById(pi._id).lean();
    expect(after).toEqual(before);
  });

  it("CONSISTENT_PAID -> NO_ACTION", async () => {
    const token = await adminToken("admin-rs-4@example.com");

    const customer = await (global as any).createTestUser({ email: "cust-rs-4@example.com" });
    const order = await (global as any).createTestPaidOrder(customer);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "rs_paid",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "VERIFYING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId: "order_paid",
      isLocked: false,
    });

    (runInternalPaymentVerification as unknown as Mocked).mockResolvedValueOnce({
      source: "RAZORPAY",
      verifiedAt: new Date(),
      internal: { paymentIntentId: String(pi._id), orderId: String(order._id), status: "VERIFYING", isLocked: false },
      gateway: { order: { id: "order_paid", status: "paid", amount: 100, currency: "INR" }, payment: { id: "pay_paid", status: "captured", method: "upi" }, refunds: [] },
      assessment: { isPaidAtGateway: true, isPaidInternally: true, discrepancy: "CONSISTENT_PAID" },
    });

    const res = await request(app)
      .get("/api/internal/payments/recovery-suggestion")
      .set("Authorization", `Bearer ${token}`)
      .query({ paymentIntentId: String(pi._id) });

    expect(res.status).toBe(200);
    expect(res.body.discrepancy).toBe("CONSISTENT_PAID");
    expect(res.body.suggestion.recommendedAction).toBe("NO_ACTION");
  });
});
