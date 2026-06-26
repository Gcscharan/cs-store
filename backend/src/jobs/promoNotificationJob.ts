/**
 * Promotional Notification Automation Job
 *
 * Scheduled job that handles:
 * 1. Coupon expiry reminders — sends notifications 24h before coupon expiration
 *    to users who have unused coupons
 * 2. Promotional campaign eligibility — filters users by segment, location, activity
 *    before publishing PROMO_CAMPAIGN events
 *
 * Runs every hour to check for coupons expiring within the next 24 hours.
 * Respects promo category preference — skips users who disabled promo notifications.
 */

import { logger } from "../utils/logger";
import { Coupon, ICoupon } from "../models/Coupon";
import { User, IUser } from "../models/User";
import { Order } from "../models/Order";
import { publish } from "../domains/events/eventBus";
import { createPromoCampaignEvent } from "../domains/events/promo.events";

let promoJobInterval: NodeJS.Timeout | null = null;

// ─── Eligibility Filtering ─────────────────────────────────────────────────────

/**
 * Segment criteria for targeting users with promotions.
 */
export interface PromoEligibilityCriteria {
  /** Target user segment: "all", "active", "inactive", "new" */
  segment?: "all" | "active" | "inactive" | "new";
  /** Target users in specific locations (pincodes) */
  locations?: string[];
  /** Minimum number of completed orders */
  minOrders?: number;
  /** Maximum number of completed orders */
  maxOrders?: number;
  /** Minimum days since last order (for win-back campaigns) */
  minDaysSinceLastOrder?: number;
  /** Maximum days since account creation (for new user promos) */
  maxDaysAccountAge?: number;
  /** Loyalty tier filter */
  loyaltyTier?: ("bronze" | "silver" | "gold" | "platinum")[];
}

/**
 * Check if a user has promo notifications disabled.
 * Returns true if promo notifications are disabled for the user.
 */
export function isPromoDisabledForUser(
  notificationPreferences?: Record<string, any>
): boolean {
  if (!notificationPreferences) {
    return false; // Default: promo enabled
  }

  // Check push.categories.newOffers
  const pushPrefs = notificationPreferences.push;
  if (pushPrefs?.enabled === false) {
    return true;
  }
  if (pushPrefs?.categories?.newOffers === false) {
    return true;
  }

  // Check inapp.categories.newOffers
  const inappPrefs = notificationPreferences.inapp;
  if (inappPrefs?.enabled === false && pushPrefs?.enabled === false) {
    // Both in-app and push disabled — skip promo notifications entirely
    return true;
  }

  return false;
}

/**
 * Build a MongoDB query filter for user eligibility based on criteria.
 */
export function buildEligibilityFilter(
  criteria: PromoEligibilityCriteria
): Record<string, any> {
  const filter: Record<string, any> = {
    role: "customer",
    isDeleted: { $ne: true },
  };

  // Segment-based filtering
  if (criteria.segment === "active") {
    // Active: has ordered in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    filter.lastLoginAt = { $gte: thirtyDaysAgo };
  } else if (criteria.segment === "inactive") {
    // Inactive: no login in 30+ days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    filter.$or = [
      { lastLoginAt: { $lt: thirtyDaysAgo } },
      { lastLoginAt: null },
    ];
  } else if (criteria.segment === "new") {
    // New: account created within configured days
    const daysAgo = criteria.maxDaysAccountAge || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysAgo);
    filter.createdAt = { $gte: cutoff };
  }

  // Location filtering (by user address pincodes)
  if (criteria.locations && criteria.locations.length > 0) {
    filter["addresses.pincode"] = { $in: criteria.locations };
  }

  // Order count filtering
  if (criteria.minOrders !== undefined) {
    filter.completedOrders = { ...filter.completedOrders, $gte: criteria.minOrders };
  }
  if (criteria.maxOrders !== undefined) {
    filter.completedOrders = { ...filter.completedOrders, $lte: criteria.maxOrders };
  }

  // Loyalty tier filtering
  if (criteria.loyaltyTier && criteria.loyaltyTier.length > 0) {
    filter.loyaltyTier = { $in: criteria.loyaltyTier };
  }

  return filter;
}

/**
 * Query eligible users for a promotion based on criteria.
 * Respects promo notification preferences — skips users who disabled promo.
 */
export async function getEligibleUsersForPromo(
  criteria: PromoEligibilityCriteria
): Promise<Pick<IUser, "_id" | "name">[]> {
  const filter = buildEligibilityFilter(criteria);

  const users = await User.find(filter)
    .select("_id name notificationPreferences")
    .lean();

  // Filter out users who have disabled promo notifications
  return users.filter(
    (user) => !isPromoDisabledForUser(user.notificationPreferences as any)
  );
}

// ─── Coupon Expiry Reminders ────────────────────────────────────────────────────

/**
 * Find coupons expiring within the next 24 hours that are still active.
 */
export async function getExpiringCoupons(): Promise<ICoupon[]> {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const coupons = await Coupon.find({
    isActive: true,
    expiryDate: {
      $gte: now,
      $lte: twentyFourHoursFromNow,
    },
  }).lean();

  return coupons as unknown as ICoupon[];
}

