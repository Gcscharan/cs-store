import request from "supertest";

jest.mock("../../src/domains/payments/verification/razorpayVerificationService", () => ({
  verifyRazorpayPayment: jest.fn(),
}));

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { PaymentRecoveryExecutionAudit } from "../../src/domains/payments/models/PaymentRecoveryExecutionAudit";
import { verifyRazorpayPayment } from "../../src/domains/payments/verification/razorpayVerificationService";

type Mocked = jest.Mock;

const CONFIRM = "YES_I_UNDERSTAND_THIS_CHANGES_STATE";

describe("POST /internal/payments/recovery-execute/:paymentIntentId (STEP 4)", () => {
  const prevEnv = process.env.PAYMENT_AUTO_RECOVERY_ENABLED;
  const prevExecEnv = process.env.PAYMENT_RECOVERY_EXECUTION_ENABLED;

  beforeEach(() => {
    (verifyRazorpayPayment as unknown as Mocked).mockReset();
    process.env.PAYMENT_AUTO_RECOVERY_ENABLED = "true";
    process.env.PAYMENT_RECOVERY_EXECUTION_ENABLED = "true";
  });

  afterEach(() => {
    process.env.PAYMENT_AUTO_RECOVERY_ENABLED = prevEnv;
    process.env.PAYMENT_RECOVERY_EXECUTION_ENABLED = prevExecEnv;
  });

  it("blocks execution when feature flag is OFF", async () => {
    process.env.PAYMENT_AUTO_RECOVERY_ENABLED = "false";

    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-1@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-1@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_flag_off",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "MARK_RECOVERABLE",
        reason: "Operator confirmed safe retry path.",
        confirm: CONFIRM,
      });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "FEATURE_DISABLED" });

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("CREATED");

    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("blocks execution when recovery execution kill switch is OFF", async () => {
    process.env.PAYMENT_RECOVERY_EXECUTION_ENABLED = "false";

    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-ks-1@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-ks-1@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_kill_switch_off",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "MARK_RECOVERABLE",
        reason: "Operator confirmed safe retry path.",
        confirm: CONFIRM,
      });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "FEATURE_DISABLED" });

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("CREATED");
    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("blocks invalid FSM transition", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-5b@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-5b@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_invalid_fsm",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "MARK_RECOVERABLE",
        reason: "Operator confirmed safe retry path.",
        confirm: CONFIRM,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "INVALID_STATE_TRANSITION" });

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("PAYMENT_PROCESSING");
    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("blocks non-admin", async () => {
    const user = await (global as any).createTestUser({ role: "customer", email: "cust-exec-2@example.com" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .post("/internal/payments/recovery-execute/507f191e810c19729de860ea")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_RECOVERABLE", reason: "some sufficiently long reason", confirm: CONFIRM });

    expect(res.status).toBe(403);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("rejects missing or invalid confirmation", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-3@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-3@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_bad_confirm",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "MARK_RECOVERABLE", reason: "Operator confirmed safe retry path.", confirm: "NO" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "INVALID_INPUT" });

    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("blocks CAPTURED intent", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-4@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-4@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_captured",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CAPTURED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "MARK_VERIFYING",
        reason: "Operator confirmed safe verification attempt.",
        confirm: CONFIRM,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "INVALID_STATE_TRANSITION" });

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("CAPTURED");

    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("blocks when order is PAID", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-5@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-5@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_paid_order",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "MARK_VERIFYING",
        reason: "Operator confirmed safe verification attempt.",
        confirm: CONFIRM,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "INVALID_STATE_TRANSITION" });

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("PAYMENT_PROCESSING");

    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(0);
    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });

  it("executes allowed transition and writes audit exactly once", async () => {
    const admin = await (global as any).createTestUser({ role: "admin", email: "admin-exec-6@example.com" });
    const token = await (global as any).getAuthToken(admin);

    const u = await (global as any).createTestUser({ email: "u-exec-6@example.com" });
    const order = await (global as any).createTestOrder(u, { paymentStatus: "pending" });

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "exec_ok",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "PAYMENT_PROCESSING",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    const res = await request(app)
      .post(`/internal/payments/recovery-execute/${String(pi._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        action: "MARK_VERIFYING",
        reason: "Operator confirmed safe verification attempt.",
        confirm: CONFIRM,
      });

    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(true);
    expect(res.body.previousStatus).toBe("PAYMENT_PROCESSING");
    expect(res.body.newStatus).toBe("VERIFYING");
    expect(typeof res.body.auditId).toBe("string");
    expect(res.body.auditId.length).toBeGreaterThan(0);

    const fresh = await PaymentIntent.findById(pi._id).lean();
    expect((fresh as any).status).toBe("VERIFYING");
    expect((fresh as any).lastScannedAt).toBeDefined();

    expect(await PaymentRecoveryExecutionAudit.countDocuments({ paymentIntentId: pi._id })).toBe(1);

    const audit = await PaymentRecoveryExecutionAudit.findOne({ paymentIntentId: pi._id }).lean();
    expect(audit).not.toBeNull();
    expect((audit as any).action).toBe("MARK_VERIFYING");
    expect((audit as any).previousStatus).toBe("PAYMENT_PROCESSING");
    expect((audit as any).newStatus).toBe("VERIFYING");

    expect(verifyRazorpayPayment).toHaveBeenCalledTimes(0);
  });
});
