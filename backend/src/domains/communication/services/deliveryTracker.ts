/**
 * Delivery Lifecycle Tracker
 *
 * Tracks the full lifecycle of every notification per channel with states:
 * sent, delivered, opened, clicked, failed.
 *
 * Provides:
 * - updateLifecycleStatus(notificationId, channel, status, error?) — updates lifecycle state
 * - getDeliveryMetrics(eventType?, period?) — aggregates delivery/open/click rates
 *
 * Integrates with:
 * - PushGateway: update to 'sent' after Expo accepts, 'delivered' on receipt confirmation
 * - Socket Emitter: update to 'sent' after IO emit
 * - Client-side tracking: 'opened' and 'clicked' via POST /api/notifications/:id/track
 */

import mongoose from "mongoose";
import Notification, {
  LifecycleStatus,
  INotificationLifecycle,
} from "../../../models/Notification";
import { logger } from "../../../utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LifecycleChannel = "push" | "socket" | "inApp";

export type TrackingEvent = "opened" | "clicked";

/**
 * Legal prior states for each target status (monotonic state machine).
 *
 * Forward progression: sent → delivered → opened → clicked.
 * `failed` is only reachable from a pre-delivery state (none/sent) — a late
 * failure signal must never regress an already-delivered/opened notification.
 *
 * A transition to status X is allowed only if the channel's current status is
 * one of PRIOR_STATUSES_ALLOWING[X] (or unset).
 */
const PRIOR_STATUSES_ALLOWING: Record<string, string[]> = {
  sent: [], // only settable when unset (no prior)
  delivered: ["sent"],
  opened: ["sent", "delivered"],
  clicked: ["sent", "delivered", "opened"],
  failed: ["sent"], // only fail from a not-yet-delivered state
};

export interface LifecycleUpdateParams {
  notificationId: string;
  channel: LifecycleChannel;
  status: LifecycleStatus;
  error?: string;
}

export interface MetricsQuery {
  eventType?: string;
  period?: "hour" | "day" | "week" | "month";
  startDate?: Date;
  endDate?: Date;
}

export interface ChannelMetrics {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

export interface DeliveryMetrics {
  eventType: string;
  period: string;
  push: ChannelMetrics;
  socket: ChannelMetrics;
  inApp: ChannelMetrics;
  overall: {
    total: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Updates the lifecycle status for a specific channel on a notification.
 *
 * This is the core tracking function called by:
 * - PushGateway: after Expo accepts ('sent') or receipt confirmation ('delivered')
 * - Socket Emitter: after IO emit ('sent')
 * - Track endpoint: client-side 'opened' or 'clicked' events
 *
 * @param notificationId - The notification document ID
 * @param channel - The delivery channel: 'push', 'socket', or 'inApp'
 * @param status - The lifecycle state: 'sent', 'delivered', 'opened', 'clicked', 'failed'
 * @param error - Optional error message (typically for 'failed' status)
 */
export async function updateLifecycleStatus(
  notificationId: string,
  channel: LifecycleChannel,
  status: LifecycleStatus,
  error?: string
): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      logger.warn("[DeliveryTracker] Invalid notificationId, skipping update", {
        notificationId,
        channel,
        status,
      });
      return;
    }

    const updateFields: Record<string, any> = {
      [`lifecycle.${channel}.status`]: status,
      [`lifecycle.${channel}.updatedAt`]: new Date(),
    };

    if (error) {
      updateFields[`lifecycle.${channel}.error`] = error;
    } else {
      // Clear error when status is not 'failed'
      updateFields[`lifecycle.${channel}.error`] = undefined;
    }

    // ── Monotonic state-machine guard ──
    // Lifecycle may only advance: sent → delivered → opened → clicked.
    // `failed` is only valid from a pre-delivery state (sent/none) — once a
    // channel reaches delivered+, a late `failed` (e.g. a stale receipt) must
    // not regress it. This enforces:
    //   - FAILED → OPENED can never happen
    //   - DELIVERED → SENT (or → GENERATED) can never happen
    //   - opened count can never exceed delivered count (per-channel)
    const statusField = `lifecycle.${channel}.status`;
    const allowedPriorStatuses = PRIOR_STATUSES_ALLOWING[status];

