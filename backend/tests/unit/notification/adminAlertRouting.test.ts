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

// Mock pushGateway (orchestrator delivers push via pushGateway.sendPush)
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
  _handleEvent,
  _resolveRecipients,
  _resetOrchestrator,
  _setSocketEmitter,
  ADMIN_ALERT_EVENTS,
} from "../../../src/domains/communication/services/notificationOrchestrator";
import {
  resolveTemplate,
  interpolateTemplate,
} from "../../../src/domains/communication/templates/notificationTemplates";
import { BaseEvent } from "../../../src/domains/events/BaseEvent";
import { ISocketEmitter } from "../../../src/domains/communication/services/socketEmitter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockSocketEmitter(): ISocketEmitter {
  return {
    emitNotificationNew: jest.fn(),
    emitNotificationRead: jest.fn(),
    emitNotificationReadAll: jest.fn(),
    emitUnreadCount: jest.fn(),
    emitNotificationSync: jest.fn(),
  };
}

function createAdminAlertEvent(
  eventType: string,
  data: Record<string, any>
): BaseEvent {
  return {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: { type: "system" },
    source: "test",
    data,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Admin Alert Routing", () => {
  let mockEmitter: ISocketEmitter;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetOrchestrator();
    process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "true";

    mockEmitter = createMockSocketEmitter();
    _setSocketEmitter(mockEmitter);

    // Default mock behaviors
    mockProcessedEventCreate.mockResolvedValue({});
    mockNotificationCreate.mockImplementation((doc: any) => {
      return Promise.resolve({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        toString: () => new mongoose.Types.ObjectId().toString(),
      });
    });
    mockNotificationCountDocuments.mockResolvedValue(3);
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

  describe("ADMIN_ALERT_EVENTS set", () => {
    it("should include LOW_STOCK in admin alert events", () => {
      expect(ADMIN_ALERT_EVENTS.has("LOW_STOCK")).toBe(true);
    });

    it("should include ORDER_CREATED in admin alert events", () => {
      expect(ADMIN_ALERT_EVENTS.has("ORDER_CREATED")).toBe(true);
    });

    it("should include ORDER_FAILED in admin alert events", () => {
      expect(ADMIN_ALERT_EVENTS.has("ORDER_FAILED")).toBe(true);
    });

    it("should include PAYMENT_FAILED in admin alert events", () => {
      expect(ADMIN_ALERT_EVENTS.has("PAYMENT_FAILED")).toBe(true);
    });

    it("should include ADMIN_SECURITY_EVENT in admin alert events", () => {
      expect(ADMIN_ALERT_EVENTS.has("ADMIN_SECURITY_EVENT")).toBe(true);
    });

    it("should contain exactly 5 admin alert event types", () => {
      expect(ADMIN_ALERT_EVENTS.size).toBe(5);
    });
  });

  describe("Admin recipient resolution", () => {
    it("should query admin users for admin alert events", async () => {
      const adminId1 = new mongoose.Types.ObjectId();
      const adminId2 = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: adminId1 },
            { _id: adminId2 },
          ]),
        }),
      });

      const recipients = await _resolveRecipients("ORDER_CREATED", {
        userId: new mongoose.Types.ObjectId().toString(),
      });

      // Should have customer + 2 admins
      expect(recipients).toHaveLength(3);
      expect(recipients[0].role).toBe("customer");
      expect(recipients[1]).toEqual({ userId: adminId1.toString(), role: "admin" });
      expect(recipients[2]).toEqual({ userId: adminId2.toString(), role: "admin" });
    });

    it("should query admin users with correct filter (role=admin, not deleted)", async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await _resolveRecipients("ORDER_FAILED", {
        userId: new mongoose.Types.ObjectId().toString(),
      });

      expect(mockUserFind).toHaveBeenCalledWith({
        role: "admin",
        isDeleted: { $ne: true },
      });
    });

    it("should resolve admin recipients for LOW_STOCK events", async () => {
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const recipients = await _resolveRecipients("LOW_STOCK", {});

      // LOW_STOCK has no userId, so only admin recipients
      expect(recipients).toHaveLength(1);
      expect(recipients[0]).toEqual({ userId: adminId.toString(), role: "admin" });
    });

    it("should handle admin query failure gracefully and still return primary recipient", async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error("DB error")),
        }),
      });

      const userId = new mongoose.Types.ObjectId().toString();
      const recipients = await _resolveRecipients("ORDER_FAILED", { userId });

      // Should still have the customer recipient even if admin query fails
      expect(recipients).toHaveLength(1);
      expect(recipients[0]).toEqual({ userId, role: "customer" });
    });

    it("should not query admin users for non-admin-alert events", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      await _resolveRecipients("ORDER_CONFIRMED", { userId });

      expect(mockUserFind).not.toHaveBeenCalled();
    });
  });

  describe("Admin notification creation", () => {
    it("should create notification records for each admin user on ORDER_CREATED", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const adminId1 = new mongoose.Types.ObjectId();
      const adminId2 = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: adminId1 },
            { _id: adminId2 },
          ]),
        }),
      });

      const event = createAdminAlertEvent("ORDER_CREATED", {
        userId,
        orderId,
        orderNumber: "ORD-500",
        customerName: "John Doe",
        amount: "999",
      });

      await _handleEvent(event);

      // Should create notifications for: customer + admin1 + admin2 = 3
      expect(mockNotificationCreate).toHaveBeenCalledTimes(3);

      // Verify admin notification has admin-specific title
      const adminCalls = mockNotificationCreate.mock.calls.filter(
        (call: any[]) => call[0].title === "New Order Received"
      );
      expect(adminCalls).toHaveLength(2);
    });

    it("should create notification records for each admin user on ORDER_FAILED", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("ORDER_FAILED", {
        userId,
        orderId,
        orderNumber: "ORD-501",
        failureReason: "Customer unavailable",
        deliveryPartnerName: "Rider A",
      });

      await _handleEvent(event);

      // Customer + 1 admin = 2 notifications
      expect(mockNotificationCreate).toHaveBeenCalledTimes(2);

      // Verify admin notification uses admin template
      const adminCall = mockNotificationCreate.mock.calls.find(
        (call: any[]) => call[0].title === "⚠️ Delivery Failed"
      );
      expect(adminCall).toBeDefined();
      expect(adminCall![0].body).toContain("Customer unavailable");
      expect(adminCall![0].body).toContain("Rider A");
    });

    it("should create notification for admin on PAYMENT_FAILED", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("PAYMENT_FAILED", {
        userId,
        orderId,
        orderNumber: "ORD-502",
        amount: "1500",
        customerName: "Jane Smith",
        failureReason: "Insufficient funds",
      });

      await _handleEvent(event);

      // Customer + 1 admin = 2 notifications
      expect(mockNotificationCreate).toHaveBeenCalledTimes(2);

      const adminCall = mockNotificationCreate.mock.calls.find(
        (call: any[]) => call[0].title === "⚠️ Payment Failed"
      );
      expect(adminCall).toBeDefined();
      expect(adminCall![0].body).toContain("1500");
      expect(adminCall![0].body).toContain("Jane Smith");
    });

    it("should create notification for admin on LOW_STOCK", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId().toString();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("LOW_STOCK", {
        productId,
        productName: "Basmati Rice 5kg",
        currentStock: "3",
      });

      await _handleEvent(event);

      // Only admin (no userId in event data for customer)
      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);

      const call = mockNotificationCreate.mock.calls[0];
      expect(call[0].title).toBe("⚠️ Low Stock Alert");
      expect(call[0].body).toContain("Basmati Rice 5kg");
      expect(call[0].body).toContain("3");
    });

    it("should create notification for admin on ADMIN_SECURITY_EVENT", async () => {
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("ADMIN_SECURITY_EVENT", {
        securityEventType: "Multiple failed login attempts",
        affectedUser: "user@example.com",
        eventDetails: "5 failed attempts in 10 minutes",
        eventId: "sec-event-001",
      });

      await _handleEvent(event);

      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);

      const call = mockNotificationCreate.mock.calls[0];
      expect(call[0].title).toBe("🔒 Security Alert");
      expect(call[0].body).toContain("Multiple failed login attempts");
      expect(call[0].body).toContain("user@example.com");
    });
  });

  describe("Admin socket events", () => {
    it("should emit socket events to admin user rooms", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("ORDER_CREATED", {
        userId,
        orderId,
        orderNumber: "ORD-600",
        customerName: "Test User",
        amount: "500",
      });

      await _handleEvent(event);

      // Socket emit should be called for customer and admin
      expect(mockEmitter.emitNotificationNew).toHaveBeenCalledTimes(2);

      // Verify admin socket emission
      const adminEmitCall = (mockEmitter.emitNotificationNew as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === adminId.toString()
      );
      expect(adminEmitCall).toBeDefined();
      expect(adminEmitCall![1]).toEqual(
        expect.objectContaining({
          title: "New Order Received",
          category: "order",
        })
      );
    });

    it("should emit unread count to admin user rooms", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId().toString();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("LOW_STOCK", {
        productId,
        productName: "Test Product",
        currentStock: "2",
      });

      await _handleEvent(event);

      expect(mockEmitter.emitUnreadCount).toHaveBeenCalledWith(
        adminId.toString(),
        3 // from mockNotificationCountDocuments
      );
    });
  });

  describe("Admin push notifications", () => {
    it("should send push notifications to admin devices", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const orderId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("ORDER_FAILED", {
        userId,
        orderId,
        orderNumber: "ORD-700",
        failureReason: "Address not reachable",
        deliveryPartnerName: "Rider B",
      });

      await _handleEvent(event);

      // Push should be called for both customer and admin
      expect(mockSendPush).toHaveBeenCalledTimes(2);

      // Verify push was sent to admin
      const adminPushCall = mockSendPush.mock.calls.find(
        (call: any[]) => call[0]?.userId === adminId.toString()
      );
      expect(adminPushCall).toBeDefined();
      expect(adminPushCall![0].title).toBe("⚠️ Delivery Failed"); // admin title
    });

    it("should send push to admin for LOW_STOCK event", async () => {
      const adminId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId().toString();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: adminId }]),
        }),
      });

      const event = createAdminAlertEvent("LOW_STOCK", {
        productId,
        productName: "Organic Honey",
        currentStock: "1",
      });

      await _handleEvent(event);

      expect(mockSendPush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminId.toString(),
          title: "⚠️ Low Stock Alert",
          body: expect.stringContaining("Organic Honey"),
        })
      );
    });
  });

  describe("Admin deep links", () => {
    it("should use /admin/orders/{orderId} deep link for ORDER_CREATED", () => {
      const template = resolveTemplate("ORDER_CREATED", "admin");
      expect(template).not.toBeNull();
      expect(template!.deepLinkPattern).toBe("/admin/orders/{orderId}");
    });

    it("should use /admin/orders/{orderId} deep link for ORDER_FAILED", () => {
      const template = resolveTemplate("ORDER_FAILED", "admin");
      expect(template).not.toBeNull();
      expect(template!.deepLinkPattern).toBe("/admin/orders/{orderId}");
    });

    it("should use /admin/payments/{paymentId} deep link for PAYMENT_FAILED", () => {
      const template = resolveTemplate("PAYMENT_FAILED", "admin");
      expect(template).not.toBeNull();
      expect(template!.deepLinkPattern).toBe("/admin/payments/{paymentId}");
    });

    it("should use /admin/security/events/{eventId} deep link for ADMIN_SECURITY_EVENT", () => {
      const template = resolveTemplate("ADMIN_SECURITY_EVENT", "admin");
      expect(template).not.toBeNull();
      expect(template!.deepLinkPattern).toBe("/admin/security/events/{eventId}");
    });

    it("should use /admin/inventory/{productId} deep link for LOW_STOCK", () => {
      const template = resolveTemplate("LOW_STOCK", "admin");
      expect(template).not.toBeNull();
      expect(template!.deepLinkPattern).toBe("/admin/inventory/{productId}");
    });

    it("should interpolate admin deep link correctly", () => {
      const template = resolveTemplate("LOW_STOCK", "admin");
      const deepLink = interpolateTemplate(template!.deepLinkPattern, {
        productId: "prod_123",
      });
      expect(deepLink).toBe("/admin/inventory/prod_123");
    });
  });

  describe("LOW_STOCK admin template", () => {
    it("should have LOW_STOCK template registered for admin role", () => {
      const template = resolveTemplate("LOW_STOCK", "admin");
      expect(template).not.toBeNull();
    });

    it("should have correct template properties", () => {
      const template = resolveTemplate("LOW_STOCK", "admin")!;
      expect(template.eventType).toBe("LOW_STOCK");
      expect(template.role).toBe("admin");
      expect(template.title).toBe("⚠️ Low Stock Alert");
      expect(template.category).toBe("order");
      expect(template.priority).toBe("P1");
      expect(template.channels).toEqual(["in_app", "push", "socket"]);
      expect(template.sound).toBe(true);
    });

    it("should interpolate LOW_STOCK template body correctly", () => {
      const template = resolveTemplate("LOW_STOCK", "admin")!;
      const body = interpolateTemplate(template.body, {
        productName: "Toor Dal 1kg",
        currentStock: "5",
      });
      expect(body).toBe("Toor Dal 1kg is running low. Current stock: 5 units.");
    });

    it("should handle missing variables in LOW_STOCK template with empty fallback", () => {
      const template = resolveTemplate("LOW_STOCK", "admin")!;
      const body = interpolateTemplate(template.body, {});
      expect(body).toBe(" is running low. Current stock:  units.");
    });
  });

  describe("Multiple admin users", () => {
    it("should create separate notifications for each admin user", async () => {
      const adminId1 = new mongoose.Types.ObjectId();
      const adminId2 = new mongoose.Types.ObjectId();
      const adminId3 = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: adminId1 },
            { _id: adminId2 },
            { _id: adminId3 },
          ]),
        }),
      });

      const event = createAdminAlertEvent("LOW_STOCK", {
        productId: new mongoose.Types.ObjectId().toString(),
        productName: "Test Product",
        currentStock: "2",
      });

      await _handleEvent(event);

      // 3 admin notifications
      expect(mockNotificationCreate).toHaveBeenCalledTimes(3);
      expect(mockSendPush).toHaveBeenCalledTimes(3);
      expect(mockEmitter.emitNotificationNew).toHaveBeenCalledTimes(3);
    });

    it("should continue processing remaining admins if one fails", async () => {
      const adminId1 = new mongoose.Types.ObjectId();
      const adminId2 = new mongoose.Types.ObjectId();

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: adminId1 },
            { _id: adminId2 },
          ]),
        }),
      });

      // Fail on first admin notification create, succeed on second
      let callCount = 0;
      mockNotificationCreate.mockImplementation((doc: any) => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("DB write failed for first admin"));
        }
        return Promise.resolve({
          ...doc,
          _id: new mongoose.Types.ObjectId(),
          toString: () => new mongoose.Types.ObjectId().toString(),
        });
      });

      const event = createAdminAlertEvent("LOW_STOCK", {
        productId: new mongoose.Types.ObjectId().toString(),
        productName: "Test Product",
        currentStock: "1",
      });

      // Should not throw - errors handled per recipient
      await expect(_handleEvent(event)).resolves.not.toThrow();

      // Second admin should still get processed
      expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    });
  });
});
