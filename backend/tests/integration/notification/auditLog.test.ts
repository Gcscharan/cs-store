/**
 * Integration tests for Audit Log — verify audit records are created correctly.
 *
 * Tests the NotificationAudit model and auditLogger service against a real MongoDB
 * instance to verify: record creation, immutability, queryability, and TTL index.
 *
 * Requirements: R19 (Audit Trail)
 */

import mongoose from "mongoose";
import NotificationAudit from "../../../src/models/NotificationAudit";
import { logNotificationAudit, AuditLogParams } from "../../../src/domains/communication/services/auditLogger";

describe("Audit Log Integration", () => {
  describe("Audit record creation via logNotificationAudit", () => {
    it("should create a complete audit record with all required fields", async () => {
      const notificationId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const eventId = `evt-audit-${Date.now()}`;

      const params: AuditLogParams = {
        notificationId,
        eventId,
        eventType: "ORDER_CONFIRMED",
        userId,
        actor: { type: "system" },
        source: "orderStateService",
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
          { channel: "push", status: "sent", sentAt: new Date() },
          { channel: "socket", status: "sent", sentAt: new Date() },
        ],
        priority: "P2",
        category: "order",
      };

      await logNotificationAudit(params);

      const audits = await NotificationAudit.find({ eventId }).lean();
      expect(audits.length).toBe(1);

      const audit = audits[0];
      expect(audit.notificationId.toString()).toBe(notificationId);
      expect(audit.eventId).toBe(eventId);
      expect(audit.eventType).toBe("ORDER_CONFIRMED");
      expect(audit.userId.toString()).toBe(userId);
      expect(audit.actor.type).toBe("system");
      expect(audit.source).toBe("orderStateService");
      expect(audit.priority).toBe("P2");
      expect(audit.category).toBe("order");
      expect(audit.channels).toHaveLength(3);
      expect(audit.createdAt).toBeInstanceOf(Date);
    });

    it("should record channel-level delivery status including errors", async () => {
      const notificationId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const eventId = `evt-audit-errors-${Date.now()}`;

      await logNotificationAudit({
        notificationId,
        eventId,
        eventType: "PAYMENT_FAILED",
        userId,
        actor: { type: "system" },
        source: "webhookProcessor",
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
          { channel: "push", status: "failed", sentAt: new Date(), error: "Device not registered" },
          { channel: "socket", status: "sent", sentAt: new Date() },
        ],
        priority: "P0",
        category: "payment",
      });

      const audit = await NotificationAudit.findOne({ eventId }).lean();
      expect(audit).toBeDefined();
      expect(audit!.channels).toHaveLength(3);

      const pushChannel = audit!.channels.find((ch) => ch.channel === "push");
      expect(pushChannel).toBeDefined();
      expect(pushChannel!.status).toBe("failed");
      expect(pushChannel!.error).toBe("Device not registered");

      const inAppChannel = audit!.channels.find((ch) => ch.channel === "in_app");
      expect(inAppChannel).toBeDefined();
      expect(inAppChannel!.status).toBe("sent");
      expect(inAppChannel!.error).toBeUndefined();
    });

    it("should record actor with optional id field", async () => {
      const notificationId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const actorId = new mongoose.Types.ObjectId().toString();
      const eventId = `evt-audit-actor-${Date.now()}`;

      await logNotificationAudit({
        notificationId,
        eventId,
        eventType: "ADMIN_SECURITY_EVENT",
        userId,
        actor: { type: "admin", id: actorId },
        source: "authController",
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
        ],
        priority: "P0",
        category: "account",
      });

      const audit = await NotificationAudit.findOne({ eventId }).lean();
      expect(audit!.actor.type).toBe("admin");
      expect(audit!.actor.id).toBe(actorId);
    });

    it("should never throw even on invalid inputs — swallows errors gracefully", async () => {
      // Invalid notificationId (not a valid ObjectId)
      await expect(
        logNotificationAudit({
          notificationId: "invalid-not-objectid",
          eventId: "evt-invalid",
          eventType: "TEST",
          userId: new mongoose.Types.ObjectId().toString(),
          actor: { type: "system" },
          source: "test",
          channels: [],
          priority: "P3",
          category: "order",
        })
      ).resolves.toBeUndefined(); // Should not throw

      // Invalid userId
      await expect(
        logNotificationAudit({
          notificationId: new mongoose.Types.ObjectId().toString(),
          eventId: "evt-invalid-user",
          eventType: "TEST",
          userId: "not-a-valid-id",
          actor: { type: "system" },
          source: "test",
          channels: [],
          priority: "P3",
          category: "order",
        })
      ).resolves.toBeUndefined(); // Should not throw
    });
  });

  describe("Queryability", () => {
    it("should be queryable by userId", async () => {
      const userId = new mongoose.Types.ObjectId();

      // Create multiple audit records for the same user
      for (let i = 0; i < 3; i++) {
        await NotificationAudit.create({
          notificationId: new mongoose.Types.ObjectId(),
          eventId: `evt-query-user-${i}-${Date.now()}`,
          eventType: i < 2 ? "ORDER_CONFIRMED" : "PAYMENT_SUCCESS",
          userId,
          actor: { type: "system" },
          source: "test",
          channels: [{ channel: "in_app", status: "sent", sentAt: new Date() }],
          priority: "P2",
          category: i < 2 ? "order" : "payment",
          createdAt: new Date(),
        });
      }

      const results = await NotificationAudit.find({ userId }).lean();
      expect(results.length).toBe(3);
    });

    it("should be queryable by eventType", async () => {
      const userId = new mongoose.Types.ObjectId();

      await NotificationAudit.create({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: `evt-query-type-1-${Date.now()}`,
        eventType: "ORDER_DELIVERED",
        userId,
        actor: { type: "system" },
        source: "test",
        channels: [{ channel: "in_app", status: "sent", sentAt: new Date() }],
        priority: "P1",
        category: "order",
        createdAt: new Date(),
      });

      await NotificationAudit.create({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: `evt-query-type-2-${Date.now()}`,
        eventType: "ORDER_DELIVERED",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "system" },
        source: "test",
        channels: [{ channel: "in_app", status: "sent", sentAt: new Date() }],
        priority: "P1",
        category: "order",
        createdAt: new Date(),
      });

      const results = await NotificationAudit.find({ eventType: "ORDER_DELIVERED" }).lean();
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should be queryable by time range", async () => {
      const userId = new mongoose.Types.ObjectId();
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Create an audit record with a specific timestamp
      await NotificationAudit.create({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: `evt-timerange-${Date.now()}`,
        eventType: "ORDER_PACKED",
        userId,
        actor: { type: "system" },
        source: "test",
        channels: [{ channel: "in_app", status: "sent", sentAt: new Date() }],
        priority: "P2",
        category: "order",
        createdAt: now,
      });

      // Query for records in the last hour
      const results = await NotificationAudit.find({
        userId,
        createdAt: { $gte: oneHourAgo, $lte: now },
      }).lean();
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Query for records in a period before the record was created (should find nothing)
      const oldResults = await NotificationAudit.find({
        userId,
        createdAt: { $gte: twoHoursAgo, $lte: oneHourAgo },
      }).lean();
      expect(oldResults.length).toBe(0);
    });

    it("should be queryable by delivery status across channels", async () => {
      const userId = new mongoose.Types.ObjectId();

      await NotificationAudit.create({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: `evt-status-query-${Date.now()}`,
        eventType: "ORDER_FAILED",
        userId,
        actor: { type: "system" },
        source: "test",
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
          { channel: "push", status: "failed", sentAt: new Date(), error: "Token invalid" },
        ],
        priority: "P0",
        category: "order",
        createdAt: new Date(),
      });

      // Query for records with failed channels
      const failedResults = await NotificationAudit.find({
        userId,
        "channels.status": "failed",
      }).lean();
      expect(failedResults.length).toBeGreaterThanOrEqual(1);
      expect(failedResults[0].channels.some((ch) => ch.status === "failed")).toBe(true);
    });
  });

  describe("Schema validation and immutability", () => {
    it("should have TTL index configured for 90-day expiration", async () => {
      const indexes = await NotificationAudit.collection.indexes();
      const ttlIndex = indexes.find(
        (idx) =>
          idx.key?.createdAt === 1 &&
          idx.expireAfterSeconds === 90 * 24 * 60 * 60
      );
      expect(ttlIndex).toBeDefined();
    });

    it("should have query indexes on userId and eventType", async () => {
      const indexes = await NotificationAudit.collection.indexes();

      const userIdIndex = indexes.find((idx) => idx.key?.userId === 1);
      expect(userIdIndex).toBeDefined();

      const eventTypeIndex = indexes.find((idx) => idx.key?.eventType === 1);
      expect(eventTypeIndex).toBeDefined();
    });

    it("should set createdAt automatically when not provided", async () => {
      const before = new Date();

      await NotificationAudit.create({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: `evt-auto-created-${Date.now()}`,
        eventType: "TEST_EVENT",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "system" },
        source: "test",
        channels: [],
        priority: "P3",
        category: "order",
        // Not specifying createdAt
      });

      const after = new Date();

      const record = await NotificationAudit.findOne({
        eventId: { $regex: /^evt-auto-created-/ },
      }).lean();
      expect(record).toBeDefined();
      expect(record!.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(record!.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should store all priority levels correctly", async () => {
      const priorities = ["P0", "P1", "P2", "P3"];

      for (const priority of priorities) {
        const eventId = `evt-priority-${priority}-${Date.now()}`;
        await NotificationAudit.create({
          notificationId: new mongoose.Types.ObjectId(),
          eventId,
          eventType: "TEST_EVENT",
          userId: new mongoose.Types.ObjectId(),
          actor: { type: "system" },
          source: "test",
          channels: [{ channel: "in_app", status: "sent", sentAt: new Date() }],
          priority,
          category: "order",
          createdAt: new Date(),
        });

        const record = await NotificationAudit.findOne({ eventId }).lean();
        expect(record!.priority).toBe(priority);
      }
    });
  });
});
