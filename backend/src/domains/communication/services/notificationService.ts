import { User } from "../../../models/User";
import { sendEmail } from "./mailService";
import { sendSMS } from "../../../utils/sms";

// Notification Event Types
export type NotificationEvent = 
  | 'ORDER_CONFIRMED'
  | 'ORDER_SHIPPED'
  | 'ORDER_PICKED_UP'
  | 'ORDER_IN_TRANSIT'
  | 'ORDER_ARRIVED_AT_DESTINATION'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'CART_REMINDER'
  | 'PAYMENT_REMINDER'
  | 'PRODUCT_RESTOCK'
  | 'NEW_OFFER'
  | 'PRODUCT_RECOMMENDATION'
  | 'FEEDBACK_REQUEST'
  | 'NEW_PRODUCT_ALERT';

// Notification Data Interface
export interface NotificationData {
  orderId?: string;
  orderNumber?: string;
  productName?: string;
  productId?: string;
  amount?: number;
  paymentId?: string;
  trackingNumber?: string;
  deliveryDate?: Date;
  offerTitle?: string;
  cartItems?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  [key: string]: any;
}

// Event to Category Mapping
const eventCategoryMapping: Record<NotificationEvent, { category: string; subcategory?: string }> = {
  'ORDER_CONFIRMED': { category: 'myOrders' },
  'ORDER_SHIPPED': { category: 'myOrders' },
  'ORDER_PICKED_UP': { category: 'myOrders' },
  'ORDER_IN_TRANSIT': { category: 'myOrders' },
  'ORDER_ARRIVED_AT_DESTINATION': { category: 'myOrders' },
  'ORDER_DELIVERED': { category: 'myOrders' },
  'ORDER_CANCELLED': { category: 'myOrders' },
  'PAYMENT_SUCCESS': { category: 'silentPay' },
  'PAYMENT_FAILED': { category: 'silentPay' },
  'CART_REMINDER': { category: 'reminders', subcategory: 'reminders_cart' },
  'PAYMENT_REMINDER': { category: 'reminders', subcategory: 'reminders_payment' },
  'PRODUCT_RESTOCK': { category: 'reminders', subcategory: 'reminders_restock' },
  'NEW_OFFER': { category: 'newOffers' },
  'PRODUCT_RECOMMENDATION': { category: 'recommendations' },
  'FEEDBACK_REQUEST': { category: 'feedback' },
  'NEW_PRODUCT_ALERT': { category: 'newProductAlerts' },
};

/**
 * Core Notification Service - Central hub for all notifications
 * Reads user preferences and dispatches appropriate notifications
 */
export class NotificationService {
  /**
   * Main dispatch function - sends notifications based on user preferences
   */
  static async dispatchNotification(
    userId: string, 
    event: NotificationEvent, 
    data: NotificationData
  ): Promise<void> {
    try {
      console.log(`🔔 Dispatching notification: ${event} for user: ${userId}`);
      
      // Fetch user with preferences and contact info
      const user = await User.findById(userId).select('notificationPreferences email phone name');
      
      if (!user) {
        console.error(`❌ User not found: ${userId}`);
        return;
      }

      // Get event category mapping
      const eventMapping = eventCategoryMapping[event];
      if (!eventMapping) {
        console.error(`❌ No category mapping found for event: ${event}`);
        return;
      }

      const { category, subcategory } = eventMapping;
      const preferences = user.notificationPreferences || {};

      console.log(`📋 Checking preferences for category: ${category}${subcategory ? `, subcategory: ${subcategory}` : ''}`);

      // Check each channel and send if enabled
      await this.checkAndSendEmail(user, preferences, category, subcategory, event, data);
      await this.checkAndSendSMS(user, preferences, category, subcategory, event, data);
      await this.checkAndSendWhatsApp(user, preferences, category, subcategory, event, data);
      await this.checkAndSendPush(user, preferences, category, subcategory, event, data);

      console.log(`✅ Notification dispatch completed for event: ${event}`);
    } catch (error) {
      console.error(`❌ Error dispatching notification:`, error);
    }
  }

