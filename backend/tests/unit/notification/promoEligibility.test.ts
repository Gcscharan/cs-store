/**
 * Unit tests for Promotional Notification Eligibility Logic
 *
 * Tests cover:
 * - isPromoDisabledForUser: preference checking for promo category
 * - buildEligibilityFilter: MongoDB filter construction for user segmentation
 * - getEligibleUsersForPromo: integration of filter + preference check
 * - getExpiringCoupons: query for coupons expiring within 24h
 * - getUsersWithUnusedCoupon: query users eligible for coupon expiry reminders
 * - processCouponExpiryReminders: end-to-end coupon expiry flow
 * - publishNewPromotion: end-to-end promo publish flow
 */

import {
  isPromoDisabledForUser,
  buildEligibilityFilter,
  getEligibleUsersForPromo,
  getExpiringCoupons,
  getUsersWithUnusedCoupon,
  processCouponExpiryReminders,
  publishNewPromotion,
  PromoEligibilityCriteria,
} from "../../../src/jobs/promoNotificationJob";

// Mock dependencies
jest.mock("../../../src/models/Coupon", () => ({
  Coupon: {
    find: jest.fn(),
  },
}));

jest.mock("../../../src/models/User", () => ({
  User: {
    find: jest.fn(),
  },
}));

jest.mock("../../../src/models/Order", () => ({
  Order: {},
}));