    // Build a filter that only matches when the transition is legal:
    // either the channel has no status yet, or its current status is one we
    // are allowed to advance from.
    const transitionFilter: Record<string, any> = {
      _id: notificationId,
      $or: [
        { [statusField]: { $exists: false } },
        { [statusField]: null },
        { [statusField]: { $in: allowedPriorStatuses } },
      ],
    };

    const result = await Notification.findOneAndUpdate(
      transitionFilter,
      { $set: updateFields },
      { new: false }
    );

    if (!result) {
      // Either the notification doesn't exist, or the transition was illegal
      // (e.g. trying to set 'failed' on an already-delivered notification).
      // This is expected and safe — we simply don't regress the state.
      logger.info("[DeliveryTracker] Lifecycle update skipped (not found or illegal transition)", {
        notificationId,
        channel,
        status,
      });
      return;
    }

    logger.info("[DeliveryTracker] Lifecycle status updated", {
      notificationId,
      channel,
      status,
      ...(error ? { error } : {}),
    });
  } catch (err) {
    // Lifecycle tracking should never block notification delivery
    logger.error("[DeliveryTracker] Failed to update lifecycle status", {
      error: err instanceof Error ? err.message : String(err),
      notificationId,
      channel,
      status,
    });
  }
}

/**
 * Batch update lifecycle status for multiple notifications on a channel.
 * Useful for PushGateway batch operations.
 */
export async function batchUpdateLifecycleStatus(
  updates: LifecycleUpdateParams[]
): Promise<void> {
  const bulkOps = updates
    .filter((u) => mongoose.Types.ObjectId.isValid(u.notificationId))
    .map((update) => {
      const setFields: Record<string, any> = {
        [`lifecycle.${update.channel}.status`]: update.status,
        [`lifecycle.${update.channel}.updatedAt`]: new Date(),
      };
      if (update.error) {
        setFields[`lifecycle.${update.channel}.error`] = update.error;
      }

      return {
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(update.notificationId) },
          update: { $set: setFields },
        },
      };
    });

  if (bulkOps.length === 0) return;

  try {
    await Notification.bulkWrite(bulkOps, { ordered: false });
    logger.info("[DeliveryTracker] Batch lifecycle update completed", {
      count: bulkOps.length,
    });
  } catch (err) {
    logger.error("[DeliveryTracker] Batch lifecycle update failed", {
      error: err instanceof Error ? err.message : String(err),
      count: bulkOps.length,
    });
  }
}

// ─── Metrics Aggregation ──────────────────────────────────────────────────────

/**
 * Computes the start date for a given period relative to now or an endDate.
 */
function getPeriodStartDate(period: string, endDate?: Date): Date {
  const end = endDate || new Date();
  const start = new Date(end);

  switch (period) {
    case "hour":
      start.setHours(start.getHours() - 1);
      break;
    case "day":
      start.setDate(start.getDate() - 1);
      break;
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setMonth(start.getMonth() - 1);
      break;
    default:
      start.setDate(start.getDate() - 1);
  }

  return start;
}

/**
 * Computes delivery metrics (delivery rate, open rate, click rate) per event type per time period.
 *
 * Uses MongoDB aggregation on the Notification collection lifecycle field.
 */
