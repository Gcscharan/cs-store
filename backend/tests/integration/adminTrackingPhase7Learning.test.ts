import request from "supertest";
import app from "../../src/app";
import redisClient from "../../src/config/redis";
import { createTestAdmin, getAuthHeadersForAdmin } from "../helpers/auth";
import { runOfflineLearningAnalysis } from "../../src/domains/tracking/phase7/offlineRunner";

describe("Phase 7 learning admin APIs", () => {
  it("OPS_VIEWER can read learning insights; endpoints are read-only", async () => {
    const admin = await createTestAdmin({ email: "ops-viewer-p7@example.com" });
    const headers = getAuthHeadersForAdmin(admin);
    await redisClient.set(`ops:role:${String(admin._id)}`, "OPS_VIEWER");

    // Run offline learning analysis (no API endpoint; test-only usage)
    await runOfflineLearningAnalysis({ now: new Date("2026-01-01T00:00:00.000Z") });

    const eta = await request(app).get("/admin/tracking/learning/eta").set(headers).expect(200);
    expect(String(eta.body.domain)).toBe("ETA");

    const inc = await request(app).get("/admin/tracking/learning/incidents").set(headers).expect(200);
    expect(String(inc.body.domain)).toBe("INCIDENT");

    const esc = await request(app).get("/admin/tracking/learning/escalations").set(headers).expect(200);
    expect(String(esc.body.domain)).toBe("ESCALATION");

    const ks = await request(app).get("/admin/tracking/learning/killswitch").set(headers).expect(200);
    expect(String(ks.body.domain)).toBe("KILLSWITCH");

    // Ensure endpoints do not provide mutation routes (404)
    await request(app).post("/admin/tracking/learning/eta").set(headers).send({}).expect(404);

    const metrics = await request(app).get("/api/admin/ops/metrics").set(headers).expect(200);
    expect(String(metrics.text)).toContain("learning_insights_total");
  });
});
