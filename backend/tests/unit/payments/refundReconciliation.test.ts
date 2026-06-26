/**
 * Unit tests for the refund reconciliation scanner — completes refunds whose
 * webhook was lost/delayed by querying Razorpay directly.
 */

const mockRefundFind = jest.fn();
jest.mock("../../../src/domains/payments/models/RefundRequest", () => ({
  RefundRequest: { find: (...a: any[]) => mockRefundFind(...a) },
}));

const mockOrderFindById = jest.fn();
jest.mock("../../../src/models/Order", () => ({
  Order: { findById: (...a: any[]) => mockOrderFindById(...a) },
}));

const mockMarkCompleted = jest.fn();
jest.mock("../../../src/domains/payments/refunds/refundService", () => ({
  markRefundCompleted: (...a: any[]) => mockMarkCompleted(...a),
}));

const mockFetchPaymentRefunds = jest.fn();
jest.mock("../../../src/domains/payments/verification/razorpayReadonlyClient", () => ({
  RazorpayReadonlyClient: jest.fn().mockImplementation(() => ({
    fetchPaymentRefunds: (...a: any[]) => mockFetchPaymentRefunds(...a),
  })),
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  capturePaymentError: jest.fn(),
}));
jest.mock("../../../src/ops/opsMetrics", () => ({ incCounterWithLabels: jest.fn() }));

import { runRefundReconciliationOnce } from "../../../src/domains/payments/services/refundReconciliationService";

const RR_ID = "6a3a00000000000000000010";
const ORDER_ID = "6a3a00000000000000000011";

function stuckRefunds(rows: any[]) {
  mockRefundFind.mockReturnValue({
    select: () => ({ limit: () => ({ lean: () => Promise.resolve(rows) }) }),
  });
}
function orderWithPayment(paymentId: string | null) {
  mockOrderFindById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(paymentId ? { razorpayPaymentId: paymentId } : {}) }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
});

test("no stuck refunds → no work", async () => {
  stuckRefunds([]);
  const counts = await runRefundReconciliationOnce();
  expect(counts.scanned).toBe(0);
  expect(mockFetchPaymentRefunds).not.toHaveBeenCalled();
});

test("matches by refundRequestId note and completes when processed", async () => {
  stuckRefunds([{ _id: RR_ID, orderId: ORDER_ID, paymentIntentId: "pi", amount: 500 }]);
  orderWithPayment("pay_1");
  mockFetchPaymentRefunds.mockResolvedValue({
    items: [
      { id: "rfnd_1", status: "processed", amount: 50000, notes: { refundRequestId: RR_ID }, created_at: 1700000000 },
    ],
  });
  mockMarkCompleted.mockResolvedValue({ updated: true });

  const counts = await runRefundReconciliationOnce();

  expect(counts.completed).toBe(1);
  expect(mockMarkCompleted).toHaveBeenCalledWith(
    expect.objectContaining({ refundRequestId: RR_ID, gatewayRefundId: "rfnd_1" })
  );
});

test("falls back to amount+processed match when note missing", async () => {
  stuckRefunds([{ _id: RR_ID, orderId: ORDER_ID, paymentIntentId: "pi", amount: 750 }]);
  orderWithPayment("pay_2");
  mockFetchPaymentRefunds.mockResolvedValue({
    items: [{ id: "rfnd_2", status: "processed", amount: 75000, notes: {}, created_at: 1700000000 }],
  });
  mockMarkCompleted.mockResolvedValue({ updated: true });

  const counts = await runRefundReconciliationOnce();
  expect(counts.completed).toBe(1);
});

test("refund still pending at gateway → no completion", async () => {
  stuckRefunds([{ _id: RR_ID, orderId: ORDER_ID, paymentIntentId: "pi", amount: 500 }]);
  orderWithPayment("pay_3");
  mockFetchPaymentRefunds.mockResolvedValue({
    items: [{ id: "rfnd_3", status: "pending", amount: 50000, notes: { refundRequestId: RR_ID } }],
  });

  const counts = await runRefundReconciliationOnce();
  expect(counts.completed).toBe(0);
  expect(counts.still_pending).toBe(1);
  expect(mockMarkCompleted).not.toHaveBeenCalled();
});

test("missing gateway payment id → counted as error, no gateway call", async () => {
  stuckRefunds([{ _id: RR_ID, orderId: ORDER_ID, paymentIntentId: "pi", amount: 500 }]);
  orderWithPayment(null);

  const counts = await runRefundReconciliationOnce();
  expect(counts.errors).toBe(1);
  expect(mockFetchPaymentRefunds).not.toHaveBeenCalled();
});
