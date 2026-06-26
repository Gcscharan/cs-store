import { User, INotificationPreferences } from "../../../models/User";
import { logger } from "../../../utils/logger";

/**
 * Delivery channels supported by the notification system.
 */
export type DeliveryChannel = "in_app" | "push" | "socket";

/**
 * Notification categories used by the system.
 */
export type NotificationCategory = "order" | "delivery" | "payment" | "account" | "promo";

/**
 * Priority levels for notifications.
 */
export type NotificationPriority = "P0" | "P1" | "P2" | "P3";

/**
 * Maps notification categories to the corresponding user preference category key.
 * The user model has preference keys like "myOrders", "silentPay", "newOffers" etc.
 */
const categoryToPreferenceKey: Record<NotificationCategory, string> = {
  order: "myOrders",
  delivery: "myOrders", // delivery notifications use "myOrders" preference
  payment: "silentPay",
  account: "feedback", // account notifications mapped to feedback category
  promo: "newOffers",
};

/**
 * Checks if a specific channel is enabled for a given category in user preferences.
 *
 * @param channelPrefs - The preferences for a specific channel (e.g., push, inapp)
 * @param preferenceKey - The category key to check (e.g., "myOrders", "silentPay")
 * @returns true if the channel and category are enabled, false otherwise
 */
function isChannelEnabledForCategory(
  channelPrefs: { enabled?: boolean; categories?: Record<string, any> } | undefined,
  preferenceKey: string
): boolean {
  // If no channel prefs exist, default to enabled
  if (!channelPrefs) {
    return true;
  }

  // If channel is explicitly disabled, respect that
  if (channelPrefs.enabled === false) {
    return false;
  }

  // If categories object doesn't exist, default to enabled
  if (!channelPrefs.categories) {
    return true;
  }

  // If the specific category key is explicitly set to false, disable
  const categoryValue = channelPrefs.categories[preferenceKey];
  if (categoryValue === false) {
    return false;
  }

  // Default to enabled (undefined or true both mean enabled)
  return true;
}

/**
 * Determines which delivery channels a notification should be sent on.
 *
 * Channel Router Logic:
 * 1. P0 (Critical) notifications ALWAYS deliver via push + in_app regardless of user preferences
 * 2. For other priorities, checks user notification preferences per channel per category
 * 3. If user has no preferences set, all channels are enabled by default
 * 4. Socket channel is always included unless explicitly filtered by future requirements
 *
 * @param userId - The target user's ID
 * @param category - The notification category (order, delivery, payment, account, promo)
 * @param priority - The notification priority (P0, P1, P2, P3)
 * @param templateChannels - The channels defined in the notification template
 * @returns Array of active delivery channels
 */
export async function determineChannels(
  userId: string,
  category: NotificationCategory,
  priority: NotificationPriority,
  templateChannels: DeliveryChannel[]
): Promise<DeliveryChannel[]> {
  // P0 priority override: always deliver via push + in_app regardless of preferences
  if (priority === "P0") {
    const p0Channels: DeliveryChannel[] = ["push", "in_app"];
    // Also include socket if it's in the template channels
    if (templateChannels.includes("socket")) {
      p0Channels.push("socket");
    }
    return p0Channels;
  }

  // Load user notification preferences
  let preferences: INotificationPreferences | undefined;
  try {
    const user = await User.findById(userId).select("notificationPreferences").lean();
    preferences = user?.notificationPreferences;
  } catch (err) {
    logger.error(`[ChannelRouter] Failed to load preferences for user ${userId}:`, err);
    // On error, default to all template channels (fail-open)
    return [...templateChannels];
  }

  // If user has no preferences, all channels are enabled by default
  if (!preferences || Object.keys(preferences).length === 0) {
    return [...templateChannels];
  }

  const preferenceKey = categoryToPreferenceKey[category] || "myOrders";
  const activeChannels: DeliveryChannel[] = [];

  for (const channel of templateChannels) {
    switch (channel) {
      case "push": {
        if (isChannelEnabledForCategory(preferences.push, preferenceKey)) {
          activeChannels.push("push");
        }
        break;
      }
      case "in_app": {
        if (isChannelEnabledForCategory(preferences.inapp, preferenceKey)) {
          activeChannels.push("in_app");
        }
        break;
      }
      case "socket": {
        // Socket (real-time) follows the same preferences as in_app
        // If in-app is enabled for the category, socket is also enabled
        if (isChannelEnabledForCategory(preferences.inapp, preferenceKey)) {
          activeChannels.push("socket");
        }
        break;
      }
      default:
        break;
    }
  }

  return activeChannels;
}
