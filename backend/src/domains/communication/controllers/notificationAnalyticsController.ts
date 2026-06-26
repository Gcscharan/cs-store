/**
 * Notification Analytics Controller
 *
 * Provides aggregated notification performance metrics for the admin dashboard.
 * Uses MongoDB aggregation pipeline on the NotificationAudit collection.
 *
 * Endpoint: GET /api/admin/notifications/analytics
 * Requires: Admin role authentication
 *
 * Requirements: R20 (Analytics Dashboard)
 */

import { Response } from "express";
import mongoose from "mongoose";
import NotificationAudit from "../../../models/NotificationAudit";
import { User } from "../../../models/User";
import { AuthRequest } from "../../../middleware/auth";
import { logger } from "../../../utils/logger";

/** Supported time period groupings */
type TimePeriod = "hourly" | "daily" | "weekly";

/** Delivery rate warning threshold */
const DELIVERY_RATE_WARNING_THRESHOLD = 0.8; // 80%

/**
 * Builds the date format expression for MongoDB aggregation based on the time period.
 */
function getDateGroupExpression(period: TimePeriod): Record<string, any> {
  switch (period) {
    case "hourly":
      return {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
        hour: { $hour: "$createdAt" },
      };
    case "weekly":
      return {
        year: { $isoWeekYear: "$createdAt" },
        week: { $isoWeek: "$createdAt" },
      };
    case "daily":
    default:
      return {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
  }
}

/**
 * Builds a filter pipeline stage for category and priority.
 */
function buildMatchFilter(
  startDate: Date,
  endDate: Date,
  category?: string,
  priority?: string
): Record<string, any> {
  const match: Record<string, any> = {
    createdAt: { $gte: startDate, $lte: endDate },
  };

  if (category) {
    match.category = category;
  }

  if (priority) {
    match.priority = priority;
  }

  return match;
}

/**
 * GET /api/admin/notifications/analytics
 *
 * Returns aggregated notification metrics:
 * - Total sent/delivered/opened/failed by time period
 * - Top notification types by volume
 * - Top failure reasons
 * - Push token health
 * - Delivery rate warnings (highlight if <80%)
 *
 * Query Parameters:
 * - period: "hourly" | "daily" | "weekly" (default: "daily")
 * - startDate: ISO date string (default: 7 days ago)
 * - endDate: ISO date string (default: now)
 * - category: filter by notification category (order, delivery, payment, account, promo)
 * - priority: filter by priority level (P0, P1, P2, P3)
 */
export const getNotificationAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Parse query parameters
    const period = (req.query.period as TimePeriod) || "daily";
    if (!["hourly", "daily", "weekly"].includes(period)) {
      res.status(400).json({ error: "Invalid period. Must be hourly, daily, or weekly." });
      return;
    }

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : defaultStart;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : now;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ error: "Invalid date format. Use ISO date strings." });
      return;
    }

    const category = req.query.category as string | undefined;
    const priority = req.query.priority as string | undefined;

    // Validate category if provided
    if (category && !["order", "delivery", "payment", "account", "promo"].includes(category)) {
      res.status(400).json({ error: "Invalid category. Must be order, delivery, payment, account, or promo." });
      return;
    }

    // Validate priority if provided
    if (priority && !["P0", "P1", "P2", "P3"].includes(priority)) {
      res.status(400).json({ error: "Invalid priority. Must be P0, P1, P2, or P3." });
      return;
    }

    const matchFilter = buildMatchFilter(startDate, endDate, category, priority);

    // Run all aggregation queries in parallel
    const [
      metricsByPeriod,
      topNotificationTypes,
      topFailureReasons,
      pushTokenHealth,
      overallMetrics,
    ] = await Promise.all([
      // 1. Metrics grouped by time period
      getMetricsByPeriod(matchFilter, period),
      // 2. Top notification types by volume
      getTopNotificationTypes(matchFilter),
      // 3. Top failure reasons
      getTopFailureReasons(matchFilter),
      // 4. Push token health
      getPushTokenHealth(),
      // 5. Overall metrics for delivery rate calculation
      getOverallMetrics(matchFilter),
    ]);

    // Calculate delivery rate and warnings
    const deliveryRateByType = calculateDeliveryRateByType(overallMetrics);
    const warnings = deliveryRateByType
      .filter((item) => item.deliveryRate < DELIVERY_RATE_WARNING_THRESHOLD)
      .map((item) => ({
        eventType: item.eventType,
        deliveryRate: item.deliveryRate,
        message: `Delivery rate for ${item.eventType} is ${(item.deliveryRate * 100).toFixed(1)}% (below ${DELIVERY_RATE_WARNING_THRESHOLD * 100}% threshold)`,
      }));

    res.json({
      success: true,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      filters: {
        ...(category ? { category } : {}),
        ...(priority ? { priority } : {}),
      },
      metrics: {
        byTimePeriod: metricsByPeriod,
        totals: {
          sent: overallMetrics.reduce((sum, m) => sum + m.sent, 0),
          delivered: overallMetrics.reduce((sum, m) => sum + m.delivered, 0),
          opened: overallMetrics.reduce((sum, m) => sum + m.opened, 0),
          failed: overallMetrics.reduce((sum, m) => sum + m.failed, 0),
        },
      },
      topNotificationTypes,
      topFailureReasons,
      pushTokenHealth,
      deliveryRateByType,
      warnings,
    });
  } catch (error) {
    logger.error("[NotificationAnalytics] Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch notification analytics" });
  }
};

