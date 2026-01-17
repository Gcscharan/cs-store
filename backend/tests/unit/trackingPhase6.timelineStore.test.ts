import { addIncidentNote, listIncidentTimeline } from "../../src/domains/tracking/phase6/incidentsTimelineStore";

describe("Phase 6 incident timeline store", () => {
  it("adds immutable notes and dedupes identical writes", async () => {
    const incidentId = "i-test";
    const now = new Date("2026-01-01T00:00:00.000Z");

    const e1 = await addIncidentNote({
      incidentId,
      note: { text: "handoff: root cause unknown" },
      actor: { userId: "u1", email: "u1@example.com" },
      now,
    });

    const e2 = await addIncidentNote({
      incidentId,
      note: { text: "handoff: root cause unknown" },
      actor: { userId: "u1", email: "u1@example.com" },
      now,
    });

    expect(e1.id).toBe(e2.id);

    const timeline = await listIncidentTimeline({ incidentId, limit: 50 });
    const notes = timeline.filter((t) => t.type === "note");
    expect(notes.length).toBe(1);
  });
});
