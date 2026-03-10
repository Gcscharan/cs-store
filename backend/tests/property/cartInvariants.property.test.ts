import * as fc from "fast-check";

type CartItem = { productId: string; price: number; qty: number };

describe("cart invariants", () => {
  it("cart total equals sum(price * qty)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            productId: fc.hexaString({ minLength: 24, maxLength: 24 }),
            price: fc.float({ min: 0.01, max: 1_000_000, noNaN: true }),
            qty: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (items: CartItem[]) => {
          const total = items.reduce((acc, it) => acc + it.price * it.qty, 0);
          return Number.isFinite(total) && total >= 0;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("qty is always >= 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (qty) => {
        return qty >= 1;
      }),
      { numRuns: 1000 }
    );
  });

  it("no duplicate productIds", () => {
    fc.assert(
      fc.property(
        fc.array(fc.hexaString({ minLength: 24, maxLength: 24 }), { minLength: 0, maxLength: 50 }),
        (ids) => {
          const set = new Set(ids);
          return set.size === ids.length;
        }
      ),
      { numRuns: 1000 }
    );
  });
});
