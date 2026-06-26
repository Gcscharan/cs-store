/**
 * Integration tests for Notification Analytics Controller.
 *
 * Tests the aggregation queries that power the admin analytics dashboard.
 * Verifies: metrics by time period, top notification types, top failure reasons,
 * push token health, delivery rate warnings, and filter support.
 *
 * Requirements: R20 (Analytics Dashboard)
 */

import mongoose from "mongoose";
import request from "supertest";
import express from "express";
import NotificationAudit from "../../../src/models/NotificationAudit";
import { User } from "../../../src/models/User";
import { getNotificationAnalytics } from "../../../src/domains/communication/controllers/notificationAnalyticsController";
import { authenticateToken, requireRole } from "../../../src/middleware/auth";
import jwt from "jsonwebtoken";

// Build a minimal test app
function buildTestApp() {
  const app = express();
  app.use(express.json());

  // Mock auth for testing — inject admin user directly
  app.get(
    "/api/admin/notifications/analytics",
    authenticateToken,
    requireRole(["admin"]),
    getNotificationAnalytics
  );

  return app;
}

describe("Notification Analytics Controller", () => {
  let app: express.Application;
  let adminUser: any;
  let adminToken: string;
  let customerUser: any;
  let customerToken: string;

  beforeAll(async () => {
    app = buildTestApp();
  });

  beforeEach(async () => {
    // Create admin user
    adminUser = await (global as any).createTestUser({
      name: "Admin User",
      role: "admin",
      phone: `9000${Date.now().toString().slice(-6)}`,
    });
    adminToken = await (global as any).getAuthToken(adminUser);

    // Create customer user
    customerUser = await (global as any).createTestUser({
      name: "Customer User",
      role: "customer",
      phone: `8000${Date.now().toString().slice(-6)}`,
    });
    customerToken = await (global as any).getAuthToken(customerUser);
  });

  describe("Authentication and Authorization", () => {
    it("should return 401 when no auth token is provided", async () => {
      const res = await request(app).get("/api/admin/notifications/analytics");
      expect(res.status).toBe(401);
    });

    it("should return 403 when non-admin user requests analytics", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it("should return 200 for admin users", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Aggregated Metrics by Time Period", () => {
    beforeEach(async () => {
      // Seed audit records
      const now = new Date();
      const userId = new mongoose.Types.ObjectId();

      const records = [
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-1",
          eventType: "ORDER_CONFIRMED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "in_app", status: "sent", sentAt: now },
            { channel: "push", status: "delivered", sentAt: now },
          ],
          priority: "P2",
          category: "order",
          createdAt: now,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-2",
          eventType: "ORDER_DELIVERED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "in_app", status: "sent", sentAt: now },
            { channel: "push", status: "failed", sentAt: now, error: "Device not registered" },
            { channel: "socket", status: "sent", sentAt: now },
          ],
          priority: "P1",
          category: "order",
          createdAt: now,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-3",
          eventType: "PAYMENT_FAILED",
          userId,
          actor: { type: "system" },
          source: "webhookProcessor",
          channels: [
            { channel: "in_app", status: "sent", sentAt: now },
            { channel: "push", status: "sent", sentAt: now },
          ],
          priority: "P0",
          category: "payment",
          createdAt: now,
        },
      ];

      await NotificationAudit.insertMany(records);
    });

    it("should return metrics grouped by daily period by default", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toBe("daily");
      expect(res.body.metrics.byTimePeriod).toBeInstanceOf(Array);
      expect(res.body.metrics.byTimePeriod.length).toBeGreaterThan(0);

      // Each period entry should have sent/delivered/opened/failed
      const periodEntry = res.body.metrics.byTimePeriod[0];
      expect(periodEntry).toHaveProperty("sent");
      expect(periodEntry).toHaveProperty("delivered");
      expect(periodEntry).toHaveProperty("opened");
      expect(periodEntry).toHaveProperty("failed");
      expect(periodEntry).toHaveProperty("total");
    });

    it("should return totals across all periods", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.metrics.totals).toBeDefined();
      expect(res.body.metrics.totals.sent).toBeGreaterThanOrEqual(0);
      expect(res.body.metrics.totals.delivered).toBeGreaterThanOrEqual(0);
      expect(res.body.metrics.totals.opened).toBeGreaterThanOrEqual(0);
      expect(res.body.metrics.totals.failed).toBeGreaterThanOrEqual(0);
    });

    it("should support hourly period grouping", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .query({ period: "hourly" })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toBe("hourly");
      expect(res.body.metrics.byTimePeriod.length).toBeGreaterThan(0);

      // Hourly groups should have hour field
      const entry = res.body.metrics.byTimePeriod[0];
      expect(entry._id).toHaveProperty("hour");
    });

    it("should support weekly period grouping", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .query({ period: "weekly" })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.period).toBe("weekly");
      expect(res.body.metrics.byTimePeriod.length).toBeGreaterThan(0);

      // Weekly groups should have week field
      const entry = res.body.metrics.byTimePeriod[0];
      expect(entry._id).toHaveProperty("week");
    });

    it("should reject invalid period values", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .query({ period: "monthly" })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid period");
    });
  });

  describe("Top Notification Types", () => {
    beforeEach(async () => {
      const now = new Date();
      const userId = new mongoose.Types.ObjectId();

      // Create multiple records with different event types
      const records = [];
      for (let i = 0; i < 5; i++) {
        records.push({
          notificationId: new mongoose.Types.ObjectId(),
          eventId: `evt-order-${i}-${Date.now()}`,
          eventType: "ORDER_CONFIRMED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "in_app", status: "sent", sentAt: now }],
          priority: "P2",
          category: "order",
          createdAt: now,
        });
      }
      for (let i = 0; i < 3; i++) {
        records.push({
          notificationId: new mongoose.Types.ObjectId(),
          eventId: `evt-payment-${i}-${Date.now()}`,
          eventType: "PAYMENT_SUCCESS",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "in_app", status: "sent", sentAt: now }],
          priority: "P1",
          category: "payment",
          createdAt: now,
        });
      }
      records.push({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: `evt-promo-1-${Date.now()}`,
        eventType: "PROMO_CAMPAIGN",
        userId,
        actor: { type: "admin", id: adminUser._id.toString() },
        source: "bulkDispatcher",
        channels: [{ channel: "push", status: "sent", sentAt: now }],
        priority: "P3",
        category: "promo",
        createdAt: now,
      });

      await NotificationAudit.insertMany(records);
    });

    it("should return top notification types sorted by volume", async () => {
      // Use an explicit wide date range to avoid any timing edge cases
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .query({ startDate, endDate })
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.topNotificationTypes).toBeInstanceOf(Array);
      expect(res.body.topNotificationTypes.length).toBeGreaterThan(0);

      // First entry should be the most frequent
      const top = res.body.topNotificationTypes[0];
      expect(top.eventType).toBe("ORDER_CONFIRMED");
      expect(top.count).toBe(5);
      expect(top.category).toBe("order");
      expect(top.priority).toBe("P2");

      // Should be sorted by count descending
      for (let i = 1; i < res.body.topNotificationTypes.length; i++) {
        expect(res.body.topNotificationTypes[i].count).toBeLessThanOrEqual(
          res.body.topNotificationTypes[i - 1].count
        );
      }
    });

    it("should limit top types to 10", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.topNotificationTypes).toBeInstanceOf(Array);
      expect(res.body.topNotificationTypes.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Top Failure Reasons", () => {
    beforeEach(async () => {
      const now = new Date();
      const userId = new mongoose.Types.ObjectId();

      const records = [
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-fail-1",
          eventType: "ORDER_CONFIRMED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "push", status: "failed", sentAt: now, error: "Device not registered" },
          ],
          priority: "P2",
          category: "order",
          createdAt: now,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-fail-2",
          eventType: "ORDER_DELIVERED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "push", status: "failed", sentAt: now, error: "Device not registered" },
          ],
          priority: "P1",
          category: "order",
          createdAt: now,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-fail-3",
          eventType: "PAYMENT_FAILED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "push", status: "failed", sentAt: now, error: "Rate limited" },
          ],
          priority: "P0",
          category: "payment",
          createdAt: now,
        },
      ];

      await NotificationAudit.insertMany(records);
    });

    it("should return top failure reasons with channel info", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.topFailureReasons).toBeInstanceOf(Array);
      expect(res.body.topFailureReasons.length).toBeGreaterThan(0);

      // Should have reason, channel, and count
      const topReason = res.body.topFailureReasons[0];
      expect(topReason).toHaveProperty("reason");
      expect(topReason).toHaveProperty("channel");
      expect(topReason).toHaveProperty("count");

      // "Device not registered" should be the top reason (2 occurrences)
      expect(topReason.reason).toBe("Device not registered");
      expect(topReason.count).toBe(2);
    });
  });

  describe("Push Token Health", () => {
    beforeEach(async () => {
      // Create users with and without push tokens
      await (global as any).createTestUser({
        name: "User With Token",
        role: "customer",
        expoPushToken: "ExponentPushToken[valid-token-1]",
        phone: `7100${Date.now().toString().slice(-6)}`,
      });
      await (global as any).createTestUser({
        name: "User With Token 2",
        role: "customer",
        expoPushToken: "ExponentPushToken[valid-token-2]",
        phone: `7200${Date.now().toString().slice(-6)}`,
      });
      await (global as any).createTestUser({
        name: "User Without Token",
        role: "customer",
        phone: `7300${Date.now().toString().slice(-6)}`,
      });
    });

    it("should return push token health metrics", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pushTokenHealth).toBeDefined();
      expect(res.body.pushTokenHealth).toHaveProperty("totalActiveTokens");
      expect(res.body.pushTokenHealth).toHaveProperty("tokensInvalidatedLast24h");
      expect(res.body.pushTokenHealth).toHaveProperty("percentUsersWithValidToken");

      // 2 users with tokens out of total (admin + customer + 3 seeded = varies)
      expect(res.body.pushTokenHealth.totalActiveTokens).toBeGreaterThanOrEqual(2);
      expect(typeof res.body.pushTokenHealth.percentUsersWithValidToken).toBe("number");
    });
  });

  describe("Delivery Rate Warning Threshold", () => {
    beforeEach(async () => {
      const now = new Date();
      const userId = new mongoose.Types.ObjectId();

      // Create a notification type with high failure rate (below 80% delivery)
      const records = [];
      for (let i = 0; i < 3; i++) {
        records.push({
          notificationId: new mongoose.Types.ObjectId(),
          eventId: `evt-low-delivery-${i}`,
          eventType: "PROMO_CAMPAIGN",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "push", status: "failed", sentAt: now, error: "Rate limited" },
          ],
          priority: "P3",
          category: "promo",
          createdAt: now,
        });
      }
      // Only 1 successful delivery out of 4 (25% rate)
      records.push({
        notificationId: new mongoose.Types.ObjectId(),
        eventId: "evt-low-delivery-success",
        eventType: "PROMO_CAMPAIGN",
        userId,
        actor: { type: "system" },
        source: "orchestrator",
        channels: [
          { channel: "push", status: "delivered", sentAt: now },
        ],
        priority: "P3",
        category: "promo",
        createdAt: now,
      });

      // High delivery rate type (ORDER_CONFIRMED)
      for (let i = 0; i < 5; i++) {
        records.push({
          notificationId: new mongoose.Types.ObjectId(),
          eventId: `evt-high-delivery-${i}`,
          eventType: "ORDER_CONFIRMED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [
            { channel: "push", status: "delivered", sentAt: now },
            { channel: "in_app", status: "delivered", sentAt: now },
          ],
          priority: "P2",
          category: "order",
          createdAt: now,
        });
      }

      await NotificationAudit.insertMany(records);
    });

    it("should flag notification types with delivery rate below 80%", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.warnings).toBeInstanceOf(Array);
      expect(res.body.warnings.length).toBeGreaterThan(0);

      // PROMO_CAMPAIGN should be in warnings (25% delivery rate)
      const promoWarning = res.body.warnings.find(
        (w: any) => w.eventType === "PROMO_CAMPAIGN"
      );
      expect(promoWarning).toBeDefined();
      expect(promoWarning.deliveryRate).toBeLessThan(0.8);
      expect(promoWarning.message).toContain("below 80%");
    });

    it("should include delivery rate by type with warning flag", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.deliveryRateByType).toBeInstanceOf(Array);

      const promoRate = res.body.deliveryRateByType.find(
        (r: any) => r.eventType === "PROMO_CAMPAIGN"
      );
      expect(promoRate).toBeDefined();
      expect(promoRate.warning).toBe(true);
      expect(promoRate.deliveryRate).toBeLessThan(0.8);

      const orderRate = res.body.deliveryRateByType.find(
        (r: any) => r.eventType === "ORDER_CONFIRMED"
      );
      expect(orderRate).toBeDefined();
      expect(orderRate.warning).toBe(false);
      expect(orderRate.deliveryRate).toBe(1); // 100% delivery
    });
  });

  describe("Category and Priority Filters", () => {
    beforeEach(async () => {
      const now = new Date();
      const userId = new mongoose.Types.ObjectId();

      const records = [
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-filter-1",
          eventType: "ORDER_CONFIRMED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "in_app", status: "sent", sentAt: now }],
          priority: "P2",
          category: "order",
          createdAt: now,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-filter-2",
          eventType: "PAYMENT_SUCCESS",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "push", status: "delivered", sentAt: now }],
          priority: "P1",
          category: "payment",
          createdAt: now,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-filter-3",
          eventType: "PAYMENT_FAILED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "push", status: "failed", sentAt: now, error: "Timeout" }],
          priority: "P0",
          category: "payment",
          createdAt: now,
        },
      ];

      await NotificationAudit.insertMany(records);
    });

    it("should filter by category", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics?category=payment")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.filters.category).toBe("payment");

      // Top types should only include payment events
      res.body.topNotificationTypes.forEach((t: any) => {
        expect(t.category).toBe("payment");
      });
    });

    it("should filter by priority", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics?priority=P0")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.filters.priority).toBe("P0");

      // Top types should only include P0 events
      res.body.topNotificationTypes.forEach((t: any) => {
        expect(t.priority).toBe("P0");
      });
    });

    it("should support combined category and priority filters", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics?category=payment&priority=P0")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.filters.category).toBe("payment");
      expect(res.body.filters.priority).toBe("P0");

      // Should only include PAYMENT_FAILED (P0 + payment)
      if (res.body.topNotificationTypes.length > 0) {
        expect(res.body.topNotificationTypes[0].eventType).toBe("PAYMENT_FAILED");
      }
    });

    it("should reject invalid category values", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics?category=invalid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid category");
    });

    it("should reject invalid priority values", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics?priority=P5")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid priority");
    });
  });

  describe("Date Range Filtering", () => {
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const records = [
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-recent",
          eventType: "ORDER_CONFIRMED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "in_app", status: "sent", sentAt: threeDaysAgo }],
          priority: "P2",
          category: "order",
          createdAt: threeDaysAgo,
        },
        {
          notificationId: new mongoose.Types.ObjectId(),
          eventId: "evt-old",
          eventType: "ORDER_DELIVERED",
          userId,
          actor: { type: "system" },
          source: "orchestrator",
          channels: [{ channel: "push", status: "delivered", sentAt: tenDaysAgo }],
          priority: "P1",
          category: "order",
          createdAt: tenDaysAgo,
        },
      ];

      await NotificationAudit.insertMany(records);
    });

    it("should default to last 7 days when no date range provided", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Only the record from 3 days ago should be included (10 days ago is outside default range)
      expect(res.body.topNotificationTypes.length).toBeGreaterThanOrEqual(1);

      const hasOldEvent = res.body.topNotificationTypes.some(
        (t: any) => t.eventType === "ORDER_DELIVERED"
      );
      // ORDER_DELIVERED was 10 days ago, should be excluded from default 7-day window
      expect(hasOldEvent).toBe(false);
    });

    it("should support custom date range", async () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .get(
          `/api/admin/notifications/analytics?startDate=${fifteenDaysAgo.toISOString()}&endDate=${now.toISOString()}`
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Both records should now be included
      expect(res.body.topNotificationTypes.length).toBe(2);
    });

    it("should reject invalid date formats", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics?startDate=not-a-date")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid date");
    });
  });

  describe("Response Structure", () => {
    it("should return complete response structure with all expected fields", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("period");
      expect(res.body).toHaveProperty("startDate");
      expect(res.body).toHaveProperty("endDate");
      expect(res.body).toHaveProperty("filters");
      expect(res.body).toHaveProperty("metrics");
      expect(res.body.metrics).toHaveProperty("byTimePeriod");
      expect(res.body.metrics).toHaveProperty("totals");
      expect(res.body.metrics.totals).toHaveProperty("sent");
      expect(res.body.metrics.totals).toHaveProperty("delivered");
      expect(res.body.metrics.totals).toHaveProperty("opened");
      expect(res.body.metrics.totals).toHaveProperty("failed");
      expect(res.body).toHaveProperty("topNotificationTypes");
      expect(res.body).toHaveProperty("topFailureReasons");
      expect(res.body).toHaveProperty("pushTokenHealth");
      expect(res.body).toHaveProperty("deliveryRateByType");
      expect(res.body).toHaveProperty("warnings");
    });

    it("should handle empty database gracefully", async () => {
      const res = await request(app)
        .get("/api/admin/notifications/analytics")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.byTimePeriod).toEqual([]);
      expect(res.body.topNotificationTypes).toEqual([]);
      expect(res.body.topFailureReasons).toEqual([]);
      expect(res.body.metrics.totals.sent).toBe(0);
      expect(res.body.metrics.totals.delivered).toBe(0);
      expect(res.body.metrics.totals.opened).toBe(0);
      expect(res.body.metrics.totals.failed).toBe(0);
    });
  });
});
