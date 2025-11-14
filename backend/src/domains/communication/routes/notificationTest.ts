import express from 'express';
import { dispatchNotification, NotificationUtils } from '../services/notificationService';
import { authenticateToken } from '../../../middleware/auth';
import { sendTestNotificationsAllChannels } from '../controllers/notificationController';

const router = express.Router();

/**
 * Test notification dispatch
 * POST /api/notification-test/dispatch
 */
router.post('/dispatch', authenticateToken, async (req, res) => {
  try {
    const { event, data } = req.body;
    const userId = (req as any).user._id.toString();

    await dispatchNotification(userId, event, data || {});

    res.json({
      success: true,
      message: `Test notification sent: ${event}`,
      userId
    });
  } catch (error) {
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
router.post('/test-all-channels', authenticateToken, sendTestNotificationsAllChannels);

/**
 * Test cart reminder system
 * POST /api/notification-test/cart-reminders
 */
router.post('/cart-reminders', authenticateToken, async (req, res) => {
  try {
    const { hours = 1 } = req.body; // Default to 1 hour for testing
    
    await NotificationUtils.sendCartReminders(hours);

    res.json({
      success: true,
      message: `Cart reminders processed for ${hours} hours`
    });
  } catch (error) {
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
router.post('/payment-reminders', authenticateToken, async (req, res) => {
  try {
    await NotificationUtils.sendPaymentReminders();

    res.json({
      success: true,
      message: 'Payment reminders processed'
    });
  } catch (error) {
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

export default router;
