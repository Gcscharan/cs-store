/**
 * Audit Logger Service
 *
 * Creates immutable NotificationAudit records for every notification
 * processed by the Notification Orchestrator. Records include source event,
 * actor, target user, channels attempted, and delivery status per channel.
 *
 * IMPORTANT: This service must NEVER throw or block notification delivery.
 * All operations are wrapped in try/catch and failures are logged but swallowed.
 */

import mongoose from "mongoose";
import NotificationAudit, { IChannelStatus, IActor } from "../../../models/NotificationAudit";
import { logger } from "../../../utils/logger";

export interface AuditLogParams {
  /** The ObjectId of the created notification (or a generated placeholder if in-app was skipped) */
  notificationId: string;
  /** The original event ID from the EventBus */
  eventId: string;
  /** The event type that triggered this notification */
  eventType: string;
  /** The target user ID */
  userId: string;
  /** The actor who triggered the event */
  actor: IActor;
  /** Source system/service that published the event */
  source: string;
  /** Delivery status per channel */
  channels: IChannelStatus[];
  /** Priority classification (P0, P1, P2, P3) */
  priority: string;
  /** Notification category (order, delivery, payment, account, promo) */
  category: string;
}

/**
 * Creates an immutable audit record for a notification delivery.
 *
 * This function NEVER throws — any errors are logged and swallowed
 * to prevent audit failures from blocking notification delivery.
 */
export async function logNotificationAudit(params: AuditLogParams): Promise<void> {
  try {
    const {
      notificationId,
      eventId,
      eventType,
      userId,
      actor,
      source,
      channels,
      priority,
      category,
    } = params;

    // Validate ObjectId fields before creating
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      logger.warn("[AuditLogger] Invalid notificationId, skipping audit", {
        notificationId,
        eventId,
        eventType,
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn("[AuditLogger] Invalid userId, skipping audit", {
        userId,
        eventId,
        eventType,
      });
      return;
    }

    await NotificationAudit.create({
      notificationId: new mongoose.Types.ObjectId(notificationId),
      eventId,
      eventType,
      userId: new mongoose.Types.ObjectId(userId),
      actor,
      source,
      channels: channels.map((ch) => ({
        channel: ch.channel,
        status: ch.status,
        sentAt: ch.sentAt || new Date(),
        ...(ch.error ? { error: ch.error } : {}),
      })),
      priority,
      category,
      createdAt: new Date(),
    });

    logger.info("[AuditLogger] Audit record created", {
      notificationId,
      eventId,
      eventType,
      userId,
      priority,
      category,
      channelCount: channels.length,
    });
  } catch (err) {
    // NEVER throw — audit failures must not block notification delivery
    logger.error("[AuditLogger] Failed to create audit record", {
      error: err instanceof Error ? err.message : String(err),
      eventId: params.eventId,
      eventType: params.eventType,
      userId: params.userId,
    });
  }
}
