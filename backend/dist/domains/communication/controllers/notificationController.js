"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestNotificationsAllChannels = exports.getUnreadCount = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const Notification_1 = __importDefault(require("../../../models/Notification"));
const notificationService_1 = require("../services/notificationService");
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
        await Notification_1.default.updateMany({ userId: user._id, isRead: false }, { $set: { isRead: true } });
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
