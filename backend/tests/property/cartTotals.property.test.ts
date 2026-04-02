import fc from "fast-check";

import { calculateCartTotals } from "../../src/domains/cart/utils/CartUtils";

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 20;

describe("Property: cart totals", () => {
  test("total and itemCount are consistent and never negative", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
            quantity: fc.integer({ min: 0, max: 10_000 }),
          }),
          { maxLength: 100 }
        ),
        (items) => {
          const cartItems = items.map((it) => ({
            price: it.price,
            quantity: it.quantity,
            name: "x",
            productId: "p",
            image: "i",
          })) as any;

          const totals = calculateCartTotals(cartItems);

          expect(typeof totals.total).toBe("number");
          expect(Number.isFinite(totals.total)).toBe(true);
          expect(totals.total).toBeGreaterThanOrEqual(0);
          expect(totals.itemCount).toBeGreaterThanOrEqual(0);

          const expectedTotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
          const expectedCount = items.reduce((sum, it) => sum + it.quantity, 0);

          // Floating point: allow tiny error
          expect(Math.abs(totals.total - expectedTotal)).toBeLessThanOrEqual(0.0001 * Math.max(1, expectedTotal));
          expect(totals.itemCount).toBe(expectedCount);
        }
      ),
      { numRuns }
    );
  });
});
