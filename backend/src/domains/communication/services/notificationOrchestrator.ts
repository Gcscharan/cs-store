/**
 * Notification Orchestrator
 *
 * Unified event consumer that replaces and extends the existing notificationWriter.
 * Subscribes to the EventBus and executes the full notification pipeline:
 *
 *   1. Deduplicate (ProcessedEvent)
 *   2. Resolve Template (Template Registry)
 *   3. Determine Recipients (multi-role: customer + admin for some events)
 *   4. Check Preferences (Channel Router)
 *   5. Classify Priority (Priority Engine)
 *   6. Fan-out to active channels (In-App, Push, Socket)
 *   7. Audit log entry via logger.info
 *
 * Each channel delivers independently — a failure on one channel does not block others.
 * Controlled via NOTIFICATION_ORCHESTRATOR_ENABLED feature flag.
 */

import mongoose from "mongoose";
import { Application } from "express";
import { BaseEvent } from "../../events/BaseEvent";
import { subscribe } from "../../events/eventBus";
import { logger } from "../../../utils/logger";
import ProcessedEvent from "../../../models/ProcessedEvent";
import Notification from "../../../models/Notification";
import { User } from "../../../models/User";
import {
  resolveTemplate,
  interpolateTemplate,
  defaultTitleForEvent,
  NotificationTemplate,
  NotificationRole,
  NotificationCategory,
} from "../templates/notificationTemplates";
import { determineChannels, DeliveryChannel } from "./channelRouter";
import { classifyPriority, getDeliveryBehavior } from "./priorityEngine";
import { sendPush, PushMessage } from "./pushGateway";
import { createSocketEmitter, ISocketEmitter, NotificationDTO } from "./socketEmitter";
import { logNotificationAudit } from "./auditLogger";
import { enqueuePushRetry } from "./pushRetryWorker";
import { incrementUnreadCount, getUnreadCountCached } from "./unreadCountCache";

const CONSUMER_NAME = "notificationOrchestrator";

let initialized = false;
let socketEmitter: ISocketEmitter | null = null;

// ─── Feature Flag ─────────────────────────────────────────────────────────────

function isOrchestratorEnabled(): boolean {
  return process.env.NOTIFICATION_ORCHESTRATOR_ENABLED === "true";
}

// ─── Recipient Resolution ─────────────────────────────────────────────────────

/**
 * Events that require admin notification in addition to the primary user.
 */
const ADMIN_ALERT_EVENTS = new Set([
  "ORDER_CREATED",
  "ORDER_FAILED",
  "PAYMENT_FAILED",
  "ADMIN_SECURITY_EVENT",
  "LOW_STOCK",
]);

/**
 * Events that target delivery partners (userId in event is the delivery partner).
 */
const DELIVERY_PARTNER_EVENTS = new Set([
  "DELIVERY_ASSIGNED",
  "DELIVERY_PICKUP_REMINDER",
  "DELIVERY_OTP_GENERATED",
  "DELIVERY_COMPLETED",
  "EARNINGS_CREDITED",
  "EARNINGS_DAILY_SUMMARY",
  "PERFORMANCE_MILESTONE",
  "COD_SETTLEMENT_REMINDER",
]);

interface Recipient {
  userId: string;
  role: NotificationRole;
}

/**
 * Determines all recipients for a given event.
 * Some events notify multiple roles (e.g., ORDER_FAILED → customer + admin).
 */
async function resolveRecipients(
  eventType: string,
  data: Record<string, any>
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  const userId = typeof data.userId === "string" ? data.userId : undefined;

  if (DELIVERY_PARTNER_EVENTS.has(eventType)) {
    // Delivery partner events target the rider
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      recipients.push({ userId, role: "delivery_partner" });
    }
  } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    // Standard customer notification
    recipients.push({ userId, role: "customer" });
  }

  // Admin alerts: notify all admin users
  if (ADMIN_ALERT_EVENTS.has(eventType)) {
    try {
      const admins = await User.find({ role: "admin", isDeleted: { $ne: true } })
        .select("_id")
        .lean();

      for (const admin of admins) {
        recipients.push({
          userId: admin._id.toString(),
          role: "admin",
        });
      }
    } catch (err) {
      logger.error("[NotificationOrchestrator] Failed to query admin users", {
        error: err instanceof Error ? err.message : String(err),
        eventType,
      });
    }
  }

  return recipients;
}

// ─── Channel Fan-out ──────────────────────────────────────────────────────────

interface ChannelResult {
  channel: string;
  status: "success" | "failed";
  error?: string;
}

/**
 * Delivers notification to the In-App channel (creates Notification document).
 */
