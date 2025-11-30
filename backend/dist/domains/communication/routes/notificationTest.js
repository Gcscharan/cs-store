"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationService_1 = require("../services/notificationService");
const auth_1 = require("../../../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
/**
 * Test notification dispatch
 * POST /api/notification-test/dispatch
 */
router.post('/dispatch', auth_1.authenticateToken, async (req, res) => {
    try {
        const { event, data } = req.body;
        const userId = req.user._id.toString();
        await (0, notificationService_1.dispatchNotification)(userId, event, data || {});
        res.json({
            success: true,
            message: `Test notification sent: ${event}`,
            userId
        });
    }
    catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({
            error: 'Failed to send test notification'
        });
    }
});
/**
 * Multi-channel test notifications for current user
 * POST /api/notification-test/test-all-channels
 */
router.post('/test-all-channels', auth_1.authenticateToken, notificationController_1.sendTestNotificationsAllChannels);
/**
 * Test cart reminder system
 * POST /api/notification-test/cart-reminders
 */
router.post('/cart-reminders', auth_1.authenticateToken, async (req, res) => {
    try {
        const { hours = 1 } = req.body; // Default to 1 hour for testing
        await notificationService_1.NotificationUtils.sendCartReminders(hours);
        res.json({
            success: true,
            message: `Cart reminders processed for ${hours} hours`
        });
    }
    catch (error) {
        console.error('Cart reminder test error:', error);
        res.status(500).json({
            error: 'Failed to process cart reminders'
        });
    }
});
/**
 * Test payment reminder system
 * POST /api/notification-test/payment-reminders
 */
router.post('/payment-reminders', auth_1.authenticateToken, async (req, res) => {
    try {
        await notificationService_1.NotificationUtils.sendPaymentReminders();
        res.json({
            success: true,
            message: 'Payment reminders processed'
        });
    }
    catch (error) {
        console.error('Payment reminder test error:', error);
        res.status(500).json({
            error: 'Failed to process payment reminders'
        });
    }
});
/**
 * Get supported notification events
 * GET /api/notification-test/events
 */
router.get('/events', (req, res) => {
    const events = [
        'ORDER_CONFIRMED',
        'ORDER_SHIPPED',
        'ORDER_DELIVERED',
        'ORDER_CANCELLED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'CART_REMINDER',
        'PAYMENT_REMINDER',
        'PRODUCT_RESTOCK',
        'NEW_OFFER',
        'PRODUCT_RECOMMENDATION',
        'FEEDBACK_REQUEST'
    ];
    res.json({
        success: true,
        events,
        message: 'Available notification events'
    });
});
exports.default = router;
