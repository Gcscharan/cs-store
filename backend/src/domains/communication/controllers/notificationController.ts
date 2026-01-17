import { Request, Response } from "express";
import mongoose from "mongoose";
import Notification from "../../../models/Notification";
import { AuthRequest } from "../../../middleware/auth";
import { dispatchNotification, NotificationEvent } from "../services/notificationService";

type NotificationCategory = "order" | "delivery" | "payment" | "account" | "promo";
type NotificationPriority = "high" | "normal" | "low";

type NotificationDTO = {
  id: string;
  title: string;
  body: string;
  eventType?: string;
  meta?: Record<string, any>;
  category: NotificationCategory;
  priority: NotificationPriority;
  isRead: boolean;
  deepLink?: string;
  createdAt: string;
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function encodeCursor(input: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: input.createdAt.toISOString(), id: input.id })
  ).toString("base64");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(String(cursor), "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    const createdAt = new Date(parsed?.createdAt);
    const id = String(parsed?.id || "");
    if (!id || !Number.isFinite(createdAt.getTime())) return null;
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function parseCategoryFilter(value: unknown): NotificationCategory | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (["order", "delivery", "payment", "account", "promo"].includes(raw)) {
    return raw as NotificationCategory;
  }
  return null;
}

function buildCategoryMongoFilter(category: NotificationCategory): any {
  if (category === "order") {
    return {
      $or: [
        { category: "order" },
        { orderId: { $exists: true, $ne: null } },
        { type: "order_update" },
      ],
    };
  }

  if (category === "delivery") {
    return {
      $or: [{ category: "delivery" }, { type: "delivery_otp" }],
    };
  }

  if (category === "account") {
    return {
      $or: [{ category: "account" }, { category: { $exists: false } }, { category: null }],
    };
  }

  return { category };
}

function mapLegacyToCategory(input: any): NotificationCategory {
  const explicit = String(input?.category || "");
  if (["order", "delivery", "payment", "account", "promo"].includes(explicit)) {
    return explicit as NotificationCategory;
  }

  const type = String(input?.type || "");
  const hasOrder = !!input?.orderId;
  if (hasOrder) return "order";
  if (type === "delivery_otp") return "delivery";
  if (type === "order_update") return "order";
  return "account";
}

function defaultPriorityForCategory(category: NotificationCategory): NotificationPriority {
  if (category === "order" || category === "delivery" || category === "payment") return "high";
  return "normal";
}

function sanitizeMeta(input: any): Record<string, any> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const meta = { ...(input as any) };

  delete (meta as any).userId;
  delete (meta as any).orderId;
  delete (meta as any).paymentId;
  delete (meta as any).trackingNumber;
  delete (meta as any).eventId;
  delete (meta as any).source;

  return meta;
}

function mapNotificationToDTO(notification: any): NotificationDTO {
  const id = String(notification?._id || "");
  const title = String(notification?.title || "");
  const body = String(notification?.body ?? notification?.message ?? "");
  const eventType = typeof notification?.eventType === "string" ? notification.eventType : undefined;
  const meta = sanitizeMeta(notification?.meta);
  const category = mapLegacyToCategory(notification);
  const priorityRaw = String(notification?.priority || "");
  const priority: NotificationPriority = ([
    "high",
    "normal",
    "low",
  ].includes(priorityRaw)
    ? (priorityRaw as NotificationPriority)
    : defaultPriorityForCategory(category));

  const deepLink =
    typeof notification?.deepLink === "string" && notification.deepLink.trim()
      ? String(notification.deepLink)
      : notification?.orderId
        ? `/orders/${String(notification.orderId)}`
        : undefined;

  return {
    id,
    title,
    body,
    ...(eventType ? { eventType } : {}),
    ...(meta ? { meta } : {}),
    category,
    priority,
    isRead: Boolean(notification?.isRead),
    ...(deepLink ? { deepLink } : {}),
    createdAt: new Date(notification?.createdAt || Date.now()).toISOString(),
  };
}

