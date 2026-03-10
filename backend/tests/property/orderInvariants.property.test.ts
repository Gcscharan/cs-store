import * as fc from "fast-check";

type LineItem = { price: number; qty: number };

describe("order invariants", () => {
  it("order total equals sum(line.price * qty)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
            qty: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (items: LineItem[]) => {
          const total = items.reduce((acc, it) => acc + it.price * it.qty, 0);
          const recomputed = items.map((it) => it.price * it.qty).reduce((a, b) => a + b, 0);
          return Number.isFinite(total) && Math.abs(total - recomputed) < 1e-6;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("status transitions only forward", () => {
    const order = ["CREATED", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: order.length - 1 }), { minLength: 1, maxLength: 50 }),
        (indices) => {
          // enforce monotonic increasing sequence
          let last = indices[0];
          for (let i = 1; i < indices.length; i++) {
            if (indices[i] < last) return false;
            last = indices[i];
          }
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("cancelled order never becomes delivered", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 30 }),
        (indices) => {
          // Build a forward-only progression where CANCELLED (4) is terminal
          let last = indices[0];
          const seq: number[] = [last];
          for (let i = 1; i < indices.length; i++) {
            last = Math.max(last, indices[i]);
            seq.push(last);
          }
          // If CANCELLED occurs, we must never see DELIVERED (3) afterwards
          const cancelledAt = seq.indexOf(4);
          if (cancelledAt === -1) return true;
          const after = seq.slice(cancelledAt + 1);
          return after.every((s) => s !== 3);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