async function deliverInApp(
  recipient: Recipient,
  template: NotificationTemplate,
  title: string,
  body: string,
  deepLink: string,
  eventType: string,
  data: Record<string, any>,
  priority: string
): Promise<{ notificationId: string }> {
  const orderId = typeof data.orderId === "string" && mongoose.Types.ObjectId.isValid(data.orderId)
    ? data.orderId
    : undefined;

  // Map P0-P3 priority to existing model's priority values
  const priorityMap: Record<string, "high" | "normal" | "low"> = {
    P0: "high",
    P1: "high",
    P2: "normal",
    P3: "low",
  };

  const notificationDoc: any = {
    userId: new mongoose.Types.ObjectId(recipient.userId),
    title,
    message: body,
    body,
    eventType,
    meta: data,
    category: template.category,
    priority: priorityMap[priority] || "normal",
    isRead: false,
    ...(deepLink ? { deepLink } : {}),
    ...(orderId ? { orderId: new mongoose.Types.ObjectId(orderId) } : {}),
  };

  const notification = await Notification.create(notificationDoc);
  return { notificationId: notification._id.toString() };
}

/**
 * Delivers notification via Push channel using PushGateway (batched).
 */
async function deliverPush(
  recipient: Recipient,
  title: string,
  body: string,
  data: Record<string, any>,
  sound: boolean,
  category?: string
): Promise<void> {
  const pushMessage: PushMessage = {
    userId: recipient.userId,
    title,
    body,
    data: {
      ...data,
    },
    category: category as any,
    sound,
    priority: sound ? "high" : "default",
  };

  await sendPush(pushMessage);
}

/**
 * Delivers notification via Socket channel using Socket Emitter.
 */
function deliverSocket(
  recipient: Recipient,
  notificationId: string,
  title: string,
  body: string,
  template: NotificationTemplate,
  deepLink: string,
  priority: string
): void {
  if (!socketEmitter) {
    logger.warn("[NotificationOrchestrator] Socket emitter not initialized, skipping socket delivery");
    return;
  }

  const dto: NotificationDTO = {
    id: notificationId,
    title,
    body,
    category: template.category,
    priority,
    deepLink: deepLink || undefined,
    createdAt: new Date().toISOString(),
  };

  socketEmitter.emitNotificationNew(recipient.userId, dto);
}

/**
 * Emits updated unread count via socket after notification creation.
 * Uses Redis cache for fast retrieval.
 */
