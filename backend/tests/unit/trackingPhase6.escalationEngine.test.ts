import { decideEscalations, matchPolicies } from "../../src/domains/tracking/phase6/escalationEngine";

describe("Phase 6 escalation engine", () => {
  it("matches policies by incident type and severity", () => {
    const incident: any = {
      id: "i1",
      type: "TRACKING_STALE",
      severity: "WARN",
      scope: "ORDER",
      subject: { scope: "ORDER", orderId: "o1" },
      status: "OPEN",
      detectedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    };

    const policies: any[] = [
      { id: "p1", appliesTo: ["TRACKING_STALE"], severity: "WARN", steps: [{ afterMinutes: 5, target: "ONCALL_PRIMARY" }], suppressionWindowMinutes: 10 },
      { id: "p2", appliesTo: ["TRACKING_STALE"], severity: "CRITICAL", steps: [{ afterMinutes: 0, target: "OPS_MANAGER" }], suppressionWindowMinutes: 10 },
    ];

    const matched = matchPolicies({ incident, policies });
    expect(matched.map((p) => p.id)).toEqual(["p1"]);
  });

  it("computes escalation decisions based on time since detected", () => {
    const incident: any = {
      id: "i1",
      type: "TRACKING_STALE",
      severity: "WARN",
      scope: "ORDER",
      subject: { scope: "ORDER", orderId: "o1" },
      status: "OPEN",
      detectedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    };

    const policy: any = {
      id: "p1",
      appliesTo: ["TRACKING_STALE"],
      severity: "WARN",
      steps: [
        { afterMinutes: 0, target: "ONCALL_PRIMARY" },
        { afterMinutes: 10, target: "ONCALL_SECONDARY" },
      ],
      suppressionWindowMinutes: 15,
    };

    const now = new Date("2026-01-01T00:05:00.000Z");
    const decisions = decideEscalations({ now, incident, policy });

    const byStep = new Map(decisions.map((d) => [d.stepIndex, d]));
    expect(byStep.get(0)?.shouldEscalate).toBe(true);
    expect(byStep.get(1)?.shouldEscalate).toBe(false);
  });
});
