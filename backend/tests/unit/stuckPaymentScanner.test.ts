import { runStuckPaymentScanOnce } from "../../src/domains/payments/services/stuckPaymentScanner";

jest.mock("../../src/domains/payments/models/PaymentIntent", () => {
  return {
    PaymentIntent: {
      find: jest.fn(),
      updateOne: jest.fn(),
    },
  };
});

jest.mock("../../src/models/Order", () => {
  return {
    Order: {
      findById: jest.fn(),
    },
  };
});

type AnyFn = (...args: any[]) => any;

function mockPaymentIntentFind(intents: any[]) {
  const { PaymentIntent } = require("../../src/domains/payments/models/PaymentIntent");
  (PaymentIntent.find as AnyFn).mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(intents),
    }),
  });
}

function mockOrderFindById(orderById: Record<string, any | null>) {
  const { Order } = require("../../src/models/Order");
  (Order.findById as AnyFn).mockImplementation((id: any) => {
    const v = orderById[String(id)];
    return {
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(v ?? null),
      }),
    };
  });
}

describe("stuckPaymentScanner", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("Paid orders are never touched", async () => {
    const { PaymentIntent } = require("../../src/domains/payments/models/PaymentIntent");

    mockPaymentIntentFind([
      {
        _id: "pi_1",
        orderId: "o_1",
        status: "PAYMENT_PROCESSING",
        updatedAt: new Date(Date.now() - 31 * 60_000),
        isLocked: false,
      },
    ]);

    mockOrderFindById({
      o_1: { paymentStatus: "PAID" },
    });

    const counts = await runStuckPaymentScanOnce({ now: new Date() });

    expect((PaymentIntent.updateOne as AnyFn).mock.calls.length).toBe(0);
    expect(counts.skippedPaid).toBe(1);
  });

  test("Old PAYMENT_PROCESSING moves to VERIFYING", async () => {
    const { PaymentIntent } = require("../../src/domains/payments/models/PaymentIntent");

    mockPaymentIntentFind([
      {
        _id: "pi_2",
        orderId: "o_2",
        status: "PAYMENT_PROCESSING",
        updatedAt: new Date(Date.now() - 31 * 60_000),
        isLocked: false,
      },
    ]);

    mockOrderFindById({
      o_2: { paymentStatus: "pending" },
    });

    (PaymentIntent.updateOne as AnyFn).mockResolvedValue({ modifiedCount: 1 });

    const counts = await runStuckPaymentScanOnce({ now: new Date() });

    expect((PaymentIntent.updateOne as AnyFn).mock.calls.length).toBe(1);
    const update = (PaymentIntent.updateOne as AnyFn).mock.calls[0][1];
    expect(update.$set.status).toBe("VERIFYING");
    expect(counts.recoverable).toBe(0);
  });

  test("Locked intents are skipped", async () => {
    const { PaymentIntent } = require("../../src/domains/payments/models/PaymentIntent");

    mockPaymentIntentFind([
      {
        _id: "pi_3",
        orderId: "o_3",
        status: "PAYMENT_RECOVERABLE",
        updatedAt: new Date(Date.now() - 25 * 60 * 60_000),
        isLocked: true,
      },
    ]);

    mockOrderFindById({
      o_3: { paymentStatus: "pending" },
    });

    const counts = await runStuckPaymentScanOnce({ now: new Date() });

    expect((PaymentIntent.updateOne as AnyFn).mock.calls.length).toBe(0);
    expect(counts.locked).toBe(0);
    expect(counts.scanned).toBe(1);
  });
});
