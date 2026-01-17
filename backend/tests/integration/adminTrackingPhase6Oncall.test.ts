import request from "supertest";
import app from "../../src/app";
import redisClient from "../../src/config/redis";
import { createTestAdmin, getAuthHeadersForAdmin } from "../helpers/auth";
import { writeTrackingProjection } from "../../src/domains/tracking/services/trackingProjectionStore";

describe("Phase 6 on-call & escalation admin APIs", () => {
  it("OPS_ADMIN can create policies/schedules, add notes, run escalation tick; OPS_VIEWER is read-only", async () => {
    const admin = await createTestAdmin({ email: "ops-admin-p6@example.com" });
    const headers = getAuthHeadersForAdmin(admin);
    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_ADMIN");

    // Policy
    await request(app)
      .post("/admin/tracking/oncall/policies")
      .set(headers)
      .send({
        id: "p6-policy-1",
        appliesTo: ["TRACKING_STALE"],
        severity: "WARN",
        steps: [{ afterMinutes: 0, target: "ONCALL_PRIMARY" }],
        suppressionWindowMinutes: 5,
      })
      .expect(200);

    // Schedule
    await request(app)
      .post("/admin/tracking/oncall/schedules")
      .set(headers)
      .send({
        id: "p6-schedule-1",
        team: "GLOBAL",
        primary: { userId: String(admin._id), email: admin.email },
        timezone: "UTC",
        effectiveFrom: new Date().toISOString(),
      })
      .expect(200);

    // Create an incident via Phase 5 runner
    const user = await (global as any).createTestUser({ email: "cust-p6@example.com" });
    const nowMs = Date.now();
    const order = await (global as any).createTestOrder(user, {
      deliveryStatus: "in_transit",
      orderStatus: "pending",
      estimatedDeliveryWindow: { start: new Date(nowMs), end: new Date(nowMs + 60_000), confidence: "high" },
    });

    await writeTrackingProjection({
      orderId: String(order._id),
      projection: {
        lastLat: 0,
        lastLng: 0,
        accuracyRadiusM: 500,
        lastUpdatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        freshnessState: "OFFLINE",
        movementState: "UNKNOWN",
        movementConfidence: "LOW",
        slaRiskLevel: "HIGH",
        slaRiskReasons: ["STALE_OR_OFFLINE"],
      } as any,
      ttlSeconds: 3600,
    });

    await request(app).post("/admin/tracking/incidents/run-detection").set(headers).send({ limit: 10 }).expect(200);

    const incidents = await request(app).get("/admin/tracking/incidents").set(headers).expect(200);
    expect(incidents.body.count).toBeGreaterThan(0);
    const incidentId = String(incidents.body.items[0].id);

    // Notes (OPS_ADMIN)
    await request(app)
      .post(`/admin/tracking/oncall/incidents/${incidentId}/notes`)
      .set(headers)
      .send({ text: "handoff: investigating stale pings" })
      .expect(200);

    // Timeline read
    const timeline = await request(app)
      .get(`/admin/tracking/oncall/incidents/${incidentId}/timeline`)
      .set(headers)
      .expect(200);
    expect(timeline.body.count).toBeGreaterThan(0);

    // Run escalation tick
    const run = await request(app).post("/admin/tracking/escalations/run").set(headers).send({ limitIncidents: 50 }).expect(200);
    expect(run.body.scannedIncidents).toBeGreaterThanOrEqual(0);

    // Viewer cannot mutate
    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_VIEWER");
    await request(app)
      .post("/admin/tracking/oncall/policies")
      .set(headers)
      .send({ id: "blocked", appliesTo: ["TRACKING_STALE"], severity: "WARN", steps: [{ afterMinutes: 0, target: "ONCALL_PRIMARY" }], suppressionWindowMinutes: 1 })
      .expect(403);

    await request(app)
      .post(`/admin/tracking/oncall/incidents/${incidentId}/notes`)
      .set(headers)
      .send({ text: "should be blocked" })
      .expect(403);

    // Viewer can read
    await request(app).get("/admin/tracking/oncall/policies").set(headers).expect(200);
    await request(app).get("/admin/tracking/escalations/status").set(headers).expect(200);

    const metrics = await request(app).get("/api/admin/ops/metrics").set(headers).expect(200);
    expect(String(metrics.text)).toContain("tracking_escalations_total");
    expect(String(metrics.text)).toContain("tracking_oncall_pages_total");
  });
});
