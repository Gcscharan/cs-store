import request from "supertest";
import app from "../../src/app";

describe("Phase 0 live tracking", () => {
  const prevEnv = process.env.TRACKING_KILL_SWITCH_MODE;

  beforeEach(() => {
    process.env.TRACKING_KILL_SWITCH_MODE = "OFF";
  });

  afterAll(() => {
    if (prevEnv === undefined) {
      delete process.env.TRACKING_KILL_SWITCH_MODE;
    } else {
      process.env.TRACKING_KILL_SWITCH_MODE = prevEnv;
    }
  });

  it("GET /api/orders/:id/tracking returns HIDDEN when kill switch is OFF", async () => {
    const user = await (global as any).createTestUser();
    const order = await (global as any).createTestOrder(user);
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .get(`/api/orders/${String(order._id)}/tracking`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ trackingState: "HIDDEN" });
  });

  it("GET /api/orders/:id/tracking returns OFFLINE contract when customer read is enabled", async () => {
    const user = await (global as any).createTestUser();
    const order = await (global as any).createTestOrder(user);
    const token = await (global as any).getAuthToken(user);

    process.env.TRACKING_KILL_SWITCH_MODE = "CUSTOMER_READ_ENABLED";

    const res = await request(app)
      .get(`/api/orders/${String(order._id)}/tracking`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.trackingState).toBe("OFFLINE");
    expect(res.body.lastUpdatedAt).toBe(null);
    expect(res.body.freshnessState).toBe("OFFLINE");
    expect("riderId" in res.body).toBe(false);
  });

  it("POST /internal/tracking/location rejects when kill switch is OFF", async () => {
    const user = await (global as any).createTestUser({ role: "delivery" });
    const token = await (global as any).getAuthToken(user);

    const res = await request(app)
      .post("/api/internal/tracking/location")
      .set("Authorization", `Bearer ${token}`)
      .send({
        schemaVersion: 1,
        riderId: String(user._id),
        orderId: "507f191e810c19729de860ea",
        seq: 1,
        lat: 17.4123,
        lng: 78.3912,
        accuracyM: 18,
        speedMps: 6.2,
        headingDeg: 120,
        deviceTs: new Date().toISOString(),
      });

    expect(res.status).toBe(403);
  });

  it("POST /internal/tracking/location accepts when kill switch is INGEST_ONLY", async () => {
    const user = await (global as any).createTestUser({ role: "delivery" });
    const token = await (global as any).getAuthToken(user);

    // Rider must own the order they post location for (ownership-validated ingest).
    const customer = await (global as any).createTestUser({ email: "p0ingest-cust@example.com" });
    const order = await (global as any).createTestOrder(customer, { deliveryPartnerId: user._id });

    process.env.TRACKING_KILL_SWITCH_MODE = "INGEST_ONLY";

    const res = await request(app)
      .post("/api/internal/tracking/location")
      .set("Authorization", `Bearer ${token}`)
      .send({
        schemaVersion: 1,
        riderId: String(user._id),
        orderId: String(order._id),
        seq: 1,
        lat: 17.4123,
        lng: 78.3912,
        accuracyM: 18,
        speedMps: 6.2,
        headingDeg: 120,
        deviceTs: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
  });

  it("POST /internal/tracking/location rejects when rider does not own the order (403)", async () => {
    const ownerRider = await (global as any).createTestUser({ email: "p0owner@example.com", role: "delivery" });
    const otherRider = await (global as any).createTestUser({ email: "p0other@example.com", role: "delivery" });
    const otherToken = await (global as any).getAuthToken(otherRider);

    const customer = await (global as any).createTestUser({ email: "p0own-cust@example.com" });
    const order = await (global as any).createTestOrder(customer, { deliveryPartnerId: ownerRider._id });

    process.env.TRACKING_KILL_SWITCH_MODE = "INGEST_ONLY";

    // A different authenticated rider must NOT be able to inject location for this order.
    const res = await request(app)
      .post("/api/internal/tracking/location")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        schemaVersion: 1,
        riderId: String(otherRider._id),
        orderId: String(order._id),
        seq: 1,
        lat: 17.4123,
        lng: 78.3912,
        accuracyM: 18,
        speedMps: 6.2,
        headingDeg: 120,
        deviceTs: new Date().toISOString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ownership_mismatch");
  });
});
