import request from "supertest";
import app from "../../src/app";
import { startTrackingProjectionWorker } from "../../src/domains/tracking/workers/trackingProjectionWorker";
import { __resetTrackingEventStreamForTests } from "../../src/domains/tracking/stream/trackingEventStream";

async function waitFor(fn: () => Promise<boolean>, timeoutMs: number = 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timeout");
}

describe("Phase 1 tracking (stream + projection)", () => {
  const prevMode = process.env.TRACKING_KILL_SWITCH_MODE;

  beforeEach(() => {
    __resetTrackingEventStreamForTests();
    process.env.TRACKING_STREAM_DRIVER = "memory";
  });

  afterAll(() => {
    if (prevMode === undefined) {
      delete process.env.TRACKING_KILL_SWITCH_MODE;
    } else {
      process.env.TRACKING_KILL_SWITCH_MODE = prevMode;
    }
    delete process.env.TRACKING_STREAM_DRIVER;
  });

  it("ingestion -> stream -> projection -> customer API read (CUSTOMER_READ_ENABLED)", async () => {
    process.env.TRACKING_KILL_SWITCH_MODE = "CUSTOMER_READ_ENABLED";

    const customer = await (global as any).createTestUser({ email: "c1@example.com" });
    const order = await (global as any).createTestOrder(customer);
    const customerToken = await (global as any).getAuthToken(customer);

    const rider = await (global as any).createTestUser({ email: "r1@example.com", role: "delivery" });
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
        accuracyM: 10,
        speedMps: 2,
        deviceTs: new Date().toISOString(),
      });

    expect(ingestRes.status).toBe(200);

    await waitFor(async () => {
      const res = await request(app)
        .get(`/api/orders/${String(order._id)}/tracking`)
        .set("Authorization", `Bearer ${customerToken}`);

      return res.status === 200 && res.body && res.body.trackingState === "AVAILABLE";
    });

    const readRes = await request(app)
      .get(`/api/orders/${String(order._id)}/tracking`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(readRes.body.trackingState).toBe("AVAILABLE");
    expect(typeof readRes.body.lastUpdatedAt).toBe("string");
    expect(["LIVE", "STALE", "OFFLINE"]).toContain(readRes.body.freshnessState);
    expect("riderId" in readRes.body).toBe(false);

    await worker.stop();
  });

  it("kill switch OFF blocks ingestion and prevents projection/customer read", async () => {
    process.env.TRACKING_KILL_SWITCH_MODE = "OFF";

    const customer = await (global as any).createTestUser({ email: "c2@example.com" });
    const order = await (global as any).createTestOrder(customer);
    const customerToken = await (global as any).getAuthToken(customer);

    const rider = await (global as any).createTestUser({ email: "r2@example.com", role: "delivery" });
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
        accuracyM: 10,
        deviceTs: new Date().toISOString(),
      });

    expect(ingestRes.status).toBe(403);

    const readRes = await request(app)
      .get(`/api/orders/${String(order._id)}/tracking`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(readRes.body).toEqual({ trackingState: "HIDDEN" });

    await worker.stop();
  });
});
