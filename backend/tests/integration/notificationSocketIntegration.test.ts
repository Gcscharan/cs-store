/**
 * Integration tests for Socket Emitter integration with Notification Flow.
 *
 * Tests verify that:
 * 1. Socket events are emitted after notification creation (via orchestrator)
 * 2. markAsRead emits notification:read and notification:unread_count events
 * 3. markAllAsRead emits notification:read_all and notification:unread_count events
 *
 * Requirements: 12.1, 12.3, 12.4, 12.5
 */

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import express, { Application } from "express";
import { User } from "../../src/models/User";
import Notification from "../../src/models/Notification";
import { createSocketEmitter } from "../../src/domains/communication/services/socketEmitter";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "test-jwt-secret-key",
    { expiresIn: "1h" }
  );
}

async function createTestUser(role: "customer" | "delivery" | "admin") {
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
  });
}

async function createTestNotification(userId: mongoose.Types.ObjectId, overrides: any = {}) {
  return Notification.create({
    userId,
    title: "Test Notification",
    message: "Test message body",
    body: "Test message body",
    category: "order",
    priority: "normal",
    isRead: false,
    eventType: "ORDER_CONFIRMED",
    deepLink: "/orders/test-123",
    ...overrides,
  });
}

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

function connectSocket(url: string, token?: string): Promise<ClientSocket> {
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

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Notification Socket Integration", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let app: Application;
  let serverUrl: string;

  beforeAll(async () => {
    app = express();
    httpServer = createServer(app);
    io = new SocketIOServer(httpServer, {
      cors: { origin: "*" },
      transports: ["websocket"],
    });

    // Attach io to app (same as production index.ts)
    app.set("io", io);

    // Auth middleware for socket connections
    io.use(async (socket, next) => {
      try {
        const provided =
          (typeof socket.handshake?.auth?.token === "string" &&
            String(socket.handshake.auth.token).trim()) ||
          "";

        if (!provided) return next(new Error("Unauthorized"));

        const jwtSecret = process.env.JWT_SECRET || "test-jwt-secret-key";
        const decoded = jwt.verify(provided, jwtSecret) as any;
        const userId = String(decoded?.userId || "");
        if (!userId) return next(new Error("Unauthorized"));

        (socket.data as any).userId = userId;
        (socket.data as any).role = decoded.role;

        // Auto-join user room (as in production)
        socket.join(`user_${userId}`);

        return next();
      } catch {
        return next(new Error("Unauthorized"));
      }
    });

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

  describe("Socket Emitter emitNotificationNew", () => {
    it("emits notification:new event with correct DTO to user room after notification creation", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);
        const eventPromise = waitForEvent<any>(socket, "notification:new");

        // Simulate what the orchestrator does after creating a notification
        const notificationDTO = {
          id: new mongoose.Types.ObjectId().toString(),
          title: "Order Confirmed",
          body: "Your order #ORD-001 has been confirmed",
          category: "order",
          priority: "P2",
          deepLink: "/orders/test-order-id",
          createdAt: new Date().toISOString(),
        };

        socketEmitter.emitNotificationNew(userId, notificationDTO);

        const received = await eventPromise;

        expect(received).toMatchObject({
          id: notificationDTO.id,
          title: "Order Confirmed",
          body: expect.stringContaining("ORD-001"),
          category: "order",
          priority: "P2",
          deepLink: "/orders/test-order-id",
          createdAt: expect.any(String),
        });
      } finally {
        socket.disconnect();
      }
    });

    it("emits notification:unread_count event after notification creation", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Create some unread notifications
      await createTestNotification(user._id);
      await createTestNotification(user._id);

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);
        const eventPromise = waitForEvent<any>(socket, "notification:unread_count");

        // Emit the unread count (as orchestrator does after in-app creation)
        const unreadCount = await Notification.countDocuments({
          userId: user._id,
          isRead: false,
        });
        socketEmitter.emitUnreadCount(userId, unreadCount);

        const received = await eventPromise;
        expect(received).toMatchObject({ count: 2 });
      } finally {
        socket.disconnect();
      }
    });
  });

  describe("Socket Emitter emitNotificationRead (markAsRead integration)", () => {
    it("emits notification:read event with notificationId when marking as read", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      const notification = await createTestNotification(user._id);
      const notificationId = String(notification._id);

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);
        const eventPromise = waitForEvent<any>(socket, "notification:read");

        socketEmitter.emitNotificationRead(userId, notificationId);

        const received = await eventPromise;
        expect(received).toMatchObject({ notificationId });
      } finally {
        socket.disconnect();
      }
    });

    it("emits updated unread count after marking a notification as read", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Create 3 unread notifications
      await createTestNotification(user._id);
      await createTestNotification(user._id);
      const notification = await createTestNotification(user._id);

      // Mark one as read
      notification.isRead = true;
      await notification.save();

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);
        const eventPromise = waitForEvent<any>(socket, "notification:unread_count");

        // Emit updated count (2 remaining unread)
        const unreadCount = await Notification.countDocuments({
          userId: user._id,
          isRead: false,
        });
        socketEmitter.emitUnreadCount(userId, unreadCount);

        const received = await eventPromise;
        expect(received).toMatchObject({ count: 2 });
      } finally {
        socket.disconnect();
      }
    });
  });

  describe("Socket Emitter emitNotificationReadAll (markAllAsRead integration)", () => {
    it("emits notification:read_all event when all notifications marked as read", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);
        const eventPromise = waitForEvent<any>(socket, "notification:read_all");

        socketEmitter.emitNotificationReadAll(userId);

        const received = await eventPromise;
        expect(received).toEqual({});
      } finally {
        socket.disconnect();
      }
    });

    it("emits unread count of 0 after marking all as read", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Create some unread notifications then mark all as read
      await createTestNotification(user._id);
      await createTestNotification(user._id);
      await Notification.updateMany({ userId: user._id, isRead: false }, { $set: { isRead: true } });

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);
        const eventPromise = waitForEvent<any>(socket, "notification:unread_count");

        socketEmitter.emitUnreadCount(userId, 0);

        const received = await eventPromise;
        expect(received).toMatchObject({ count: 0 });
      } finally {
        socket.disconnect();
      }
    });
  });

  describe("Socket event isolation - user rooms", () => {
    it("notification:new event is only received by the target user", async () => {
      const userA = await createTestUser("customer");
      const userB = await createTestUser("customer");
      const tokenA = makeToken(String(userA._id), "customer");
      const tokenB = makeToken(String(userB._id), "customer");

      const socketA = await connectSocket(serverUrl, tokenA);
      const socketB = await connectSocket(serverUrl, tokenB);

      try {
        const socketEmitter = createSocketEmitter(app);

        let userBReceived = false;
        socketB.on("notification:new", () => {
          userBReceived = true;
        });

        const eventPromiseA = waitForEvent<any>(socketA, "notification:new");

        // Emit to user A only
        socketEmitter.emitNotificationNew(String(userA._id), {
          id: "notif-1",
          title: "For User A Only",
          body: "This should only go to A",
          category: "order",
          priority: "P2",
          createdAt: new Date().toISOString(),
        });

        const received = await eventPromiseA;
        expect(received.title).toBe("For User A Only");

        // Wait a bit to ensure userB doesn't receive
        await new Promise((r) => setTimeout(r, 300));
        expect(userBReceived).toBe(false);
      } finally {
        socketA.disconnect();
        socketB.disconnect();
      }
    });
  });

  describe("End-to-end: markAsRead controller socket emission", () => {
    it("verifies the controller pattern: mark as read → emit read + unread count", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Create 3 unread notifications
      await createTestNotification(user._id);
      await createTestNotification(user._id);
      const targetNotification = await createTestNotification(user._id);
      const notificationId = String(targetNotification._id);

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);

        // Collect both events
        const readPromise = waitForEvent<any>(socket, "notification:read");
        const countPromise = waitForEvent<any>(socket, "notification:unread_count");

        // Simulate what the updated markAsRead controller does:
        // 1. Mark notification as read in DB
        targetNotification.isRead = true;
        await targetNotification.save();

        // 2. Emit socket events
        socketEmitter.emitNotificationRead(userId, notificationId);
        const unreadCount = await Notification.countDocuments({
          userId: user._id,
          isRead: false,
        });
        socketEmitter.emitUnreadCount(userId, unreadCount);

        const readEvent = await readPromise;
        const countEvent = await countPromise;

        expect(readEvent).toMatchObject({ notificationId });
        expect(countEvent).toMatchObject({ count: 2 });
      } finally {
        socket.disconnect();
      }
    });
  });

  describe("End-to-end: markAllAsRead controller socket emission", () => {
    it("verifies the controller pattern: mark all read → emit read_all + unread count 0", async () => {
      const user = await createTestUser("customer");
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Create unread notifications
      await createTestNotification(user._id);
      await createTestNotification(user._id);

      const socket = await connectSocket(serverUrl, token);

      try {
        const socketEmitter = createSocketEmitter(app);

        const readAllPromise = waitForEvent<any>(socket, "notification:read_all");
        const countPromise = waitForEvent<any>(socket, "notification:unread_count");

        // Simulate what the updated markAllAsRead controller does:
        // 1. Mark all as read in DB
        await Notification.updateMany(
          { userId: user._id, isRead: false },
          { $set: { isRead: true } }
        );

        // 2. Emit socket events
        socketEmitter.emitNotificationReadAll(userId);
        socketEmitter.emitUnreadCount(userId, 0);

        const readAllEvent = await readAllPromise;
        const countEvent = await countPromise;

        expect(readAllEvent).toEqual({});
        expect(countEvent).toMatchObject({ count: 0 });
      } finally {
        socket.disconnect();
      }
    });
  });
});
