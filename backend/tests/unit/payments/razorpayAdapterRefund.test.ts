/**
 * Tests for RazorpayAdapter refund parsing + execution wiring.
 */

process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test-webhook-secret";

import { RazorpayAdapter } from "../../../src/domains/payments/adapters/RazorpayAdapter";

describe("RazorpayAdapter — refund webhook parsing", () => {
  const adapter = new RazorpayAdapter();

  test("parses refund.processed with refundRequestId from notes", () => {
    const body = {
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: "rfnd_123",
            payment_id: "pay_456",
            amount: 50000, // paise → 500
            currency: "INR",
            created_at: 1700000000,
            notes: { refundRequestId: "rr_789" },
          },
        },
      },
    };
    const evt = adapter.parseWebhook({ rawBody: Buffer.from(JSON.stringify(body)) });

    expect(evt.type).toBe("REFUND_PROCESSED");
    expect(evt.gatewayRefundId).toBe("rfnd_123");
    expect(evt.gatewayPaymentId).toBe("pay_456");
    expect(evt.refundRequestId).toBe("rr_789");
    expect(evt.amount).toBe(500);
  });

  test("parses dashboard refund (no refundRequestId in notes)", () => {
    const body = {
      event: "refund.processed",
      payload: {
        refund: {
          entity: {
            id: "rfnd_dash",
            payment_id: "pay_dash",
            amount: 100000, // 1000
            currency: "INR",
          },
        },
      },
    };
    const evt = adapter.parseWebhook({ rawBody: Buffer.from(JSON.stringify(body)) });

    expect(evt.type).toBe("REFUND_PROCESSED");
    expect(evt.gatewayRefundId).toBe("rfnd_dash");
    expect(evt.gatewayPaymentId).toBe("pay_dash");
    expect(evt.refundRequestId).toBeUndefined();
    expect(evt.amount).toBe(1000);
  });

  test("payment.captured still parses correctly (regression)", () => {
    const body = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_x", order_id: "order_x", amount: 25000, currency: "INR" } } },
    };
    const evt = adapter.parseWebhook({ rawBody: Buffer.from(JSON.stringify(body)) });
    expect(evt.type).toBe("PAYMENT_CAPTURED");
    expect(evt.amount).toBe(250);
  });

  test("refundPayment calls gateway with idempotency header", async () => {
    const mockRefund = jest.fn().mockResolvedValue({ id: "rfnd_ok", status: "processed", amount: 50000 });
    (adapter as any).razorpay = { payments: { refund: mockRefund } };

    const out = await adapter.refundPayment({
      gatewayPaymentId: "pay_1",
      amount: 500,
      idempotencyKey: "refund:rr_1",
      notes: { refundRequestId: "rr_1" },
    });

    expect(out.gatewayRefundId).toBe("rfnd_ok");
    expect(out.status).toBe("processed");
    expect(out.amount).toBe(500);

    const [paymentId, opts, requestOptions] = mockRefund.mock.calls[0];
    expect(paymentId).toBe("pay_1");
    expect(opts.amount).toBe(50000); // paise
    expect(requestOptions["Idempotency-Key"]).toBe("refund:rr_1");
  });

  test("refundPayment rejects invalid amount", async () => {
    await expect(adapter.refundPayment({ gatewayPaymentId: "pay_1", amount: 0 })).rejects.toThrow();
  });
});