async function emitUnreadCount(userId: string): Promise<void> {
  if (!socketEmitter) return;

  try {
    const count = await getUnreadCountCached(userId);
    socketEmitter.emitUnreadCount(userId, count);
  } catch (err) {
    logger.error("[NotificationOrchestrator] Failed to emit unread count", {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
  }
}

// ─── Main Orchestration Handler ───────────────────────────────────────────────

/**
 * Processes a single recipient for a given event.
 * Handles template resolution, channel routing, priority, and fan-out.
 */
async function processRecipient(
  recipient: Recipient,
  eventType: string,
  data: Record<string, any>,
  eventId: string
): Promise<void> {
  // Step 2: Resolve template
  const template = resolveTemplate(eventType, recipient.role);

  if (!template) {
    logger.warn("[NotificationOrchestrator] No template found for event, skipping", {
      eventType,
      role: recipient.role,
      userId: recipient.userId,
    });
    return;
  }

  // Interpolate title, body, deepLink
  const title = interpolateTemplate(template.title, data);
  const body = interpolateTemplate(template.body, data);
  const deepLink = interpolateTemplate(template.deepLinkPattern, data);

  // Step 5: Classify priority
  const priority = classifyPriority(eventType);
  const behavior = getDeliveryBehavior(priority);

  // Step 4: Determine active channels via Channel Router
  const activeChannels = await determineChannels(
    recipient.userId,
    template.category as any,
    priority,
    template.channels as DeliveryChannel[]
  );

  if (activeChannels.length === 0) {
    logger.info("[NotificationOrchestrator] No active channels for recipient, skipping", {
      eventType,
      role: recipient.role,
      userId: recipient.userId,
    });
    return;
  }

  // Step 6: Fan-out to active channels (independent failure handling)
  const channelResults: ChannelResult[] = [];
  let notificationId: string | undefined;

  // In-App channel
  if (activeChannels.includes("in_app")) {
    try {
      const result = await deliverInApp(
        recipient,
        template,
        title,
        body,
        deepLink,
        eventType,
        data,
        priority
      );
      notificationId = result.notificationId;
      channelResults.push({ channel: "in_app", status: "success" });

      // Increment Redis cached unread count for this user
      await incrementUnreadCount(recipient.userId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("[NotificationOrchestrator] In-App delivery failed", {
        error: errorMsg,
        userId: recipient.userId,
        eventType,
      });
      channelResults.push({ channel: "in_app", status: "failed", error: errorMsg });
    }
  }

  // Push channel
  if (activeChannels.includes("push")) {
    try {
      await deliverPush(recipient, title, body, data, behavior.sound, template.category);
      channelResults.push({ channel: "push", status: "success" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("[NotificationOrchestrator] Push delivery failed", {
        error: errorMsg,
        userId: recipient.userId,
        eventType,
      });
      channelResults.push({ channel: "push", status: "failed", error: errorMsg });

      // Enqueue retry for non-token-invalid errors
      const isTokenInvalid = errorMsg.toLowerCase().includes("devicenotregistered") ||
        errorMsg.toLowerCase().includes("token") && errorMsg.toLowerCase().includes("invalid");

      if (!isTokenInvalid && notificationId) {
        await enqueuePushRetry({
          notificationId,
          userId: recipient.userId,
          title,
          body,
          data,
          error: errorMsg,
        });
      }
    }
  }

  // Socket channel
  if (activeChannels.includes("socket")) {
    try {
      // Use the notification ID from in-app creation, or generate a placeholder
      const socketNotifId = notificationId || new mongoose.Types.ObjectId().toString();
      deliverSocket(recipient, socketNotifId, title, body, template, deepLink, priority);
      channelResults.push({ channel: "socket", status: "success" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("[NotificationOrchestrator] Socket delivery failed", {
        error: errorMsg,
        userId: recipient.userId,
        eventType,
      });
      channelResults.push({ channel: "socket", status: "failed", error: errorMsg });
    }
  }

  // Emit updated unread count after in-app notification creation
  if (notificationId && activeChannels.includes("socket")) {
    try {
      await emitUnreadCount(recipient.userId);
    } catch {
      // Non-critical — don't fail orchestration
    }
  }

  // Step 7: Audit log entry (never throws or blocks delivery)
  await logNotificationAudit({
    notificationId: notificationId || new mongoose.Types.ObjectId().toString(),
    eventId,
    eventType,
    userId: recipient.userId,
    actor: { type: data.actorType || "system", id: data.actorId },
    source: data.source || eventType,
    channels: channelResults.map((cr) => ({
      channel: cr.channel,
      status: cr.status === "success" ? "sent" : "failed",
      sentAt: new Date(),
      ...(cr.error ? { error: cr.error } : {}),
    })),
    priority,
    category: template.category,
  });
}

// ─── Event Handler ────────────────────────────────────────────────────────────

/**
 * Main event handler subscribed to the EventBus.
 */
async function handleEvent(event: BaseEvent): Promise<void> {
  // Feature flag check
  if (!isOrchestratorEnabled()) {
    return;
  }

  const eventId = String(event?.eventId || "");
  const eventType = String(event?.eventType || "");

  if (!eventId || !eventType) return;

  const data = (event?.data || {}) as Record<string, any>;

  // Step 1: Deduplicate using ProcessedEvent
  try {
    await ProcessedEvent.create({
      eventId,
      consumerName: CONSUMER_NAME,
      processedAt: new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Already processed by this consumer — skip
      logger.info("[NotificationOrchestrator] Event already processed, skipping", {
        eventId,
        eventType,
        consumerName: CONSUMER_NAME,
      });
      return;
    }
    // Unexpected error — rethrow so outbox retries
    throw err;
  }

  logger.info("[NotificationOrchestrator] Processing event", {
    eventId,
    eventType,
  });

  // Step 3: Determine target recipients
  const recipients = await resolveRecipients(eventType, data);

  if (recipients.length === 0) {
    logger.warn("[NotificationOrchestrator] No recipients resolved for event", {
      eventId,
      eventType,
    });
    return;
  }

  // Process each recipient independently
  for (const recipient of recipients) {
    try {
      await processRecipient(recipient, eventType, data, eventId);
    } catch (err) {
      logger.error("[NotificationOrchestrator] Failed to process recipient", {
        error: err instanceof Error ? err.message : String(err),
        eventId,
        eventType,
        userId: recipient.userId,
        role: recipient.role,
      });
      // Continue with other recipients — one failure doesn't block others
    }
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize the Notification Orchestrator event consumer.
 *
 * Subscribes to the EventBus and processes all notification-worthy events.
 * Controlled by the NOTIFICATION_ORCHESTRATOR_ENABLED environment variable.
 *
 * @param app - Express application instance (required for Socket.IO access)
 */
export function initializeNotificationOrchestrator(app?: Application): void {
  if (initialized) return;
  initialized = true;

  // Initialize socket emitter if app is provided
  if (app) {
    socketEmitter = createSocketEmitter(app);
  }

  subscribe(handleEvent);

  logger.info("[NotificationOrchestrator] Notification orchestrator initialized", {
    featureFlag: isOrchestratorEnabled() ? "enabled" : "disabled",
  });
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

export {
  handleEvent as _handleEvent,
  resolveRecipients as _resolveRecipients,
  processRecipient as _processRecipient,
  CONSUMER_NAME,
  ADMIN_ALERT_EVENTS,
  DELIVERY_PARTNER_EVENTS,
};

/**
 * Reset the initialized state (for testing only).
 */
export function _resetOrchestrator(): void {
  initialized = false;
  socketEmitter = null;
}

/**
 * Set a custom socket emitter (for testing only).
 */
export function _setSocketEmitter(emitter: ISocketEmitter | null): void {
  socketEmitter = emitter;
}
