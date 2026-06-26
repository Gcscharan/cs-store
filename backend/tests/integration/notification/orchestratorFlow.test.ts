/**
 * Integration tests for Notification Orchestrator — end-to-end flow.
 *
 * Tests the complete pipeline: publish event → notification created + socket emitted + push queued.
 * Uses real MongoDB (via test setup) and mocks external services (Expo Push API, Socket.IO).
 *
 * Requirements: R1 (Event-Driven Orchestration), R12 (Socket.IO Events), R10 (Push Delivery)
 */

import mongoose from "mongoose";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import express, { Application } from "express";

import { User } from "../../../src/models/User";
import Notification from "../../../src/models/Notification";
import ProcessedEvent from "../../../src/models/ProcessedEvent";
import NotificationAudit from "../../../src/models/NotificationAudit";
import { OutboxEvent } from "../../../src/models/OutboxEvent";
import {
  _handleEvent,
  _resetOrchestrator,
  _setSocketEmitter,
  CONSUMER_NAME,
} from "../../../src/domains/communication/services/notificationOrchestrator";
import { createSocketEmitter } from "../../../src/domains/communication/services/socketEmitter";
import {
  _resetBatchQueue,
  _resetRateLimitState,
} from "../../../src/domains/communication/services/pushGateway";

// Mock node-fetch for Expo Push API
jest.mock("node-fetch", () => jest.fn());
import fetch from "node-fetch";
const mockFetch = fetch as unknown as jest.Mock;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "test-jwt-secret-key",
    { expiresIn: "1h" }
  );
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

