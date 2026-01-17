import { Response } from "express";
import mongoose from "mongoose";
import Notification from "../../../models/Notification";
import { AuthRequest } from "../../../middleware/auth";

type NotificationCategory = "order" | "delivery" | "payment" | "account" | "promo";
type NotificationPriority = "high" | "normal" | "low";

type EmitNotificationRequestBody = {
  title?: unknown;
  body?: unknown;
  category?: unknown;
  priority?: unknown;
  deepLink?: unknown;
};

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return (
    typeof value === "string" &&
    ["order", "delivery", "payment", "account", "promo"].includes(value)
  );
}

function isNotificationPriority(value: unknown): value is NotificationPriority {
  return (
    typeof value === "string" &&
    ["high", "normal", "low"].includes(value)
  );
}

function defaultPriorityForCategory(category: NotificationCategory): NotificationPriority {
  if (category === "order" || category === "delivery" || category === "payment") return "high";
  if (category === "promo") return "low";
  return "normal";
}

export const emitDevNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).send("Not found");
    return;
  }

  try {
    const actor = req.user;
    if (!actor) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const body = (req.body || {}) as EmitNotificationRequestBody;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    if (!messageBody) {
      res.status(400).json({ error: "body is required" });
      return;
    }

    if (!isNotificationCategory(body.category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const category = body.category;

    let priority: NotificationPriority;
    if (typeof body.priority === "undefined" || body.priority === null || body.priority === "") {
      priority = defaultPriorityForCategory(category);
    } else if (isNotificationPriority(body.priority)) {
      priority = body.priority;
    } else {
      res.status(400).json({ error: "Invalid priority" });
      return;
    }

    const deepLink = typeof body.deepLink === "string" && body.deepLink.trim() ? body.deepLink.trim() : undefined;

    const targetUserId = String(actor._id);

    const created = await Notification.create({
      userId: new mongoose.Types.ObjectId(targetUserId),
      title,
      message: messageBody,
      body: messageBody,
      category,
      priority,
      deepLink,
      isRead: false,
    });

    res.status(201).json({
      id: String(created._id),
      title: String(created.title),
      body: String(created.body ?? created.message ?? ""),
      category,
      priority,
      isRead: Boolean(created.isRead),
      ...(deepLink ? { deepLink } : {}),
      createdAt: new Date(created.createdAt || Date.now()).toISOString(),
    });
  } catch (error) {
    console.error("Error emitting dev notification:", error);
    res.status(500).json({ error: "Failed to emit notification" });
  }
};
