import { navigationRef } from '../navigation/RootNavigator';

/**
 * Centralized notification deep-link resolver.
 *
 * The backend attaches a `deepLink` string (and category/type) to every push
 * payload — see backend notificationTemplates.ts `deepLinkPattern`. This maps
 * those backend paths to the app's navigation routes, so a notification tap
 * lands on the correct screen regardless of which channel delivered it
 * (push tap, in-app toast tap, or terminated-state cold start).
 *
 * Supported backend deepLink shapes:
 *   /orders/{id}                 → OrderDetail
 *   /orders/{id}/tracking        → OrderTracking
 *   /orders/{id}/payment         → OrderDetail (payment section)
 *   /notifications               → Notifications
 *   /account/settings|security   → Settings
 *   /offers/{id} | /announcements→ Home
 */

export interface NotificationPayloadData {
  deepLink?: string;
  type?: string;        // legacy: ORDER_UPDATE, OFFER, etc.
  orderId?: string;
  category?: string;    // order | delivery | payment | account | promo
  [key: string]: any;
}

type NavTarget = { screen: string; params?: Record<string, any> };

/**
 * Resolves a notification payload to a navigation target.
 * Returns null if nothing actionable can be derived (caller should no-op).
 */
export function resolveNotificationTarget(data: NotificationPayloadData | undefined | null): NavTarget | null {
  if (!data) return null;

  const deepLink = typeof data.deepLink === 'string' ? data.deepLink.trim() : '';

  // ── Primary: structured deepLink from backend templates ──
  if (deepLink) {
    // Order tracking: /orders/{id}/tracking
    const trackingMatch = deepLink.match(/^\/orders\/([^/]+)\/tracking$/);
    if (trackingMatch) {
      return { screen: 'OrderTracking', params: { orderId: trackingMatch[1] } };
    }

    // Order payment: /orders/{id}/payment → order detail
    const paymentMatch = deepLink.match(/^\/orders\/([^/]+)\/payment$/);
    if (paymentMatch) {
      return { screen: 'OrderDetail', params: { orderId: paymentMatch[1] } };
    }

    // Order detail: /orders/{id}
    const orderMatch = deepLink.match(/^\/orders\/([^/]+)$/);
    if (orderMatch) {
      return { screen: 'OrderDetail', params: { orderId: orderMatch[1] } };
    }

    if (deepLink === '/notifications') {
      return { screen: 'Notifications' };
    }

    if (deepLink.startsWith('/account')) {
      return { screen: 'Settings' };
    }

    if (deepLink.startsWith('/offers') || deepLink === '/announcements') {
      return { screen: 'Main', params: { screen: 'Home' } };
    }
  }

  // ── Fallback: legacy `type` + orderId (older payloads) ──
  const type = typeof data.type === 'string' ? data.type.toUpperCase() : '';
  const orderId = typeof data.orderId === 'string' ? data.orderId : undefined;

  if (orderId && (type === 'ORDER_UPDATE' || type.startsWith('ORDER_') || type.startsWith('DELIVERY_'))) {
    // Delivery-related → tracking; otherwise order detail
    if (type.includes('TRANSIT') || type.includes('OUT_FOR_DELIVERY') || type === 'ORDER_PICKED_UP') {
      return { screen: 'OrderTracking', params: { orderId } };
    }
    return { screen: 'OrderDetail', params: { orderId } };
  }

  if (type === 'OFFER' || type === 'PROMO') {
    return { screen: 'Main', params: { screen: 'Home' } };
  }

  // ── Category-based last resort ──
  const category = typeof data.category === 'string' ? data.category.toLowerCase() : '';
  if (orderId && (category === 'order' || category === 'delivery' || category === 'payment')) {
    return { screen: 'OrderDetail', params: { orderId } };
  }
  if (category) {
    return { screen: 'Notifications' };
  }

  return null;
}

/**
 * Navigates to the screen for a notification payload.
 * Safe to call from any app state — no-ops if navigation isn't ready or the
 * payload isn't actionable.
 */
export function navigateFromNotification(data: NotificationPayloadData | undefined | null): void {
  const target = resolveNotificationTarget(data);
  if (!target) return;
  if (!navigationRef.isReady()) return;

  if (target.params) {
    navigationRef.navigate(target.screen as never, target.params as never);
  } else {
    navigationRef.navigate(target.screen as never);
  }
}