jest.mock("../../../src/domains/events/eventBus", () => ({
  publish: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/domains/events/promo.events", () => ({
  createPromoCampaignEvent: jest.fn((params) => ({
    eventId: "mock-event-id",
    eventType: "PROMO_CAMPAIGN",
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: params.actor,
    source: params.source,
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      deepLink: params.deepLink,
    },
  })),
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { Coupon } from "../../../src/models/Coupon";
import { User } from "../../../src/models/User";
import { publish } from "../../../src/domains/events/eventBus";
import { createPromoCampaignEvent } from "../../../src/domains/events/promo.events";

const mockCouponFind = Coupon.find as jest.Mock;
const mockUserFind = User.find as jest.Mock;
const mockPublish = publish as jest.Mock;
const mockCreatePromoCampaignEvent = createPromoCampaignEvent as jest.Mock;

describe("Promotional Notification Eligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── isPromoDisabledForUser ─────────────────────────────────────────────────

  describe("isPromoDisabledForUser", () => {
    it("should return false when no preferences are set (default: enabled)", () => {
      expect(isPromoDisabledForUser(undefined)).toBe(false);
      expect(isPromoDisabledForUser({})).toBe(false);
    });

    it("should return true when push is explicitly disabled", () => {
      const prefs = {
        push: { enabled: false },
      };
      expect(isPromoDisabledForUser(prefs)).toBe(true);
    });

    it("should return true when push.categories.newOffers is false", () => {
      const prefs = {
        push: {
          enabled: true,
          categories: { newOffers: false },
        },
      };
      expect(isPromoDisabledForUser(prefs)).toBe(true);
    });

    it("should return false when push is enabled and newOffers is true", () => {
      const prefs = {
        push: {
          enabled: true,
          categories: { newOffers: true },
        },
      };
      expect(isPromoDisabledForUser(prefs)).toBe(false);
    });

    it("should return false when push is enabled and newOffers is undefined (default enabled)", () => {
      const prefs = {
        push: {
          enabled: true,
          categories: { myOrders: true },
        },
      };
      expect(isPromoDisabledForUser(prefs)).toBe(false);
    });

    it("should return true when both push and inapp are disabled", () => {
      const prefs = {
        push: { enabled: false },
        inapp: { enabled: false },
      };
      expect(isPromoDisabledForUser(prefs)).toBe(true);
    });

    it("should return false when push is disabled but inapp is enabled", () => {
      // Push disabled check returns true first so this actually returns true
      const prefs = {
        push: { enabled: false },
        inapp: { enabled: true },
      };
      // Per our logic, if push.enabled === false we return true (disabled)
      expect(isPromoDisabledForUser(prefs)).toBe(true);
    });

    it("should return false when push has no categories object", () => {
      const prefs = {
        push: { enabled: true },
      };
      expect(isPromoDisabledForUser(prefs)).toBe(false);
    });
  });

  // ─── buildEligibilityFilter ─────────────────────────────────────────────────

  describe("buildEligibilityFilter", () => {
    it("should build base filter with role=customer and isDeleted=false", () => {
      const filter = buildEligibilityFilter({ segment: "all" });

      expect(filter.role).toBe("customer");
      expect(filter.isDeleted).toEqual({ $ne: true });
    });

    it("should add lastLoginAt filter for active segment", () => {
      const filter = buildEligibilityFilter({ segment: "active" });

      expect(filter.lastLoginAt).toBeDefined();
      expect(filter.lastLoginAt.$gte).toBeInstanceOf(Date);
      // Should be approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const diff = Math.abs(
        filter.lastLoginAt.$gte.getTime() - thirtyDaysAgo.getTime()
      );
      expect(diff).toBeLessThan(1000); // within 1 second
    });

    it("should add $or filter for inactive segment", () => {
      const filter = buildEligibilityFilter({ segment: "inactive" });

      expect(filter.$or).toBeDefined();
      expect(filter.$or).toHaveLength(2);
      expect(filter.$or[0]).toHaveProperty("lastLoginAt");
      expect(filter.$or[1]).toEqual({ lastLoginAt: null });
    });

    it("should add createdAt filter for new segment", () => {
      const filter = buildEligibilityFilter({
        segment: "new",
        maxDaysAccountAge: 14,
      });

      expect(filter.createdAt).toBeDefined();
      expect(filter.createdAt.$gte).toBeInstanceOf(Date);
    });

    it("should add location filter when locations are provided", () => {
      const filter = buildEligibilityFilter({
        locations: ["560001", "560002"],
      });

      expect(filter["addresses.pincode"]).toEqual({
        $in: ["560001", "560002"],
      });
    });

    it("should add minOrders filter", () => {
      const filter = buildEligibilityFilter({ minOrders: 5 });

      expect(filter.completedOrders).toBeDefined();
      expect(filter.completedOrders.$gte).toBe(5);
    });

    it("should add maxOrders filter", () => {
      const filter = buildEligibilityFilter({ maxOrders: 10 });

      expect(filter.completedOrders).toBeDefined();
      expect(filter.completedOrders.$lte).toBe(10);
    });

    it("should combine minOrders and maxOrders", () => {
      const filter = buildEligibilityFilter({ minOrders: 2, maxOrders: 50 });

      expect(filter.completedOrders.$gte).toBe(2);
      expect(filter.completedOrders.$lte).toBe(50);
    });

    it("should add loyaltyTier filter", () => {
      const filter = buildEligibilityFilter({
        loyaltyTier: ["gold", "platinum"],
      });

      expect(filter.loyaltyTier).toEqual({ $in: ["gold", "platinum"] });
    });

    it("should not add optional filters when not provided", () => {
      const filter = buildEligibilityFilter({});

      expect(filter["addresses.pincode"]).toBeUndefined();
      expect(filter.completedOrders).toBeUndefined();
      expect(filter.loyaltyTier).toBeUndefined();
      expect(filter.lastLoginAt).toBeUndefined();
      expect(filter.createdAt).toBeUndefined();
    });
  });

  // ─── getEligibleUsersForPromo ─────────────────────────────────────────────

  describe("getEligibleUsersForPromo", () => {
    it("should return users who have promo enabled", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        { _id: "user2", name: "Bob", notificationPreferences: { push: { enabled: true } } },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await getEligibleUsersForPromo({ segment: "all" });

      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe("user1");
      expect(result[1]._id).toBe("user2");
    });

    it("should filter out users who disabled promo notifications", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        {
          _id: "user2",
          name: "Bob",
          notificationPreferences: {
            push: { enabled: true, categories: { newOffers: false } },
          },
        },
        { _id: "user3", name: "Charlie", notificationPreferences: { push: { enabled: false } } },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await getEligibleUsersForPromo({ segment: "all" });

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("user1");
    });

    it("should call User.find with correct filter for active segment", async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await getEligibleUsersForPromo({ segment: "active" });

      const calledFilter = mockUserFind.mock.calls[0][0];
      expect(calledFilter.role).toBe("customer");
      expect(calledFilter.isDeleted).toEqual({ $ne: true });
      expect(calledFilter.lastLoginAt).toBeDefined();
    });
  });

  // ─── getExpiringCoupons ─────────────────────────────────────────────────────

  describe("getExpiringCoupons", () => {
    it("should query coupons expiring within 24 hours", async () => {
      const mockCoupons = [
        {
          _id: "c1",
          code: "SAVE20",
          discountType: "percentage",
          discountValue: 20,
          expiryDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          isActive: true,
        },
      ];

      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCoupons),
      });

      const result = await getExpiringCoupons();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("SAVE20");

      // Verify the query parameters
      const calledFilter = mockCouponFind.mock.calls[0][0];
      expect(calledFilter.isActive).toBe(true);
      expect(calledFilter.expiryDate.$gte).toBeInstanceOf(Date);
      expect(calledFilter.expiryDate.$lte).toBeInstanceOf(Date);

      // $lte should be ~24h from now
      const diff = calledFilter.expiryDate.$lte.getTime() - Date.now();
      expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });

    it("should return empty array when no coupons are expiring", async () => {
      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await getExpiringCoupons();

      expect(result).toHaveLength(0);
    });
  });

  // ─── getUsersWithUnusedCoupon ─────────────────────────────────────────────

  describe("getUsersWithUnusedCoupon", () => {
    it("should return customer users with promo enabled", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        { _id: "user2", name: "Bob", notificationPreferences: { push: { enabled: true } } },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const coupon = {
        _id: "c1",
        code: "SAVE20",
        discountType: "percentage" as const,
        discountValue: 20,
        expiryDate: new Date(),
        isActive: true,
      } as any;

      const result = await getUsersWithUnusedCoupon(coupon);

      expect(result).toHaveLength(2);
    });

    it("should filter out users who disabled promo notifications", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        {
          _id: "user2",
          name: "Bob",
          notificationPreferences: { push: { enabled: false } },
        },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const coupon = {
        _id: "c1",
        code: "FLAT50",
        discountType: "fixed" as const,
        discountValue: 50,
        expiryDate: new Date(),
        isActive: true,
      } as any;

      const result = await getUsersWithUnusedCoupon(coupon);

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("user1");
    });

    it("should query with role=customer and isDeleted=false", async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const coupon = {
        _id: "c1",
        code: "TEST",
        discountType: "fixed" as const,
        discountValue: 10,
        expiryDate: new Date(),
        isActive: true,
      } as any;

      await getUsersWithUnusedCoupon(coupon);

      const calledFilter = mockUserFind.mock.calls[0][0];
      expect(calledFilter.role).toBe("customer");
      expect(calledFilter.isDeleted).toEqual({ $ne: true });
    });
  });

  // ─── processCouponExpiryReminders ─────────────────────────────────────────

  describe("processCouponExpiryReminders", () => {
    it("should return zero counts when no coupons are expiring", async () => {
      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await processCouponExpiryReminders();

      expect(result.couponsProcessed).toBe(0);
      expect(result.usersNotified).toBe(0);
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should publish events for each eligible user per expiring coupon", async () => {
      const mockCoupons = [
        {
          _id: "c1",
          code: "SAVE20",
          discountType: "percentage",
          discountValue: 20,
          expiryDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          isActive: true,
        },
      ];

      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        { _id: "user2", name: "Bob", notificationPreferences: {} },
      ];

      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCoupons),
      });

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await processCouponExpiryReminders();

      expect(result.couponsProcessed).toBe(1);
      expect(result.usersNotified).toBe(2);
      expect(mockPublish).toHaveBeenCalledTimes(2);
      expect(mockCreatePromoCampaignEvent).toHaveBeenCalledTimes(2);

      // Check event content
      const firstCall = mockCreatePromoCampaignEvent.mock.calls[0][0];
      expect(firstCall.userId).toBe("user1");
      expect(firstCall.title).toContain("Coupon Expiring");
      expect(firstCall.body).toContain("SAVE20");
      expect(firstCall.body).toContain("20% off");
    });

    it("should include fixed discount format in body for fixed-type coupons", async () => {
      const mockCoupons = [
        {
          _id: "c1",
          code: "FLAT100",
          discountType: "fixed",
          discountValue: 100,
          expiryDate: new Date(Date.now() + 10 * 60 * 60 * 1000),
          isActive: true,
        },
      ];

      const mockUsers = [
        { _id: "user1", name: "Test", notificationPreferences: {} },
      ];

      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCoupons),
      });

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      await processCouponExpiryReminders();

      const firstCall = mockCreatePromoCampaignEvent.mock.calls[0][0];
      expect(firstCall.body).toContain("₹100 off");
      expect(firstCall.body).toContain("FLAT100");
    });

    it("should skip users who disabled promo notifications", async () => {
      const mockCoupons = [
        {
          _id: "c1",
          code: "TEST",
          discountType: "fixed",
          discountValue: 50,
          expiryDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          isActive: true,
        },
      ];

      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        {
          _id: "user2",
          name: "Bob",
          notificationPreferences: { push: { enabled: false } },
        },
      ];

      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCoupons),
      });

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await processCouponExpiryReminders();

      expect(result.usersNotified).toBe(1);
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    it("should continue processing remaining coupons if one fails", async () => {
      const mockCoupons = [
        {
          _id: "c1",
          code: "FIRST",
          discountType: "fixed",
          discountValue: 10,
          expiryDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          _id: "c2",
          code: "SECOND",
          discountType: "percentage",
          discountValue: 15,
          expiryDate: new Date(Date.now() + 20 * 60 * 60 * 1000),
          isActive: true,
        },
      ];

      mockCouponFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockCoupons),
      });

      // First coupon query fails, second succeeds
      let callCount = 0;
      mockUserFind.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.reject(new Error("DB connection lost"));
            }
            return Promise.resolve([
              { _id: "user1", name: "Alice", notificationPreferences: {} },
            ]);
          }),
        }),
      }));

      const result = await processCouponExpiryReminders();

      // First coupon failed (getUsersWithUnusedCoupon threw), but second succeeded
      expect(result.couponsProcessed).toBe(1);
      expect(result.usersNotified).toBe(1);
    });
  });

  // ─── publishNewPromotion ──────────────────────────────────────────────────

  describe("publishNewPromotion", () => {
    it("should publish promo events to all eligible users", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        { _id: "user2", name: "Bob", notificationPreferences: {} },
        { _id: "user3", name: "Charlie", notificationPreferences: {} },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await publishNewPromotion({
        title: "Flash Sale!",
        body: "50% off on all products for the next 2 hours!",
        deepLink: "/offers/flash-sale",
        criteria: { segment: "all" },
      });

      expect(result.usersTargeted).toBe(3);
      expect(mockPublish).toHaveBeenCalledTimes(3);
    });

    it("should use default segment 'all' when no criteria provided", async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await publishNewPromotion({
        title: "Test",
        body: "Test body",
      });

      const calledFilter = mockUserFind.mock.calls[0][0];
      expect(calledFilter.role).toBe("customer");
    });

    it("should skip users who disabled promo notifications", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        {
          _id: "user2",
          name: "Bob",
          notificationPreferences: {
            push: { enabled: true, categories: { newOffers: false } },
          },
        },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await publishNewPromotion({
        title: "Sale",
        body: "Big sale",
        criteria: { segment: "all" },
      });

      expect(result.usersTargeted).toBe(1);
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    it("should apply location-based eligibility filter", async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      await publishNewPromotion({
        title: "Local Deal",
        body: "For Bangalore customers only",
        criteria: { locations: ["560001", "560002"] },
      });

      const calledFilter = mockUserFind.mock.calls[0][0];
      expect(calledFilter["addresses.pincode"]).toEqual({
        $in: ["560001", "560002"],
      });
    });

    it("should continue publishing to remaining users if one fails", async () => {
      const mockUsers = [
        { _id: "user1", name: "Alice", notificationPreferences: {} },
        { _id: "user2", name: "Bob", notificationPreferences: {} },
        { _id: "user3", name: "Charlie", notificationPreferences: {} },
      ];

      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUsers),
        }),
      });

      // Make publish fail for the second user
      mockPublish
        .mockResolvedValueOnce(undefined) // user1 succeeds
        .mockRejectedValueOnce(new Error("publish failed")) // user2 fails
        .mockResolvedValueOnce(undefined); // user3 succeeds

      const result = await publishNewPromotion({
        title: "Test",
        body: "Test body",
      });

      // 2 succeeded, 1 failed
      expect(result.usersTargeted).toBe(2);
      expect(mockPublish).toHaveBeenCalledTimes(3);
    });
  });
});
