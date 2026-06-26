import { logger } from "../../../utils/logger";

// ─── Interface ────────────────────────────────────────────────────────────────

export type NotificationRole = "customer" | "delivery_partner" | "admin" | "all";
export type NotificationPriority = "P0" | "P1" | "P2" | "P3";
export type NotificationChannel = "in_app" | "push" | "socket";
export type NotificationCategory = "order" | "delivery" | "payment" | "account" | "promo";

export interface NotificationTemplate {
  eventType: string;
  role: NotificationRole;
  title: string;
  body: string;
  deepLinkPattern: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  sound: boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * In-memory template registry: Map<eventType, Map<role, NotificationTemplate>>
 */
const templateRegistry = new Map<string, Map<NotificationRole, NotificationTemplate>>();

function registerTemplate(template: NotificationTemplate): void {
  if (!templateRegistry.has(template.eventType)) {
    templateRegistry.set(template.eventType, new Map());
  }
  templateRegistry.get(template.eventType)!.set(template.role, template);
}

// ─── Template Registrations ───────────────────────────────────────────────────

// --- Order Events (Customer) ---

registerTemplate({
  eventType: "ORDER_CREATED",
  role: "customer",
  title: "Order Placed",
  body: "Your order #{orderNumber} has been placed successfully. We'll confirm it shortly.",
  deepLinkPattern: "/orders/{orderId}",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "ORDER_CONFIRMED",
  role: "customer",
  title: "Order Confirmed",
  body: "Your order #{orderNumber} has been confirmed. Estimated delivery: {estimatedDelivery}.",
  deepLinkPattern: "/orders/{orderId}",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "ORDER_PACKED",
  role: "customer",
  title: "Order Packed",
  body: "Your order #{orderNumber} has been packed and is ready for pickup.",
  deepLinkPattern: "/orders/{orderId}",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "DELIVERY_ASSIGNED",
  role: "customer",
  title: "Delivery Partner Assigned",
  body: "Your order #{orderNumber} has been assigned to {deliveryPartnerName}.",
  deepLinkPattern: "/orders/{orderId}/tracking",
  category: "order",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "ORDER_PICKED_UP",
  role: "customer",
  title: "Order Picked Up",
  body: "Your order #{orderNumber} has been picked up and is on the way.",
  deepLinkPattern: "/orders/{orderId}/tracking",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "ORDER_IN_TRANSIT",
  role: "customer",
  title: "Order On The Way",
  body: "Your order #{orderNumber} is on the way! Track live location.",
  deepLinkPattern: "/orders/{orderId}/tracking",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "ORDER_DELIVERED",
  role: "customer",
  title: "Order Delivered",
  body: "Your order #{orderNumber} has been delivered. We'd love your feedback!",
  deepLinkPattern: "/orders/{orderId}",
  category: "order",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "ORDER_FAILED",
  role: "customer",
  title: "Delivery Failed",
  body: "We couldn't deliver your order #{orderNumber}. Reason: {failureReason}.",
  deepLinkPattern: "/orders/{orderId}",
  category: "order",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "ORDER_CANCELLED",
  role: "customer",
  title: "Order Cancelled",
  body: "Your order #{orderNumber} has been cancelled. Reason: {cancellationReason}.",
  deepLinkPattern: "/orders/{orderId}",
  category: "order",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

// --- Payment Events (Customer) ---

registerTemplate({
  eventType: "PAYMENT_PENDING",
  role: "customer",
  title: "Payment Pending",
  body: "Payment of ₹{amount} for order #{orderNumber} is pending.",
  deepLinkPattern: "/orders/{orderId}/payment",
  category: "payment",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "PAYMENT_SUCCESS",
  role: "customer",
  title: "Payment Successful",
  body: "Payment of ₹{amount} via {paymentMethod} for order #{orderNumber} was successful.",
  deepLinkPattern: "/orders/{orderId}",
  category: "payment",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "PAYMENT_FAILED",
  role: "customer",
  title: "Payment Failed",
  body: "Your payment of ₹{amount} for order #{orderNumber} failed. Reason: {failureReason}. Please retry.",
  deepLinkPattern: "/orders/{orderId}/payment",
  category: "payment",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "PAYMENT_FAILED",
  role: "customer",
  title: "Payment Failed",
  body: "Payment of ₹{amount} for order #{orderNumber} failed. Reason: {failureReason}. Please retry.",
  deepLinkPattern: "/orders/{orderId}/payment",
  category: "payment",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "REFUND_INITIATED",
  role: "customer",
  title: "Refund Initiated",
  body: "A refund of ₹{amount} for order #{orderNumber} has been initiated. Expected in {expectedTimeline}.",
  deepLinkPattern: "/orders/{orderId}",
  category: "payment",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "REFUND_COMPLETED",
  role: "customer",
  title: "Refund Credited",
  body: "₹{amount} has been refunded to your {paymentMethod} for order #{orderNumber}.",
  deepLinkPattern: "/orders/{orderId}",
  category: "payment",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

// --- Account Events (Customer) ---

registerTemplate({
  eventType: "ACCOUNT_PROFILE_UPDATED",
  role: "customer",
  title: "Profile Updated",
  body: "Your profile has been updated successfully.",
  deepLinkPattern: "/account/settings",
  category: "account",
  priority: "P3",
  channels: ["in_app", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "ACCOUNT_PASSWORD_CHANGED",
  role: "customer",
  title: "Password Changed",
  body: "Your password was changed successfully. If this wasn't you, please contact support immediately.",
  deepLinkPattern: "/account/security",
  category: "account",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "ACCOUNT_NEW_LOGIN",
  role: "customer",
  title: "New Login Detected",
  body: "A new login was detected on your account from {deviceInfo}.",
  deepLinkPattern: "/account/security",
  category: "account",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

// --- Promo Events (Customer) ---

registerTemplate({
  eventType: "PROMO_CAMPAIGN",
  role: "customer",
  title: "{promoTitle}",
  body: "{promoBody}",
  deepLinkPattern: "/offers/{promoId}",
  category: "promo",
  priority: "P3",
  channels: ["in_app", "push"],
  sound: false,
});

registerTemplate({
  eventType: "SYSTEM_ANNOUNCEMENT",
  role: "customer",
  title: "{announcementTitle}",
  body: "{announcementBody}",
  deepLinkPattern: "/announcements",
  category: "promo",
  priority: "P3",
  channels: ["in_app", "push"],
  sound: false,
});

// --- Demo / Dev Notification Events (Customer) ---
// One template per category so the dev demo endpoint can drive correct
// icon/color theming. All include the "socket" channel so the in-app toast fires.

registerTemplate({
  eventType: "DEMO_ORDER",
  role: "customer",
  title: "{demoTitle}",
  body: "{demoBody}",
  deepLinkPattern: "{demoDeepLink}",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "DEMO_DELIVERY",
  role: "customer",
  title: "{demoTitle}",
  body: "{demoBody}",
  deepLinkPattern: "{demoDeepLink}",
  category: "delivery",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "DEMO_PAYMENT",
  role: "customer",
  title: "{demoTitle}",
  body: "{demoBody}",
  deepLinkPattern: "{demoDeepLink}",
  category: "payment",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "DEMO_ACCOUNT",
  role: "customer",
  title: "{demoTitle}",
  body: "{demoBody}",
  deepLinkPattern: "{demoDeepLink}",
  category: "account",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "DEMO_PROMO",
  role: "customer",
  title: "{demoTitle}",
  body: "{demoBody}",
  deepLinkPattern: "{demoDeepLink}",
  category: "promo",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

// --- Delivery Partner Events ---

registerTemplate({
  eventType: "DELIVERY_ASSIGNED",
  role: "delivery_partner",
  title: "New Order Assigned",
  body: "Order #{orderNumber} assigned. Pickup from {pickupAddress}. Earn ₹{deliveryFee}.",
  deepLinkPattern: "/delivery/orders/{orderId}/accept",
  category: "delivery",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "DELIVERY_PICKUP_REMINDER",
  role: "delivery_partner",
  title: "Pickup Reminder",
  body: "Order #{orderNumber} is waiting for pickup at {pickupAddress}. Please pick up soon.",
  deepLinkPattern: "/delivery/orders/{orderId}",
  category: "delivery",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "DELIVERY_OTP_GENERATED",
  role: "delivery_partner",
  title: "🔐 Delivery Verification",
  body: "Your delivery verification code is ready. Tap to view securely.",
  deepLinkPattern: "/delivery/orders/{orderId}",
  category: "delivery",
  priority: "P1",
  channels: ["in_app", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "DELIVERY_COMPLETED",
  role: "delivery_partner",
  title: "Delivery Completed",
  body: "Order #{orderNumber} delivered successfully! Earned ₹{amount}.",
  deepLinkPattern: "/delivery/earnings",
  category: "delivery",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "EARNINGS_CREDITED",
  role: "delivery_partner",
  title: "Earnings Credited",
  body: "₹{amount} credited to your account. Total balance: ₹{totalBalance}.",
  deepLinkPattern: "/delivery/earnings",
  category: "delivery",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "EARNINGS_DAILY_SUMMARY",
  role: "delivery_partner",
  title: "Daily Earnings Summary",
  body: "Today: {totalDeliveries} deliveries completed. Total earnings: ₹{totalEarnings}.",
  deepLinkPattern: "/delivery/earnings",
  category: "delivery",
  priority: "P3",
  channels: ["in_app", "push"],
  sound: false,
});

registerTemplate({
  eventType: "PERFORMANCE_MILESTONE",
  role: "delivery_partner",
  title: "Milestone Achieved! 🎉",
  body: "Congratulations! You've completed {milestoneCount} deliveries. Keep up the great work!",
  deepLinkPattern: "/delivery/performance",
  category: "delivery",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "COD_SETTLEMENT_REMINDER",
  role: "delivery_partner",
  title: "COD Settlement Pending",
  body: "You have ₹{outstandingAmount} in pending COD settlement. Please settle at the earliest.",
  deepLinkPattern: "/delivery/settlements",
  category: "delivery",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

// --- Admin Events ---

registerTemplate({
  eventType: "ORDER_CREATED",
  role: "admin",
  title: "New Order Received",
  body: "Order #{orderNumber} placed by {customerName}. Amount: ₹{amount}.",
  deepLinkPattern: "/admin/orders/{orderId}",
  category: "order",
  priority: "P2",
  channels: ["in_app", "push", "socket"],
  sound: false,
});

registerTemplate({
  eventType: "ORDER_FAILED",
  role: "admin",
  title: "⚠️ Delivery Failed",
  body: "Order #{orderNumber} delivery failed. Reason: {failureReason}. Partner: {deliveryPartnerName}.",
  deepLinkPattern: "/admin/orders/{orderId}",
  category: "order",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "PAYMENT_FAILED",
  role: "customer",
  title: "Payment Failed",
  body: "Payment of ₹{amount} for order #{orderNumber} failed. Reason: {failureReason}. Please retry.",
  deepLinkPattern: "/orders/{orderId}/payment",
  category: "payment",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "PAYMENT_FAILED",
  role: "admin",
  title: "⚠️ Payment Failed",
  body: "Payment of ₹{amount} failed for order #{orderNumber}. Customer: {customerName}.",
  deepLinkPattern: "/admin/payments/{paymentId}",
  category: "payment",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "ADMIN_SECURITY_EVENT",
  role: "admin",
  title: "🔒 Security Alert",
  body: "Security event: {securityEventType}. User: {affectedUser}. Details: {eventDetails}.",
  deepLinkPattern: "/admin/security/events/{eventId}",
  category: "account",
  priority: "P0",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

registerTemplate({
  eventType: "LOW_STOCK",
  role: "admin",
  title: "⚠️ Low Stock Alert",
  body: "{productName} is running low. Current stock: {currentStock} units.",
  deepLinkPattern: "/admin/inventory/{productId}",
  category: "order",
  priority: "P1",
  channels: ["in_app", "push", "socket"],
  sound: true,
});

// ─── Fallback Function (from existing notificationWriter) ─────────────────────

/**
 * Fallback title generation for events without a registered template.
 * Matches existing behavior in notificationWriter.ts.
 */
export function defaultTitleForEvent(eventType: string): string {
  if (eventType === "ORDER_CREATED") {
    return "Order placed successfully";
  }
  return eventType.replace(/_/g, " ");
}

// ─── Template Resolution ──────────────────────────────────────────────────────

/**
 * Resolves the notification template for a given eventType and role.
 *
 * Resolution order:
 * 1. Exact match: (eventType, role)
 * 2. Fallback to 'all' role: (eventType, 'all')
 * 3. Returns null if no template found (caller should use defaultTitleForEvent fallback)
 */
export function resolveTemplate(
  eventType: string,
  role: NotificationRole
): NotificationTemplate | null {
  const eventTemplates = templateRegistry.get(eventType);
  if (!eventTemplates) {
    return null;
  }

  // Try exact role match first
  const exactMatch = eventTemplates.get(role);
  if (exactMatch) {
    return exactMatch;
  }

  // Fallback to 'all' role
  const allMatch = eventTemplates.get("all");
  if (allMatch) {
    return allMatch;
  }

  return null;
}

// ─── Template Interpolation ───────────────────────────────────────────────────

/**
 * Interpolates template variables in a string with actual data values.
 * Variables use {variableName} syntax.
 * Missing variables are replaced with empty string and a warning is logged.
 */
export function interpolateTemplate(
  templateString: string,
  data: Record<string, any>
): string {
  return templateString.replace(/\{(\w+)\}/g, (match, variableName) => {
    const value = data[variableName];
    if (value === undefined || value === null) {
      logger.warn(
        `[TEMPLATE_INTERPOLATION] Missing variable "{${variableName}}" in template. Using empty string fallback.`,
        { variableName, availableKeys: Object.keys(data) }
      );
      return "";
    }
    return String(value);
  });
}

// ─── Exports for Testing ──────────────────────────────────────────────────────

/**
 * Returns the internal registry for testing purposes.
 */
export function getTemplateRegistry(): Map<string, Map<NotificationRole, NotificationTemplate>> {
  return templateRegistry;
}
