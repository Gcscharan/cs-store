"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestNotificationsAllChannels = exports.getUnreadCount = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = exports.getNotificationsV2 = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = __importDefault(require("../../../models/Notification"));
const notificationService_1 = require("../services/notificationService");
function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
}
function encodeCursor(input) {
    return Buffer.from(JSON.stringify({ createdAt: input.createdAt.toISOString(), id: input.id })).toString("base64");
}
function decodeCursor(cursor) {
    try {
        const raw = Buffer.from(String(cursor), "base64").toString("utf8");
        const parsed = JSON.parse(raw);
        const createdAt = new Date(parsed?.createdAt);
        const id = String(parsed?.id || "");
        if (!id || !Number.isFinite(createdAt.getTime()))
            return null;
        if (!mongoose_1.default.Types.ObjectId.isValid(id))
            return null;
        return { createdAt, id };
    }
    catch {
        return null;
    }
}
function parseCategoryFilter(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return null;
    if (["order", "delivery", "payment", "account", "promo"].includes(raw)) {
        return raw;
    }
    return null;
}
function buildCategoryMongoFilter(category) {
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
function mapLegacyToCategory(input) {
    const explicit = String(input?.category || "");
    if (["order", "delivery", "payment", "account", "promo"].includes(explicit)) {
        return explicit;
    }
    const type = String(input?.type || "");
    const hasOrder = !!input?.orderId;
    if (hasOrder)
        return "order";
    if (type === "delivery_otp")
        return "delivery";
    if (type === "order_update")
        return "order";
    return "account";
}
function defaultPriorityForCategory(category) {
    if (category === "order" || category === "delivery" || category === "payment")
        return "high";
    return "normal";
}
function sanitizeMeta(input) {
    if (!input || typeof input !== "object")
        return undefined;
    const meta = { ...input };
    delete meta.userId;
    delete meta.orderId;
    delete meta.paymentId;
    delete meta.trackingNumber;
    delete meta.eventId;
    delete meta.source;
    return meta;
}
function mapNotificationToDTO(notification) {
    const id = String(notification?._id || "");
    const title = String(notification?.title || "");
    const body = String(notification?.body ?? notification?.message ?? "");
    const eventType = typeof notification?.eventType === "string" ? notification.eventType : undefined;
    const meta = sanitizeMeta(notification?.meta);
    const category = mapLegacyToCategory(notification);
    const priorityRaw = String(notification?.priority || "");
    const priority = ([
        "high",
        "normal",
        "low",
    ].includes(priorityRaw)
        ? priorityRaw
        : defaultPriorityForCategory(category));
    const deepLink = typeof notification?.deepLink === "string" && notification.deepLink.trim()
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
const getNotificationsV2 = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const limit = clampInt(req.query?.limit, 1, 50, 20);
        const cursorRaw = String(req.query?.cursor || "");
        const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
        const categoryRaw = req.query?.category;
        const category = categoryRaw ? parseCategoryFilter(categoryRaw) : null;
        if (categoryRaw && !category) {
            res.status(400).json({ error: "Invalid category" });
            return;
        }
        const andConditions = [
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
                        _id: { $lt: new mongoose_1.default.Types.ObjectId(cursor.id) },
                    },
                ],
            });
        }
        const baseFilter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
        const docs = await Notification_1.default.find(baseFilter)
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
    }
    catch (error) {
        console.error("Error fetching notifications v2:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};
exports.getNotificationsV2 = getNotificationsV2;
/**
 * Get all notifications for authenticated user
 * GET /api/notifications
 */
const getNotifications = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const notifications = await Notification_1.default.find({ userId: user._id })
            .sort({ createdAt: -1 }) // Newest first
            .limit(50); // Limit to 50 most recent
        res.json({
            success: true,
            notifications,
            count: notifications.length,
        });
    }
    catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};
exports.getNotifications = getNotifications;
/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 */
const markAsRead = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const { notificationId } = req.params;
        const notification = await Notification_1.default.findOne({
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
    }
    catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ error: "Failed to update notification" });
    }
};
exports.markAsRead = markAsRead;
/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        await Notification_1.default.updateMany({
            userId: user._id,
            isRead: false,
        }, { $set: { isRead: true } });
        res.json({
            success: true,
            message: "All notifications marked as read",
        });
    }
    catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ error: "Failed to update notifications" });
    }
};
exports.markAllAsRead = markAllAsRead;
/**
 * Delete a notification
 * DELETE /api/notifications/:notificationId
 */
const deleteNotification = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const { notificationId } = req.params;
        const notification = await Notification_1.default.findOneAndDelete({
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
    }
    catch (error) {
        console.error("Error deleting notification:", error);
        res.status(500).json({ error: "Failed to delete notification" });
    }
};
exports.deleteNotification = deleteNotification;
/**
 * Get unread notification count
 * GET /api/notifications/unread/count
 */
const getUnreadCount = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const count = await Notification_1.default.countDocuments({
            userId: user._id,
            isRead: false,
        });
        res.json({
            success: true,
            count,
        });
    }
    catch (error) {
        console.error("Error fetching unread count:", error);
        res.status(500).json({ error: "Failed to fetch unread count" });
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * Trigger multi-channel test notifications for the authenticated user
 * POST /api/notifications/test-all-channels
 */
const sendTestNotificationsAllChannels = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }
        const userId = user._id.toString();
        // Representative events that exercise different categories/subcategories
        const testEvents = [
            "ORDER_CONFIRMED", // myOrders
            "CART_REMINDER", // reminders_cart
            "PAYMENT_REMINDER", // reminders_payment
            "PRODUCT_RESTOCK", // reminders_restock
            "NEW_OFFER", // newOffers
            "PRODUCT_RECOMMENDATION", // recommendations
            "NEW_PRODUCT_ALERT", // newProductAlerts
            "FEEDBACK_REQUEST", // feedback
        ];
        const results = [];
        for (const event of testEvents) {
            try {
                await (0, notificationService_1.dispatchNotification)(userId, event, {
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
            }
            catch (err) {
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
    }
    catch (error) {
        console.error("Error in sendTestNotificationsAllChannels:", error);
        res
            .status(500)
            .json({ error: "Failed to dispatch multi-channel test notifications" });
    }
};
exports.sendTestNotificationsAllChannels = sendTestNotificationsAllChannels;
