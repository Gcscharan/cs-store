/**
 * Integration tests for delivery Socket.IO functionality.
 *
 * Tests run against a real MongoDB (via setup-globals.ts) and a real Socket.IO
 * server started on a random port for each test suite.
 *
 * Requirements: 2.5, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 1b.4, 1.9
 */

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../../src/models/User";
import { Order } from "../../src/models/Order";
import { DeliverySocketEvent } from "../../src/models/DeliverySocketEvent";
import { DeliverySocketEmitter } from "../../src/domains/delivery/services/deliverySocketEmitter";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "test-jwt-secret-key",
    { expiresIn: "1h" }
  );
}

async function createUser(role: "delivery" | "customer" | "admin") {
  const phone = `9${Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, "0")}`;
  const referralCode = `REF${Date.now()}${Math.random()
    .toString(36)
    .substr(2, 5)
    .toUpperCase()}`;
  return User.create({
    name: `Test ${role}`,
    phone,
    referralCode,
    passwordHash: "hashed",
    role,
    ...(role !== "customer" ? { email: `${role}.${Date.now()}@test.com` } : {}),
  });
}

async function createOrder(userId: string, deliveryBoyId?: string) {
  return Order.create({
    userId,
    items: [{ productId: new mongoose.Types.ObjectId(), name: "Item", price: 100, qty: 1 }],
    totalAmount: 100,
    paymentStatus: "PENDING",
    orderStatus: "CONFIRMED",
    deliveryStatus: "unassigned",
    socketVersion: 0,
    paymentIntent: { status: "pending", amount: 100, currency: "INR" },
    address: {
      label: "Home",
      addressLine: "123 Test St",
      city: "City",
      state: "ST",
      pincode: "500001",
      lat: 17.38,
      lng: 78.48,
    },
    assignmentHistory: [],
    history: [],
    ...(deliveryBoyId ? { deliveryBoyId } : {}),
  });
}

