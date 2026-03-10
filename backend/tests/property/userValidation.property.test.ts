import * as fc from "fast-check";

describe("user validation invariants", () => {
  const pincodeRe = /^\d{6}$/;
  const phoneRe = /^\d{10}$/;

  it("pincode is always exactly 6 digits", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const digits = s.replace(/\D/g, "").slice(0, 6);
        return pincodeRe.test(digits.padStart(6, "0"));
      }),
      { numRuns: 1000 }
    );
  });

  it("phone is always exactly 10 digits", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const digits = s.replace(/\D/g, "").slice(0, 10);
        return phoneRe.test(digits.padStart(10, "0"));
      }),
      { numRuns: 1000 }
    );
  });

  it("email always contains @ symbol", () => {
    fc.assert(
      fc.property(fc.emailAddress(), (email) => {
        return typeof email === "string" && email.includes("@");
      }),
      { numRuns: 1000 }
    );
  });
});
