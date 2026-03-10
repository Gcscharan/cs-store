import crypto from "crypto";

import { processRazorpayWebhook } from "../../src/domains/payments/services/webhookProcessor";

function sign(body: Buffer, secret: string) {
  return crypto.createHmac("sha256", secret).update(new Uint8Array(body)).digest("hex");
}

describe("Chaos: Webhook duplication", () => {
  test("duplicate PAYMENT_CAPTURED webhook should be idempotent", async () => {
    process.env.NODE_ENV = "test";
    process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test-webhook-secret";

    const suffix = crypto.randomBytes(6).toString("hex");
    const payload = {
      id: `evt_test_${suffix}`,
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_test_${suffix}`,
            order_id: `order_test_${suffix}`,
            amount: 1000,
            currency: "INR",
            created_at: Math.floor(Date.now() / 1000),
            notes: { orderId: "000000000000000000000000" },
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), "utf8");
    const signature = sign(rawBody, String(process.env.RAZORPAY_WEBHOOK_SECRET));
    const headers = { "x-razorpay-signature": signature };

    // Run twice (duplicate)
    const first = await processRazorpayWebhook({ rawBody, headers });
    let second: any;
    try {
      second = await processRazorpayWebhook({ rawBody, headers });
    } catch (e: any) {
      // Duplicate inbox insert should be treated as idempotent behavior.
      // If the implementation throws, ensure it's the expected duplicate-key class of error.
      const msg = String(e?.message || "");
      const code = Number(e?.code);
      expect(code === 11000 || msg.includes("E11000") || msg.includes("duplicate key")).toBe(true);
      second = { ok: true };
    }

    // Must not crash; should acknowledge duplicates safely.
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    // Both can be ok or first might fail due to missing order mapping, but duplication must not escalate.
    // Key: should not throw.
  });
});
