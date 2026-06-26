import mongoose from "mongoose";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock ProcessedEvent
const mockProcessedEventCreate = jest.fn();
jest.mock("../../../src/models/ProcessedEvent", () => ({
  __esModule: true,
  default: {
    create: (...args: any[]) => mockProcessedEventCreate(...args),
  },
}));

// Mock Notification
const mockNotificationCreate = jest.fn();
const mockNotificationCountDocuments = jest.fn();
jest.mock("../../../src/models/Notification", () => ({
  __esModule: true,
  default: {
    create: (...args: any[]) => mockNotificationCreate(...args),
    countDocuments: (...args: any[]) => mockNotificationCountDocuments(...args),
  },
}));

// Mock User
const mockUserFind = jest.fn();
const mockUserFindById = jest.fn();
jest.mock("../../../src/models/User", () => ({
  User: {
    find: (...args: any[]) => mockUserFind(...args),
    findById: (...args: any[]) => mockUserFindById(...args),
  },
}));

// Mock PushNotificationService
const mockSendToUser = jest.fn();
jest.mock("../../../src/utils/PushNotificationService", () => ({
  PushNotificationService: {
    sendToUser: (...args: any[]) => mockSendToUser(...args),
  },
}));

// Mock pushGateway
const mockSendPush = jest.fn();
jest.mock("../../../src/domains/communication/services/pushGateway", () => ({
  sendPush: (...args: any[]) => mockSendPush(...args),
}));

// Mock channelRouter
const mockDetermineChannels = jest.fn();
jest.mock("../../../src/domains/communication/services/channelRouter", () => ({
  determineChannels: (...args: any[]) => mockDetermineChannels(...args),
}));