/** Wait for a socket event with a timeout. */
function waitForEvent<T = any>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for event "${event}"`)),
      timeoutMs
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Connect a socket and wait for the connect event. */
function connectSocket(
  url: string,
  token?: string
): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const opts: any = {
      forceNew: true,
      transports: ["websocket"],
      ...(token ? { auth: { token } } : {}),
    };
    const socket = ioClient(url, opts);
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Connection timeout"));
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Attempt to connect and expect rejection. */
function expectConnectionRejected(
  url: string,
  token?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: any = {
      forceNew: true,
      transports: ["websocket"],
      reconnection: false,
      ...(token ? { auth: { token } } : {}),
    };
    const socket = ioClient(url, opts);
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Expected rejection but connection succeeded"));
    }, 5000);

    socket.on("connect_error", (err: Error) => {
      clearTimeout(timer);
      socket.disconnect();
      resolve(err.message);
    });
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error("Expected rejection but connection succeeded"));
    });
  });
}

// ─── Socket.IO server factory ────────────────────────────────────────────────

/**
 * Creates a minimal Socket.IO server that mirrors the auth middleware and
 * room handlers from backend/src/index.ts, but without background jobs.
 */
function createTestSocketServer() {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket"],
  });

  // Auth middleware (mirrors index.ts)
  io.use(async (socket, next) => {
    try {
      const provided =
        (typeof (socket.handshake as any)?.auth?.token === "string" &&
          String((socket.handshake as any).auth.token).trim()) ||
        (typeof socket.handshake.headers?.authorization === "string" &&
          String(socket.handshake.headers.authorization)
            .replace(/^Bearer\s+/i, "")
            .trim()) ||
        "";

      if (!provided) return next(new Error("Unauthorized"));

      const jwtSecret = process.env.JWT_SECRET || "test-jwt-secret-key";
      const decoded = jwt.verify(provided, jwtSecret) as any;
      const userId = String(decoded?.userId || "");
      if (!userId) return next(new Error("Unauthorized"));

      const u = await User.findById(userId).select("_id role").lean();
      if (!u) return next(new Error("Unauthorized"));

      const role = String((u as any).role || "");
      if (role !== "delivery" && role !== "admin" && role !== "customer") {
        return next(new Error("Unauthorized"));
      }

      (socket.data as any).userId = userId;
      (socket.data as any).role = role;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // join_room handler (mirrors index.ts)
    socket.on("join_room", (data) => {
      const { room, token } = data || {};
      const roomStr = String(room || "");

      // admin_room: admin only
      if (roomStr === "admin_room") {
        try {
          const provided =
            (typeof token === "string" && token.trim()) ||
            (typeof (socket.handshake as any)?.auth?.token === "string" &&
              String((socket.handshake as any).auth.token).trim()) ||
            "";
          if (!provided) return;

          const jwtSecret = process.env.JWT_SECRET || "test-jwt-secret-key";
          const decoded = jwt.verify(provided, jwtSecret) as any;
          const adminId = String(decoded?.userId || "");
          if (!adminId) return;

          User.findById(adminId)
            .select("role")
            .then((u: any) => {
              if (!u || String(u.role) !== "admin") return;
              socket.join("admin_room");
            })
            .catch(() => {});
        } catch {
          // silently ignore
        }
        return;
      }

      // delivery:{userId}: delivery role, must match own ID
      if (roomStr.startsWith("delivery:")) {
        try {
          const provided =
            (typeof token === "string" && token.trim()) ||
            (typeof (socket.handshake as any)?.auth?.token === "string" &&
              String((socket.handshake as any).auth.token).trim()) ||
            "";
          if (!provided) return;

          const jwtSecret = process.env.JWT_SECRET || "test-jwt-secret-key";
          const decoded = jwt.verify(provided, jwtSecret) as any;
          const deliveryBoyId = String(decoded?.userId || "");
          if (!deliveryBoyId) return;

          const expectedRoom = `delivery:${deliveryBoyId}`;
          if (roomStr !== expectedRoom) return; // room mismatch — silently ignore

          User.findById(deliveryBoyId)
            .select("role")
            .then((u: any) => {
              if (!u || String(u.role) !== "delivery") return;
              socket.join(roomStr);
            })
            .catch(() => {});
        } catch {
          // silently ignore
        }
        return;
      }

      // All other rooms denied
    });

    // join_order_room handler (mirrors index.ts)
    socket.on("join_order_room", async (data) => {
      const { orderId, token } = data || {};
      const orderIdStr = String(orderId || "").trim();
      if (!orderIdStr) return;

      try {
        const provided =
          (typeof token === "string" && token.trim()) ||
          (typeof (socket.handshake as any)?.auth?.token === "string" &&
            String((socket.handshake as any).auth.token).trim()) ||
          "";
        if (!provided) return;

        const jwtSecret = process.env.JWT_SECRET || "test-jwt-secret-key";
        const decoded = jwt.verify(provided, jwtSecret) as any;
        const userId = String(decoded?.userId || "");
        if (!userId) return;

        const order = await Order.findById(orderIdStr)
          .select("userId status")
          .lean();
        if (!order) return;

        // Check ownership using userId field
        if (String((order as any).userId) !== userId) return;

        socket.join(`order:${orderIdStr}`);
      } catch {
        // silently ignore
      }
    });

    // sync_request handler (mirrors index.ts)
    socket.on("sync_request", async (data: { lastEventTimestamp: string }) => {
      const riderId = String((socket.data as any).userId || "");
      if (!riderId) return;

      const since = new Date(data?.lastEventTimestamp || 0);

      try {
        const events = await DeliverySocketEvent.find({
          riderId: new mongoose.Types.ObjectId(riderId),
          timestamp: { $gt: since },
        })
          .sort({ timestamp: 1 })
          .limit(500)
          .lean();

        const orders = events.map((e: any) => e.payload);
        const wasCapped = events.length === 500;
        socket.emit("sync_response", { orders, fullRefetchRequired: wasCapped });
      } catch {
        socket.emit("sync_response", { orders: [] });
      }
    });
  });

  return { httpServer, io };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe("Delivery Socket Integration Tests", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let serverUrl: string;

  beforeAll(async () => {
    const { httpServer: hs, io: ioServer } = createTestSocketServer();
    httpServer = hs;
    io = ioServer;

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => {
        const addr = httpServer.address() as any;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  // ── 20.1 sync_request returns correct events ─────────────────────────────

  describe("20.1 sync_request returns correct events from DeliverySocketEvent collection", () => {
    it("returns seeded events for the authenticated rider", async () => {
      const rider = await createUser("delivery");
      const riderId = String(rider._id);
      const token = makeToken(riderId, "delivery");

      const baseTime = new Date(Date.now() - 10_000);

      // Seed two events for this rider
      const event1 = await DeliverySocketEvent.create({
        orderId: new mongoose.Types.ObjectId(),
        riderId: rider._id,
        eventName: "order:status:changed",
        payload: {
          orderId: new mongoose.Types.ObjectId().toString(),
          orderStatus: "PICKED_UP",
          deliveryStatus: "picked_up",
          allowedActions: ["START_DELIVERY"],
          version: 1,
          eventId: "evt-1",
          timestamp: new Date(baseTime.getTime() + 1000).toISOString(),
        },
        timestamp: new Date(baseTime.getTime() + 1000),
      });

      const event2 = await DeliverySocketEvent.create({
        orderId: new mongoose.Types.ObjectId(),
        riderId: rider._id,
        eventName: "order:status:changed",
        payload: {
          orderId: new mongoose.Types.ObjectId().toString(),
          orderStatus: "IN_TRANSIT",
          deliveryStatus: "in_transit",
          allowedActions: ["MARK_ARRIVED"],
          version: 2,
          eventId: "evt-2",
          timestamp: new Date(baseTime.getTime() + 2000).toISOString(),
        },
        timestamp: new Date(baseTime.getTime() + 2000),
      });

      // Seed an event for a DIFFERENT rider (should NOT appear)
      const otherRider = await createUser("delivery");
      await DeliverySocketEvent.create({
        orderId: new mongoose.Types.ObjectId(),
        riderId: otherRider._id,
        eventName: "order:status:changed",
        payload: {
          orderId: new mongoose.Types.ObjectId().toString(),
          orderStatus: "DELIVERED",
          deliveryStatus: "delivered",
          allowedActions: [],
          version: 1,
          eventId: "evt-other",
          timestamp: new Date(baseTime.getTime() + 500).toISOString(),
        },
        timestamp: new Date(baseTime.getTime() + 500),
      });

      const socket = await connectSocket(serverUrl, token);

      try {
        const syncPromise = waitForEvent<any>(socket, "sync_response");
        socket.emit("sync_request", {
          lastEventTimestamp: new Date(baseTime.getTime() - 1000).toISOString(),
        });

        const response = await syncPromise;

        expect(response).toHaveProperty("orders");
        expect(Array.isArray(response.orders)).toBe(true);
        expect(response.orders).toHaveLength(2);

        const eventIds = response.orders.map((o: any) => o.eventId);
        expect(eventIds).toContain("evt-1");
        expect(eventIds).toContain("evt-2");
        expect(eventIds).not.toContain("evt-other");
      } finally {
        socket.disconnect();
      }
    });

    it("returns empty array when no events exist after the given timestamp", async () => {
      const rider = await createUser("delivery");
      const token = makeToken(String(rider._id), "delivery");

      const socket = await connectSocket(serverUrl, token);

      try {
        const syncPromise = waitForEvent<any>(socket, "sync_response");
        socket.emit("sync_request", {
          lastEventTimestamp: new Date().toISOString(),
        });

        const response = await syncPromise;
        expect(response.orders).toHaveLength(0);
      } finally {
        socket.disconnect();
      }
    });
  });

  // ── 20.2 TTL index is configured correctly ───────────────────────────────

  describe("20.2 DeliverySocketEvent TTL index is configured correctly", () => {
    it("has a TTL index on createdAt with expireAfterSeconds: 86400", async () => {
      const collection = mongoose.connection.collection("deliverysocketevents");
      const indexes = await collection.listIndexes().toArray();

      const ttlIndex = indexes.find(
        (idx: any) =>
          idx.key &&
          idx.key.createdAt === 1 &&
          typeof idx.expireAfterSeconds === "number"
      );

      expect(ttlIndex).toBeDefined();
      expect(ttlIndex!.expireAfterSeconds).toBe(86400);
    });
  });

  // ── 20.3 socketVersion incremented after emitStatusChanged ───────────────

  describe("20.3 socketVersion is correctly incremented in Order document after emission", () => {
    it("increments socketVersion from 0 to 1 after emitStatusChanged", async () => {
      const customer = await createUser("customer");
      const rider = await createUser("delivery");

      const order = await createOrder(String(customer._id), String(rider._id));
      expect((order as any).socketVersion).toBe(0);

      const emitter = new DeliverySocketEmitter(io);
      await emitter.emitStatusChanged({
        order: {
          _id: order._id,
          deliveryBoyId: rider._id,
          userId: customer._id,
          orderStatus: "PICKED_UP",
          deliveryStatus: "picked_up",
        },
        previousStatus: "CONFIRMED",
        options: {
          codCollected: false,
          isNext: false,
          riderHasLocation: false,
          otpSentAt: null,
        },
      });

      const updated = await Order.findById(order._id).lean();
      expect((updated as any).socketVersion).toBe(1);
    });

    it("increments socketVersion monotonically across multiple emissions", async () => {
      const customer = await createUser("customer");
      const rider = await createUser("delivery");
      const order = await createOrder(String(customer._id), String(rider._id));

      const emitter = new DeliverySocketEmitter(io);
      const orderDoc = {
        _id: order._id,
        deliveryBoyId: rider._id,
        userId: customer._id,
        orderStatus: "PICKED_UP",
        deliveryStatus: "picked_up",
      };
      const opts = {
        codCollected: false,
        isNext: false,
        riderHasLocation: false,
        otpSentAt: null,
      };

      await emitter.emitStatusChanged({ order: orderDoc, previousStatus: "CONFIRMED", options: opts });
      await emitter.emitStatusChanged({ order: orderDoc, previousStatus: "PICKED_UP", options: opts });
      await emitter.emitStatusChanged({ order: orderDoc, previousStatus: "IN_TRANSIT", options: opts });

      const updated = await Order.findById(order._id).lean();
      expect((updated as any).socketVersion).toBe(3);
    });
  });

  // ── 20.4 Auth middleware rejects connections without valid JWT ────────────

  describe("20.4 Socket auth middleware rejects connections without valid JWT", () => {
    it("rejects connection with no token", async () => {
      const errMsg = await expectConnectionRejected(serverUrl);
      expect(errMsg).toMatch(/unauthorized/i);
    });

    it("rejects connection with an invalid/malformed token", async () => {
      const errMsg = await expectConnectionRejected(serverUrl, "not-a-valid-jwt");
      expect(errMsg).toMatch(/unauthorized/i);
    });

    it("rejects connection with a token for a non-existent user", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const token = makeToken(fakeId, "delivery");
      const errMsg = await expectConnectionRejected(serverUrl, token);
      expect(errMsg).toMatch(/unauthorized/i);
    });
  });

  // ── 20.5 join_room delivery:{userId} denied for wrong userId ─────────────

  describe("20.5 join_room for delivery:{userId} denied when room userId does not match JWT userId", () => {
    it("rider A does NOT receive events emitted to rider B's room", async () => {
      const riderA = await createUser("delivery");
      const riderB = await createUser("delivery");

      const tokenA = makeToken(String(riderA._id), "delivery");

      const socketA = await connectSocket(serverUrl, tokenA);

      try {
        // Rider A tries to join rider B's room
        socketA.emit("join_room", {
          room: `delivery:${riderB._id}`,
          token: tokenA,
        });

        // Give the server time to process the join attempt
        await new Promise((r) => setTimeout(r, 300));

        // Now emit an event to rider B's room
        let received = false;
        socketA.on("order:status:changed", () => {
          received = true;
        });

        io.to(`delivery:${riderB._id}`).emit("order:status:changed", {
          orderId: "test-order",
          orderStatus: "PICKED_UP",
        });

        // Wait briefly to see if the event arrives
        await new Promise((r) => setTimeout(r, 300));

        expect(received).toBe(false);
      } finally {
        socketA.disconnect();
      }
    });
  });

  // ── 20.6 join_order_room denied when order.userId does not match ─────────

  describe("20.6 join_order_room denied when order.userId does not match JWT userId", () => {
    it("customer A cannot join order room owned by customer B", async () => {
      const customerA = await createUser("customer");
      const customerB = await createUser("customer");

      const order = await createOrder(String(customerB._id));
      const tokenA = makeToken(String(customerA._id), "customer");

      const socketA = await connectSocket(serverUrl, tokenA);

      try {
        // Customer A tries to join customer B's order room
        socketA.emit("join_order_room", {
          orderId: String(order._id),
          token: tokenA,
        });

        // Give the server time to process
        await new Promise((r) => setTimeout(r, 300));

        // Emit to the order room
        let received = false;
        socketA.on("order:status:changed", () => {
          received = true;
        });

        io.to(`order:${order._id}`).emit("order:status:changed", {
          orderId: String(order._id),
          orderStatus: "DELIVERED",
        });

        await new Promise((r) => setTimeout(r, 300));

        expect(received).toBe(false);
      } finally {
        socketA.disconnect();
      }
    });

    it("customer A CAN join their own order room", async () => {
      const customerA = await createUser("customer");
      const order = await createOrder(String(customerA._id));
      const tokenA = makeToken(String(customerA._id), "customer");

      const socketA = await connectSocket(serverUrl, tokenA);

      try {
        socketA.emit("join_order_room", {
          orderId: String(order._id),
          token: tokenA,
        });

        // Give the server time to process the join
        await new Promise((r) => setTimeout(r, 300));

        const eventPromise = waitForEvent<any>(socketA, "order:status:changed", 2000);

        io.to(`order:${order._id}`).emit("order:status:changed", {
          orderId: String(order._id),
          orderStatus: "DELIVERED",
        });

        const event = await eventPromise;
        expect(event.orderId).toBe(String(order._id));
      } finally {
        socketA.disconnect();
      }
    });
  });

  // ── 20.7 join_room admin_room denied for non-admin users ─────────────────

  describe("20.7 join_room for admin_room denied for non-admin users", () => {
    it("rider does NOT receive events emitted to admin_room", async () => {
      const rider = await createUser("delivery");
      const token = makeToken(String(rider._id), "delivery");

      const socket = await connectSocket(serverUrl, token);

      try {
        // Rider tries to join admin_room
        socket.emit("join_room", { room: "admin_room", token });

        // Give the server time to process
        await new Promise((r) => setTimeout(r, 300));

        let received = false;
        socket.on("order:status:changed", () => {
          received = true;
        });

        io.to("admin_room").emit("order:status:changed", {
          orderId: "admin-test-order",
          orderStatus: "CONFIRMED",
        });

        await new Promise((r) => setTimeout(r, 300));

        expect(received).toBe(false);
      } finally {
        socket.disconnect();
      }
    });

    it("admin user CAN join admin_room", async () => {
      const admin = await createUser("admin");
      const token = makeToken(String(admin._id), "admin");

      const socket = await connectSocket(serverUrl, token);

      try {
        socket.emit("join_room", { room: "admin_room", token });

        // Give the server time to process the async join
        await new Promise((r) => setTimeout(r, 500));

        const eventPromise = waitForEvent<any>(socket, "order:status:changed", 2000);

        io.to("admin_room").emit("order:status:changed", {
          orderId: "admin-test-order-2",
          orderStatus: "CONFIRMED",
        });

        const event = await eventPromise;
        expect(event.orderId).toBe("admin-test-order-2");
      } finally {
        socket.disconnect();
      }
    });
  });
});
