import mongoose from "mongoose";

import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { RefundRequest } from "../../src/domains/payments/models/RefundRequest";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";
import { getFinanceHealth } from "../../src/domains/finance/services/financeHealthService";

describe("financeHealthService", () => {
  async function createOrderAndIntent(args?: {
    orderPaymentStatus?: any;
    amount?: number;
  }): Promise<{ order: any; intent: any }> {
    const user = await (global as any).createTestUser({ email: `fh-${Date.now()}@example.com` });
    const wantsPaid = String(args?.orderPaymentStatus || "").toUpperCase() === "PAID";
    const order = wantsPaid
      ? await (global as any).createTestPaidOrder(
          user,
          { price: args?.amount ?? 100, stock: 10, reservedStock: 0 },
          { totalAmount: args?.amount ?? 100 }
        )
      : await (global as any).createTestOrder(user, {
          paymentStatus: args?.orderPaymentStatus ?? "PENDING",
          totalAmount: args?.amount ?? 100,
        });

    const intent = await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: `fh_pi_${String(order._id)}`,
      gateway: "RAZORPAY",
      amount: args?.amount ?? 100,
      currency: "INR",
      status: "CAPTURED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      isLocked: false,
    });

    return { order, intent };
  }

  async function insertCapture(args: {
    orderId: mongoose.Types.ObjectId;
    paymentIntentId: mongoose.Types.ObjectId;
    amount: number;
    dedupeKey: string;
  }) {
    await LedgerEntry.create({
      orderId: args.orderId,
      paymentIntentId: args.paymentIntentId,
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: args.amount,
      currency: "INR",
      gatewayEventId: `pay_${args.dedupeKey}`,
      dedupeKey: args.dedupeKey,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });
  }

  async function insertRefund(args: {
    orderId: mongoose.Types.ObjectId;
    paymentIntentId: mongoose.Types.ObjectId;
    amount: number;
    dedupeKey: string;
    refundId?: string;
  }) {
    await LedgerEntry.create({
      orderId: args.orderId,
      paymentIntentId: args.paymentIntentId,
      gateway: "RAZORPAY",
      eventType: "REFUND",
      refundId: args.refundId,
      amount: -Math.abs(args.amount),
      currency: "INR",
      gatewayEventId: `rf_${args.dedupeKey}`,
      dedupeKey: args.dedupeKey,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "processed" },
    });
  }

  it("flags refund exists without CAPTURE ledger", async () => {
    const { order, intent } = await createOrderAndIntent({ orderPaymentStatus: "PAID", amount: 100 });

    await insertRefund({
      orderId: order._id,
      paymentIntentId: intent._id,
      amount: 10,
      dedupeKey: "fh_refund_no_capture",
    });

    const out = await getFinanceHealth();
    const check = out.checks.find((c) => c.name === "Refund exists without CAPTURE ledger");

    expect(check?.status).toBe("ERROR");
    expect(check?.details?.pairs).toBe(1);
  });

  it("flags refund amount > captured amount", async () => {
    const { order, intent } = await createOrderAndIntent({ orderPaymentStatus: "PAID", amount: 100 });

    await insertCapture({
      orderId: order._id,
      paymentIntentId: intent._id,
      amount: 10,
      dedupeKey: "fh_capture_small",
    });

    await insertRefund({
      orderId: order._id,
      paymentIntentId: intent._id,
      amount: 15,
      dedupeKey: "fh_refund_large",
    });

    const out = await getFinanceHealth();
    const check = out.checks.find((c) => c.name === "Refund amount > captured amount");

    expect(check?.status).toBe("ERROR");
    expect(check?.details?.pairs).toBe(1);
  });

  it("flags orphan ledger entries (no order/paymentIntent)", async () => {
    const orphanOrderId = new mongoose.Types.ObjectId();
    const { intent } = await createOrderAndIntent({ orderPaymentStatus: "PAID", amount: 100 });

    await LedgerEntry.create({
      orderId: orphanOrderId,
      paymentIntentId: intent._id,
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: 100,
      currency: "INR",
      gatewayEventId: "pay_orphan_1",
      dedupeKey: "fh_orphan_1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    const out = await getFinanceHealth();
    const check = out.checks.find((c) => c.name === "Orphan ledger entries (no order/paymentIntent)");

    expect(check?.status).toBe("ERROR");
    expect(check?.details?.entries).toBe(1);
  });

  it("flags refund marked COMPLETED but no ledger entry", async () => {
    const { order, intent } = await createOrderAndIntent({ orderPaymentStatus: "PAID", amount: 100 });

    await RefundRequest.create({
      orderId: order._id,
      paymentIntentId: intent._id,
      amount: 10,
      currency: "INR",
      status: "COMPLETED",
      reason: "test",
      idempotencyKey: "fh_completed_no_ledger",
    });

    const out = await getFinanceHealth();
    const check = out.checks.find((c) => c.name === "Refund marked COMPLETED but no ledger entry");

    expect(check?.status).toBe("ERROR");
    expect(check?.details?.refunds).toBe(1);
  });

  it("classifies ledger total != order paymentStatus as WARN when capture exists but order is UNPAID", async () => {
    const { order, intent } = await createOrderAndIntent({ orderPaymentStatus: "PENDING", amount: 100 });

    await insertCapture({
      orderId: order._id,
      paymentIntentId: intent._id,
      amount: 100,
      dedupeKey: "fh_capture_warn",
    });

    const out = await getFinanceHealth();
    const check = out.checks.find((c) => c.name === "Ledger total ≠ Order.paymentStatus");

    expect(check?.status).toBe("WARN");
    expect(check?.details?.warnings).toBe(1);
    expect(check?.details?.errors).toBe(0);
  });

  it("flags duplicate ledger entries (same dedupeKey)", async () => {
    const { order, intent } = await createOrderAndIntent({ orderPaymentStatus: "PAID", amount: 100 });

    try {
      await LedgerEntry.collection.dropIndex("dedupeKey_1");
    } catch {
      // ignore
    }

    await LedgerEntry.collection.insertMany([
      {
        orderId: order._id,
        paymentIntentId: intent._id,
        gateway: "RAZORPAY",
        eventType: "CAPTURE",
        amount: 100,
        currency: "INR",
        gatewayEventId: "pay_dup_1",
        dedupeKey: "fh_dup_key",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        recordedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        orderId: order._id,
        paymentIntentId: intent._id,
        gateway: "RAZORPAY",
        eventType: "CAPTURE",
        amount: 100,
        currency: "INR",
        gatewayEventId: "pay_dup_2",
        dedupeKey: "fh_dup_key",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
        recordedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const out = await getFinanceHealth();
    const check = out.checks.find((c) => c.name === "Duplicate ledger entries (dedupeKey)");

    expect(check?.status).toBe("ERROR");
    expect(check?.details?.duplicateGroups).toBe(1);
  });

  afterEach(async () => {
    // Ensure Order collection isn't accidentally relied on across tests
    await Order.deleteMany({});
  });
});
