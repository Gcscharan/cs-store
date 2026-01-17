import request from "supertest";
import app from "../../src/app";
import redisClient from "../../src/config/redis";
import { startTrackingProjectionWorker } from "../../src/domains/tracking/workers/trackingProjectionWorker";
import { __resetTrackingEventStreamForTests } from "../../src/domains/tracking/stream/trackingEventStream";

async function waitFor(fn: () => Promise<boolean>, timeoutMs: number = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timeout");
}

describe("Phase 3 ETA + SLA enrichment (internal-only)", () => {
  const prevMode = process.env.TRACKING_KILL_SWITCH_MODE;

  beforeEach(() => {
    __resetTrackingEventStreamForTests();
    process.env.TRACKING_STREAM_DRIVER = "memory";
    process.env.TRACKING_KILL_SWITCH_MODE = "CUSTOMER_READ_ENABLED";
  });

  afterAll(() => {
    if (prevMode === undefined) {
      delete process.env.TRACKING_KILL_SWITCH_MODE;
    } else {
      process.env.TRACKING_KILL_SWITCH_MODE = prevMode;
    }
    delete process.env.TRACKING_STREAM_DRIVER;
  });

  it("writes ETA/SLA fields in Redis projection but does not leak via customer API", async () => {
    const customer = await (global as any).createTestUser({ email: "p3c@example.com" });
    const order = await (global as any).createTestOrder(customer, {
      estimatedDeliveryWindow: {
        start: new Date(Date.now()),
        end: new Date(Date.now() + 10 * 60 * 1000),
        confidence: "high",
      },
      orderStatus: "in_transit",
      deliveryStatus: "in_transit",
    });
    const customerToken = await (global as any).getAuthToken(customer);

    const rider = await (global as any).createTestUser({ email: "p3r@example.com", role: "delivery" });
    const riderToken = await (global as any).getAuthToken(rider);

    const worker = await startTrackingProjectionWorker();

    const ingestRes = await request(app)
      .post("/internal/tracking/location")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        schemaVersion: 1,
        riderId: String(rider._id),
        orderId: String(order._id),
        seq: 1,
        lat: 17.4123,
        lng: 78.3912,
        accuracyM: 12,
        speedMps: 2,
        deviceTs: new Date().toISOString(),
      });

    expect(ingestRes.status).toBe(200);

    await waitFor(async () => {
      const raw = await redisClient.get(`tracking:projection:${String(order._id)}`);
      return Boolean(raw);
    });

    const raw = await redisClient.get(`tracking:projection:${String(order._id)}`);
    const proj = JSON.parse(String(raw));

    expect(typeof proj.etaP50).toBe("string");
    expect(typeof proj.etaP90).toBe("string");
    expect(typeof proj.etaConfidence).toBe("string");
    expect(typeof proj.etaUpdatedAt).toBe("string");
    expect(typeof proj.distanceRemainingM).toBe("number");

    expect(typeof proj.slaRiskLevel).toBe("string");
    expect(Array.isArray(proj.slaRiskReasons)).toBe(true);
    expect(typeof proj.slaRiskDetectedAt).toBe("string");

    const readRes = await request(app)
      .get(`/api/orders/${String(order._id)}/tracking`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(readRes.body.trackingState).toBeDefined();
    expect("etaP50" in readRes.body).toBe(false);
    expect("etaP90" in readRes.body).toBe(false);
    expect("etaConfidence" in readRes.body).toBe(false);
    expect("slaRiskLevel" in readRes.body).toBe(false);

    await worker.stop();
  });
});
