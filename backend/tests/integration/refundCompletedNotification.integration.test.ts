/**
 * M7 — Refund completion must notify the customer (REFUND_COMPLETED).
 *
 * Regression test for the wiring gap: the createRefundCompletedEvent factory and
 * the notificationWriter REFUND_ handling both existed, but nothing published the
 * event — so customers were never told their refund completed.
 *
 * markRefundCompleted now publishes REFUND_COMPLETED post-commit (non-throwing).
 * Exactly-once is enforced by the deterministic eventId (OutboxEvent.eventId
 * unique) and the COMPLETED→COMPLETED state guard (a duplicate refund webhook
 * never re-publishes).
 *
 * Runs against the replica-set test DB (tests/setup-globals.ts) so the refund
 * transaction executes for real.
 */

import mongoose from "mongoose";

import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { RefundRequest } from "../../src/domains/payments/models/RefundRequest";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";
import { OutboxEvent } from "../../src/models/OutboxEvent";
import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";
import { markRefundCompleted } from "../../src/domains/payments/refunds/refundService";

async function seedRefund() {
  const userId = new mongoose.Types.ObjectId();

  const order = await Order.create({
    userId,
    idempotencyKey: `idem_${Date.now()}_${Math.random()}`,
    orderStatus: "CONFIRMED",
    paymentStatus: "PAID",
    totalAmount: 500,
    address: {
      label: "Home",
      addressLine: "1 Test St",
      city: "Tiruvuru",
      state: "AP",
      pincode: "521235",
      lat: 17,
      lng: 80,
    },
    items: [],
  } as any);

  const intent = await PaymentIntent.create({
    orderId: order._id,
    attemptNo: 1,
    idempotencyKey: `pi_${Date.now()}_${Math.random()}`,
    gateway: "RAZORPAY",
    paymentState: "PAID",
    amount: 500,
    currency: "INR",
    status: "CAPTURED",
    expiresAt: new Date(Date.now() + 3_600_000),
  } as any);

  // CAPTURE ledger entry so sumCapturedAmount() > 0 (refund is bounded by capture).
  await appendLedgerEntry({
    paymentIntentId: String(intent._id),
    orderId: String(order._id),
    gateway: "RAZORPAY",
    eventType: "CAPTURE",
    amount: 500,
    currency: "INR",
    gatewayEventId: `pay_${Date.now()}_${Math.random()}`,
    dedupeKey: `cap:${String(intent._id)}`,
  } as any);

  const refund = await RefundRequest.create({
    orderId: order._id,
    paymentIntentId: intent._id,
    amount: 500,
    currency: "INR",
    status: "PROCESSING",
    idempotencyKey: `cancel_refund:${String(order._id)}`,
  } as any);

  return { userId, order, intent, refund };
}

describe("M7 — REFUND_COMPLETED customer notification", () => {
  beforeEach(async () => {
    await Promise.all([
      Order.deleteMany({}),
      PaymentIntent.deleteMany({}),
      RefundRequest.deleteMany({}),
      LedgerEntry.deleteMany({}),
      OutboxEvent.deleteMany({}),
    ]);
  });

  it("publishes exactly one REFUND_COMPLETED event addressed to the customer", async () => {
    const { userId, order, refund } = await seedRefund();

    const res = await markRefundCompleted({
      refundRequestId: String(refund._id),
      gatewayRefundId: "rfnd_test_1",
    });
    expect(res.status).toBe("COMPLETED");

    const events = await OutboxEvent.find({ eventType: "REFUND_COMPLETED" }).lean();
    expect(events).toHaveLength(1);
    expect(String((events[0] as any).data.userId)).toBe(String(userId));
    expect(String((events[0] as any).data.orderId)).toBe(String(order._id));
    expect((events[0] as any).data.amount).toBe(500);
  });

  it("does not publish a second event on a duplicate completion (idempotent)", async () => {
    const { refund } = await seedRefund();

    await markRefundCompleted({
      refundRequestId: String(refund._id),
      gatewayRefundId: "rfnd_test_1",
    });

    // A duplicate refund.processed webhook → markRefundCompleted again → the
    // COMPLETED→COMPLETED guard rejects; no second notification is published.
    await expect(
      markRefundCompleted({
        refundRequestId: String(refund._id),
        gatewayRefundId: "rfnd_test_1",
      })
    ).rejects.toBeTruthy();

    const events = await OutboxEvent.find({ eventType: "REFUND_COMPLETED" }).lean();
    expect(events).toHaveLength(1);
  });
});
