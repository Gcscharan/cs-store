/**
 * Priority Engine
 *
 * Classifies notifications into priority levels (P0-P3) based on event type
 * and determines delivery behavior per priority level (sound, badge, retry, forced channels).
 *
 * Priority Levels:
 * - P0 (Critical): payment failure, delivery failure, security events
 * - P1 (High): order delivered, OTP generated, order assigned
 * - P2 (Medium): earnings credited, order confirmed, order packed
 * - P3 (Low): promotions, recommendations, reminders
 */

export type PriorityLevel = "P0" | "P1" | "P2" | "P3";

export type DeliveryChannel = "push" | "in_app" | "socket";

export interface DeliveryBehavior {
  sound: boolean;
  badge: boolean;
  retryAttempts: number;
  forceChannels: DeliveryChannel[];
}

/**
 * Event type to priority level mapping.
 * P0 (Critical): Immediate attention required, affects money or security.
 * P1 (High): Important lifecycle events requiring prompt user awareness.
 * P2 (Medium): Informational updates about order/earnings progress.
 * P3 (Low): Non-urgent promotions and announcements.
 */
const EVENT_PRIORITY_MAP: Record<string, PriorityLevel> = {
  // P0 — Critical
  PAYMENT_FAILED: "P0",
  ORDER_FAILED: "P0",
  ADMIN_SECURITY_EVENT: "P0",

  // P1 — High
  ORDER_DELIVERED: "P1",
  DELIVERY_ASSIGNED: "P1",
  OTP_GENERATED: "P1",
  DELIVERY_OTP_GENERATED: "P1",

  // P2 — Medium
  ORDER_CONFIRMED: "P2",
  ORDER_PACKED: "P2",
  EARNINGS_CREDITED: "P2",

  // P3 — Low
  PROMO_CAMPAIGN: "P3",
  SYSTEM_ANNOUNCEMENT: "P3",
};

/**
 * Delivery behavior configuration per priority level.
 */
const DELIVERY_BEHAVIORS: Record<PriorityLevel, DeliveryBehavior> = {
  P0: {
    sound: true,
    badge: true,
    retryAttempts: 5,
    forceChannels: ["push", "in_app"],
  },
  P1: {
    sound: true,
    badge: true,
    retryAttempts: 3,
    forceChannels: [],
  },
  P2: {
    sound: false,
    badge: true,
    retryAttempts: 2,
    forceChannels: [],
  },
  P3: {
    sound: false,
    badge: false,
    retryAttempts: 0,
    forceChannels: [],
  },
};

/**
 * Classify an event type into a priority level.
 *
 * Uses the event-to-priority mapping. If the event type is not explicitly mapped,
 * defaults to P2 (Medium) as a safe fallback.
 *
 * @param eventType - The domain event type string (e.g., "PAYMENT_FAILED", "ORDER_CONFIRMED")
 * @returns The priority level for the given event type
 */
export function classifyPriority(eventType: string): PriorityLevel {
  return EVENT_PRIORITY_MAP[eventType] || "P2";
}

/**
 * Get the delivery behavior configuration for a given priority level.
 *
 * Returns configuration controlling sound, badge, retry attempts, and forced channels.
 *
 * @param priority - The priority level (P0, P1, P2, P3)
 * @returns The delivery behavior configuration for that priority
 */
export function getDeliveryBehavior(priority: PriorityLevel): DeliveryBehavior {
  return DELIVERY_BEHAVIORS[priority];
}
