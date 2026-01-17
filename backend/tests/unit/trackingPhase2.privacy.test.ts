import { computeMarker } from "../../src/domains/tracking/phase2/privacy";

describe("Phase 2 privacy marker", () => {
  it("is deterministic for the same orderId", () => {
    const m1 = computeMarker({
      orderId: "order-123",
      baseLat: 17.4,
      baseLng: 78.39,
      baseAccuracyM: 20,
      nearDestination: false,
    });

    const m2 = computeMarker({
      orderId: "order-123",
      baseLat: 17.4,
      baseLng: 78.39,
      baseAccuracyM: 20,
      nearDestination: false,
    });

    expect(m1).toEqual(m2);
  });

  it("increases radius near destination", () => {
    const far = computeMarker({
      orderId: "order-xyz",
      baseLat: 17.4,
      baseLng: 78.39,
      baseAccuracyM: 20,
      nearDestination: false,
      minRadiusM: 25,
      maxRadiusM: 180,
    });

    const near = computeMarker({
      orderId: "order-xyz",
      baseLat: 17.4,
      baseLng: 78.39,
      baseAccuracyM: 20,
      nearDestination: true,
      minRadiusM: 25,
      maxRadiusM: 180,
    });

    expect(near.radiusM).toBeGreaterThanOrEqual(far.radiusM);
  });
});
