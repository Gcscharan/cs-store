import request from "supertest";
import app from "../../src/app";
import redisClient from "../../src/config/redis";
import { createTestAdmin, createTestUser, getAuthHeaders, getAuthHeadersForAdmin } from "../helpers/auth";

describe("Phase 4 admin tracking routes", () => {
  beforeEach(async () => {
    // Ensure kill switch key isn't sticky across tests
    await redisClient.del("tracking:killswitch:mode");
  });

  it("requires admin auth for overview", async () => {
    const customer = await createTestUser({ role: "customer", email: "cust-ops@example.com" });
    const customerHeaders = getAuthHeaders(customer);

    await request(app).get("/admin/tracking/overview").set(customerHeaders).expect(403);
  });

  it("supports ETag polling with 304 when unchanged", async () => {
    const admin = await createTestAdmin({ email: "ops-viewer@example.com" });
    const headers = getAuthHeadersForAdmin(admin);

    const first = await request(app).get("/admin/tracking/overview").set(headers).expect(200);
    const etag = String(first.headers["etag"] || "");
    expect(etag).toContain('W/"');

    const second = await request(app)
      .get("/admin/tracking/overview")
      .set(headers)
      .set("If-None-Match", etag)
      .expect(304);

    expect(second.text || "").toBe("");
  });

  it("allows OPS_ADMIN to toggle kill switch with reason and emits admin action metric", async () => {
    const admin = await createTestAdmin({ email: "ops-admin@example.com" });
    const headers = getAuthHeadersForAdmin(admin);

    // Grant ops role via admin-only Redis mapping
    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_ADMIN");

    await request(app)
      .post("/admin/tracking/killswitch")
      .set(headers)
      .send({ mode: "CUSTOMER_READ_ENABLED", reason: "test" })
      .expect(200);

    const modeRes = await request(app).get("/admin/tracking/killswitch").set(headers).expect(200);
    expect(modeRes.body.mode).toBe("CUSTOMER_READ_ENABLED");

    const metrics = await request(app).get("/api/admin/ops/metrics").set(headers).expect(200);
    expect(String(metrics.text)).toContain('tracking_admin_actions_total{action="killswitch_toggle"}');
  });

  it("blocks OPS_VIEWER from toggling kill switch", async () => {
    const admin = await createTestAdmin({ email: "ops-viewer2@example.com" });
    const headers = getAuthHeadersForAdmin(admin);

    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_VIEWER");

    await request(app)
      .post("/admin/tracking/killswitch")
      .set(headers)
      .send({ mode: "OFF", reason: "test" })
      .expect(403);
  });
});
