import {
  buildRevenueLedgerRows,
  categorizePaymentIntentStatus,
  computeFinanceTotals,
  computeGatewayPerformance,
  type FinanceRefundEvent,
  type FinanceSaleEvent,
} from "../../src/domains/finance/financeMetrics";

describe("financeMetrics (PHASE 4.2)", () => {
  test("refunds are recognized on completion date (not sale date)", () => {
    const sales: FinanceSaleEvent[] = [
      {
        kind: "SALE",
        source: "RAZORPAY_CAPTURE",
        gateway: "RAZORPAY",
        orderId: "o1",
        paymentIntentId: "pi1",
        amount: 100,
        currency: "INR",
        occurredAt: new Date("2026-01-01T10:00:00.000Z"),
      },
    ];

    const refunds: FinanceRefundEvent[] = [
      {
        kind: "REFUND",
        gateway: "RAZORPAY",
        orderId: "o1",
        paymentIntentId: "pi1",
        refundId: "rf1",
        amount: 100,
        currency: "INR",
        completedAt: new Date("2026-01-03T12:00:00.000Z"),
      },
    ];

    const totalsSaleWindow = computeFinanceTotals({
      sales,
      refunds,
      range: { from: new Date("2026-01-01T00:00:00.000Z"), to: new Date("2026-01-02T00:00:00.000Z") },
      currency: "INR",
    });

    expect(totalsSaleWindow.grossRevenue).toBe(100);
    expect(totalsSaleWindow.refundedAmount).toBe(0);
    expect(totalsSaleWindow.netRevenue).toBe(100);

    const totalsRefundWindow = computeFinanceTotals({
      sales,
      refunds,
      range: { from: new Date("2026-01-03T00:00:00.000Z"), to: new Date("2026-01-04T00:00:00.000Z") },
      currency: "INR",
    });

    expect(totalsRefundWindow.grossRevenue).toBe(0);
    expect(totalsRefundWindow.refundedAmount).toBe(100);
    expect(totalsRefundWindow.netRevenue).toBe(-100);
  });

  test("partial refunds are supported", () => {
    const sales: FinanceSaleEvent[] = [
      {
        kind: "SALE",
        source: "COD_COLLECTION",
        gateway: "COD",
        orderId: "o2",
        amount: 200,
        currency: "INR",
        occurredAt: new Date("2026-01-05T10:00:00.000Z"),
      },
    ];

    const refunds: FinanceRefundEvent[] = [
      {
        kind: "REFUND",
        gateway: "RAZORPAY",
        orderId: "o2",
        amount: 50,
        currency: "INR",
        completedAt: new Date("2026-01-06T12:00:00.000Z"),
      },
    ];

    const totals = computeFinanceTotals({
      sales,
      refunds,
      range: { from: new Date("2026-01-01T00:00:00.000Z"), to: new Date("2026-02-01T00:00:00.000Z") },
      currency: "INR",
    });

    expect(totals.grossRevenue).toBe(200);
    expect(totals.refundedAmount).toBe(50);
    expect(totals.netRevenue).toBe(150);
    expect(totals.refundRate).toBeCloseTo(0.25, 5);
  });

  test("buildRevenueLedgerRows produces deterministic ordering", () => {
    const sales: FinanceSaleEvent[] = [
      {
        kind: "SALE",
        source: "RAZORPAY_CAPTURE",
        gateway: "RAZORPAY",
        orderId: "b",
        paymentIntentId: "pi_b",
        amount: 10,
        currency: "INR",
        occurredAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        kind: "SALE",
        source: "RAZORPAY_CAPTURE",
        gateway: "RAZORPAY",
        orderId: "a",
        paymentIntentId: "pi_a",
        amount: 10,
        currency: "INR",
        occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];

    const refunds: FinanceRefundEvent[] = [
      {
        kind: "REFUND",
        gateway: "RAZORPAY",
        orderId: "a",
        paymentIntentId: "pi_a",
        amount: 2,
        currency: "INR",
        completedAt: new Date("2026-01-01T01:00:00.000Z"),
      },
    ];

    const rows = buildRevenueLedgerRows({
      sales,
      refunds,
      range: { from: new Date("2026-01-01T00:00:00.000Z"), to: new Date("2026-01-03T00:00:00.000Z") },
      currency: "INR",
    });

    expect(rows.map((r) => `${r.date}:${r.eventType}:${r.orderId}`)).toEqual([
      "2026-01-01:sale:a",
      "2026-01-01:refund:a",
      "2026-01-02:sale:b",
    ]);
  });

  test("categorizePaymentIntentStatus is explicit and stable", () => {
    expect(categorizePaymentIntentStatus("CAPTURED")).toBe("SUCCESS");
    expect(categorizePaymentIntentStatus("FAILED")).toBe("FAILED");
    expect(categorizePaymentIntentStatus("CANCELLED")).toBe("FAILED");
    expect(categorizePaymentIntentStatus("EXPIRED")).toBe("FAILED");
    expect(categorizePaymentIntentStatus("VERIFYING")).toBe("PENDING");
    expect(categorizePaymentIntentStatus("PAYMENT_PROCESSING")).toBe("PENDING");
  });

  test("computeGatewayPerformance aggregates by gateway and status", () => {
    const out = computeGatewayPerformance({
      intents: [
        {
          paymentIntentId: "pi1",
          gateway: "RAZORPAY",
          status: "CAPTURED",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          paymentIntentId: "pi2",
          gateway: "RAZORPAY",
          status: "FAILED",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          paymentIntentId: "pi3",
          gateway: "RAZORPAY",
          status: "VERIFYING",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    expect(out).toHaveLength(1);
    expect(out[0].gateway).toBe("RAZORPAY");
    expect(out[0].successCount).toBe(1);
    expect(out[0].failedCount).toBe(1);
    expect(out[0].pendingCount).toBe(1);
    expect(out[0].captureRate).toBeCloseTo(1 / 3, 5);
  });
});
