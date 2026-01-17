import request from "supertest";
import app from "../../src/app";
import redisClient from "../../src/config/redis";
import { createTestAdmin, getAuthHeadersForAdmin } from "../helpers/auth";
import { writeTrackingProjection } from "../../src/domains/tracking/services/trackingProjectionStore";

describe("Phase 5 admin incident APIs", () => {
  it("OPS_ADMIN can run detection and see incidents; OPS_VIEWER can read but cannot mutate", async () => {
    const admin = await createTestAdmin({ email: "ops-admin-p5@example.com" });
    const headers = getAuthHeadersForAdmin(admin);

    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_ADMIN");

    const user = await (global as any).createTestUser({ email: "cust-p5@example.com" });
    const now = Date.now();
    const order = await (global as any).createTestOrder(user, {
      deliveryStatus: "in_transit",
      orderStatus: "pending",
      estimatedDeliveryWindow: {
        start: new Date(now),
        end: new Date(now + 60_000),
        confidence: "high",
      },
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

    const run = await request(app)
      .post("/admin/tracking/incidents/run-detection")
      .set(headers)
      .send({ limit: 10 })
      .expect(200);

    expect(run.body.scannedOrders).toBeGreaterThanOrEqual(1);

    const list = await request(app).get("/admin/tracking/incidents").set(headers).expect(200);
    expect(list.body.count).toBeGreaterThan(0);

    const anyIncidentId = String(list.body.items[0].id);

    // Close as false positive to exercise metrics + MTTR
    await request(app)
      .post(`/admin/tracking/incidents/${anyIncidentId}/close`)
      .set(headers)
      .send({ reason: "false_positive:test" })
      .expect(200);

    const metrics = await request(app).get("/api/admin/ops/metrics").set(headers).expect(200);
    expect(String(metrics.text)).toContain("tracking_incidents_total");
    expect(String(metrics.text)).toContain("tracking_false_positive_total");
    expect(String(metrics.text)).toContain("tracking_incident_mttr_seconds");

    // Downgrade role to OPS_VIEWER and ensure mutation is blocked
    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_VIEWER");

    await request(app)
      .post(`/admin/tracking/incidents/${anyIncidentId}/ack`)
      .set(headers)
      .expect(403);

    await request(app).get(`/admin/tracking/incidents/${anyIncidentId}`).set(headers).expect(200);
  });
});