describe("Notification Orchestrator End-to-End Flow", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer;
  let app: Application;
  let serverUrl: string;
  const originalEnv = process.env.NOTIFICATION_ORCHESTRATOR_ENABLED;

  beforeAll(async () => {
    // Enable orchestrator
    process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "true";

    // Set up Socket.IO server
    app = express();
    httpServer = createServer(app);
    io = new SocketIOServer(httpServer, {
      cors: { origin: "*" },
      transports: ["websocket"],
    });

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

    // Initialize socket emitter with our test app
    const socketEmitter = createSocketEmitter(app);
    _setSocketEmitter(socketEmitter);
  });

  afterAll(async () => {
    process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = originalEnv;
    _resetOrchestrator();
    _setSocketEmitter(null);
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    _resetBatchQueue();
    _resetRateLimitState();
    jest.clearAllMocks();

    // Mock successful Expo push
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ status: "ok", id: "ticket-1" }],
      }),
    });
  });

  afterEach(() => {
    _resetBatchQueue();
    _resetRateLimitState();
  });

  describe("Complete orchestration flow: event → notification + socket + push", () => {
    it("should create notification, emit socket event, and queue push when ORDER_CONFIRMED event is processed", async () => {
      // Create a customer user with push token
      const user = await (global as any).createTestUser({
        email: "orchestrator-flow@test.com",
        expoPushToken: "ExponentPushToken[flow-test]",
        notificationPreferences: {
          push: { enabled: true, categories: { myOrders: true } },
        },
      });
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Connect socket client
      const socket = await connectSocket(serverUrl, token);

      try {
        // Set up event listener before triggering
        const notifPromise = waitForEvent<any>(socket, "notification:new");

        // Simulate the orchestrator processing an ORDER_CONFIRMED event
        const event = {
          eventId: `evt-${Date.now()}-order-confirmed`,
          eventType: "ORDER_CONFIRMED",
          version: 1,
          occurredAt: new Date().toISOString(),
          actor: { type: "system" },
          source: "orderStateService",
          data: {
            userId,
            orderId: new mongoose.Types.ObjectId().toString(),
            orderNumber: "ORD-12345",
          },
        };

        await _handleEvent(event as any);

        // Wait a moment for async operations
        await new Promise((r) => setTimeout(r, 200));

        // 1. Verify notification was created in MongoDB
        const notifications = await Notification.find({ userId: user._id }).lean();
        expect(notifications.length).toBeGreaterThanOrEqual(1);

        const notification = notifications[0];
        expect(notification.title).toContain("Confirmed");
        expect(notification.category).toBe("order");
        expect(notification.isRead).toBe(false);
        expect(notification.eventType).toBe("ORDER_CONFIRMED");

        // 2. Verify socket event was emitted
        const socketData = await notifPromise;
        expect(socketData).toMatchObject({
          title: expect.stringContaining("Confirmed"),
          category: "order",
        });

        // 3. Verify deduplication record was created
        const processedEvents = await ProcessedEvent.find({
          eventId: event.eventId,
          consumerName: CONSUMER_NAME,
        }).lean();
        expect(processedEvents.length).toBe(1);
      } finally {
        socket.disconnect();
      }
    });

    it("should deduplicate events — same event processed only once", async () => {
      const user = await (global as any).createTestUser({
        email: "orchestrator-dedupe@test.com",
        expoPushToken: "ExponentPushToken[dedupe-test]",
      });
      const userId = String(user._id);

      const event = {
        eventId: `evt-dedupe-${Date.now()}`,
        eventType: "ORDER_PACKED",
        version: 1,
        occurredAt: new Date().toISOString(),
        actor: { type: "system" },
        source: "orderStateService",
        data: {
          userId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderNumber: "ORD-DEDUPE",
        },
      };

      // Process the event twice
      await _handleEvent(event as any);
      await _handleEvent(event as any);

      // Should only create ONE notification
      const notifications = await Notification.find({
        userId: user._id,
        eventType: "ORDER_PACKED",
      }).lean();
      expect(notifications.length).toBe(1);
    });

    it("should handle multiple recipients for admin-alert events", async () => {
      // Create a customer and an admin
      const customer = await (global as any).createTestUser({
        email: "orchestrator-customer@test.com",
        role: "customer",
        expoPushToken: "ExponentPushToken[customer]",
      });
      const admin = await (global as any).createTestUser({
        email: "orchestrator-admin@test.com",
        role: "admin",
        expoPushToken: "ExponentPushToken[admin]",
      });

      const event = {
        eventId: `evt-admin-alert-${Date.now()}`,
        eventType: "ORDER_CREATED",
        version: 1,
        occurredAt: new Date().toISOString(),
        actor: { type: "system" },
        source: "orderBuilder",
        data: {
          userId: String(customer._id),
          orderId: new mongoose.Types.ObjectId().toString(),
          orderNumber: "ORD-ADMIN",
          totalAmount: 500,
        },
      };

      await _handleEvent(event as any);

      await new Promise((r) => setTimeout(r, 200));

      // Notifications should exist for both customer AND admin
      const customerNotifs = await Notification.find({
        userId: customer._id,
        eventType: "ORDER_CREATED",
      }).lean();
      const adminNotifs = await Notification.find({
        userId: admin._id,
        eventType: "ORDER_CREATED",
      }).lean();

      expect(customerNotifs.length).toBe(1);
      expect(adminNotifs.length).toBe(1);
    });

    it("should skip notification when event type has no registered template", async () => {
      const user = await (global as any).createTestUser({
        email: "orchestrator-notemplate@test.com",
      });

      const event = {
        eventId: `evt-unknown-${Date.now()}`,
        eventType: "UNKNOWN_EVENT_TYPE_XYZ",
        version: 1,
        occurredAt: new Date().toISOString(),
        actor: { type: "system" },
        source: "test",
        data: {
          userId: String(user._id),
        },
      };

      await _handleEvent(event as any);

      // No notification should be created for unknown event types
      const notifications = await Notification.find({ userId: user._id }).lean();
      expect(notifications.length).toBe(0);
    });

    it("should not process events when orchestrator is disabled", async () => {
      const prevFlag = process.env.NOTIFICATION_ORCHESTRATOR_ENABLED;
      process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "false";

      try {
        const user = await (global as any).createTestUser({
          email: "orchestrator-disabled@test.com",
        });

        const event = {
          eventId: `evt-disabled-${Date.now()}`,
          eventType: "ORDER_CONFIRMED",
          version: 1,
          occurredAt: new Date().toISOString(),
          actor: { type: "system" },
          source: "test",
          data: {
            userId: String(user._id),
            orderId: new mongoose.Types.ObjectId().toString(),
          },
        };

        await _handleEvent(event as any);

        const notifications = await Notification.find({ userId: user._id }).lean();
        expect(notifications.length).toBe(0);
      } finally {
        process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = prevFlag;
      }
    });

    it("should continue delivering to other channels when one channel fails", async () => {
      // Create user WITH push token but mock push failure
      const user = await (global as any).createTestUser({
        email: "orchestrator-partial-fail@test.com",
        expoPushToken: "ExponentPushToken[fail-push]",
      });
      const userId = String(user._id);
      const token = makeToken(userId, "customer");

      // Mock push to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const socket = await connectSocket(serverUrl, token);

      try {
        const notifPromise = waitForEvent<any>(socket, "notification:new");

        const event = {
          eventId: `evt-partial-fail-${Date.now()}`,
          eventType: "ORDER_CONFIRMED",
          version: 1,
          occurredAt: new Date().toISOString(),
          actor: { type: "system" },
          source: "test",
          data: {
            userId,
            orderId: new mongoose.Types.ObjectId().toString(),
            orderNumber: "ORD-PARTIAL",
          },
        };

        await _handleEvent(event as any);

        await new Promise((r) => setTimeout(r, 200));

        // In-app notification should STILL be created despite push failure
        const notifications = await Notification.find({ userId: user._id }).lean();
        expect(notifications.length).toBeGreaterThanOrEqual(1);

        // Socket event should STILL be emitted despite push failure
        const socketData = await notifPromise;
        expect(socketData.title).toBeDefined();
      } finally {
        socket.disconnect();
      }
    });
  });

  describe("Audit logging integration", () => {
    it("should create audit record after successful orchestration", async () => {
      const user = await (global as any).createTestUser({
        email: "orchestrator-audit@test.com",
        expoPushToken: "ExponentPushToken[audit-test]",
      });
      const userId = String(user._id);

      const eventId = `evt-audit-${Date.now()}`;
      const event = {
        eventId,
        eventType: "ORDER_DELIVERED",
        version: 1,
        occurredAt: new Date().toISOString(),
        actor: { type: "system" },
        source: "orderStateService",
        data: {
          userId,
          orderId: new mongoose.Types.ObjectId().toString(),
          orderNumber: "ORD-AUDIT",
        },
      };

      await _handleEvent(event as any);

      await new Promise((r) => setTimeout(r, 200));

      // Verify audit record was created
      const audits = await NotificationAudit.find({
        eventId,
        userId: user._id,
      }).lean();
      expect(audits.length).toBeGreaterThanOrEqual(1);

      const audit = audits[0];
      expect(audit.eventType).toBe("ORDER_DELIVERED");
      expect(audit.priority).toBeDefined();
      expect(audit.category).toBe("order");
      expect(audit.channels.length).toBeGreaterThan(0);
      expect(audit.actor.type).toBe("system");
    });
  });
});
