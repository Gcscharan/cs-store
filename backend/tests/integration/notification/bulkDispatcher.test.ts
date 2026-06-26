/**
 * Integration tests for Bulk Notification System.
 *
 * Tests:
 * - Batch processing (users processed in batches of 100 with delay)
 * - Cancellation mid-execution
 * - Preference filtering (users with category disabled are skipped)
 * - API endpoints for creating, getting status, and cancelling jobs
 *
 * Requirement: R18 (Bulk Notification System)
 */

import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";

import { User } from "../../../src/models/User";
import Notification from "../../../src/models/Notification";
import BulkNotificationJob from "../../../src/models/BulkNotificationJob";
import {
  createAndStartBulkJob,
  cancelBulkJob,
  getBulkJobStatus,
  processJob,
  _buildSegmentFilter,
  _isUserCategoryEnabled,
  _cancelledJobs,
  BATCH_SIZE,
} from "../../../src/domains/communication/services/bulkDispatcher";

import testApp from "../../helpers/testApp";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAdminToken(userId: string): string {
  return jwt.sign(
    { userId, role: "admin" },
    process.env.JWT_SECRET || "test-jwt-secret-key",
    { expiresIn: "1h" }
  );
}

function makeCustomerToken(userId: string): string {
  return jwt.sign(
    { userId, role: "customer" },
    process.env.JWT_SECRET || "test-jwt-secret-key",
    { expiresIn: "1h" }
  );
}

/**
 * Create multiple test users for batch processing tests.
 */