/**
 * Aggregates notification metrics grouped by time period.
 */
async function getMetricsByPeriod(
  matchFilter: Record<string, any>,
  period: TimePeriod
): Promise<any[]> {
  const dateGroup = getDateGroupExpression(period);

  const pipeline: any[] = [
    { $match: matchFilter },
    { $unwind: "$channels" },
    {
      $group: {
        _id: dateGroup,
        sent: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "sent"] }, 1, 0],
          },
        },
        delivered: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "delivered"] }, 1, 0],
          },
        },
        opened: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "opened"] }, 1, 0],
          },
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "failed"] }, 1, 0],
          },
        },
        total: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1, "_id.week": 1 } },
  ];

  return NotificationAudit.aggregate(pipeline);
}

/**
 * Aggregates top notification types by volume.
 */
async function getTopNotificationTypes(
  matchFilter: Record<string, any>
): Promise<any[]> {
  const pipeline: any[] = [
    { $match: matchFilter },
    {
      $group: {
        _id: "$eventType",
        count: { $sum: 1 },
        category: { $first: "$category" },
        priority: { $first: "$priority" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        eventType: "$_id",
        count: 1,
        category: 1,
        priority: 1,
      },
    },
  ];

  return NotificationAudit.aggregate(pipeline);
}

/**
 * Aggregates top failure reasons from channel delivery data.
 */
async function getTopFailureReasons(
  matchFilter: Record<string, any>
): Promise<any[]> {
  const pipeline: any[] = [
    { $match: matchFilter },
    { $unwind: "$channels" },
    { $match: { "channels.status": "failed" } },
    {
      $group: {
        _id: {
          error: { $ifNull: ["$channels.error", "Unknown error"] },
          channel: "$channels.channel",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        reason: "$_id.error",
        channel: "$_id.channel",
        count: 1,
      },
    },
  ];

  return NotificationAudit.aggregate(pipeline);
}

/**
 * Calculates push token health metrics:
 * - Total active tokens
 * - Tokens invalidated in last 24 hours (users who lost their token)
 * - Percentage of users with valid tokens
 */
async function getPushTokenHealth(): Promise<{
  totalActiveTokens: number;
  tokensInvalidatedLast24h: number;
  percentUsersWithValidToken: number;
}> {
  try {
    const [totalUsers, usersWithToken] = await Promise.all([
      User.countDocuments({ status: { $ne: "suspended" } }),
      User.countDocuments({
        expoPushToken: { $exists: true, $nin: [null, ""] },
        status: { $ne: "suspended" },
      }),
    ]);

    // Count push failures with "Device not registered" or similar token errors in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tokenFailures = await NotificationAudit.countDocuments({
      createdAt: { $gte: twentyFourHoursAgo },
      "channels.channel": "push",
      "channels.status": "failed",
      "channels.error": { $regex: /token|device.*not.*registered|invalid.*token/i },
    });

    const percentUsersWithValidToken =
      totalUsers > 0 ? Math.round((usersWithToken / totalUsers) * 100) / 100 : 0;

    return {
      totalActiveTokens: usersWithToken,
      tokensInvalidatedLast24h: tokenFailures,
      percentUsersWithValidToken,
    };
  } catch (error) {
    logger.error("[NotificationAnalytics] Error fetching push token health:", error);
    return {
      totalActiveTokens: 0,
      tokensInvalidatedLast24h: 0,
      percentUsersWithValidToken: 0,
    };
  }
}

/**
 * Gets overall delivery metrics per event type for delivery rate calculations.
 */
async function getOverallMetrics(
  matchFilter: Record<string, any>
): Promise<Array<{ eventType: string; sent: number; delivered: number; opened: number; failed: number }>> {
  const pipeline: any[] = [
    { $match: matchFilter },
    { $unwind: "$channels" },
    {
      $group: {
        _id: "$eventType",
        sent: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "sent"] }, 1, 0],
          },
        },
        delivered: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "delivered"] }, 1, 0],
          },
        },
        opened: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "opened"] }, 1, 0],
          },
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ["$channels.status", "failed"] }, 1, 0],
          },
        },
      },
    },
  ];

  const results = await NotificationAudit.aggregate(pipeline);
  return results.map((r) => ({
    eventType: r._id,
    sent: r.sent,
    delivered: r.delivered,
    opened: r.opened,
    failed: r.failed,
  }));
}

/**
 * Calculates delivery rate per event type and flags warnings.
 */
function calculateDeliveryRateByType(
  metrics: Array<{ eventType: string; sent: number; delivered: number; opened: number; failed: number }>
): Array<{ eventType: string; deliveryRate: number; total: number; delivered: number; failed: number; warning: boolean }> {
  return metrics
    .map((m) => {
      const total = m.sent + m.delivered + m.opened + m.failed;
      // Delivery rate = (delivered + opened) / total (excluding "sent" as pending)
      // A notification counts as delivered if its status advanced past "sent"
      const successfulDeliveries = m.delivered + m.opened;
      const completedAttempts = successfulDeliveries + m.failed;
      const deliveryRate = completedAttempts > 0 ? successfulDeliveries / completedAttempts : 1;

      return {
        eventType: m.eventType,
        deliveryRate: Math.round(deliveryRate * 1000) / 1000, // 3 decimal places
        total,
        delivered: successfulDeliveries,
        failed: m.failed,
        warning: deliveryRate < DELIVERY_RATE_WARNING_THRESHOLD,
      };
    })
    .sort((a, b) => a.deliveryRate - b.deliveryRate); // Worst rates first
}
