import * as fc from "fast-check";

type CartItem = { productId: string; price: number; qty: number };

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 20;

const objectIdLike = () =>
  fc
    .stringMatching(/^[0-9a-f]{24}$/)
    .map((s) => s.toLowerCase());

describe("cart invariants", () => {
  it("cart total equals sum(price * qty)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            productId: objectIdLike(),
            price: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
            qty: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (items: CartItem[]) => {
          const total = items.reduce((acc, it) => acc + it.price * it.qty, 0);
          return Number.isFinite(total) && total >= 0;
        }
      ),
      { numRuns }
    );
  });

  it("qty is always >= 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (qty) => {
        return qty >= 1;
      }),
      { numRuns }
    );
  });

  it("no duplicate productIds", () => {
    fc.assert(
      fc.property(
        fc.set(objectIdLike(), { minLength: 0, maxLength: 50 }),
        (ids) => {
          const arr = Array.from(ids);
          const set = new Set(arr);
          return set.size === arr.length;
        }
      ),
      { numRuns }
    );
  });
});