async function createBatchUsers(
  count: number,
  role: string = "customer",
  notificationPreferences?: any
): Promise<any[]> {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await (global as any).createTestUser({
      role,
      email: `batch-user-${Date.now()}-${i}@test.com`,
      ...(notificationPreferences ? { notificationPreferences } : {}),
    });
    users.push(user);
  }
  return users;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Bulk Notification System", () => {
  describe("Segment Filter Building", () => {
    it("should build filter for all_customers segment", () => {
      const filter = _buildSegmentFilter("all_customers");
      expect(filter).toEqual({ isDeleted: { $ne: true }, role: "customer" });
    });

    it("should build filter for all_delivery_partners segment", () => {
      const filter = _buildSegmentFilter("all_delivery_partners");
      expect(filter).toEqual({ isDeleted: { $ne: true }, role: "delivery" });
    });

    it("should build filter for all_admins segment", () => {
      const filter = _buildSegmentFilter("all_admins");
      expect(filter).toEqual({ isDeleted: { $ne: true }, role: "admin" });
    });

    it("should build filter for custom segment with custom filter", () => {
      const customFilter = { "addresses.city": "Bangalore" };
      const filter = _buildSegmentFilter("custom", customFilter);
      expect(filter).toEqual({
        isDeleted: { $ne: true },
        "addresses.city": "Bangalore",
      });
    });
  });

  describe("User Preference Checking", () => {
    it("should return true when user has no preferences (default enabled)", () => {
      const user = { notificationPreferences: undefined } as any;
      expect(_isUserCategoryEnabled(user, "promo")).toBe(true);
    });

    it("should return true when preferences are empty object", () => {
      const user = { notificationPreferences: {} } as any;
      expect(_isUserCategoryEnabled(user, "order")).toBe(true);
    });

    it("should return false when push channel is disabled", () => {
      const user = {
        notificationPreferences: {
          push: { enabled: false },
        },
      } as any;
      expect(_isUserCategoryEnabled(user, "order")).toBe(false);
    });

    it("should return false when the specific category is disabled in push", () => {
      const user = {
        notificationPreferences: {
          push: { enabled: true, categories: { newOffers: false } },
        },
      } as any;
      expect(_isUserCategoryEnabled(user, "promo")).toBe(false);
    });

    it("should return true when push category is enabled", () => {
      const user = {
        notificationPreferences: {
          push: { enabled: true, categories: { newOffers: true } },
        },
      } as any;
      expect(_isUserCategoryEnabled(user, "promo")).toBe(true);
    });

    it("should return false when inapp channel is disabled", () => {
      const user = {
        notificationPreferences: {
          inapp: { enabled: false },
        },
      } as any;
      expect(_isUserCategoryEnabled(user, "order")).toBe(false);
    });
  });

  describe("Batch Processing", () => {
    it("should process all users and create notifications", async () => {
      // Create 5 customer users
      const users = await createBatchUsers(5, "customer");
      const admin = await (global as any).createTestUser({
        role: "admin",
        email: "bulk-admin@test.com",
      });

      const job = await createAndStartBulkJob({
        title: "Test Bulk Notification",
        body: "This is a test bulk notification",
        category: "promo",
        targetSegment: "all_customers",
        createdBy: admin._id.toString(),
      });

      expect(job.status).toBe("pending");
      expect(job.progress.total).toBe(5);

      // Wait for processing to complete
      await new Promise((r) => setTimeout(r, 3000));

      // Verify all notifications were created
      const notifications = await Notification.find({
        eventType: "BULK_NOTIFICATION",
        "meta.bulkJobId": job._id.toString(),
      }).lean();
      expect(notifications.length).toBe(5);

      // Verify job status is completed
      const updatedJob = await BulkNotificationJob.findById(job._id).lean();
      expect(updatedJob?.status).toBe("completed");
      expect(updatedJob?.progress.sent).toBe(5);
      expect(updatedJob?.progress.failed).toBe(0);
    }, 15000);

    it("should skip users with category disabled in preferences", async () => {
      // Create 3 users with promo enabled, 2 with promo disabled
      const enabledUsers = await createBatchUsers(3, "customer", {
        push: { enabled: true, categories: { newOffers: true } },
      });
      const disabledUsers = await createBatchUsers(2, "customer", {
        push: { enabled: true, categories: { newOffers: false } },
        inapp: { enabled: true, categories: { newOffers: false } },
      });

      const admin = await (global as any).createTestUser({
        role: "admin",
        email: "bulk-pref-admin@test.com",
      });

      const job = await createAndStartBulkJob({
        title: "Promo Notification",
        body: "Special offer for you!",
        category: "promo",
        targetSegment: "all_customers",
        createdBy: admin._id.toString(),
      });

      // Wait for processing to complete
      await new Promise((r) => setTimeout(r, 3000));

      // Only enabled users should receive notifications
      const notifications = await Notification.find({
        eventType: "BULK_NOTIFICATION",
        "meta.bulkJobId": job._id.toString(),
      }).lean();

      // The enabled users (3) should have notifications, disabled (2) should not
      expect(notifications.length).toBe(3);

      // Verify disabled users didn't get notifications
      for (const disabledUser of disabledUsers) {
        const userNotifs = notifications.filter(
          (n) => n.userId.toString() === disabledUser._id.toString()
        );
        expect(userNotifs.length).toBe(0);
      }

      // Verify job progress
      const updatedJob = await BulkNotificationJob.findById(job._id).lean();
      expect(updatedJob?.status).toBe("completed");
      expect(updatedJob?.progress.sent).toBe(3);
    }, 15000);

    it("should only target the specified segment", async () => {
      // Create users with different roles
      const customers = await createBatchUsers(3, "customer");
      const deliveryPartners = await createBatchUsers(2, "delivery");
      const admin = await (global as any).createTestUser({
        role: "admin",
        email: "segment-admin@test.com",
      });

      const job = await createAndStartBulkJob({
        title: "Delivery Partner Announcement",
        body: "Important update for delivery partners",
        category: "delivery",
        targetSegment: "all_delivery_partners",
        createdBy: admin._id.toString(),
      });

      // Wait for processing
      await new Promise((r) => setTimeout(r, 3000));

      const notifications = await Notification.find({
        eventType: "BULK_NOTIFICATION",
        "meta.bulkJobId": job._id.toString(),
      }).lean();

      // Only delivery partners should receive
      expect(notifications.length).toBe(2);
      for (const notif of notifications) {
        const isDeliveryPartner = deliveryPartners.some(
          (dp) => dp._id.toString() === notif.userId.toString()
        );
        expect(isDeliveryPartner).toBe(true);
      }
    }, 15000);
  });

  describe("Job Cancellation", () => {
    it("should cancel a pending/processing job", async () => {
      // Create many users to ensure processing takes time
      await createBatchUsers(5, "customer");
      const admin = await (global as any).createTestUser({
        role: "admin",
        email: "cancel-admin@test.com",
      });

      const job = await createAndStartBulkJob({
        title: "Cancellable Notification",
        body: "This might get cancelled",
        category: "order",
        targetSegment: "all_customers",
        createdBy: admin._id.toString(),
      });

      // Cancel immediately
      const result = await cancelBulkJob(job._id.toString());
      expect(result.success).toBe(true);
      expect(result.message).toBe("Job cancellation initiated");

      // Wait a bit for the job to pick up cancellation
      await new Promise((r) => setTimeout(r, 2000));

      // Verify job is cancelled
      const updatedJob = await BulkNotificationJob.findById(job._id).lean();
      expect(updatedJob?.status).toBe("cancelled");
    }, 15000);

    it("should return error when trying to cancel a completed job", async () => {
      const admin = await (global as any).createTestUser({
        role: "admin",
        email: "cancel-complete-admin@test.com",
      });

      // Create a job and manually set it as completed
      const job = await BulkNotificationJob.create({
        title: "Completed Job",
        body: "Already done",
        category: "order",
        targetSegment: "all_customers",
        status: "completed",
        progress: { total: 10, sent: 10, failed: 0 },
        createdBy: admin._id,
        completedAt: new Date(),
      });

      const result = await cancelBulkJob(job._id.toString());
      expect(result.success).toBe(false);
      expect(result.message).toBe("Job already completed");
    });

    it("should return error when trying to cancel an already cancelled job", async () => {
      const admin = await (global as any).createTestUser({
        role: "admin",
        email: "cancel-twice-admin@test.com",
      });

      const job = await BulkNotificationJob.create({
        title: "Cancelled Job",
        body: "Already cancelled",
        category: "order",
        targetSegment: "all_customers",
        status: "cancelled",
        progress: { total: 10, sent: 5, failed: 0 },
        createdBy: admin._id,
      });

      const result = await cancelBulkJob(job._id.toString());
      expect(result.success).toBe(false);
      expect(result.message).toBe("Job already cancelled");
    });

    it("should return error when job does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await cancelBulkJob(fakeId);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Job not found");
    });
  });

  describe("API Endpoints", () => {
    describe("POST /api/admin/notifications/bulk", () => {
      it("should create a bulk job with valid data", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-create-admin@test.com",
        });
        await createBatchUsers(3, "customer");
        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .post("/api/admin/notifications/bulk")
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "API Test Notification",
            body: "Created via API",
            category: "promo",
            targetSegment: "all_customers",
            deepLink: "/offers/new",
          });

        expect(res.status).toBe(201);
        expect(res.body.job).toBeDefined();
        expect(res.body.job.title).toBe("API Test Notification");
        expect(res.body.job.status).toBe("pending");
        expect(res.body.job.progress.total).toBe(3);
      });

      it("should reject request without title", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-notitle-admin@test.com",
        });
        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .post("/api/admin/notifications/bulk")
          .set("Authorization", `Bearer ${token}`)
          .send({
            body: "No title",
            category: "promo",
            targetSegment: "all_customers",
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Title is required");
      });

      it("should reject request with invalid category", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-badcategory-admin@test.com",
        });
        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .post("/api/admin/notifications/bulk")
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Test",
            body: "Test body",
            category: "invalid_category",
            targetSegment: "all_customers",
          });

        expect(res.status).toBe(400);
      });

      it("should reject request with invalid target segment", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-badsegment-admin@test.com",
        });
        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .post("/api/admin/notifications/bulk")
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Test",
            body: "Test body",
            category: "promo",
            targetSegment: "invalid_segment",
          });

        expect(res.status).toBe(400);
      });

      it("should reject non-admin users", async () => {
        const customer = await (global as any).createTestUser({
          role: "customer",
          email: "api-customer@test.com",
        });
        const token = makeCustomerToken(customer._id.toString());

        const res = await request(testApp)
          .post("/api/admin/notifications/bulk")
          .set("Authorization", `Bearer ${token}`)
          .send({
            title: "Test",
            body: "Test body",
            category: "promo",
            targetSegment: "all_customers",
          });

        expect(res.status).toBe(403);
      });

      it("should require authentication", async () => {
        const res = await request(testApp)
          .post("/api/admin/notifications/bulk")
          .send({
            title: "Test",
            body: "Test body",
            category: "promo",
            targetSegment: "all_customers",
          });

        expect(res.status).toBe(401);
      });
    });

    describe("GET /api/admin/notifications/bulk/:jobId", () => {
      it("should return job status", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-status-admin@test.com",
        });

        const job = await BulkNotificationJob.create({
          title: "Status Check Job",
          body: "Checking status",
          category: "order",
          targetSegment: "all_customers",
          status: "processing",
          progress: { total: 100, sent: 50, failed: 2 },
          createdBy: admin._id,
          startedAt: new Date(),
        });

        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .get(`/api/admin/notifications/bulk/${job._id}`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.job).toBeDefined();
        expect(res.body.job.status).toBe("processing");
        expect(res.body.job.progress.total).toBe(100);
        expect(res.body.job.progress.sent).toBe(50);
        expect(res.body.job.progress.failed).toBe(2);
      });

      it("should return 404 for non-existent job", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-notfound-admin@test.com",
        });
        const token = makeAdminToken(admin._id.toString());
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(testApp)
          .get(`/api/admin/notifications/bulk/${fakeId}`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
      });

      it("should return 400 for invalid job ID", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-invalidid-admin@test.com",
        });
        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .get("/api/admin/notifications/bulk/invalid-id")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
      });
    });

    describe("POST /api/admin/notifications/bulk/:jobId/cancel", () => {
      it("should cancel a processing job via API", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-cancel-admin@test.com",
        });

        const job = await BulkNotificationJob.create({
          title: "Cancel via API",
          body: "Will be cancelled",
          category: "order",
          targetSegment: "all_customers",
          status: "processing",
          progress: { total: 100, sent: 30, failed: 0 },
          createdBy: admin._id,
          startedAt: new Date(),
        });

        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .post(`/api/admin/notifications/bulk/${job._id}/cancel`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Job cancellation initiated");

        // Verify DB state
        const updatedJob = await BulkNotificationJob.findById(job._id).lean();
        expect(updatedJob?.status).toBe("cancelled");
      });

      it("should return error for already completed job", async () => {
        const admin = await (global as any).createTestUser({
          role: "admin",
          email: "api-cancel-done-admin@test.com",
        });

        const job = await BulkNotificationJob.create({
          title: "Completed Job",
          body: "Already done",
          category: "order",
          targetSegment: "all_customers",
          status: "completed",
          progress: { total: 100, sent: 100, failed: 0 },
          createdBy: admin._id,
          completedAt: new Date(),
        });

        const token = makeAdminToken(admin._id.toString());

        const res = await request(testApp)
          .post(`/api/admin/notifications/bulk/${job._id}/cancel`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Job already completed");
      });

      it("should reject non-admin users", async () => {
        const customer = await (global as any).createTestUser({
          role: "customer",
          email: "api-cancel-customer@test.com",
        });
        const token = makeCustomerToken(customer._id.toString());
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(testApp)
          .post(`/api/admin/notifications/bulk/${fakeId}/cancel`)
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
      });
    });
  });
});
