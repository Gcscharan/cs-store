import * as fc from "fast-check";

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 20;

describe("delivery fee invariants", () => {
  function calcFee(distanceKm: number, freeThreshold: number, baseRate: number): number {
    if (distanceKm < 0) return NaN;
    const fee = distanceKm * baseRate;
    return fee >= freeThreshold ? 0 : fee;
  }

  it("fee always >= 0 and finite", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (distanceKm, freeThreshold, baseRate) => {
          const fee = calcFee(distanceKm, freeThreshold, baseRate);
          return Number.isFinite(fee) && fee >= 0;
        }
      ),
      { numRuns }
    );
  });

  it("fee never NaN or Infinity", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (distanceKm, freeThreshold, baseRate) => {
          const fee = calcFee(distanceKm, freeThreshold, baseRate);
          return !Number.isNaN(fee) && fee !== Infinity && fee !== -Infinity;
        }
      ),
      { numRuns: 50 }
    );
  });

  it("free delivery triggers above threshold", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        (distanceKm, freeThreshold, baseRate) => {
          const raw = distanceKm * baseRate;
          const fee = calcFee(distanceKm, freeThreshold, baseRate);
          if (raw >= freeThreshold) return fee === 0;
          return fee === raw;
        }
      ),
      { numRuns }
    );
  });
});
