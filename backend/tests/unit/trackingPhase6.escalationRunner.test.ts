import redisClient from "../../src/config/redis";
import { upsertDetectedIncident } from "../../src/domains/tracking/phase5/incidents/store";
import { runEscalationTick } from "../../src/domains/tracking/phase6/escalationRunner";
import { upsertEscalationPolicy } from "../../src/domains/tracking/phase6/oncallPolicyStore";
import { upsertOnCallSchedule } from "../../src/domains/tracking/phase6/oncallScheduleStore";
import { listIncidentTimeline } from "../../src/domains/tracking/phase6/incidentsTimelineStore";

describe("Phase 6 escalation runner", () => {
  it("dedupes by {incidentId, policyId, stepIndex} and respects suppression window", async () => {
    const now = new Date("2026-01-01T00:10:00.000Z");

    await upsertEscalationPolicy({
      policy: {
        id: "p6-policy",
        appliesTo: ["TRACKING_STALE" as any],
        severity: "WARN" as any,
        steps: [{ afterMinutes: 0, target: "ONCALL_PRIMARY" }],
        suppressionWindowMinutes: 5,
      } as any,
    });

    await upsertOnCallSchedule({
      schedule: {
        id: "p6-sched",
        team: "GLOBAL",
        primary: { userId: "u1", email: "u1@example.com" },
        timezone: "UTC",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      } as any,
    });

    const detectedAt = new Date("2026-01-01T00:00:00.000Z");
    await upsertDetectedIncident({
      detected: {
        type: "TRACKING_STALE" as any,
        severity: "WARN" as any,
        scope: "ORDER" as any,
        subject: { scope: "ORDER", orderId: "o1" },
        evidence: { test: true },
      },
      now: detectedAt,
    });

    const r1 = await runEscalationTick({ now, limitIncidents: 50 });
    const emitted1 = r1.decisions.filter((d) => d.action === "EMITTED");
    expect(emitted1.length).toBe(1);

    // Same tick again should dedupe (no re-emit)
    const r2 = await runEscalationTick({ now, limitIncidents: 50 });
    const emitted2 = r2.decisions.filter((d) => d.action === "EMITTED");
    expect(emitted2.length).toBe(0);

    // Timeline should have detected + escalated
    const timeline = await listIncidentTimeline({ incidentId: emitted1[0].incidentId, limit: 50 });
    expect(timeline.find((t) => t.type === "escalated")).toBeTruthy();

    // Suppression key should exist
    const suppressExists = await redisClient.exists(`tracking:escalations:suppress:${emitted1[0].incidentId}:p6-policy`);
    expect(suppressExists).toBe(1);
  });
});
