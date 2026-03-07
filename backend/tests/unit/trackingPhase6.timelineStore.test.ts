import redisClient from "../../src/config/redis";

describe("Phase 6 incident timeline store", () => {
  it("adds immutable notes and dedupes identical writes", async () => {
    const g = globalThis as any;
    if (typeof g.__resetRedisMockStore === "function") {
      g.__resetRedisMockStore();
    }

    if ((redisClient as any)?.connect) {
      await (redisClient as any).connect();
    }

    expect(typeof (redisClient as any)?.get).toBe("function");
    expect(typeof (redisClient as any)?.set).toBe("function");

    const { addIncidentNote, listIncidentTimeline } = await import(
      "../../src/domains/tracking/phase6/incidentsTimelineStore"
    );

    const incidentId = `i-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const now = new Date(Date.now());

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
