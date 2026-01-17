import { computeEta } from "../../src/domains/tracking/phase3/eta";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

describe("Phase 3 ETA engine", () => {
  it("suppresses small ETA flaps", () => {
    const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

    const base = computeEta({
      existing: null,
      nowIso: iso(t0 + 90 * 1000),
      smoothedLat: 0,
      smoothedLng: 0.0006,
      movementState: "MOVING",
      movementConfidence: "HIGH",
      destination: { lat: 0, lng: 0.01 },
      distanceRemainingM: 9300,
      rawSpeedMps: 5,
      config: {
        suppressSeconds: 180,
        idleThresholdSeconds: 300,
        minSpeedMps: 1,
        maxSpeedMps: 30,
      },
    });

    const existing: any = {
      ...(base.result as any),
      lastLat: 0,
      lastLng: 0,
      accuracyRadiusM: 10,
      // Keep lastUpdatedAt equal to nowIso so observed-speed does not override raw speed.
      lastUpdatedAt: iso(t0 + 90 * 1000),
      freshnessState: "LIVE",
      movementState: "MOVING",
      smoothedLat: 0,
      smoothedLng: 0.0006,
      movementConfidence: "HIGH",
    };

    const res = computeEta({
      existing,
      nowIso: iso(t0 + 90 * 1000),
      smoothedLat: 0,
      smoothedLng: 0.0006,
      movementState: "MOVING",
      movementConfidence: "HIGH",
      destination: { lat: 0, lng: 0.01 },
      // Small change in remaining distance => small ETA delta (< suppress window)
      distanceRemainingM: 9500,
      rawSpeedMps: 5,
      config: {
        recomputeMovedM: 0,
        suppressSeconds: 180,
      },
    });

    expect(res.recomputed).toBe(true);
    expect(res.result?.etaP50).toBe(base.result?.etaP50);
    expect(res.result?.etaP90).toBe(base.result?.etaP90);
  });

  it("widens ETA when stationary beyond idle threshold", () => {
    const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

    const base = computeEta({
      existing: null,
      nowIso: iso(t0),
      smoothedLat: 0,
      smoothedLng: 0,
      movementState: "MOVING",
      movementConfidence: "HIGH",
      destination: { lat: 0, lng: 0.01 },
      distanceRemainingM: 1100,
      rawSpeedMps: 6,
      config: {
        idleThresholdSeconds: 60,
        suppressSeconds: 0,
      },
    });

    const existing = {
      ...(base.result as any),
      lastLat: 0,
      lastLng: 0,
      accuracyRadiusM: 10,
      lastUpdatedAt: iso(t0),
      freshnessState: "LIVE",
      movementState: "STATIONARY",
      smoothedLat: 0,
      smoothedLng: 0,
      movementConfidence: "LOW",
      phase3LastMovingAt: iso(t0),
    };

    const idle = computeEta({
      existing: existing as any,
      nowIso: iso(t0 + 5 * 60 * 1000),
      smoothedLat: 0,
      smoothedLng: 0,
      movementState: "STATIONARY",
      movementConfidence: "LOW",
      destination: { lat: 0, lng: 0.01 },
      distanceRemainingM: 1100,
      rawSpeedMps: 0,
      config: {
        idleThresholdSeconds: 60,
        suppressSeconds: 0,
      },
    });

    expect(idle.recomputed).toBe(true);
    expect(new Date(String(idle.result?.etaP90)).getTime()).toBeGreaterThan(new Date(String(base.result?.etaP90)).getTime());
  });

  it("does not shrink P90 aggressively on confidence downgrade", () => {
    const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

    const existing: any = {
      lastLat: 0,
      lastLng: 0,
      accuracyRadiusM: 10,
      lastUpdatedAt: iso(t0),
      freshnessState: "LIVE",
      movementState: "MOVING",
      smoothedLat: 0,
      smoothedLng: 0,
      movementConfidence: "HIGH",
      etaP50: iso(t0 + 20 * 60 * 1000),
      etaP90: iso(t0 + 30 * 60 * 1000),
      etaUpdatedAt: iso(t0),
      etaConfidence: "high",
      etaAnchorLat: 0,
      etaAnchorLng: 0,
      etaAnchorDistanceRemainingM: 1000,
      etaAnchorUpdatedAt: iso(t0),
      etaSpeedEwmaMps: 10,
      phase3LastMovingAt: iso(t0),
    };

    const res = computeEta({
      existing,
      nowIso: iso(t0 + 2 * 60 * 1000),
      smoothedLat: 0,
      smoothedLng: 0,
      movementState: "STATIONARY",
      movementConfidence: "LOW",
      destination: { lat: 0, lng: 0.01 },
      distanceRemainingM: 200,
      rawSpeedMps: 0,
      config: {
        recomputeMovedM: 0,
        suppressSeconds: 0,
      },
    });

    expect(res.recomputed).toBe(true);
    expect(new Date(String(res.result?.etaP90)).getTime()).toBeGreaterThanOrEqual(new Date(existing.etaP90).getTime());
  });
});
