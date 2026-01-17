export type NotificationMeta = {
  itemCount?: number;
  totalAmount?: number;
  amount?: number;
  primaryProductName?: string;
  deliveryPartnerName?: string;
  [key: string]: any;
};

export type FormattedNotification = {
  title: string;
  body: string;
};

function formatRupees(amount?: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `₹${Math.round(n)}`;
}

function orderDescriptor(meta?: NotificationMeta): string {
  const itemCount = Number(meta?.itemCount);
  const primary = typeof meta?.primaryProductName === "string" ? meta.primaryProductName.trim() : "";

  if (Number.isFinite(itemCount) && itemCount === 1 && primary) {
    return `for ${primary}`;
  }
  if (Number.isFinite(itemCount) && itemCount > 0) {
    return `with ${itemCount} item${itemCount === 1 ? "" : "s"}`;
  }
  return "";
}

function amountSuffix(meta?: NotificationMeta): string {
  const amt = formatRupees(meta?.totalAmount ?? meta?.amount);
  return amt ? ` (${amt})` : "";
}

export function formatNotificationCopy(input: {
  eventType?: string;
  meta?: NotificationMeta;
  fallbackTitle?: string;
  fallbackBody?: string;
}): FormattedNotification {
  const eventType = String(input.eventType || "").trim().toUpperCase();
  const meta = input.meta || {};

  const descriptor = orderDescriptor(meta);
  const suffix = amountSuffix(meta);

  const fallbackTitle = String(input.fallbackTitle || "").trim();
  const fallbackBody = String(input.fallbackBody || "").trim();

  const defaultReturn: FormattedNotification = {
    title: fallbackTitle || "Notification",
    body: fallbackBody || fallbackTitle || "You have a new update.",
  };

  if (!eventType) return defaultReturn;

  switch (eventType) {
    case "ORDER_CREATED": {
      const body = `Your order${descriptor ? ` ${descriptor}` : ""}${suffix} has been placed successfully.`;
      return { title: "Order placed", body };
    }
    case "ORDER_CONFIRMED": {
      const body = `Your order${descriptor ? ` ${descriptor}` : ""}${suffix} has been confirmed.`;
      return { title: "Order confirmed", body };
    }
    case "ORDER_PACKED": {
      const body = `Your order${descriptor ? ` ${descriptor}` : ""}${suffix} has been shipped.`;
      return { title: "Shipped", body };
    }
    case "DELIVERY_ASSIGNED": {
      const name = typeof meta?.deliveryPartnerName === "string" ? meta.deliveryPartnerName.trim() : "";
      const body = name
        ? `${name} is assigned to deliver your order${suffix}.`
        : `Your order${suffix} has been shipped.`;
      return { title: "Shipped", body };
    }
    case "ORDER_PICKED_UP": {
      const body = `Your order${suffix} has been shipped.`;
      return { title: "Shipped", body };
    }
    case "ORDER_IN_TRANSIT": {
      const body = `Your order${suffix} is out for delivery.`;
      return { title: "Out for delivery", body };
    }
    case "ORDER_DELIVERED": {
      const body = `Your order${suffix} has been delivered.`;
      return { title: "Delivered", body };
    }
    case "ORDER_CANCELLED": {
      const body = `Your order${suffix} has been cancelled.`;
      return { title: "Order cancelled", body };
    }
    case "PAYMENT_SUCCESS": {
      const amt = formatRupees(meta?.amount ?? meta?.totalAmount);
      const body = amt ? `Payment of ${amt} received successfully.` : "Payment received successfully.";
      return { title: "Payment received", body };
    }
    case "PAYMENT_PENDING": {
      const amt = formatRupees(meta?.amount ?? meta?.totalAmount);
      const body = amt ? `Your payment of ${amt} is pending.` : "Your payment is pending.";
      return { title: "Payment pending", body };
    }
    case "REFUND_INITIATED": {
      const amt = formatRupees(meta?.amount ?? meta?.totalAmount);
      const body = amt ? `Refund of ${amt} has been initiated.` : "Refund has been initiated.";
      return { title: "Refund initiated", body };
    }
    case "REFUND_COMPLETED": {
      const amt = formatRupees(meta?.amount ?? meta?.totalAmount);
      const body = amt ? `Refund of ${amt} has been credited to your account.` : "Refund has been credited to your account.";
      return { title: "Refund completed", body };
    }
    case "ACCOUNT_NEW_LOGIN": {
      return { title: "New login", body: "We noticed a new login to your account." };
    }
    case "ACCOUNT_PASSWORD_CHANGED": {
      return { title: "Password updated", body: "Your account password was changed successfully." };
    }
    case "ACCOUNT_PROFILE_UPDATED": {
      return { title: "Profile updated", body: "Your account details were updated." };
    }
    case "PROMO_CAMPAIGN": {
      const t = String(input.fallbackTitle || "Offer").trim() || "Offer";
      const b = String(input.fallbackBody || "").trim() || "A new offer is available for you.";
      return { title: t, body: b };
    }
    case "SYSTEM_ANNOUNCEMENT": {
      const t = String(input.fallbackTitle || "Announcement").trim() || "Announcement";
      const b = String(input.fallbackBody || "").trim() || "There’s a new update.";
      return { title: t, body: b };
    }
    default:
      return defaultReturn;
  }
}
