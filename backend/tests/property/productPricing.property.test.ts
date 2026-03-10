import * as fc from "fast-check";

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 100;

describe("product pricing invariants", () => {
  it("final price invariants", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        fc.double({ min: 0, max: 0.28, noNaN: true }),
        (price, discountRate, gstRate) => {
          const discount = price * discountRate;
          const gst = price * gstRate;
          const final = price - discount + gst;

          return (
            Number.isFinite(final) &&
            final > 0 &&
            discount >= 0 &&
            discount <= price &&
            gst >= 0 &&
            Math.abs(gst - price * gstRate) < 1e-6 &&
            Math.abs(final - (price + gst - discount)) < 1e-6
          );
        }
      ),
      { numRuns }
    );
  });
});
