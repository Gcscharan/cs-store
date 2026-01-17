import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app";
import { createTestAdmin, createTestUser, getAuthHeadersForAdmin, getAuthHeaders } from "../helpers/auth";
import { Order } from "../../src/models/Order";
import { DeliveryBoy } from "../../src/models/DeliveryBoy";

describe("Admin CVRP routes operationalization", () => {
  it("compute -> persist -> assign -> delivery current route -> complete -> route status", async () => {
    const admin = await createTestAdmin({ email: "routes-admin@example.com" });
    const adminHeaders = getAuthHeadersForAdmin(admin);

    const customer = await createTestUser({ email: "routes-customer@example.com" });

    const deliveryUser = await createTestUser({
      email: "routes-delivery@example.com",
      phone: "9876543299",
      role: "delivery",
      status: "active",
    });
    const deliveryHeaders = getAuthHeaders(deliveryUser);

    const deliveryBoy = await DeliveryBoy.create({
      name: "Auto Driver",
      phone: "9876543288",
      vehicleType: "AUTO",
      isActive: true,
      availability: "busy",
      currentLocation: { lat: 17.094, lng: 80.598, lastUpdatedAt: new Date() },
      userId: deliveryUser._id,
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
      currentLoad: 0,
    });

    const orderIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const o = await Order.create({
        userId: customer._id,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: "Test Product",
            price: 100,
            qty: 1,
          },
        ],
        totalAmount: 100,
        paymentMethod: "cod",
        paymentStatus: "PENDING",
        orderStatus: "PACKED",
        deliveryStatus: "unassigned",
        address: {
          name: "Test User",
          phone: "9876543210",
          label: "Home",
          addressLine: "123 Test St",
          city: "Tiruvuru",
          state: "AP",
          pincode: "521235",
          lat: 17.094 + i * 0.001,
          lng: 80.598 + i * 0.001,
        },
        assignmentHistory: [],
        history: [],
      });
      orderIds.push(String((o as any)._id));
    }

    const compute = await request(app)
      .post("/api/admin/routes/compute")
      .set(adminHeaders)
      .send({ orderIds, vehicle: { type: "AUTO" } })
      .expect(200);

    expect(compute.body.success).toBe(true);
    expect(Array.isArray(compute.body.routes)).toBe(true);
    expect(compute.body.routes.length).toBeGreaterThan(0);

    const routeId = String(compute.body.routes[0].routeId);
    expect(routeId).toContain("AUTO-");

    const list = await request(app)
      .get("/api/admin/routes")
      .set(adminHeaders)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.routes)).toBe(true);

    const assign = await request(app)
      .post(`/api/admin/routes/${encodeURIComponent(routeId)}/assign`)
      .set(adminHeaders)
      .send({ deliveryBoyId: String(deliveryBoy._id) })
      .expect(200);

    expect(assign.body.success).toBe(true);
    expect(assign.body.route.routeId).toBe(routeId);

    const current = await request(app)
      .get("/api/delivery/routes/current")
      .set(deliveryHeaders)
      .expect(200);

    expect(current.body.success).toBe(true);
    expect(current.body.route).toBeTruthy();
    expect(current.body.route.routeId).toBe(routeId);
    expect(Array.isArray(current.body.route.routePath)).toBe(true);
    expect(current.body.route.routePath.length).toBeGreaterThanOrEqual(20);
    expect(current.body.route.nextStop).toBeTruthy();

    // Complete all orders (COD => no OTP required)
    for (const oid of orderIds) {
      await request(app)
        .post(`/api/delivery/orders/${encodeURIComponent(oid)}/complete`)
        .set(deliveryHeaders)
        .send({})
        .expect(200);
    }

    const status = await request(app)
      .get(`/api/admin/routes/${encodeURIComponent(routeId)}/status`)
      .set(adminHeaders)
      .expect(200);

    expect(status.body.success).toBe(true);
    expect(status.body.pendingCount).toBe(0);
    expect(status.body.deliveredCount).toBeGreaterThanOrEqual(20);
    expect(["IN_PROGRESS", "COMPLETED"]).toContain(String(status.body.status));

    // A subsequent status poll should converge to COMPLETED
    const status2 = await request(app)
      .get(`/api/admin/routes/${encodeURIComponent(routeId)}/status`)
      .set(adminHeaders)
      .expect(200);

    expect(status2.body.success).toBe(true);
    expect(status2.body.pendingCount).toBe(0);
    expect(String(status2.body.status)).toBe("COMPLETED");
  }, 60_000);
});
