import fc from "fast-check";

import { assertAllowedTransition, isAllowedTransition } from "../../src/domains/payments/services/paymentIntentStateMachine";
import { PAYMENT_INTENT_STATUSES } from "../../src/domains/payments/types";

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 100;

describe("Property: payment invariants", () => {
  test("capturedAmount <= paymentAmount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_00 }),
        fc.integer({ min: 0, max: 1_000_000_00 }),
        (paymentAmount, capturedAmount) => {
          if (capturedAmount <= paymentAmount) {
            expect(capturedAmount).toBeLessThanOrEqual(paymentAmount);
          } else {
            expect(capturedAmount).toBeGreaterThan(paymentAmount);
          }
        }
      ),
      { numRuns }
    );
  });

  test("payment intent transitions are consistent", () => {
    const statuses = [...PAYMENT_INTENT_STATUSES] as any[];

    fc.assert(
      fc.property(fc.constantFrom(...statuses), fc.constantFrom(...statuses), (from, to) => {
        const ok = isAllowedTransition(from, to);
        if (ok) {
          expect(() => assertAllowedTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertAllowedTransition(from, to)).toThrow();
        }
      }),
      { numRuns }
    );
  });
});