// Mock eventBus subscribe
const mockSubscribe = jest.fn();
jest.mock("../../../src/domains/events/eventBus", () => ({
  subscribe: (...args: any[]) => mockSubscribe(...args),
}));

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock socketEmitter
jest.mock("../../../src/domains/communication/services/socketEmitter", () => ({
  createSocketEmitter: jest.fn(() => ({
    emitNotificationNew: jest.fn(),
    emitNotificationRead: jest.fn(),
    emitNotificationReadAll: jest.fn(),
    emitUnreadCount: jest.fn(),
    emitNotificationSync: jest.fn(),
  })),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import {
  initializeNotificationOrchestrator,
  _handleEvent,
  _resolveRecipients,
  _resetOrchestrator,
  _setSocketEmitter,
  CONSUMER_NAME,
  ADMIN_ALERT_EVENTS,
  DELIVERY_PARTNER_EVENTS,
} from "../../../src/domains/communication/services/notificationOrchestrator";
import { BaseEvent } from "../../../src/domains/events/BaseEvent";
import { ISocketEmitter } from "../../../src/domains/communication/services/socketEmitter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTestEvent(overrides: Partial<BaseEvent> = {}): BaseEvent {
  return {
    eventId: "evt_test_123",
    eventType: "ORDER_CONFIRMED",
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: { type: "system" },
    source: "test",
    data: {
      userId: new mongoose.Types.ObjectId().toString(),
      orderId: new mongoose.Types.ObjectId().toString(),
      orderNumber: "ORD-001",
      estimatedDelivery: "30 mins",
    },
    ...overrides,
  };
}

function createMockSocketEmitter(): ISocketEmitter {
  return {
    emitNotificationNew: jest.fn(),
    emitNotificationRead: jest.fn(),
    emitNotificationReadAll: jest.fn(),
    emitUnreadCount: jest.fn(),
    emitNotificationSync: jest.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Notification Orchestrator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetOrchestrator();
    process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "true";

    // Default mock behaviors
    mockProcessedEventCreate.mockResolvedValue({});
    mockNotificationCreate.mockImplementation((doc: any) => {
      return Promise.resolve({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        toString: () => new mongoose.Types.ObjectId().toString(),
      });
    });
    mockNotificationCountDocuments.mockResolvedValue(5);
    mockDetermineChannels.mockResolvedValue(["in_app", "push", "socket"]);
    mockSendPush.mockResolvedValue(undefined);
    mockUserFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    mockUserFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
  });

  afterEach(() => {
    delete process.env.NOTIFICATION_ORCHESTRATOR_ENABLED;
  });

  describe("initializeNotificationOrchestrator", () => {
    it("should subscribe to the event bus", () => {
      initializeNotificationOrchestrator();
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should only initialize once", () => {
      initializeNotificationOrchestrator();
      initializeNotificationOrchestrator();
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("Feature Flag", () => {
    it("should skip processing when NOTIFICATION_ORCHESTRATOR_ENABLED is not true", async () => {
      process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "false";
      const event = createTestEvent();

      await _handleEvent(event);

      expect(mockProcessedEventCreate).not.toHaveBeenCalled();
    });

    it("should skip processing when NOTIFICATION_ORCHESTRATOR_ENABLED is not set", async () => {
      delete process.env.NOTIFICATION_ORCHESTRATOR_ENABLED;
      const event = createTestEvent();

      await _handleEvent(event);

      expect(mockProcessedEventCreate).not.toHaveBeenCalled();
    });

    it("should process events when NOTIFICATION_ORCHESTRATOR_ENABLED is true", async () => {
      process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "true";
      const event = createTestEvent();

      await _handleEvent(event);

      expect(mockProcessedEventCreate).toHaveBeenCalled();
    });
  });

  describe("Deduplication (Step 1)", () => {
    it("should create a ProcessedEvent record with correct consumerName", async () => {
      const event = createTestEvent();

      await _handleEvent(event);

      expect(mockProcessedEventCreate).toHaveBeenCalledWith({
        eventId: event.eventId,
        consumerName: "notificationOrchestrator",
        processedAt: expect.any(Date),
      });
    });

    it("should skip event if already processed (E11000 duplicate key)", async () => {
      const duplicateError = new Error("Duplicate key") as any;
      duplicateError.code = 11000;
      mockProcessedEventCreate.mockRejectedValue(duplicateError);

      const event = createTestEvent();
      await _handleEvent(event);

      // Should not proceed to create notification
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    it("should rethrow unexpected errors from ProcessedEvent.create", async () => {
      mockProcessedEventCreate.mockRejectedValue(new Error("DB connection error"));

      const event = createTestEvent();
      await expect(_handleEvent(event)).rejects.toThrow("DB connection error");
    });
  });

  describe("Recipient Resolution (Step 3)", () => {
    it("should resolve customer recipient from event data userId", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const recipients = await _resolveRecipients("ORDER_CONFIRMED", { userId });

      expect(recipients).toEqual([{ userId, role: "customer" }]);
    });

    it("should resolve delivery_partner role for delivery events", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const recipients = await _resolveRecipients("DELIVERY_COMPLETED", { userId });

      expect(recipients).toEqual([{ userId, role: "delivery_partner" }]);
    });

    it("should include admin recipients for admin alert events", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const recipients = await _resolveRecipients("ORDER_FAILED", { userId });

      expect(recipients).toHaveLength(2);
      expect(recipients[0]).toEqual({ userId, role: "customer" });
      expect(recipients[1]).toEqual({ userId: adminId.toString(), role: "admin" });
    });

    it("should return admin recipients for PAYMENT_FAILED", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const recipients = await _resolveRecipients("PAYMENT_FAILED", { userId });

      expect(recipients).toContainEqual({ userId: adminId.toString(), role: "admin" });
    });

    it("should return empty array when no userId and no admin event", async () => {
      const recipients = await _resolveRecipients("ORDER_CONFIRMED", {});
      expect(recipients).toEqual([]);
    });

    it("should return empty for invalid userId", async () => {
      const recipients = await _resolveRecipients("ORDER_CONFIRMED", { userId: "invalid" });
      expect(recipients).toEqual([]);
    });
  });

  describe("Full Orchestration Flow", () => {
    let mockEmitter: ISocketEmitter;

    beforeEach(() => {
      mockEmitter = createMockSocketEmitter();
      _setSocketEmitter(mockEmitter);
    });

    it("should create in-app notification with correct fields", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: {
          userId,
          orderId,
          orderNumber: "ORD-100",
          estimatedDelivery: "30 mins",
        },
      });

      await _handleEvent(event);

      expect(mockNotificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(mongoose.Types.ObjectId),
          title: expect.any(String),
          message: expect.any(String),
          body: expect.any(String),
          eventType: "ORDER_CONFIRMED",
          category: "order",
          isRead: false,
        })
      );
    });

    it("should send push notification", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-101" },
      });

      await _handleEvent(event);

      expect(mockSendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          title: expect.any(String),
          body: expect.any(String),
        })
      );
    });

    it("should emit socket notification:new event", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-102" },
      });

      await _handleEvent(event);

      expect(mockEmitter.emitNotificationNew).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          body: expect.any(String),
          category: "order",
        })
      );
    });

    it("should emit unread count after in-app notification creation", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-103" },
      });

      await _handleEvent(event);

      expect(mockEmitter.emitUnreadCount).toHaveBeenCalledWith(userId, 5);
    });
  });

  describe("Channel Independence (Failure Isolation)", () => {
    let mockEmitter: ISocketEmitter;

    beforeEach(() => {
      mockEmitter = createMockSocketEmitter();
      _setSocketEmitter(mockEmitter);
    });

    it("should continue with push and socket when in-app fails", async () => {
      mockNotificationCreate.mockRejectedValue(new Error("MongoDB write failed"));
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-104" },
      });

      await _handleEvent(event);

      // Push should still be called
      expect(mockSendPush).toHaveBeenCalled();
      // Socket should still be called (with fallback ID)
      expect(mockEmitter.emitNotificationNew).toHaveBeenCalled();
    });

    it("should continue with in-app and socket when push fails", async () => {
      mockSendPush.mockRejectedValue(new Error("Expo API down"));
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-105" },
      });

      await _handleEvent(event);

      // In-app should succeed
      expect(mockNotificationCreate).toHaveBeenCalled();
      // Socket should still be called
      expect(mockEmitter.emitNotificationNew).toHaveBeenCalled();
    });

    it("should not fail when socket emitter is not initialized", async () => {
      _setSocketEmitter(null);
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-106" },
      });

      // Should not throw
      await expect(_handleEvent(event)).resolves.not.toThrow();
      expect(mockNotificationCreate).toHaveBeenCalled();
      expect(mockSendPush).toHaveBeenCalled();
    });
  });

  describe("Template Resolution (Step 2)", () => {
    let mockEmitter: ISocketEmitter;

    beforeEach(() => {
      mockEmitter = createMockSocketEmitter();
      _setSocketEmitter(mockEmitter);
    });

    it("should skip notification when no template is found for event type", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        eventType: "UNKNOWN_EVENT_TYPE",
        data: { userId },
      });

      await _handleEvent(event);

      expect(mockNotificationCreate).not.toHaveBeenCalled();
      expect(mockSendPush).not.toHaveBeenCalled();
    });

    it("should interpolate template variables with event data", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        eventType: "ORDER_CONFIRMED",
        data: {
          userId,
          orderId,
          orderNumber: "ORD-999",
          estimatedDelivery: "45 mins",
        },
      });

      await _handleEvent(event);

      expect(mockNotificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Order Confirmed",
          body: expect.stringContaining("ORD-999"),
        })
      );
    });
  });

  describe("Multi-Role Recipients", () => {
    let mockEmitter: ISocketEmitter;

    beforeEach(() => {
      mockEmitter = createMockSocketEmitter();
      _setSocketEmitter(mockEmitter);
    });

    it("should create notifications for both customer and admin on ORDER_FAILED", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createTestEvent({
        eventType: "ORDER_FAILED",
        data: {
          userId,
          orderId,
          orderNumber: "ORD-200",
          failureReason: "Address not found",
        },
      });

      await _handleEvent(event);

      // Should have been called twice — once for customer, once for admin
      expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    });

    it("should use delivery_partner role templates for DELIVERY_ASSIGNED to rider", async () => {
      const riderId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();

      // DELIVERY_ASSIGNED also triggers admin alerts and has customer template
      // but when userId is the rider, it routes to delivery_partner
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const event = createTestEvent({
        eventType: "DELIVERY_ASSIGNED",
        data: {
          userId: riderId,
          orderId,
          orderNumber: "ORD-201",
          pickupAddress: "123 Store St",
          deliveryFee: "50",
        },
      });

      await _handleEvent(event);

      // Should create notification for delivery partner
      expect(mockNotificationCreate).toHaveBeenCalled();
    });
  });

  describe("Channel Routing (Step 4)", () => {
    let mockEmitter: ISocketEmitter;

    beforeEach(() => {
      mockEmitter = createMockSocketEmitter();
      _setSocketEmitter(mockEmitter);
    });

    it("should only use channels returned by Channel Router", async () => {
      // Only in_app channel active
      mockDetermineChannels.mockResolvedValue(["in_app"]);

      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-300" },
      });

      await _handleEvent(event);

      expect(mockNotificationCreate).toHaveBeenCalled();
      expect(mockSendPush).not.toHaveBeenCalled();
      expect(mockEmitter.emitNotificationNew).not.toHaveBeenCalled();
    });

    it("should skip all delivery when no channels are active", async () => {
      mockDetermineChannels.mockResolvedValue([]);

      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const event = createTestEvent({
        data: { userId, orderId, orderNumber: "ORD-301" },
      });

      await _handleEvent(event);

      expect(mockNotificationCreate).not.toHaveBeenCalled();
      expect(mockSendPush).not.toHaveBeenCalled();
      expect(mockEmitter.emitNotificationNew).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle event with empty eventId", async () => {
      const event = createTestEvent({ eventId: "" });
      await _handleEvent(event);
      expect(mockProcessedEventCreate).not.toHaveBeenCalled();
    });

    it("should handle event with empty eventType", async () => {
      const event = createTestEvent({ eventType: "" });
      await _handleEvent(event);
      expect(mockProcessedEventCreate).not.toHaveBeenCalled();
    });

    it("should handle null/undefined event data gracefully", async () => {
      const event = createTestEvent({ data: {} as any });
      await _handleEvent(event);
      // Should not throw, just log warning about no recipients
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });
  });

  describe("Constants", () => {
    it("should use correct consumer name", () => {
      expect(CONSUMER_NAME).toBe("notificationOrchestrator");
    });

    it("should define admin alert events", () => {
      expect(ADMIN_ALERT_EVENTS.has("ORDER_CREATED")).toBe(true);
      expect(ADMIN_ALERT_EVENTS.has("ORDER_FAILED")).toBe(true);
      expect(ADMIN_ALERT_EVENTS.has("PAYMENT_FAILED")).toBe(true);
      expect(ADMIN_ALERT_EVENTS.has("ADMIN_SECURITY_EVENT")).toBe(true);
    });

    it("should define delivery partner events", () => {
      expect(DELIVERY_PARTNER_EVENTS.has("DELIVERY_ASSIGNED")).toBe(true);
      expect(DELIVERY_PARTNER_EVENTS.has("DELIVERY_COMPLETED")).toBe(true);
      expect(DELIVERY_PARTNER_EVENTS.has("EARNINGS_CREDITED")).toBe(true);
      expect(DELIVERY_PARTNER_EVENTS.has("DELIVERY_PICKUP_REMINDER")).toBe(true);
    });
  });
});
