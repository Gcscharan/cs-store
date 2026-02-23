import axios from "axios";

import { verifyRazorpayPayment } from "../../src/domains/payments/verification/razorpayVerificationService";
import { RazorpayReadonlyClient } from "../../src/domains/payments/verification/razorpayReadonlyClient";
import {
  RazorpayVerificationError,
  RazorpayVerificationErrorCode,
} from "../../src/domains/payments/verification/errors";

jest.mock("axios");

type MockAxiosInstance = {
  request: jest.Mock;
};

function mockAxiosCreate() {
  const instance: MockAxiosInstance = {
    request: jest.fn(),
  };

  (axios.create as unknown as jest.Mock).mockReturnValue(instance);
  return instance;
}

describe("Razorpay verification (read-only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("valid payment fetch (payment first) returns normalized payment + refunds + order", async () => {
    const http = mockAxiosCreate();

    http.request
      .mockResolvedValueOnce({
        data: {
          id: "pay_123",
          status: "captured",
          method: "card",
          amount: 12300,
          created_at: 1700000000,
          order_id: "order_123",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "order_123",
          amount: 12300,
          currency: "INR",
          status: "paid",
          attempts: 1,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "rf_1", amount: 100, status: "processed" }],
        },
      });

    const res = await verifyRazorpayPayment(
      { razorpayPaymentId: "pay_123" },
      { client: new RazorpayReadonlyClient(), now: new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(res.gateway).toBe("RAZORPAY");
    expect(res.order?.id).toBe("order_123");
    expect(res.payment?.id).toBe("pay_123");
    expect(res.payment?.status).toBe("captured");
    expect(res.payment?.createdAt.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(res.refunds?.[0].id).toBe("rf_1");
    expect(res.fetchedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");

    expect(http.request).toHaveBeenCalledTimes(3);
    expect(http.request.mock.calls[0][0].method).toBe("GET");
  });

  it("valid order fetch (order first) returns normalized order and most recent payment + refunds", async () => {
    const http = mockAxiosCreate();

    http.request
      .mockResolvedValueOnce({
        data: {
          id: "order_aaa",
          amount: 5000,
          currency: "INR",
          status: "attempted",
          attempts: 2,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            { id: "pay_old", created_at: 100, status: "authorized", method: "upi", amount: 5000 },
            { id: "pay_new", created_at: 200, status: "captured", method: "upi", amount: 5000 },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [],
        },
      });

    const res = await verifyRazorpayPayment(
      { razorpayOrderId: "order_aaa" },
      { client: new RazorpayReadonlyClient(), now: new Date("2026-01-02T00:00:00.000Z") }
    );

    expect(res.order?.id).toBe("order_aaa");
    expect(res.payment?.id).toBe("pay_new");
    expect(res.refunds).toEqual([]);
  });

  it("order exists but payment missing returns order only", async () => {
    const http = mockAxiosCreate();

    http.request
      .mockResolvedValueOnce({
        data: {
          id: "order_only",
          amount: 1000,
          currency: "INR",
          status: "created",
          attempts: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [],
        },
      });

    const res = await verifyRazorpayPayment(
      { razorpayOrderId: "order_only" },
      { client: new RazorpayReadonlyClient(), now: new Date("2026-01-03T00:00:00.000Z") }
    );

    expect(res.order?.id).toBe("order_only");
    expect(res.payment).toBeUndefined();
    expect(res.refunds).toBeUndefined();
  });

  it("maps 404 from Razorpay to NOT_FOUND", async () => {
    const http = mockAxiosCreate();

    http.request.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(
      verifyRazorpayPayment(
        { razorpayPaymentId: "pay_missing" },
        { client: new RazorpayReadonlyClient() }
      )
    ).rejects.toMatchObject({ code: RazorpayVerificationErrorCode.NOT_FOUND });
  });

  it("maps 401 from Razorpay to AUTH_FAILED", async () => {
    const http = mockAxiosCreate();

    http.request.mockRejectedValueOnce({ response: { status: 401 } });

    await expect(
      verifyRazorpayPayment(
        { razorpayPaymentId: "pay_auth" },
        { client: new RazorpayReadonlyClient() }
      )
    ).rejects.toMatchObject({ code: RazorpayVerificationErrorCode.AUTH_FAILED });
  });

  it("maps 429 from Razorpay to RATE_LIMITED", async () => {
    const http = mockAxiosCreate();

    http.request.mockRejectedValueOnce({ response: { status: 429 } });

    await expect(
      verifyRazorpayPayment(
        { razorpayPaymentId: "pay_rl" },
        { client: new RazorpayReadonlyClient() }
      )
    ).rejects.toMatchObject({ code: RazorpayVerificationErrorCode.RATE_LIMITED });
  });

  it("maps timeout to GATEWAY_TIMEOUT", async () => {
    const http = mockAxiosCreate();

    http.request.mockRejectedValue({ code: "ECONNABORTED", message: "timeout of 5000ms exceeded" });

    await expect(
      verifyRazorpayPayment(
        { razorpayPaymentId: "pay_timeout" },
        { client: new RazorpayReadonlyClient() }
      )
    ).rejects.toMatchObject({ code: RazorpayVerificationErrorCode.GATEWAY_TIMEOUT });
  });

  it("rejects invalid input when neither id is supplied", async () => {
    await expect(verifyRazorpayPayment({})).rejects.toBeInstanceOf(RazorpayVerificationError);
    await expect(verifyRazorpayPayment({})).rejects.toMatchObject({
      code: RazorpayVerificationErrorCode.INVALID_INPUT,
    });
  });
});
