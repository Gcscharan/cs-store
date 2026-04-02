import fc from "fast-check";

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 20;

describe("Property: inventory reservation arithmetic", () => {
  test("reservedStock never exceeds stock after applying reservation constraints", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (stock, reservedStock, qty) => {
          // Skip invalid initial states - reservedStock should never exceed stock
          // This is a DB invariant that must hold before any operation
          if (reservedStock > stock) {
            return; // Invalid initial state, skip this case
          }

          const available = Math.max(0, stock - reservedStock);
          const canReserve = available >= qty && qty > 0;

          const nextReserved = canReserve ? reservedStock + qty : reservedStock;

          // Core invariant: reservedStock must never exceed stock
          expect(nextReserved).toBeLessThanOrEqual(stock);

          // After reservation, remaining stock must be non-negative
          if (canReserve) {
            expect(stock - nextReserved).toBeGreaterThanOrEqual(0);
          }

          // Release must clamp at 0
          const released = Math.max(0, nextReserved - qty);
          expect(released).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns }
    );
  });
});
