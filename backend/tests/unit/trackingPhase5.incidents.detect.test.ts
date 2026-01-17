import { detectIncidents } from "../../src/domains/tracking/phase5/incidents/detect";

describe("Phase 5 incident detection", () => {
  it("detects TRACKING_STALE when freshness is not LIVE beyond threshold", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    process.env.TRACKING_P5_TRACKING_STALE_S = "120";

    const detections = detectIncidents({
      now,
      order: { orderId: "o1", riderId: "r1", promisedWindowEnd: null, region: null },
      projection: {
        lastLat: 0,
        lastLng: 0,
        accuracyRadiusM: 10,
        lastUpdatedAt: "2025-12-31T23:57:00.000Z",
        freshnessState: "STALE",
        movementState: "UNKNOWN",
      },
    });

    expect(detections.some((d) => d.type === "TRACKING_STALE")).toBe(true);
  });

  it("detects ETA_DRIFT when etaP90 exceeds promised end + tolerance", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    process.env.TRACKING_P5_ETA_DRIFT_TOLERANCE_S = "60";

    const detections = detectIncidents({
      now,
      order: { orderId: "o1", riderId: "r1", promisedWindowEnd: "2026-01-01T00:00:00.000Z", region: null },
      projection: {
        lastLat: 0,
        lastLng: 0,
        accuracyRadiusM: 10,
        lastUpdatedAt: "2026-01-01T00:00:00.000Z",
        freshnessState: "LIVE",
        movementState: "MOVING",
        etaP90: "2026-01-01T00:02:01.000Z",
      } as any,
    });

    expect(detections.some((d) => d.type === "ETA_DRIFT")).toBe(true);
  });

  it("detects SLA_BREACH_RISK when slaRiskLevel is HIGH", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const detections = detectIncidents({
      now,
      order: { orderId: "o1", riderId: "r1", promisedWindowEnd: null, region: null },
      projection: {
        lastLat: 0,
        lastLng: 0,
        accuracyRadiusM: 10,
        lastUpdatedAt: "2026-01-01T00:00:00.000Z",
        freshnessState: "LIVE",
        movementState: "MOVING",
        slaRiskLevel: "HIGH",
        slaRiskReasons: ["STALE_OR_OFFLINE"],
      } as any,
    });

    expect(detections.some((d) => d.type === "SLA_BREACH_RISK")).toBe(true);
  });

  it("detects KILLSWITCH_TRIGGERED when global kill switch is not CUSTOMER_READ_ENABLED", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const detections = detectIncidents({
      now,
      globals: { killSwitchMode: "OFF" },
    });

    expect(detections.some((d) => d.type === "KILLSWITCH_TRIGGERED")).toBe(true);
  });
});
