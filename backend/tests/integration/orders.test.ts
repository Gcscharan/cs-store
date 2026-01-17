import request from "supertest";
import app from "../../src/app";
import { createTestUser, createTestAdmin, getAuthHeaders } from "../helpers/auth";
import "../types/global.d.ts";

describe("Orders Endpoints", () => {
  let user: any;
  let authHeaders: any;
  let product: any;
  let order: any;

  beforeEach(async () => {
    const { Pincode } = await import("../../src/models/Pincode");

    user = await createTestUser({
      addresses: [
        {
          name: "Test User",
          phone: "9876543210",
          label: "Home",
          addressLine: "123 Test Street",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500001",
          postal_district: "Hyderabad",
          admin_district: "Hyderabad",
          lat: 17.385,
          lng: 78.4867,
          isDefault: true,
          isGeocoded: true,
          coordsSource: "saved",
        },
      ],
    });
    authHeaders = getAuthHeaders(user);

    await Pincode.create({
      pincode: "500001",
      state: "Telangana",
      district: "Hyderabad",
      taluka: "Hyderabad",
    });

    product = await global.createTestProduct({
      name: "Test Product",
      price: 100,
      stock: 10,
    });
  });

  describe("POST /api/orders/create", () => {
    beforeEach(async () => {
      // Add product to cart
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });
    });

    it("should create order from cart", async () => {
      const response = await request(app)
        .post("/api/orders/create")
        .set(authHeaders)
        .send({ paymentMethod: "cod" });

      if (response.status !== 200) {
        console.error("Order creation failed:", {
          status: response.status,
          body: response.body,
        });
      }

      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty("message", "Order placed with Cash on Delivery");
      expect(response.body).toHaveProperty("order");
      expect(response.body.order.userId.toString()).toBe(user._id.toString());
      expect(response.body.order.items).toHaveLength(1);
      expect(response.body.order.items[0].qty).toBe(2);
      expect(response.body.order.items[0].priceAtOrderTime).toBe(100);
      expect(response.body.order.items[0].subtotal).toBe(200);
      expect(response.body.order.itemsTotal).toBe(200);
      expect(response.body.order.totalAmount).toBeGreaterThanOrEqual(200);
      expect(response.body.order.orderStatus).toBe("CREATED");
      expect(response.body.order.address).toHaveProperty("pincode", "500001");
      expect(response.body.order.address).toHaveProperty("postal_district");
      expect(response.body.order.address).toHaveProperty("admin_district");
      expect(response.body.order.paymentMethod).toBe("cod");

      // Verify cart is cleared
      const cartResponse = await request(app)
        .get("/api/cart")
        .set(authHeaders);

      expect(cartResponse.body.cart.items).toHaveLength(0);
    });

    it("should not create order with empty cart", async () => {
      // Clear cart first
      await request(app)
        .delete("/api/cart/clear")
        .set(authHeaders);

      const response = await request(app)
        .post("/api/orders/create")
        .set(authHeaders)
        .send({ paymentMethod: "cod" })
        .expect(400);

      expect(response.body).toHaveProperty("message", "Cart is empty");
    });

    it("should validate delivery address", async () => {
      const userNoAddress = await createTestUser({ email: "noaddr@example.com", addresses: [] });
      const userNoAddressHeaders = getAuthHeaders(userNoAddress);

      await request(app)
        .post("/api/cart/add")
        .set(userNoAddressHeaders)
        .send({ productId: product._id, quantity: 1 });

      const response = await request(app)
        .post("/api/orders/create")
        .set(userNoAddressHeaders)
        .send({ paymentMethod: "cod" })
        .expect(400);

      expect(response.body).toHaveProperty("message", "Default address is required");
    });

    it("should not create order without authentication", async () => {
      const response = await request(app)
        .post("/api/orders/create")
        .send({ paymentMethod: "cod" })
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });

    it("should check pincode serviceability", async () => {
      const userBadPincode = await createTestUser({
        email: "badpincode@example.com",
        addresses: [
          {
            name: "Test User",
            phone: "9876543210",
            label: "Home",
            addressLine: "123 Test Street",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "999999",
            postal_district: "Hyderabad",
            admin_district: "Hyderabad",
            lat: 17.385,
            lng: 78.4867,
            isDefault: true,
            isGeocoded: true,
            coordsSource: "saved",
          },
        ],
      });
      const badHeaders = getAuthHeaders(userBadPincode);

      await request(app)
        .post("/api/cart/add")
        .set(badHeaders)
        .send({ productId: product._id, quantity: 1 });

      const response = await request(app)
        .post("/api/orders/create")
        .set(badHeaders)
        .send({ paymentMethod: "cod" })
        .expect(400);

      expect(response.body).toHaveProperty("message", "Pincode not serviceable");
    });
  });

  describe("GET /api/orders", () => {
    beforeEach(async () => {
      // Create test orders
      await global.createTestOrder(user._id, {
        status: "pending",
      });
      await global.createTestOrder(user._id, {
        status: "confirmed",
      });
      await global.createTestOrder(user._id, {
        status: "delivered",
      });
    });

    it("should get user orders", async () => {
      const response = await request(app)
        .get("/api/orders")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("orders");
      expect(response.body.orders).toHaveLength(3);
      expect(response.body).toHaveProperty("pagination");
      response.body.orders.forEach((order: any) => {
        expect(order.userId).toBe(user._id.toString());
      });
    });

    it("should filter orders by status", async () => {
      const response = await request(app)
        .get("/api/orders?status=pending")
        .set(authHeaders)
        .expect(200);

      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].status).toBe("pending");
    });

    it("should paginate orders", async () => {
      const response = await request(app)
        .get("/api/orders?page=1&limit=2")
        .set(authHeaders)
        .expect(200);

      expect(response.body.orders).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(3);
    });

    it("should not get orders without authentication", async () => {
      const response = await request(app)
        .get("/api/orders")
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("GET /api/orders/:id", () => {
    let order: any;

    beforeEach(async () => {
      order = await global.createTestOrder(user._id);
    });

    it("should get order by ID", async () => {
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("order");
      expect(response.body.order._id).toBe(order._id.toString());
      expect(response.body.order.userId).toBe(user._id.toString());
      expect(response.body.order).toHaveProperty("timeline");
      expect(Array.isArray(response.body.order.timeline)).toBe(true);
    });

    it("should not get order of another user", async () => {
      const otherUser = await createTestUser({ email: "other@example.com" });
      const otherOrder = await global.createTestOrder(otherUser._id);
      const otherAuthHeaders = getAuthHeaders(otherUser);

      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set(otherAuthHeaders)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Order not found");
    });

    it("should return 404 for non-existent order", async () => {
      const response = await request(app)
        .get("/api/orders/507f1f77bcf86cd799439011")
        .set(authHeaders)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Order not found");
    });

    it("should return 400 for invalid order ID", async () => {
      const response = await request(app)
        .get("/api/orders/not-a-valid-objectid")
        .set(authHeaders)
        .expect(400);

      expect(response.body).toHaveProperty("message", "Invalid order ID");
    });

    it("should not get order without authentication", async () => {
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("PUT /api/orders/:id/cancel", () => {
    let order: any;
    let productForCancel: any;

    beforeEach(async () => {
      productForCancel = await global.createTestProduct({ stock: 10 });
      order = await global.createTestOrder(user._id, productForCancel, {
        orderStatus: "pending",
      });
    });

    it("should cancel pending order", async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Order cancelled");
      expect(response.body.order.orderStatus).toBe("CANCELLED");
    });

    it("should cancel confirmed order", async () => {
      const confirmedOrder = await global.createTestOrder(user._id, productForCancel, {
        orderStatus: "confirmed",
      });

      const response = await request(app)
        .put(`/api/orders/${confirmedOrder._id}/cancel`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Order cancelled");
      expect(response.body.order.orderStatus).toBe("CANCELLED");
    });

    it("should not cancel order of another user", async () => {
      const otherUser = await createTestUser({ email: "other@example.com" });
      const otherAuthHeaders = getAuthHeaders(otherUser);

      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set(otherAuthHeaders)
        .expect(403);

      expect(response.body).toHaveProperty("message");
    });

    it("should not cancel order without authentication", async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("GET /api/orders/:id/tracking", () => {
    let order: any;
    const prevMode = process.env.TRACKING_KILL_SWITCH_MODE;

    beforeEach(async () => {
      process.env.TRACKING_KILL_SWITCH_MODE = "OFF";
      order = await global.createTestOrder(user._id, {
        status: "confirmed",
      });
    });

    afterAll(() => {
      if (prevMode === undefined) {
        delete process.env.TRACKING_KILL_SWITCH_MODE;
      } else {
        process.env.TRACKING_KILL_SWITCH_MODE = prevMode;
      }
    });

    it("returns HIDDEN when customer tracking is disabled (Phase 0)", async () => {
      const response = await request(app)
        .get(`/api/orders/${order._id}/tracking`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toEqual({ trackingState: "HIDDEN" });
    });

    it("returns OFFLINE contract when customer tracking is enabled (Phase 0)", async () => {
      process.env.TRACKING_KILL_SWITCH_MODE = "CUSTOMER_READ_ENABLED";

      const response = await request(app)
        .get(`/api/orders/${order._id}/tracking`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.trackingState).toBe("OFFLINE");
      expect(response.body.lastUpdatedAt).toBe(null);
      expect(response.body.freshnessState).toBe("OFFLINE");
      expect("riderId" in response.body).toBe(false);
    });

    it("should return 404 for non-existent order", async () => {
      const response = await request(app)
        .get("/api/orders/507f1f77bcf86cd799439011/tracking")
        .set(authHeaders)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Order not found");
    });
  });

  describe("Admin order action endpoints", () => {
    let admin: any;
    let adminHeaders: any;
    let order: any;

    beforeEach(async () => {
      admin = await createTestAdmin();
      adminHeaders = getAuthHeaders(admin);
      order = await global.createTestOrder(user._id, {
        status: "pending",
      });
    });

    it("should confirm order as admin", async () => {
      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/confirm`)
        .set(adminHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.order.orderStatus).toBe("CONFIRMED");
    });

    it("should not allow regular user to confirm order", async () => {
      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/confirm`)
        .set(authHeaders)
        .expect(403);

      expect(response.body).toHaveProperty("message", "Admin access required");
    });

    it("should return 409 for invalid transition (pack before confirm)", async () => {
      const response = await request(app)
        .post(`/api/admin/orders/${order._id}/pack`)
        .set(adminHeaders)
        .expect(409);

      expect(response.body).toHaveProperty("message");
      expect(String(response.body.message)).toContain("Invalid state transition");
    });
  });
});
