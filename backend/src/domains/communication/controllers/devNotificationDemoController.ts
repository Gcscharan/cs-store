import { Request, Response } from "express";
import mongoose from "mongoose";
import { logger } from "../../../utils/logger";
import { publish } from "../../events/eventBus";
import { BaseEvent } from "../../events/BaseEvent";
import { v4 as uuidv4 } from "uuid";

/**
 * Dev-only demo notification endpoint.
 *
 * Sends a fully custom notification through the complete Notification Orchestrator
 * pipeline (persist → unread count → socket emit → toast → push → audit → lifecycle).
 *
 * POST /api/dev/notifications/demo
 * Body: { userId, title, body, category, priority, deepLink }
 *
 * The `category` selects a dedicated DEMO_* template so the in-app toast and
 * notification center render with the correct icon/accent theming. Every demo
 * template includes the "socket" channel, which is what fires the header toast.
 *
 * Admin-only, disabled in production.
 */

type DemoBody = {
  userId?: unknown;
  title?: unknown;
  body?: unknown;
  category?: unknown;
  priority?: unknown;
  deepLink?: unknown;
};

const VALID_CATEGORIES = ["order", "delivery", "payment", "account", "promo"] as const;
type DemoCategory = (typeof VALID_CATEGORIES)[number];

const CATEGORY_TO_EVENT_TYPE: Record<DemoCategory, string> = {
  order: "DEMO_ORDER",
  delivery: "DEMO_DELIVERY",
  payment: "DEMO_PAYMENT",
  account: "DEMO_ACCOUNT",
  promo: "DEMO_PROMO",
};

export const sendDemoNotification = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).send("Not found");
    return;
  }

  const payload = (req.body || {}) as DemoBody;

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "🎉 Demo Notification";
  const body =
    typeof payload.body === "string"
      ? payload.body.trim()
      : "This is a test notification from the new notification system.";
  const category = (typeof payload.category === "string" ? payload.category.trim() : "promo") as DemoCategory;
  const deepLink = typeof payload.deepLink === "string" ? payload.deepLink.trim() : "/notifications";

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).json({ error: "userId must be a valid ObjectId" });
    return;
  }

  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
    return;
  }

  const eventType = CATEGORY_TO_EVENT_TYPE[category];

  const event: BaseEvent = {
    eventId: uuidv4(),
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: { type: "system", id: "demo" },
    source: "devDemo",
    data: {
      userId,
      // Interpolated by the DEMO_* templates
      demoTitle: title,
      demoBody: body,
      demoDeepLink: deepLink,
    },
  };

  try {
    await publish(event);
    logger.info("[DevDemo] Demo notification published", {
      userId,
      eventId: event.eventId,
      eventType,
      category,
    });

    res.status(202).json({
      success: true,
      message: "Demo notification published through the Notification Orchestrator pipeline.",
      eventId: event.eventId,
      eventType,
      target: { userId },
      payload: { title, body, category, deepLink },
      delivered: {
        persisted: true,
        unreadCountIncremented: true,
        socketEmitted: true,
        toastTriggered: true,
        pushAttempted: true,
        auditLogged: true,
      },
    });
  } catch (err) {
    logger.error("[DevDemo] Failed to publish demo notification", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Failed to send demo notification" });
  }
};
