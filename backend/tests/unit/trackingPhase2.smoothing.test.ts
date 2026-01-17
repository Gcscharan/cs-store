import { smoothLocationSample } from "../../src/domains/tracking/phase2/smoothing";

describe("Phase 2 smoothing", () => {
  it("noisy input converges to stable output (EMA behavior)", () => {
    const base = {
      smoothedLat: 17.4,
      smoothedLng: 78.39,
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
      movementState: "STATIONARY" as const,
      movementConfidence: "HIGH" as const,
    };

    const r1 = smoothLocationSample({
      prev: base,
      raw: {
        lat: 17.4003,
        lng: 78.3904,
        accuracyM: 10,
        serverReceivedAt: "2026-01-01T00:00:05.000Z",
      },
    });

    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // Should move towards the new point, but not jump entirely.
    expect(r1.value.lat).toBeGreaterThan(base.smoothedLat);
    expect(r1.value.lat).toBeLessThan(17.4003);
  });

  it("rejects impossible jumps by implied speed", () => {
    const prev = {
      smoothedLat: 17.4,
      smoothedLng: 78.39,
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    };

    const r = smoothLocationSample({
      prev,
      raw: {
        // huge jump in 1 second
        lat: 18.4,
        lng: 79.39,
        accuracyM: 10,
        serverReceivedAt: "2026-01-01T00:00:01.000Z",
      },
      config: { maxSpeedMps: 30 },
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("impossible_jump");
    expect(r.fallback.lat).toBe(prev.smoothedLat);
  });

  it("suppresses low confidence micro-jitter", () => {
    const prev = {
      smoothedLat: 17.4,
      smoothedLng: 78.39,
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    };

    const r = smoothLocationSample({
      prev,
      raw: {
        lat: 17.40001,
        lng: 78.39001,
        accuracyM: 200,
        serverReceivedAt: "2026-01-01T00:00:10.000Z",
      },
      config: { suppressLowConfidence: true },
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("low_confidence_suppressed");
  });
});
