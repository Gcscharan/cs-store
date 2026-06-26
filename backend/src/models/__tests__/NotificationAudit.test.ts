import mongoose from "mongoose";
import NotificationAudit, { INotificationAudit } from "../NotificationAudit";

describe("NotificationAudit Model", () => {
  describe("Schema Validation", () => {
    it("should create a valid audit record with all required fields", () => {
      const auditData = {
        notificationId: new mongoose.Types.ObjectId(),
        eventId: "evt_12345",
        eventType: "ORDER_CREATED",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "system" },
        source: "ORDER_CREATED",
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
          { channel: "push", status: "sent", sentAt: new Date() },
        ],
        priority: "P1",
        category: "order",
        createdAt: new Date(),
      };

      const audit = new NotificationAudit(auditData);
      const validationError = audit.validateSync();

      expect(validationError).toBeUndefined();
      expect(audit.notificationId).toEqual(auditData.notificationId);
      expect(audit.eventId).toBe("evt_12345");
      expect(audit.eventType).toBe("ORDER_CREATED");
      expect(audit.userId).toEqual(auditData.userId);
      expect(audit.actor.type).toBe("system");
      expect(audit.source).toBe("ORDER_CREATED");
      expect(audit.channels).toHaveLength(2);
      expect(audit.priority).toBe("P1");
      expect(audit.category).toBe("order");
      expect(audit.createdAt).toBeInstanceOf(Date);
    });

    it("should accept actor with optional id field", () => {
      const auditData = {
        notificationId: new mongoose.Types.ObjectId(),
        eventId: "evt_67890",
        eventType: "ADMIN_SECURITY_EVENT",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "admin", id: "admin_user_123" },
        source: "ADMIN_SECURITY_EVENT",
        channels: [{ channel: "push", status: "sent", sentAt: new Date() }],
        priority: "P0",
        category: "account",
        createdAt: new Date(),
      };

      const audit = new NotificationAudit(auditData);
      const validationError = audit.validateSync();

      expect(validationError).toBeUndefined();
      expect(audit.actor.type).toBe("admin");
      expect(audit.actor.id).toBe("admin_user_123");
    });

    it("should accept channels with error field for failed deliveries", () => {
      const auditData = {
        notificationId: new mongoose.Types.ObjectId(),
        eventId: "evt_11111",
        eventType: "ORDER_DELIVERED",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "system" },
        source: "ORDER_DELIVERED",
        channels: [
          { channel: "in_app", status: "sent", sentAt: new Date() },
          {
            channel: "push",
            status: "failed",
            sentAt: new Date(),
            error: "DeviceNotRegistered",
          },
          { channel: "socket", status: "sent", sentAt: new Date() },
        ],
        priority: "P1",
        category: "order",
        createdAt: new Date(),
      };

      const audit = new NotificationAudit(auditData);
      const validationError = audit.validateSync();

      expect(validationError).toBeUndefined();
      expect(audit.channels).toHaveLength(3);
      expect(audit.channels[1].status).toBe("failed");
      expect(audit.channels[1].error).toBe("DeviceNotRegistered");
    });

    it("should accept empty channels array", () => {
      const auditData = {
        notificationId: new mongoose.Types.ObjectId(),
        eventId: "evt_22222",
        eventType: "PROMO_CAMPAIGN",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "system" },
        source: "PROMO_CAMPAIGN",
        channels: [],
        priority: "P3",
        category: "promo",
        createdAt: new Date(),
      };

      const audit = new NotificationAudit(auditData);
      const validationError = audit.validateSync();

      expect(validationError).toBeUndefined();
      expect(audit.channels).toHaveLength(0);
    });

    it("should fail validation when required fields are missing", () => {
      const audit = new NotificationAudit({});
      const validationError = audit.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors.notificationId).toBeDefined();
      expect(validationError?.errors.eventId).toBeDefined();
      expect(validationError?.errors.eventType).toBeDefined();
      expect(validationError?.errors.userId).toBeDefined();
      expect(validationError?.errors["actor.type"]).toBeDefined();
      expect(validationError?.errors.source).toBeDefined();
      expect(validationError?.errors.priority).toBeDefined();
      expect(validationError?.errors.category).toBeDefined();
    });

    it("should default createdAt to current date", () => {
      const before = new Date();
      const auditData = {
        notificationId: new mongoose.Types.ObjectId(),
        eventId: "evt_33333",
        eventType: "ORDER_CONFIRMED",
        userId: new mongoose.Types.ObjectId(),
        actor: { type: "system" },
        source: "ORDER_CONFIRMED",
        channels: [],
        priority: "P2",
        category: "order",
      };

      const audit = new NotificationAudit(auditData);
      const after = new Date();

      expect(audit.createdAt).toBeInstanceOf(Date);
      expect(audit.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(audit.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("Indexes", () => {
    it("should have TTL index on createdAt with 90-day expiration", () => {
      const indexes = NotificationAudit.schema.indexes();

      const ttlIndex = indexes.find(
        (index) =>
          JSON.stringify(index[0]) === JSON.stringify({ createdAt: 1 }) &&
          (index[1] as any)?.expireAfterSeconds === 90 * 24 * 60 * 60
      );

      expect(ttlIndex).toBeDefined();
    });

    it("should have index on userId", () => {
      const indexes = NotificationAudit.schema.indexes();

      const userIdIndex = indexes.find(
        (index) => JSON.stringify(index[0]) === JSON.stringify({ userId: 1 })
      );

      expect(userIdIndex).toBeDefined();
    });

    it("should have index on eventType", () => {
      const indexes = NotificationAudit.schema.indexes();

      const eventTypeIndex = indexes.find(
        (index) => JSON.stringify(index[0]) === JSON.stringify({ eventType: 1 })
      );

      expect(eventTypeIndex).toBeDefined();
    });

    it("should have compound index on userId + createdAt", () => {
      const indexes = NotificationAudit.schema.indexes();

      const compoundIndex = indexes.find(
        (index) =>
          JSON.stringify(index[0]) === JSON.stringify({ userId: 1, createdAt: -1 })
      );

      expect(compoundIndex).toBeDefined();
    });
  });

  describe("Collection Name", () => {
    it("should use notificationaudits collection", () => {
      expect(NotificationAudit.collection.name).toBe("notificationaudits");
    });
  });

  describe("Immutability (Schema Options)", () => {
    it("should not have timestamps enabled (no updatedAt)", () => {
      const schemaOptions = (NotificationAudit.schema as any).options;
      expect(schemaOptions.timestamps).toBeFalsy();
    });

    it("should not have versionKey", () => {
      const schemaOptions = (NotificationAudit.schema as any).options;
      expect(schemaOptions.versionKey).toBe(false);
    });
  });
});
