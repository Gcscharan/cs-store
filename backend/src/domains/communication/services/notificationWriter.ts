import mongoose from "mongoose";
import Notification from "../../../models/Notification";
import ProcessedEvent from "../../../models/ProcessedEvent";
import { BaseEvent } from "../../events/BaseEvent";
import { subscribe } from "../../events/eventBus";

let initialized = false;

function inferNotificationMapping(eventType: string): {
  category: "order" | "delivery" | "payment" | "account" | "promo";
  priority: "high" | "normal" | "low";
  defaultDeepLink?: string;
} | null {
  if (eventType.startsWith("ORDER_")) {
    return { category: "order", priority: "high" };
  }
  if (eventType.startsWith("DELIVERY_")) {
    return { category: "delivery", priority: "high" };
  }
  if (eventType.startsWith("PAYMENT_") || eventType.startsWith("REFUND_")) {
    return { category: "payment", priority: "high" };
  }
  if (eventType.startsWith("ACCOUNT_")) {
    return { category: "account", priority: "normal", defaultDeepLink: "/account/settings" };
  }
  if (eventType.startsWith("PROMO_") || eventType === "SYSTEM_ANNOUNCEMENT") {
    return { category: "promo", priority: "low" };
  }
  return null;
}

function defaultTitleForEvent(eventType: string): string {
  if (eventType === "ORDER_CREATED") {
    return "Order placed successfully";
  }
  return eventType.replace(/_/g, " ");
}

function defaultBodyForEvent(eventType: string, data: Record<string, any>): string {
  return `${defaultTitleForEvent(eventType)}`;
}

export function initializeNotificationWriter(): void {
  if (initialized) return;
  initialized = true;

  subscribe(async (event: BaseEvent) => {
    const eventId = String(event?.eventId || "");
    const eventType = String(event?.eventType || "");

    if (!eventId || !eventType) return;

    const mapping = inferNotificationMapping(eventType);
    if (!mapping) return;

    const data = (event?.data || {}) as Record<string, any>;
    const userIdRaw = data.userId;
    if (!userIdRaw || typeof userIdRaw !== "string") return;

    if (!mongoose.Types.ObjectId.isValid(userIdRaw)) return;

    const orderId = typeof data.orderId === "string" ? data.orderId : undefined;
    if (
      (mapping.category === "order" || mapping.category === "delivery" || mapping.category === "payment") &&
      (!orderId || !mongoose.Types.ObjectId.isValid(orderId))
    ) {
      return;
    }

    let processedCreated = false;
    try {
      await ProcessedEvent.create({ eventId, processedAt: new Date() });
      processedCreated = true;
    } catch (err: any) {
      if (err?.code === 11000) {
        return;
      }
      throw err;
    }

    const title = typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : defaultTitleForEvent(eventType);

    const body = typeof data.body === "string" && data.body.trim()
      ? data.body.trim()
      : defaultBodyForEvent(eventType, data);

    const deepLinkFromData = typeof data.deepLink === "string" && data.deepLink.trim()
      ? data.deepLink.trim()
      : undefined;

    let deepLink: string | undefined;
    if ((mapping.category === "order" || mapping.category === "delivery" || mapping.category === "payment") && orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      deepLink = `/orders/${orderId}`;
    } else if (mapping.category === "account") {
      deepLink = mapping.defaultDeepLink;
    } else if (mapping.category === "promo") {
      deepLink = deepLinkFromData;
    }

    const notificationDoc: any = {
      userId: new mongoose.Types.ObjectId(userIdRaw),
      title,
      message: body,
      body,
      eventType,
      ...(data && typeof data === "object" ? { meta: data } : {}),
      category: mapping.category,
      priority: mapping.priority,
      isRead: false,
      ...(deepLink ? { deepLink } : {}),
    };

    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      notificationDoc.orderId = new mongoose.Types.ObjectId(orderId);
    }

    try {
      await Notification.create(notificationDoc);
    } catch (err) {
      if (processedCreated) {
        try {
          await ProcessedEvent.deleteOne({ eventId });
        } catch {
          // best-effort
        }
      }
      throw err;
    }
  });
}
