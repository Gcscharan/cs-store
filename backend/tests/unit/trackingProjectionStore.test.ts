import {
  computeFreshnessState,
} from "../../src/domains/tracking/services/trackingProjectionStore";

describe("Tracking projection store", () => {
  it("computeFreshnessState returns LIVE/STALE/OFFLINE based on thresholds", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    expect(
      computeFreshnessState({
        lastUpdatedAt: "2026-01-01T00:00:00.000Z",
        now,
        staleAfterSeconds: 60,
        offlineAfterSeconds: 300,
      })
    ).toBe("LIVE");

    expect(
      computeFreshnessState({
        lastUpdatedAt: "2025-12-31T23:58:30.000Z",
        now,
        staleAfterSeconds: 60,
        offlineAfterSeconds: 300,
      })
    ).toBe("STALE");

    expect(
      computeFreshnessState({
        lastUpdatedAt: "2025-12-31T23:40:00.000Z",
        now,
        staleAfterSeconds: 60,
        offlineAfterSeconds: 300,
      })
    ).toBe("OFFLINE");
  });
});