  /**
   * Batch dispatch function - sends notifications to all users with the preference enabled
   */
  static async dispatchToAllUsers(
    event: NotificationEvent, 
    data: NotificationData
  ): Promise<void> {
    try {
      console.log(`📢 Dispatching batch notification: ${event} to all eligible users`);
      
      // Get event category mapping
      const eventMapping = eventCategoryMapping[event];
      if (!eventMapping) {
        console.error(`❌ No category mapping found for event: ${event}`);
        return;
      }

      const { category, subcategory } = eventMapping;

      // Build query to find users who have this preference enabled in any channel
      const query: any = {
        $or: [
          { [`notificationPreferences.email.categories.${category}`]: true },
          { [`notificationPreferences.sms.categories.${category}`]: true },
          { [`notificationPreferences.whatsapp.categories.${category}`]: true },
          { [`notificationPreferences.push.categories.${category}`]: true },
          { [`notificationPreferences.desktop.categories.${category}`]: true },
          { [`notificationPreferences.inapp.categories.${category}`]: true }
        ]
      };

      // For subcategory events, check subcategory preferences
      if (subcategory) {
        query.$or = [
          { [`notificationPreferences.email.categories.${category}.subcategories.${subcategory}`]: true },
          { [`notificationPreferences.sms.categories.${category}.subcategories.${subcategory}`]: true },
          { [`notificationPreferences.whatsapp.categories.${category}.subcategories.${subcategory}`]: true },
          { [`notificationPreferences.push.categories.${category}.subcategories.${subcategory}`]: true },
          { [`notificationPreferences.desktop.categories.${category}.subcategories.${subcategory}`]: true },
          { [`notificationPreferences.inapp.categories.${category}.subcategories.${subcategory}`]: true }
        ];
      }

      // Fetch eligible users
      const eligibleUsers = await User.find(query).select('_id');
      console.log(`📊 Found ${eligibleUsers.length} eligible users for ${event}`);

      // Dispatch to each user individually (preserves individual preference checking)
      let successCount = 0;
      let errorCount = 0;

      for (const user of eligibleUsers) {
        try {
          await this.dispatchNotification(user._id.toString(), event, data);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to send ${event} to user ${user._id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Batch notification completed: ${successCount} sent, ${errorCount} failed`);
    } catch (error) {
      console.error(`❌ Error in batch notification dispatch:`, error);
    }
  }

  /**
   * Check and send email notification
   */
  private static async checkAndSendEmail(
    user: any, 
    preferences: any, 
    category: string, 
    subcategory: string | undefined, 
    event: NotificationEvent, 
    data: NotificationData
  ): Promise<void> {
    try {
      const emailPrefs = preferences.email;
      if (!emailPrefs?.enabled) {
        console.log(`📧 Email disabled for user: ${user._id}`);
        return;
      }

      // Check category permission
      let hasPermission = false;
      if (subcategory) {
        // Check subcategory permission (for reminders)
        const categoryPref = emailPrefs.categories?.[category];
        hasPermission = categoryPref?.enabled && categoryPref?.subcategories?.[subcategory];
      } else {
        // Check main category permission
        hasPermission = emailPrefs.categories?.[category];
      }

      if (!hasPermission) {
        console.log(`📧 Email not permitted for ${category}${subcategory ? `/${subcategory}` : ''}: ${user._id}`);
        return;
      }

      if (!user.email) {
        console.log(`📧 No email address for user: ${user._id}`);
        return;
      }

      // Generate and send email
      const { subject, html } = this.generateEmailContent(event, data, user.name);
      await sendEmail({
        to: user.email,
        subject,
        html
      });

      console.log(`✅ Email sent for ${event} to: ${user.email}`);
    } catch (error) {
      console.error(`❌ Email send error:`, error);
    }
  }

  /**
   * Check and send SMS notification
   */
  private static async checkAndSendSMS(
    user: any, 
    preferences: any, 
    category: string, 
    subcategory: string | undefined, 
    event: NotificationEvent, 
    data: NotificationData
  ): Promise<void> {
    try {
      const smsPrefs = preferences.sms;
      if (!smsPrefs?.enabled) {
        console.log(`📱 SMS disabled for user: ${user._id}`);
        return;
      }

      // Check category permission
      let hasPermission = false;
      if (subcategory) {
        const categoryPref = smsPrefs.categories?.[category];
        hasPermission = categoryPref?.enabled && categoryPref?.subcategories?.[subcategory];
      } else {
        hasPermission = smsPrefs.categories?.[category];
      }

      if (!hasPermission) {
        console.log(`📱 SMS not permitted for ${category}${subcategory ? `/${subcategory}` : ''}: ${user._id}`);
        return;
      }

      if (!user.phone) {
        console.log(`📱 No phone number for user: ${user._id}`);
        return;
      }

      // Generate and send SMS
      const message = this.generateSMSContent(event, data, user.name);
      await sendSMS(user.phone, message);

      console.log(`✅ SMS sent for ${event} to: ${user.phone}`);
    } catch (error) {
      console.error(`❌ SMS send error:`, error);
    }
  }

  /**
   * Check and send WhatsApp notification (placeholder for future implementation)
   */
  private static async checkAndSendWhatsApp(
    user: any, 
    preferences: any, 
    category: string, 
    subcategory: string | undefined, 
    event: NotificationEvent, 
    data: NotificationData
  ): Promise<void> {
    // TODO: Implement WhatsApp Business API integration
    const whatsappPrefs = preferences.whatsapp;
    if (whatsappPrefs?.enabled) {
      console.log(`📲 WhatsApp notification queued for ${event} (not implemented yet)`);
    }
  }

  /**
   * Check and send push notification (placeholder for future implementation)
   */
  private static async checkAndSendPush(
    user: any, 
    preferences: any, 
    category: string, 
    subcategory: string | undefined, 
    event: NotificationEvent, 
    data: NotificationData
  ): Promise<void> {
    // TODO: Implement Push notification service
    const pushPrefs = preferences.push;
    if (pushPrefs?.enabled) {
      console.log(`🔔 Push notification queued for ${event} (not implemented yet)`);
    }
  }

  /**
   * Generate email content based on event type
   */
  private static generateEmailContent(event: NotificationEvent, data: NotificationData, userName: string): { subject: string; html: string } {
    const baseStyles = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">CS Store</h1>
          <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Order Update</p>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    `;

    const footerStyles = `
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              Best regards,<br><strong>CS Store Team</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    switch (event) {
      case 'ORDER_CONFIRMED':
        return {
          subject: `Order Confirmed - #${data.orderNumber || data.orderId}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Order Confirmed! 🎉</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your order <strong>#${data.orderNumber || data.orderId}</strong> has been confirmed and is being processed.
            </p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 10px 0;">Order Details</h3>
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${data.orderId}</p>
              ${data.amount ? `<p style="margin: 5px 0;"><strong>Amount:</strong> ₹${data.amount}</p>` : ''}
            </div>
            ${footerStyles}`
        };

      case 'ORDER_SHIPPED':
        return {
          subject: `Order Shipped - #${data.orderNumber || data.orderId}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Your Order is On The Way! 🚚</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your order <strong>#${data.orderNumber || data.orderId}</strong> has been shipped.
            </p>
            ${data.trackingNumber ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 10px 0;">Tracking Information</h3>
              <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
            </div>` : ''}
            ${footerStyles}`
        };

      case 'ORDER_PICKED_UP':
        return {
          subject: `Order Picked Up - #${data.orderNumber || data.orderId}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Order Picked Up! 📦</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Great news! Your order <strong>#${data.orderNumber || data.orderId}</strong> has been picked up by our delivery partner and is now on its way to you.
            </p>
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p style="margin: 0; color: #155724; font-weight: bold;">📍 Status: Out for Delivery</p>
              <p style="margin: 5px 0 0 0; color: #155724;">Your order is now with our delivery team and will arrive soon!</p>
            </div>
            ${footerStyles}`
        };

      case 'ORDER_IN_TRANSIT':
        return {
          subject: `Order Out for Delivery - #${data.orderNumber || data.orderId}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Out for Delivery! 🚴‍♂️</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your order <strong>#${data.orderNumber || data.orderId}</strong> is currently out for delivery and should arrive shortly.
            </p>
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-weight: bold;">🚚 In Transit</p>
              <p style="margin: 5px 0 0 0; color: #856404;">Our delivery partner is on the way to your location!</p>
            </div>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Please ensure someone is available to receive the delivery. You'll receive another notification when the delivery partner arrives.
            </p>
            ${footerStyles}`
        };

      case 'ORDER_ARRIVED_AT_DESTINATION':
        return {
          subject: `Delivery Partner Arrived - #${data.orderNumber || data.orderId}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Delivery Partner Has Arrived! 🏠</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Great news! Our delivery partner has arrived at your location with order <strong>#${data.orderNumber || data.orderId}</strong>.
            </p>
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p style="margin: 0; color: #155724; font-weight: bold;">🎯 Delivery Partner Arrived</p>
              <p style="margin: 5px 0 0 0; color: #155724;">Please be ready to receive your order!</p>
            </div>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Please have your OTP ready if this is a COD order. Thank you for choosing CS Store!
            </p>
            ${footerStyles}`
        };

      case 'ORDER_DELIVERED':
        return {
          subject: `Order Delivered - #${data.orderNumber || data.orderId}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Order Delivered Successfully! ✅</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your order <strong>#${data.orderNumber || data.orderId}</strong> has been delivered successfully.
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We hope you're happy with your purchase! Please consider leaving a review.
            </p>
            ${footerStyles}`
        };

      case 'PAYMENT_SUCCESS':
        return {
          subject: `Payment Successful - ₹${data.amount}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Payment Successful 💳</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your payment of <strong>₹${data.amount}</strong> has been processed successfully.
            </p>
            ${data.paymentId ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Payment ID:</strong> ${data.paymentId}</p>
            </div>` : ''}
            ${footerStyles}`
        };

      case 'CART_REMINDER':
        return {
          subject: `Items waiting in your cart 🛒`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">Don't forget your items! 🛒</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              You have items waiting in your cart. Complete your purchase before they're gone!
            </p>
            ${footerStyles}`
        };

      case 'NEW_PRODUCT_ALERT':
        return {
          subject: `🆕 New Product Alert: ${data.productName}`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">New Product Just Added! 🆕</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We've just added an exciting new product to CS Store: <strong>${data.productName}</strong>
            </p>
            ${data.productPrice ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 10px 0;">Product Details</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${data.productName}</p>
              <p style="margin: 5px 0;"><strong>Price:</strong> ₹${data.productPrice}</p>
              ${data.productCategory ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${data.productCategory}</p>` : ''}
            </div>` : ''}
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Be the first to check it out! Visit CS Store now to explore this new addition.
            </p>
            ${footerStyles}`
        };

      default:
        return {
          subject: `CS Store Notification`,
          html: `${baseStyles}
            <h2 style="color: #333; margin-bottom: 20px;">CS Store Notification</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hi ${userName || 'Valued Customer'},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              You have a new notification from CS Store.
            </p>
            ${footerStyles}`
        };
    }
  }

  /**
   * Generate SMS content based on event type
   */
  private static generateSMSContent(event: NotificationEvent, data: NotificationData, userName: string): string {
    switch (event) {
      case 'ORDER_CONFIRMED':
        return `Hi ${userName || 'Customer'}, your CS Store order #${data.orderNumber || data.orderId} has been confirmed${data.amount ? ` for ₹${data.amount}` : ''}. Thanks for shopping with us!`;
      
      case 'ORDER_SHIPPED':
        return `Your CS Store order #${data.orderNumber || data.orderId} has been shipped${data.trackingNumber ? `. Tracking: ${data.trackingNumber}` : ''}. Track your order for updates.`;
      
      case 'ORDER_PICKED_UP':
        return `📦 Order #${data.orderNumber || data.orderId} picked up! Your CS Store order is now on its way to you. Delivery coming soon!`;
      
      case 'ORDER_IN_TRANSIT':
        return `🚚 Out for delivery! Your CS Store order #${data.orderNumber || data.orderId} is currently on the way. Please be available to receive it.`;
      
      case 'ORDER_ARRIVED_AT_DESTINATION':
        return `🎯 Delivery partner arrived! Your CS Store order #${data.orderNumber || data.orderId} is at your location. Please be ready to receive it.`;
      
      case 'ORDER_DELIVERED':
        return `Great news! Your CS Store order #${data.orderNumber || data.orderId} has been delivered successfully. Hope you love your purchase!`;
      
      case 'PAYMENT_SUCCESS':
        return `Payment successful! ₹${data.amount} processed for your CS Store order${data.paymentId ? ` (ID: ${data.paymentId})` : ''}. Thank you!`;
      
      case 'PAYMENT_FAILED':
        return `Payment failed for your CS Store order. Please try again or contact support. Amount: ₹${data.amount}`;
      
      case 'CART_REMINDER':
        return `Hi ${userName || 'Customer'}, you have items in your CS Store cart. Complete your purchase before they're gone! Shop now.`;
      
      case 'NEW_PRODUCT_ALERT':
        return `🆕 New product alert: ${data.productName}${data.productPrice ? ` for ₹${data.productPrice}` : ''} just added to CS Store! Be the first to check it out.`;
      
      default:
        return `CS Store notification: You have a new update. Check your account for details.`;
    }
  }
}

/**
 * Convenience functions for dispatching notifications
 */
export const dispatchNotification = NotificationService.dispatchNotification.bind(NotificationService);
export const dispatchToAllUsers = NotificationService.dispatchToAllUsers.bind(NotificationService);

/**
 * Utility functions for common notification scenarios
 */
export class NotificationUtils {
  /**
   * Send cart reminder to users who have items in cart for more than X hours
   */
  static async sendCartReminders(hours: number = 24): Promise<void> {
    try {
      console.log(`🛒 Checking for abandoned carts older than ${hours} hours...`);
      
      const { Cart } = await import("../../../models/Cart");
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Find carts with items that haven't been updated recently
      const abandonedCarts = await Cart.find({
        itemCount: { $gt: 0 },
        updatedAt: { $lt: cutoffTime }
      }).populate('userId', '_id');

      console.log(`📊 Found ${abandonedCarts.length} abandoned carts`);

      for (const cart of abandonedCarts) {
        if (cart.userId) {
          try {
            await dispatchNotification(cart.userId.toString(), 'CART_REMINDER', {
              cartItems: cart.items?.map((item: any) => ({
                name: item.name || 'Product',
                quantity: item.qty || 1,
                price: item.price || 0
              })) || []
            });
            console.log(`✅ Cart reminder sent to user: ${cart.userId}`);
          } catch (error) {
            console.error(`❌ Failed to send cart reminder to ${cart.userId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error in sendCartReminders:`, error);
    }
  }

  /**
   * Send payment reminders for pending COD orders
   */
  static async sendPaymentReminders(): Promise<void> {
    try {
      console.log(`💳 Checking for pending COD payments...`);
      
      const { Order } = await import("../../../models/Order");
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const pendingPayments = await Order.find({
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        deliveryStatus: 'delivered',
        deliveredAt: { $lt: cutoffTime }
      });

      console.log(`📊 Found ${pendingPayments.length} pending COD payments`);

      for (const order of pendingPayments) {
        try {
          await dispatchNotification(order.userId.toString(), 'PAYMENT_REMINDER', {
            orderId: order._id.toString(),
            orderNumber: order._id.toString(),
            amount: order.totalAmount
          });
          console.log(`✅ Payment reminder sent for order: ${order._id}`);
        } catch (error) {
          console.error(`❌ Failed to send payment reminder for order ${order._id}:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Error in sendPaymentReminders:`, error);
    }
  }

  /**
   * Send product restock notifications
   */
  static async sendRestockNotifications(productId: string): Promise<void> {
    try {
      console.log(`📦 Sending restock notifications for product: ${productId}`);
      
      // TODO: Implement wishlist/restock notification tracking
      // For now, this is a placeholder for future implementation
      console.log(`🚧 Restock notifications not yet implemented - requires wishlist feature`);
    } catch (error) {
      console.error(`❌ Error in sendRestockNotifications:`, error);
    }
  }

  /**
   * Send feedback request after delivery
   */
  static async sendFeedbackRequest(orderId: string, userId: string): Promise<void> {
    try {
      await dispatchNotification(userId, 'FEEDBACK_REQUEST', {
        orderId,
        orderNumber: orderId
      });
      console.log(`✅ Feedback request sent for order: ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send feedback request for order ${orderId}:`, error);
    }
  }
}
