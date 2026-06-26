/**
 * Unit tests for refund EXECUTION (the newly-implemented money-out path).
 *
 * Proves:
 *   - executeRefund atomically claims REQUESTED→PROCESSING (one executor wins)
 *   - it calls the gateway with a stable idempotency key + refundRequestId notes
 *   - on synchronous "processed" it completes; otherwise stays PROCESSING
 *   - gateway failure reverts the claim back to REQUESTED (safe retry)
 *   - already-COMPLETED is a no-op (idempotent)
 */

const mockRefundFindById = jest.fn();
const mockRefundUpdateOne = jest.fn();
jest.mock("../../../src/domains/payments/models/RefundRequest", () => ({
  RefundRequest: {
    findById: (...a: any[]) => mockRefundFindById(...a),
    updateOne: (...a: any[]) => mockRefundUpdateOne(...a),
  },
}));

const mockOrderFindById = jest.fn();
jest.mock("../../../src/models/Order", () => ({
  Order: { findById: (...a: any[]) => mockOrderFindById(...a) },
}));

// PaymentIntent + LedgerEntry + ledgerService are pulled in by refundService; stub them.
jest.mock("../../../src/domains/payments/models/PaymentIntent", () => ({
  PaymentIntent: { findById: jest.fn() },
}));
jest.mock("../../../src/domains/payments/models/LedgerEntry", () => ({
  LedgerEntry: { aggregate: jest.fn() },
}));
const mockAppendLedger = jest.fn();
jest.mock("../../../src/domains/payments/services/ledgerService", () => ({
  appendLedgerEntry: (...a: any[]) => mockAppendLedger(...a),
}));

const mockRefundPayment = jest.fn();
jest.mock("../../../src/domains/payments/adapters/RazorpayAdapter", () => ({
  RazorpayAdapter: jest.fn().mockImplementation(() => ({
    refundPayment: (...a: any[]) => mockRefundPayment(...a),
  })),
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), opsAlert: jest.fn() },
  capturePaymentError: jest.fn(),
}));

import { executeRefund } from "../../../src/domains/payments/refunds/refundService";

const RR_ID = "6a3a00000000000000000001";
const ORDER_ID = "6a3a00000000000000000002";

function leanRefund(status: string) {
  return {
    select: () => ({
      lean: () => Promise.resolve({
        _id: RR_ID,
        orderId: ORDER_ID,
        paymentIntentId: "6a3a00000000000000000003",
        amount: 500,
        currency: "INR",
        status,
      }),
    }),
  };
}

function leanOrder(paymentId: string | null) {
  return {
    select: () => ({
      lean: () => Promise.resolve(paymentId ? { razorpayPaymentId: paymentId, paymentStatus: "PAID" } : { paymentStatus: "PAID" }),
    }),
  };
}

describe("executeRefund", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("happy path: claims PROCESSING, calls gateway with idempotency key + notes", async () => {
    mockRefundFindById.mockImplementationOnce(() => leanRefund("REQUESTED"));
    mockOrderFindById.mockImplementationOnce(() => leanOrder("pay_ABC123"));
    mockRefundUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // claim wins
    mockRefundPayment.mockResolvedValue({ gatewayRefundId: "rfnd_1", status: "pending", amount: 500, raw: {} });

    const out = await executeRefund({ refundRequestId: RR_ID });

    expect(out.executed).toBe(true);
    expect(out.gatewayRefundId).toBe("rfnd_1");
    expect(out.status).toBe("PROCESSING");

    // Gateway called with stable idempotency key + refundRequestId in notes.
    const callArg = mockRefundPayment.mock.calls[0][0];
    expect(callArg.gatewayPaymentId).toBe("pay_ABC123");
    expect(callArg.idempotencyKey).toBe(`refund:${RR_ID}`);
    expect(callArg.notes.refundRequestId).toBe(RR_ID);
  });

  test("already COMPLETED → idempotent no-op, no gateway call", async () => {
    mockRefundFindById.mockImplementationOnce(() => leanRefund("COMPLETED"));

    const out = await executeRefund({ refundRequestId: RR_ID });

    expect(out.executed).toBe(false);
    expect(out.status).toBe("COMPLETED");
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  test("lost claim (concurrent executor) → no gateway call", async () => {
    mockRefundFindById
      .mockImplementationOnce(() => leanRefund("REQUESTED"))   // initial read
      .mockImplementationOnce(() => ({ select: () => ({ lean: () => Promise.resolve({ status: "PROCESSING" }) }) })); // re-read after lost claim
    mockOrderFindById.mockImplementationOnce(() => leanOrder("pay_ABC123"));
    mockRefundUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 }); // claim lost

    const out = await executeRefund({ refundRequestId: RR_ID });

    expect(out.executed).toBe(false);
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  test("no gateway payment id → 409 NO_GATEWAY_PAYMENT_ID, no gateway call", async () => {
    mockRefundFindById.mockImplementationOnce(() => leanRefund("REQUESTED"));
    mockOrderFindById.mockImplementationOnce(() => leanOrder(null));

    await expect(executeRefund({ refundRequestId: RR_ID })).rejects.toMatchObject({
      message: "NO_GATEWAY_PAYMENT_ID",
      statusCode: 409,
    });
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  test("gateway failure → claim reverted to REQUESTED, error rethrown", async () => {
    mockRefundFindById.mockImplementationOnce(() => leanRefund("REQUESTED"));
    mockOrderFindById.mockImplementationOnce(() => leanOrder("pay_ABC123"));
    mockRefundUpdateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })  // claim wins
      .mockResolvedValueOnce({ modifiedCount: 1 }); // revert
    mockRefundPayment.mockRejectedValue(new Error("gateway 500"));

    await expect(executeRefund({ refundRequestId: RR_ID })).rejects.toThrow("gateway 500");

    // Second updateOne is the revert PROCESSING → REQUESTED.
    const revertCall = mockRefundUpdateOne.mock.calls[1];
    expect(revertCall[0]).toMatchObject({ status: "PROCESSING" });
    expect(revertCall[1].$set.status).toBe("REQUESTED");
  });
});
