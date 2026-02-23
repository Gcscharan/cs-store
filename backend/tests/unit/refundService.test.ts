import { RefundRequest } from "../../src/domains/payments/models/RefundRequest";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";
import { createRefundRequestInternal } from "../../src/domains/payments/refunds/refundService";

async function seedPaidOrderWithCapturedPayment(args: {
  capturedAmount: number;
  orderPaymentStatus?: string;
  paymentIntentIdempotencyKey: string;
  captureDedupeKey: string;
}) {
  const u = await (global as any).createTestUser({ email: `u-${args.paymentIntentIdempotencyKey}@example.com` });
  const wantsPaid = String(args.orderPaymentStatus || "").toUpperCase() === "PAID" || !args.orderPaymentStatus;
  const order = wantsPaid
    ? await (global as any).createTestPaidOrder(u, { price: args.capturedAmount }, { totalAmount: args.capturedAmount })
    : await (global as any).createTestOrder(u, { paymentStatus: args.orderPaymentStatus, totalAmount: args.capturedAmount });

  const pi = await PaymentIntent.create({
    orderId: order._id,
    attemptNo: 1,
    idempotencyKey: args.paymentIntentIdempotencyKey,
    gateway: "RAZORPAY",
    amount: args.capturedAmount,
    currency: "INR",
    status: "CAPTURED",
    expiresAt: new Date(Date.now() + 60 * 60_000),
    isLocked: false,
  });

  if (args.captureDedupeKey) {
    await appendLedgerEntry({
      paymentIntentId: String(pi._id),
      orderId: String(order._id),
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: args.capturedAmount,
      currency: "INR",
      gatewayEventId: `pay_${args.paymentIntentIdempotencyKey}`,
      dedupeKey: args.captureDedupeKey,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });
  }

  return { u, order, pi };
}

describe("Refund service (Phase 2)", () => {
  it("is idempotent by idempotencyKey", async () => {
    const { order, pi } = await seedPaidOrderWithCapturedPayment({
      capturedAmount: 100,
      paymentIntentIdempotencyKey: "refund_idem_pi_1",
      captureDedupeKey: "cap:refund_idem_pi_1",
    });

    const r1 = await createRefundRequestInternal({
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 10,
      currency: "INR",
      reason: "customer requested",
      idempotencyKey: "refund_idem_key_1",
    });

    const r2 = await createRefundRequestInternal({
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 10,
      currency: "INR",
      reason: "customer requested",
      idempotencyKey: "refund_idem_key_1",
    });

    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.refundRequestId).toBe(r1.refundRequestId);

    expect(await RefundRequest.countDocuments({ idempotencyKey: "refund_idem_key_1" })).toBe(1);
  });

  it("rejects idempotency key reuse with different parameters", async () => {
    const { order, pi } = await seedPaidOrderWithCapturedPayment({
      capturedAmount: 100,
      paymentIntentIdempotencyKey: "refund_idem_pi_2",
      captureDedupeKey: "cap:refund_idem_pi_2",
    });

    await createRefundRequestInternal({
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 10,
      currency: "INR",
      reason: "customer requested",
      idempotencyKey: "refund_idem_key_2",
    });

    await expect(
      createRefundRequestInternal({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 20,
        currency: "INR",
        reason: "customer requested",
        idempotencyKey: "refund_idem_key_2",
      })
    ).rejects.toMatchObject({ message: "IDEMPOTENCY_KEY_REUSED", statusCode: 409 });
  });

  it("rejects when order is not PAID", async () => {
    const { order, pi } = await seedPaidOrderWithCapturedPayment({
      capturedAmount: 100,
      orderPaymentStatus: "PENDING",
      paymentIntentIdempotencyKey: "refund_not_paid_pi",
      captureDedupeKey: "cap:refund_not_paid_pi",
    });

    await expect(
      createRefundRequestInternal({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 10,
        currency: "INR",
        reason: "customer requested",
        idempotencyKey: "refund_not_paid_key",
      })
    ).rejects.toMatchObject({ message: "ORDER_NOT_PAID", statusCode: 409 });
  });

  it("rejects refund before CAPTURE exists", async () => {
    const u = await (global as any).createTestUser({ email: "u-no-cap@example.com" });
    const order = await (global as any).createTestPaidOrder(u);

    const pi = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "refund_no_capture_pi",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "CAPTURED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    await expect(
      createRefundRequestInternal({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 10,
        currency: "INR",
        reason: "customer requested",
        idempotencyKey: "refund_no_capture_key",
      })
    ).rejects.toMatchObject({ message: "NO_CAPTURE", statusCode: 409 });
  });

  it("supports partial refunds until captured amount is exhausted", async () => {
    const { order, pi } = await seedPaidOrderWithCapturedPayment({
      capturedAmount: 100,
      paymentIntentIdempotencyKey: "refund_partial_pi",
      captureDedupeKey: "cap:refund_partial_pi",
    });

    const a = await createRefundRequestInternal({
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 30,
      currency: "INR",
      reason: "partial refund",
      idempotencyKey: "refund_partial_a",
    });

    const b = await createRefundRequestInternal({
      orderId: String(order._id),
      paymentIntentId: String(pi._id),
      amount: 70,
      currency: "INR",
      reason: "partial refund",
      idempotencyKey: "refund_partial_b",
    });

    expect(a.created).toBe(true);
    expect(b.created).toBe(true);

    await expect(
      createRefundRequestInternal({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 1,
        currency: "INR",
        reason: "over refund",
        idempotencyKey: "refund_partial_over",
      })
    ).rejects.toMatchObject({ message: "OVER_REFUND", statusCode: 409 });

    expect(await RefundRequest.countDocuments({ orderId: order._id })).toBe(2);
  });

  it("rejects a single over-refund attempt", async () => {
    const { order, pi } = await seedPaidOrderWithCapturedPayment({
      capturedAmount: 100,
      paymentIntentIdempotencyKey: "refund_over_pi",
      captureDedupeKey: "cap:refund_over_pi",
    });

    await expect(
      createRefundRequestInternal({
        orderId: String(order._id),
        paymentIntentId: String(pi._id),
        amount: 101,
        currency: "INR",
        reason: "over refund",
        idempotencyKey: "refund_over_key",
      })
    ).rejects.toMatchObject({ message: "OVER_REFUND", statusCode: 409 });
  });
});