/**
 * Query users who have not used a specific coupon.
 *
 * Since there's no coupon-usage tracking model, we notify all active customer users
 * with promo notifications enabled. The coupon is available to all — we remind everyone
 * that it's about to expire.
 */
export async function getUsersWithUnusedCoupon(
  _coupon: ICoupon
): Promise<Pick<IUser, "_id" | "name">[]> {
  const users = await User.find({
    role: "customer",
    isDeleted: { $ne: true },
  })
    .select("_id name notificationPreferences")
    .lean();

  // Filter out users who have disabled promo notifications
  return users.filter(
    (user) => !isPromoDisabledForUser(user.notificationPreferences as any)
  );
}

/**
 * Process coupon expiry reminders.
 * Finds coupons expiring within 24h and publishes PROMO_CAMPAIGN events
 * for eligible users.
 */
export async function processCouponExpiryReminders(): Promise<{
  couponsProcessed: number;
  usersNotified: number;
}> {
  let couponsProcessed = 0;
  let usersNotified = 0;

  try {
    const expiringCoupons = await getExpiringCoupons();

    if (expiringCoupons.length === 0) {
      logger.info("[PromoJob] No coupons expiring within 24 hours");
      return { couponsProcessed: 0, usersNotified: 0 };
    }

    logger.info(
      `[PromoJob] Found ${expiringCoupons.length} coupon(s) expiring within 24 hours`
    );

    for (const coupon of expiringCoupons) {
      try {
        const eligibleUsers = await getUsersWithUnusedCoupon(coupon);
        couponsProcessed++;

        for (const user of eligibleUsers) {
          try {
            const event = createPromoCampaignEvent({
              source: "promoNotificationJob",
              actor: { type: "system", id: "promo-automation" },
              userId: user._id.toString(),
              title: `Coupon Expiring Soon! 🔥`,
              body: `Your coupon ${coupon.code} (${coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}) expires in less than 24 hours. Use it before it's gone!`,
              deepLink: "/offers/coupons",
            });

            await publish(event);
            usersNotified++;
          } catch (err) {
            logger.error(
              `[PromoJob] Failed to publish coupon expiry event for user ${user._id}`,
              { error: err instanceof Error ? err.message : String(err) }
            );
          }
        }

        logger.info(
          `[PromoJob] Coupon ${coupon.code}: notified ${eligibleUsers.length} users`
        );
      } catch (err) {
        logger.error(`[PromoJob] Failed to process coupon ${coupon.code}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error("[PromoJob] Failed to process coupon expiry reminders", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { couponsProcessed, usersNotified };
}

// ─── New Promotion Publishing ───────────────────────────────────────────────────

/**
 * Publish a new promotion to eligible users based on eligibility criteria.
 * Respects promo category preference — skips users who disabled promo notifications.
 */
export async function publishNewPromotion(params: {
  title: string;
  body: string;
  deepLink?: string;
  criteria?: PromoEligibilityCriteria;
}): Promise<{ usersTargeted: number }> {
  const { title, body, deepLink, criteria } = params;
  const eligibilityCriteria = criteria || { segment: "all" };

  const eligibleUsers = await getEligibleUsersForPromo(eligibilityCriteria);

  logger.info(
    `[PromoJob] Publishing promotion to ${eligibleUsers.length} eligible users`,
    { title, criteria: eligibilityCriteria }
  );

  let usersTargeted = 0;

  for (const user of eligibleUsers) {
    try {
      const event = createPromoCampaignEvent({
        source: "promoNotificationJob",
        actor: { type: "system", id: "promo-automation" },
        userId: user._id.toString(),
        title,
        body,
        deepLink,
      });

      await publish(event);
      usersTargeted++;
    } catch (err) {
      logger.error(
        `[PromoJob] Failed to publish promotion event for user ${user._id}`,
        { error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  return { usersTargeted };
}

// ─── Scheduled Job ──────────────────────────────────────────────────────────────

/**
 * Main scheduled task that runs hourly.
 */
async function runPromoJob(): Promise<void> {
  logger.info("[PromoJob] Running promotional notification job...");

  try {
    const result = await processCouponExpiryReminders();
    logger.info("[PromoJob] Coupon expiry reminders complete", result);
  } catch (err) {
    logger.error("[PromoJob] Job execution failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Start the promotional notification job.
 * Runs every hour (3600000ms) to check for expiring coupons.
 */
export function startPromoNotificationJob(): void {
  if (promoJobInterval) {
    logger.warn("[PromoJob] Job already running");
    return;
  }

  // Run immediately on start
  runPromoJob().catch((err) => {
    logger.error("[PromoJob] Initial run failed:", err);
  });

  // Then run every hour
  const ONE_HOUR = 60 * 60 * 1000;
  promoJobInterval = setInterval(() => {
    runPromoJob().catch((err) => {
      logger.error("[PromoJob] Scheduled run failed:", err);
    });
  }, ONE_HOUR);

  logger.info("[PromoJob] Promotional notification job started (hourly)");
}

/**
 * Stop the promotional notification job.
 */
export function stopPromoNotificationJob(): void {
  if (promoJobInterval) {
    clearInterval(promoJobInterval);
    promoJobInterval = null;
    logger.info("[PromoJob] Promotional notification job stopped");
  }
}
