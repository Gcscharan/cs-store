import mongoose from "mongoose";
import {
  updateLifecycleStatus,
  batchUpdateLifecycleStatus,
  getDeliveryMetrics,
  LifecycleChannel,
  LifecycleUpdateParams,
} from "../deliveryTracker";
import Notification from "../../../../models/Notification";
import { logger } from "../../../../utils/logger";

// Mock Notification model
jest.mock("../../../../models/Notification", () => ({
  __esModule: true,
  default: {
    findByIdAndUpdate: jest.fn(),
    bulkWrite: jest.fn(),
    aggregate: jest.fn(),
    findOne: jest.fn(),
  },
}));

// Mock logger
jest.mock("../../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("DeliveryTracker Service", () => {
  const mockFindByIdAndUpdate = Notification.findByIdAndUpdate as jest.Mock;
  const mockBulkWrite = Notification.bulkWrite as jest.Mock;
  const mockAggregate = Notification.aggregate as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateLifecycleStatus", () => {
    const validNotificationId = new mongoose.Types.ObjectId().toString();

    it("should update lifecycle status for push channel with 'sent' status", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "push", "sent");

      expect(mockFindByIdAndUpdate).toHaveBeenCalledTimes(1);
      const [id, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(id).toBe(validNotificationId);
      expect(updateObj.$set["lifecycle.push.status"]).toBe("sent");
      expect(updateObj.$set["lifecycle.push.updatedAt"]).toBeInstanceOf(Date);
      expect(updateObj.$set["lifecycle.push.error"]).toBeUndefined();
    });

    it("should update lifecycle status for socket channel with 'sent' status", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "socket", "sent");

      const [, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateObj.$set["lifecycle.socket.status"]).toBe("sent");
      expect(updateObj.$set["lifecycle.socket.updatedAt"]).toBeInstanceOf(Date);
    });

    it("should update lifecycle status for inApp channel with 'delivered' status", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "inApp", "delivered");

      const [, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateObj.$set["lifecycle.inApp.status"]).toBe("delivered");
    });

    it("should include error field when status is 'failed'", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "push", "failed", "Token expired");

      const [, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateObj.$set["lifecycle.push.status"]).toBe("failed");
      expect(updateObj.$set["lifecycle.push.error"]).toBe("Token expired");
    });

    it("should clear error field when status is not 'failed'", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "push", "delivered");

      const [, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateObj.$set["lifecycle.push.error"]).toBeUndefined();
    });

    it("should skip and warn when notificationId is invalid", async () => {
      await updateLifecycleStatus("invalid-id", "push", "sent");

      expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "[DeliveryTracker] Invalid notificationId, skipping update",
        expect.objectContaining({
          notificationId: "invalid-id",
          channel: "push",
          status: "sent",
        })
      );
    });

    it("should warn when notification not found", async () => {
      mockFindByIdAndUpdate.mockResolvedValue(null);

      await updateLifecycleStatus(validNotificationId, "push", "sent");

      expect(logger.warn).toHaveBeenCalledWith(
        "[DeliveryTracker] Notification not found for lifecycle update",
        expect.objectContaining({
          notificationId: validNotificationId,
          channel: "push",
          status: "sent",
        })
      );
    });

    it("should NOT throw when database update fails", async () => {
      mockFindByIdAndUpdate.mockRejectedValue(new Error("DB connection lost"));

      await expect(
        updateLifecycleStatus(validNotificationId, "push", "sent")
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        "[DeliveryTracker] Failed to update lifecycle status",
        expect.objectContaining({
          error: "DB connection lost",
          notificationId: validNotificationId,
        })
      );
    });

    it("should log info on successful update", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "push", "delivered");

      expect(logger.info).toHaveBeenCalledWith(
        "[DeliveryTracker] Lifecycle status updated",
        expect.objectContaining({
          notificationId: validNotificationId,
          channel: "push",
          status: "delivered",
        })
      );
    });

    it("should handle 'opened' status for inApp channel", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "inApp", "opened");

      const [, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateObj.$set["lifecycle.inApp.status"]).toBe("opened");
    });

    it("should handle 'clicked' status for push channel", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({ _id: validNotificationId });

      await updateLifecycleStatus(validNotificationId, "push", "clicked");

      const [, updateObj] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateObj.$set["lifecycle.push.status"]).toBe("clicked");
    });
  });

  describe("batchUpdateLifecycleStatus", () => {
    it("should call bulkWrite with correct operations", async () => {
      mockBulkWrite.mockResolvedValue({ modifiedCount: 2 });

      const updates: LifecycleUpdateParams[] = [
        {
          notificationId: new mongoose.Types.ObjectId().toString(),
          channel: "push",
          status: "sent",
        },
        {
          notificationId: new mongoose.Types.ObjectId().toString(),
          channel: "push",
          status: "delivered",
        },
      ];

      await batchUpdateLifecycleStatus(updates);

      expect(mockBulkWrite).toHaveBeenCalledTimes(1);
      const [bulkOps, options] = mockBulkWrite.mock.calls[0];
      expect(bulkOps).toHaveLength(2);
      expect(options).toEqual({ ordered: false });
      expect(bulkOps[0].updateOne.update.$set["lifecycle.push.status"]).toBe("sent");
      expect(bulkOps[1].updateOne.update.$set["lifecycle.push.status"]).toBe("delivered");
    });

    it("should include error field in batch update when provided", async () => {
      mockBulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const updates: LifecycleUpdateParams[] = [
        {
          notificationId: new mongoose.Types.ObjectId().toString(),
          channel: "push",
          status: "failed",
          error: "Rate limit exceeded",
        },
      ];

      await batchUpdateLifecycleStatus(updates);

      const [bulkOps] = mockBulkWrite.mock.calls[0];
      expect(bulkOps[0].updateOne.update.$set["lifecycle.push.error"]).toBe("Rate limit exceeded");
    });

    it("should skip invalid notificationIds", async () => {
      mockBulkWrite.mockResolvedValue({ modifiedCount: 1 });

      const updates: LifecycleUpdateParams[] = [
        {
          notificationId: "invalid-id",
          channel: "push",
          status: "sent",
        },
        {
          notificationId: new mongoose.Types.ObjectId().toString(),
          channel: "socket",
          status: "sent",
        },
      ];

      await batchUpdateLifecycleStatus(updates);

      const [bulkOps] = mockBulkWrite.mock.calls[0];
      expect(bulkOps).toHaveLength(1);
      expect(bulkOps[0].updateOne.update.$set["lifecycle.socket.status"]).toBe("sent");
    });

    it("should not call bulkWrite when all IDs are invalid", async () => {
      const updates: LifecycleUpdateParams[] = [
        { notificationId: "bad-1", channel: "push", status: "sent" },
        { notificationId: "bad-2", channel: "socket", status: "sent" },
      ];

      await batchUpdateLifecycleStatus(updates);

      expect(mockBulkWrite).not.toHaveBeenCalled();
    });

    it("should NOT throw when bulkWrite fails", async () => {
      mockBulkWrite.mockRejectedValue(new Error("Bulk write failed"));

      const updates: LifecycleUpdateParams[] = [
        {
          notificationId: new mongoose.Types.ObjectId().toString(),
          channel: "push",
          status: "sent",
        },
      ];

      await expect(batchUpdateLifecycleStatus(updates)).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        "[DeliveryTracker] Batch lifecycle update failed",
        expect.objectContaining({ error: "Bulk write failed" })
      );
    });
  });

  describe("getDeliveryMetrics", () => {
    it("should return metrics aggregated by event type", async () => {
      mockAggregate.mockResolvedValue([
        {
          _id: "ORDER_CREATED",
          total: 100,
          pushSent: 80,
          pushDelivered: 70,
          pushOpened: 30,
          pushClicked: 10,
          pushFailed: 5,
          socketSent: 90,
          socketDelivered: 88,
          inAppDelivered: 95,
          inAppOpened: 50,
          inAppClicked: 20,
        },
      ]);

      const metrics = await getDeliveryMetrics({ period: "day" });

      expect(mockAggregate).toHaveBeenCalledTimes(1);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].eventType).toBe("ORDER_CREATED");
      expect(metrics[0].period).toBe("day");

      // Push metrics
      expect(metrics[0].push.total).toBe(85); // pushSent + pushFailed
      expect(metrics[0].push.sent).toBe(80);
      expect(metrics[0].push.delivered).toBe(70);
      expect(metrics[0].push.opened).toBe(30);
      expect(metrics[0].push.clicked).toBe(10);
      expect(metrics[0].push.failed).toBe(5);

      // Socket metrics
      expect(metrics[0].socket.total).toBe(90);
      expect(metrics[0].socket.sent).toBe(90);
      expect(metrics[0].socket.delivered).toBe(88);

      // InApp metrics
      expect(metrics[0].inApp.delivered).toBe(95);
      expect(metrics[0].inApp.opened).toBe(50);
      expect(metrics[0].inApp.clicked).toBe(20);
    });

    it("should handle empty results", async () => {
      mockAggregate.mockResolvedValue([]);

      const metrics = await getDeliveryMetrics({ period: "week" });

      expect(metrics).toHaveLength(0);
    });

    it("should filter by event type when provided", async () => {
      mockAggregate.mockResolvedValue([]);

      await getDeliveryMetrics({ eventType: "ORDER_DELIVERED", period: "day" });

      const pipeline = mockAggregate.mock.calls[0][0];
      expect(pipeline[0].$match.eventType).toBe("ORDER_DELIVERED");
    });

    it("should default period to 'day' when not provided", async () => {
      mockAggregate.mockResolvedValue([]);

      const metrics = await getDeliveryMetrics({});

      expect(metrics).toEqual([]);
      // Verify pipeline was called (no crash)
      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when aggregation throws", async () => {
      mockAggregate.mockRejectedValue(new Error("Aggregation failed"));

      const metrics = await getDeliveryMetrics({ period: "month" });

      expect(metrics).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "[DeliveryTracker] Failed to compute delivery metrics",
        expect.objectContaining({ error: "Aggregation failed" })
      );
    });

    it("should compute correct rates", async () => {
      mockAggregate.mockResolvedValue([
        {
          _id: "PAYMENT_SUCCESS",
          total: 50,
          pushSent: 40,
          pushDelivered: 36,
          pushOpened: 20,
          pushClicked: 5,
          pushFailed: 4,
          socketSent: 48,
          socketDelivered: 46,
          inAppDelivered: 50,
          inAppOpened: 30,
          inAppClicked: 15,
        },
      ]);

      const metrics = await getDeliveryMetrics({ eventType: "PAYMENT_SUCCESS" });

      const push = metrics[0].push;
      // deliveryRate = delivered / (sent + failed) * 100 = 36/44 * 100
      expect(push.deliveryRate).toBeCloseTo((36 / 44) * 100, 1);
      // openRate = opened / delivered * 100 = 20/36 * 100
      expect(push.openRate).toBeCloseTo((20 / 36) * 100, 1);
      // clickRate = clicked / opened * 100 = 5/20 * 100
      expect(push.clickRate).toBeCloseTo((5 / 20) * 100, 1);
    });

    it("should handle zero totals without division errors", async () => {
      mockAggregate.mockResolvedValue([
        {
          _id: "RARE_EVENT",
          total: 0,
          pushSent: 0,
          pushDelivered: 0,
          pushOpened: 0,
          pushClicked: 0,
          pushFailed: 0,
          socketSent: 0,
          socketDelivered: 0,
          inAppDelivered: 0,
          inAppOpened: 0,
          inAppClicked: 0,
        },
      ]);

      const metrics = await getDeliveryMetrics({ eventType: "RARE_EVENT" });

      expect(metrics[0].push.deliveryRate).toBe(0);
      expect(metrics[0].push.openRate).toBe(0);
      expect(metrics[0].push.clickRate).toBe(0);
      expect(metrics[0].overall.deliveryRate).toBe(0);
      expect(metrics[0].overall.openRate).toBe(0);
      expect(metrics[0].overall.clickRate).toBe(0);
    });
  });
});
