import { computeSlaRisk } from "../../src/domains/tracking/phase3/slaRisk";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

describe("Phase 3 SLA risk engine", () => {
  it("escalates to HIGH when etaP90 is after promised window end", () => {
    const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
    const res = computeSlaRisk({
      existing: null,
      nowIso: iso(t0),
      internalState: "IN_TRANSIT",
      freshnessState: "LIVE",
      distanceRemainingM: 500,
      etaP90: iso(t0 + 40 * 60 * 1000),
      etaConfidence: "high",
      promisedWindowEnd: iso(t0 + 30 * 60 * 1000),
      phase3LastMovingAt: iso(t0),
      config: {
        idleThresholdSeconds: 10 * 60,
        longDistanceThresholdM: 1500,
      },
    });

    expect(res?.slaRiskLevel).toBe("HIGH");
    expect(res?.slaRiskReasons).toContain("ETA_P90_AFTER_PROMISED_WINDOW");
  });

  it("does not downgrade risk level across replays", () => {
    const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

    const existing: any = {
      slaRiskLevel: "HIGH",
      slaRiskReasons: ["ETA_P90_AFTER_PROMISED_WINDOW"],
      slaRiskDetectedAt: iso(t0),
    };

    const res = computeSlaRisk({
      existing,
      nowIso: iso(t0 + 60 * 1000),
      internalState: "IN_TRANSIT",
      freshnessState: "LIVE",
      distanceRemainingM: 10,
      etaP90: iso(t0 + 5 * 60 * 1000),
      etaConfidence: "high",
      promisedWindowEnd: iso(t0 + 30 * 60 * 1000),
      phase3LastMovingAt: iso(t0 + 60 * 1000),
    });

    expect(res?.slaRiskLevel).toBe("HIGH");
    expect(res?.slaRiskReasons).toContain("ETA_P90_AFTER_PROMISED_WINDOW");
    expect(res?.slaRiskDetectedAt).toBe(iso(t0));
  });

  it("adds STALE_OR_OFFLINE when freshness is not LIVE", () => {
    const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

    const res = computeSlaRisk({
      existing: null,
      nowIso: iso(t0),
      internalState: "IN_TRANSIT",
      freshnessState: "STALE",
      distanceRemainingM: 500,
      etaP90: iso(t0 + 10 * 60 * 1000),
      etaConfidence: "medium",
      promisedWindowEnd: iso(t0 + 60 * 60 * 1000),
      phase3LastMovingAt: iso(t0),
    });

    expect(res?.slaRiskReasons).toContain("STALE_OR_OFFLINE");
    expect(res?.slaRiskLevel).toBe("LOW");
  });
});
