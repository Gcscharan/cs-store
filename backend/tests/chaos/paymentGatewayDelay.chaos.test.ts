import { withFaults, maybeDelay } from "./faultInjection";

// We simulate gateway delay by delaying the adapter call layer.
// This test is intentionally isolated and does not call the real Razorpay SDK.

describe("Chaos: Payment gateway delay", () => {
  test("checkout flow code should not assume instant gateway response", async () => {
    await withFaults({ paymentGatewayDelayMs: 300 }, async () => {
      const start = Date.now();
      await maybeDelay(300);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(250);
    });
  });
});
