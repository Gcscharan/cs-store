/**
 * RF-001 — Customer tracking projection correctness (execution evidence).
 *
 * Proves the customer polling-fallback endpoint GET /orders/:orderId/tracking:
 *  - authorizes by the order's REAL owner field (userId),
 *  - reads order status from the REAL field (orderStatus),
 *  - resolves the rider from the order's CURRENT deliveryBoyId, so after an
 *    A→B reassignment the customer sees Rider B's location — never stale A.
 *
 * Regression guard for the field-name bug (user/status/deliveryPartner →
 * userId/orderStatus/deliveryBoyId) that made this endpoint 403 for everyone.
 */

import express, { Application } from "express";
import request from "supertest";
import mongoose from "mongoose";

import { connect, clear, close } from "../../tests/setup";
import { Order } from "../../models/Order";
import { DeliveryBoy } from "../../models/DeliveryBoy";

// Controllable authenticated user for the stubbed auth middleware.
let currentUserId = "";

jest.mock("../../middleware/auth", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { _id: currentUserId };
    next();
  },
}));

// liveLocationStore is Redis/in-memory backed; mock its synchronous get() so the
// test deterministically controls which rider has a live location.
const liveLocations: Record<string, any> = {};
jest.mock("../../services/liveLocationStore", () => ({
  liveLocationStore: {
    get: (driverId: string) => liveLocations[String(driverId)] ?? null,
  },
}));

// ETA calc does network/IO — stub it.
jest.mock("../../domains/tracking/services/etaCalculator", () => ({
  calculateETA: async () => ({ etaMinutes: 7, distanceRemainingM: 1500 }),
}));

import orderTrackingRouter from "../../routes/orderTracking";

const createTestApp = (): Application => {
  const app = express();
  app.use(express.json());
  app.use("/orders", orderTrackingRouter);
  return app;
};

const RIDER_A_LOC = { lat: 17.111, lng: 80.611, timestamp: Date.now(), accuracy: 10 };
const RIDER_B_LOC = { lat: 12.999, lng: 77.555, timestamp: Date.now(), accuracy: 10 };

describe("RF-001 customer tracking projection", () => {
  let app: Application;
  let customerId: string;
  let otherUserId: string;
  let riderA: any;
  let riderB: any;
  let order: any;

  beforeAll(async () => {
    await connect();
    app = createTestApp();
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await clear();
    for (const k of Object.keys(liveLocations)) delete liveLocations[k];

    customerId = new mongoose.Types.ObjectId().toString();
    otherUserId = new mongoose.Types.ObjectId().toString();

    riderA = await DeliveryBoy.create({
      name: "Rider A",
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    } as any);

    riderB = await DeliveryBoy.create({
      name: "Rider B",
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      vehicleType: "bike",
      isActive: true,
      availability: "available",
      currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    } as any);

    liveLocations[String(riderA._id)] = { ...RIDER_A_LOC, timestamp: Date.now() };
    liveLocations[String(riderB._id)] = { ...RIDER_B_LOC, timestamp: Date.now() };

    order = await Order.create({
      userId: new mongoose.Types.ObjectId(customerId),
      idempotencyKey: `idem_${Date.now()}_${Math.random()}`,
      orderStatus: "IN_TRANSIT",
      deliveryStatus: "in_transit",
      deliveryBoyId: riderA._id,
      totalAmount: 100,
      address: {
        label: "Home",
        addressLine: "123 Test St",
        city: "Tiruvuru",
        state: "AP",
        pincode: "521235",
        lat: 17.2,
        lng: 80.7,
      } as any,
      items: [],
    } as any);
  });

  it("authorizes the owner and returns the assigned rider's location (was 403 for everyone)", async () => {
    currentUserId = customerId;

    const res = await request(app).get(`/orders/${order._id}/tracking`);

    expect(res.status).toBe(200);
    expect(res.body.location).toBeTruthy();
    expect(res.body.location.riderLat).toBeCloseTo(17.111, 3);
    expect(res.body.location.riderLng).toBeCloseTo(80.611, 3);
    expect(res.body.deliveryPartner?.name).toBe("Rider A");
  });

  it("rejects a non-owner with 403", async () => {
    currentUserId = otherUserId;

    const res = await request(app).get(`/orders/${order._id}/tracking`);

    expect(res.status).toBe(403);
  });

  it("after A→B reassignment, the customer sees Rider B — never stale Rider A", async () => {
    currentUserId = customerId;

    // Reassign the order to Rider B (admin reassignment updates deliveryBoyId).
    await Order.updateOne(
      { _id: order._id },
      { $set: { deliveryBoyId: riderB._id } }
    );

    const res = await request(app).get(`/orders/${order._id}/tracking`);

    expect(res.status).toBe(200);
    // Rider B's coordinates, NOT Rider A's.
    expect(res.body.location.riderLat).toBeCloseTo(12.999, 3);
    expect(res.body.location.riderLng).toBeCloseTo(77.555, 3);
    expect(res.body.location.riderLat).not.toBeCloseTo(17.111, 3);
    expect(res.body.deliveryPartner?.name).toBe("Rider B");
  });

  it("returns 'not trackable' for a terminal order", async () => {
    currentUserId = customerId;
    // orderStatus is guarded against updateOne; create a terminal order directly.
    const delivered = await Order.create({
      userId: new mongoose.Types.ObjectId(customerId),
      idempotencyKey: `idem_term_${Date.now()}_${Math.random()}`,
      orderStatus: "DELIVERED",
      deliveryStatus: "delivered",
      deliveryBoyId: riderA._id,
      totalAmount: 100,
      address: {
        label: "Home",
        addressLine: "123 Test St",
        city: "Tiruvuru",
        state: "AP",
        pincode: "521235",
        lat: 17.2,
        lng: 80.7,
      } as any,
      items: [],
    } as any);

    const res = await request(app).get(`/orders/${delivered._id}/tracking`);

    expect(res.status).toBe(200);
    expect(res.body.location).toBeNull();
    expect(String(res.body.message || "")).toMatch(/no longer trackable/i);
  });

  it("reports 'no delivery partner assigned yet' when unassigned", async () => {
    currentUserId = customerId;
    await Order.updateOne({ _id: order._id }, { $unset: { deliveryBoyId: "" } });

    const res = await request(app).get(`/orders/${order._id}/tracking`);

    expect(res.status).toBe(200);
    expect(res.body.location).toBeNull();
    expect(String(res.body.message || "")).toMatch(/no delivery partner/i);
  });
});