export async function getDeliveryMetrics(query: MetricsQuery = {}): Promise<DeliveryMetrics[]> {
  try {
    const period = query.period || "day";
    const endDate = query.endDate || new Date();
    const startDate = query.startDate || getPeriodStartDate(period, endDate);

    const matchStage: Record<string, any> = {
      createdAt: { $gte: startDate, $lte: endDate },
      lifecycle: { $exists: true, $ne: null },
    };

    if (query.eventType) {
      matchStage.eventType = query.eventType;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $group: {
          _id: "$eventType",
          total: { $sum: 1 },
          // Push channel metrics
          pushSent: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.push.status", ["sent", "delivered", "opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          pushDelivered: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.push.status", ["delivered", "opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          pushOpened: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.push.status", ["opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          pushClicked: {
            $sum: {
              $cond: [{ $eq: ["$lifecycle.push.status", "clicked"] }, 1, 0],
            },
          },
          pushFailed: {
            $sum: {
              $cond: [{ $eq: ["$lifecycle.push.status", "failed"] }, 1, 0],
            },
          },
          // Socket channel metrics
          socketSent: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.socket.status", ["sent", "delivered", "opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          socketDelivered: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.socket.status", ["delivered", "opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          // InApp channel metrics
          inAppDelivered: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.inApp.status", ["delivered", "opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          inAppOpened: {
            $sum: {
              $cond: [
                { $in: ["$lifecycle.inApp.status", ["opened", "clicked"]] },
                1,
                0,
              ],
            },
          },
          inAppClicked: {
            $sum: {
              $cond: [{ $eq: ["$lifecycle.inApp.status", "clicked"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ];

    const results = await Notification.aggregate(pipeline);

    return results.map((r) => {
      const pushTotal = r.pushSent + r.pushFailed;
      const socketTotal = r.socketSent;
      const inAppTotal = r.inAppDelivered + (r.inAppFailed || 0);

      const pushMetrics: ChannelMetrics = {
        total: pushTotal,
        sent: r.pushSent,
        delivered: r.pushDelivered,
        opened: r.pushOpened,
        clicked: r.pushClicked,
        failed: r.pushFailed,
        deliveryRate: pushTotal > 0 ? (r.pushDelivered / pushTotal) * 100 : 0,
        openRate: r.pushDelivered > 0 ? (r.pushOpened / r.pushDelivered) * 100 : 0,
        clickRate: r.pushOpened > 0 ? (r.pushClicked / r.pushOpened) * 100 : 0,
      };

      const socketMetrics: ChannelMetrics = {
        total: socketTotal,
        sent: r.socketSent,
        delivered: r.socketDelivered,
        opened: 0,
        clicked: 0,
        failed: 0,
        deliveryRate: socketTotal > 0 ? (r.socketDelivered / socketTotal) * 100 : 0,
        openRate: 0,
        clickRate: 0,
      };

      const inAppMetrics: ChannelMetrics = {
        total: inAppTotal,
        sent: inAppTotal,
        delivered: r.inAppDelivered,
        opened: r.inAppOpened,
        clicked: r.inAppClicked,
        failed: 0,
        deliveryRate: inAppTotal > 0 ? (r.inAppDelivered / inAppTotal) * 100 : 0,
        openRate: r.inAppDelivered > 0 ? (r.inAppOpened / r.inAppDelivered) * 100 : 0,
        clickRate: r.inAppOpened > 0 ? (r.inAppClicked / r.inAppOpened) * 100 : 0,
      };

      const overallTotal = r.total;
      const overallDelivered = r.pushDelivered + r.socketDelivered + r.inAppDelivered;
      const overallOpened = r.pushOpened + r.inAppOpened;
      const overallClicked = r.pushClicked + r.inAppClicked;

      return {
        eventType: r._id || "unknown",
        period,
        push: pushMetrics,
        socket: socketMetrics,
        inApp: inAppMetrics,
        overall: {
          total: overallTotal,
          deliveryRate: overallTotal > 0 ? (overallDelivered / (overallTotal * 3)) * 100 : 0,
          openRate: overallDelivered > 0 ? (overallOpened / overallDelivered) * 100 : 0,
          clickRate: overallOpened > 0 ? (overallClicked / overallOpened) * 100 : 0,
        },
      };
    });
  } catch (err) {
    logger.error("[DeliveryTracker] Failed to compute delivery metrics", {
      error: err instanceof Error ? err.message : String(err),
      query,
    });
    return [];
  }
}
