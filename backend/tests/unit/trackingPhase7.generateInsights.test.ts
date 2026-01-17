import { generateAllInsights } from "../../src/domains/tracking/phase7/generateInsights";

function makeSnapshot(asOf: string, overrides?: any): any {
  return {
    asOf,
    opsMetrics: {
      counters: {
        tracking_phase3_eta_error_ms_sum: 0,
        tracking_phase3_eta_error_count: 0,
      },
      labeledCounters: {},
      gauges: {},
    },
    incidents: [],
    escalationsStatus: { decisions: [] },
    sloSnapshot: undefined,
    ...(overrides || {}),
  };
}

describe("Phase 7 learning insight generation", () => {
  it("is deterministic: same input -> same insight ids", () => {
    const snap = makeSnapshot("2026-01-01T00:00:00.000Z", {
      opsMetrics: {
        counters: {
          tracking_phase3_eta_error_ms_sum: 120000,
          tracking_phase3_eta_error_count: 2,
        },
        labeledCounters: {
          'tracking_killswitch_activations_total:mode=CUSTOMER_READ_ENABLED': 1,
          'tracking_killswitch_activations_total:mode=INGEST_ONLY': 0,
          'tracking_killswitch_activations_total:mode=OFF': 0,
        },
        gauges: { tracking_kill_switch_state: 2 },
      },
      incidents: [
        {
          id: "i1",
          type: "TRACKING_STALE",
          severity: "WARN",
          scope: "ORDER",
          status: "CLOSED",
          detectedAt: "2026-01-01T00:00:00.000Z",
          closedAt: "2026-01-01T00:01:00.000Z",
          closeReason: "false_positive:test",
        },
      ],
    });

    const a = generateAllInsights(snap);
    const b = generateAllInsights(snap);

    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });
});
