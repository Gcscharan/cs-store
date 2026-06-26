import mongoose from "mongoose";
import { logNotificationAudit, AuditLogParams } from "../auditLogger";
import NotificationAudit from "../../../../models/NotificationAudit";
import { logger } from "../../../../utils/logger";

// Mock NotificationAudit model
jest.mock("../../../../models/NotificationAudit", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

// Mock logger
jest.mock("../../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("AuditLogger Service", () => {
  const mockCreate = NotificationAudit.create as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createValidParams(overrides?: Partial<AuditLogParams>): AuditLogParams {
    return {
      notificationId: new mongoose.Types.ObjectId().toString(),
      eventId: "evt_test_123",
      eventType: "ORDER_CREATED",
      userId: new mongoose.Types.ObjectId().toString(),
      actor: { type: "system" },
      source: "ORDER_CREATED",
      channels: [
        { channel: "in_app", status: "sent", sentAt: new Date() },
        { channel: "push", status: "sent", sentAt: new Date() },
      ],
      priority: "P1",
      category: "order",
      ...overrides,
    };
  }

  describe("logNotificationAudit", () => {
    it("should create an audit record with all provided fields", async () => {
      mockCreate.mockResolvedValue({});
      const params = createValidParams();

      await logNotificationAudit(params);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.eventId).toBe(params.eventId);
      expect(callArg.eventType).toBe(params.eventType);
      expect(callArg.actor).toEqual(params.actor);
      expect(callArg.source).toBe(params.source);
      expect(callArg.priority).toBe(params.priority);
      expect(callArg.category).toBe(params.category);
      expect(callArg.channels).toHaveLength(2);
      expect(callArg.createdAt).toBeInstanceOf(Date);
    });

    it("should convert notificationId and userId to ObjectIds", async () => {
      mockCreate.mockResolvedValue({});
      const params = createValidParams();

      await logNotificationAudit(params);

      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.notificationId).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(callArg.userId).toBeInstanceOf(mongoose.Types.ObjectId);
    });

    it("should include sentAt for each channel entry", async () => {
      mockCreate.mockResolvedValue({});
      const params = createValidParams({
        channels: [
          { channel: "in_app", status: "sent" },
          { channel: "push", status: "failed", error: "Token expired" },
        ],
      });

      await logNotificationAudit(params);

      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.channels[0].sentAt).toBeInstanceOf(Date);
      expect(callArg.channels[1].sentAt).toBeInstanceOf(Date);
      expect(callArg.channels[1].error).toBe("Token expired");
    });

    it("should preserve channel error field only when present", async () => {
      mockCreate.mockResolvedValue({});
      const params = createValidParams({
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
        ],
      });

      await logNotificationAudit(params);

      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.channels[0].error).toBeUndefined();
    });

    it("should log info on successful audit creation", async () => {
      mockCreate.mockResolvedValue({});
      const params = createValidParams();

      await logNotificationAudit(params);

      expect(logger.info).toHaveBeenCalledWith(
        "[AuditLogger] Audit record created",
        expect.objectContaining({
          notificationId: params.notificationId,
          eventId: params.eventId,
          eventType: params.eventType,
          userId: params.userId,
          priority: params.priority,
          category: params.category,
          channelCount: params.channels.length,
        })
      );
    });

    it("should handle actor with id field", async () => {
      mockCreate.mockResolvedValue({});
      const params = createValidParams({
        actor: { type: "admin", id: "admin_user_456" },
      });

      await logNotificationAudit(params);

      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.actor).toEqual({ type: "admin", id: "admin_user_456" });
    });
  });

  describe("Error Handling — Never throws", () => {
    it("should NOT throw when NotificationAudit.create fails", async () => {
      mockCreate.mockRejectedValue(new Error("MongoDB connection lost"));
      const params = createValidParams();

      // Should not throw
      await expect(logNotificationAudit(params)).resolves.toBeUndefined();
    });

    it("should log error when NotificationAudit.create fails", async () => {
      mockCreate.mockRejectedValue(new Error("MongoDB connection lost"));
      const params = createValidParams();

      await logNotificationAudit(params);

      expect(logger.error).toHaveBeenCalledWith(
        "[AuditLogger] Failed to create audit record",
        expect.objectContaining({
          error: "MongoDB connection lost",
          eventId: params.eventId,
          eventType: params.eventType,
          userId: params.userId,
        })
      );
    });

    it("should NOT throw when create throws a non-Error object", async () => {
      mockCreate.mockRejectedValue("string error");
      const params = createValidParams();

      await expect(logNotificationAudit(params)).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Validation — Invalid inputs", () => {
    it("should skip and warn when notificationId is invalid", async () => {
      const params = createValidParams({ notificationId: "not-a-valid-objectid" });

      await logNotificationAudit(params);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "[AuditLogger] Invalid notificationId, skipping audit",
        expect.objectContaining({
          notificationId: "not-a-valid-objectid",
        })
      );
    });

    it("should skip and warn when userId is invalid", async () => {
      const params = createValidParams({ userId: "invalid-user-id" });

      await logNotificationAudit(params);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "[AuditLogger] Invalid userId, skipping audit",
        expect.objectContaining({
          userId: "invalid-user-id",
        })
      );
    });
  });
});