/**
 * Get notifications in canonical v2 shape with cursor pagination
 * GET /api/notifications/v2
 */
export const getNotificationsV2 = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const limit = clampInt((req as any).query?.limit, 1, 50, 20);
    const cursorRaw = String((req as any).query?.cursor || "");
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;

    const categoryRaw = (req as any).query?.category;
    const category = categoryRaw ? parseCategoryFilter(categoryRaw) : null;
    if (categoryRaw && !category) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const andConditions: any[] = [
      { userId: user._id },
    ];
    if (category) {
      andConditions.push(buildCategoryMongoFilter(category));
    }
    if (cursor) {
      andConditions.push({
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            _id: { $lt: new mongoose.Types.ObjectId(cursor.id) },
          },
        ],
      });
    }
    const baseFilter: any = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    const docs = await Notification.find(baseFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;
    const notifications = pageDocs.map(mapNotificationToDTO);

    const last = pageDocs.length ? pageDocs[pageDocs.length - 1] : null;
    const nextCursor = hasMore && last?._id && last?.createdAt
      ? encodeCursor({ createdAt: new Date(last.createdAt), id: String(last._id) })
      : undefined;

    res.json({
      notifications,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    });
  } catch (error) {
    console.error("Error fetching notifications v2:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};


/**
 * Get all notifications for authenticated user
 * GET /api/notifications
 */
export const getNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 }) // Newest first
      .limit(50); // Limit to 50 most recent

    res.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 */
export const markAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: user._id,
    });

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    await Notification.updateMany(
      {
        userId: user._id,
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:notificationId
 */
export const deleteNotification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: user._id,
    });

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread/count
 */
export const getUnreadCount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const count = await Notification.countDocuments({
      userId: user._id,
      isRead: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
};

/**
 * Trigger multi-channel test notifications for the authenticated user
 * POST /api/notifications/test-all-channels
 */
export const sendTestNotificationsAllChannels = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const userId = user._id.toString();

    // Representative events that exercise different categories/subcategories
    const testEvents: NotificationEvent[] = [
      "ORDER_CONFIRMED",      // myOrders
      "CART_REMINDER",        // reminders_cart
      "PAYMENT_REMINDER",     // reminders_payment
      "PRODUCT_RESTOCK",      // reminders_restock
      "NEW_OFFER",            // newOffers
      "PRODUCT_RECOMMENDATION", // recommendations
      "NEW_PRODUCT_ALERT",    // newProductAlerts
      "FEEDBACK_REQUEST",     // feedback
    ];

    const results: { event: NotificationEvent; success: boolean; error?: string }[] = [];

    for (const event of testEvents) {
      try {
        await dispatchNotification(userId, event, {
          orderId: "TEST_ORDER_ID",
          orderNumber: "TEST-ORDER-123",
          productId: "TEST_PRODUCT_ID",
          productName: "CS Store Test Product",
          amount: 123,
          paymentId: "TEST_PAYMENT_ID",
          trackingNumber: "TRACK123",
          offerTitle: "Test Offer for Multi-Channel Notification",
          cartItems: [
            { name: "Test Item 1", quantity: 1, price: 99 },
            { name: "Test Item 2", quantity: 2, price: 149 },
          ],
          isTestNotification: true,
          testScenario: `multi-channel-${event}`,
        });

        results.push({ event, success: true });
      } catch (err) {
        console.error(`Error dispatching test event ${event} for user ${userId}:`, err);
        results.push({
          event,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    res.json({
      success: true,
      message: "Multi-channel test notifications dispatched",
      userId,
      results,
    });
  } catch (error) {
    console.error("Error in sendTestNotificationsAllChannels:", error);
    res
      .status(500)
      .json({ error: "Failed to dispatch multi-channel test notifications" });
  }
};
