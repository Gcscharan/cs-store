import { Request, Response } from "express";
import { publish } from "../../events/eventBus";
import { BaseEvent } from "../../events/BaseEvent";
import {
  createOrderCreatedEvent,
  createOrderConfirmedEvent,
  createOrderPackedEvent,
  createDeliveryAssignedEvent,
  createOrderPickedUpEvent,
  createOrderInTransitEvent,
  createOrderDeliveredEvent,
  createOrderFailedEvent,
  createOrderCancelledEvent,
} from "../../events/order.events";
import {
  createPaymentPendingEvent,
  createPaymentSuccessEvent,
  createRefundInitiatedEvent,
  createRefundCompletedEvent,
} from "../../events/payment.events";
import {
  createAccountProfileUpdatedEvent,
  createAccountPasswordChangedEvent,
  createAccountNewLoginEvent,
} from "../../events/account.events";
import {
  createPromoCampaignEvent,
  createSystemAnnouncementEvent,
} from "../../events/promo.events";

type DevNotificationTestBody = {
  eventType?: unknown;
  userId?: unknown;
  orderId?: unknown;
  title?: unknown;
  body?: unknown;
};

function actorFromRequest(req: Request): BaseEvent["actor"] {
  const user = (req as any).user;
  const role = String(user?.role || "").toLowerCase();
  const actorId = user?._id ? String(user._id) : undefined;

  if (role === "admin") return { type: "admin", ...(actorId ? { id: actorId } : {}) };
  return { type: "user", ...(actorId ? { id: actorId } : {}) };
}

export const devTestEmitEvent = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).send("Not found");
    return;
  }

  const payload = (req.body || {}) as DevNotificationTestBody;

  const eventType = typeof payload.eventType === "string" ? payload.eventType.trim() : "";
  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : undefined;
  const title = typeof payload.title === "string" ? payload.title.trim() : undefined;
  const body = typeof payload.body === "string" ? payload.body.trim() : undefined;

  if (!eventType) {
    res.status(400).json({ error: "eventType is required" });
    return;
  }

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const actor = actorFromRequest(req);
  const source = "dev";

  let event: BaseEvent | null = null;

  switch (eventType) {
    case "ORDER_CREATED":
      if (!orderId) break;
      event = createOrderCreatedEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_CONFIRMED":
      if (!orderId) break;
      event = createOrderConfirmedEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_PACKED":
      if (!orderId) break;
      event = createOrderPackedEvent({ source, actor, userId, orderId, title, body });
      break;
    case "DELIVERY_ASSIGNED":
      if (!orderId) break;
      event = createDeliveryAssignedEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_PICKED_UP":
      if (!orderId) break;
      event = createOrderPickedUpEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_IN_TRANSIT":
      if (!orderId) break;
      event = createOrderInTransitEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_DELIVERED":
      if (!orderId) break;
      event = createOrderDeliveredEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_FAILED":
      if (!orderId) break;
      event = createOrderFailedEvent({ source, actor, userId, orderId, title, body });
      break;
    case "ORDER_CANCELLED":
      if (!orderId) break;
      event = createOrderCancelledEvent({ source, actor, userId, orderId, title, body });
      break;

    case "PAYMENT_PENDING":
      event = createPaymentPendingEvent({ source, actor, userId, orderId, title, body });
      break;
    case "PAYMENT_SUCCESS":
      event = createPaymentSuccessEvent({ source, actor, userId, orderId, title, body });
      break;
    case "REFUND_INITIATED":
      event = createRefundInitiatedEvent({ source, actor, userId, orderId, title, body });
      break;
    case "REFUND_COMPLETED":
      event = createRefundCompletedEvent({ source, actor, userId, orderId, title, body });
      break;

    case "ACCOUNT_PROFILE_UPDATED":
      event = createAccountProfileUpdatedEvent({ source, actor, userId, title, body });
      break;
    case "ACCOUNT_PASSWORD_CHANGED":
      event = createAccountPasswordChangedEvent({ source, actor, userId, title, body });
      break;
    case "ACCOUNT_NEW_LOGIN":
      event = createAccountNewLoginEvent({ source, actor, userId, title, body });
      break;

    case "PROMO_CAMPAIGN":
      event = createPromoCampaignEvent({ source, actor, userId, title, body });
      break;
    case "SYSTEM_ANNOUNCEMENT":
      event = createSystemAnnouncementEvent({ source, actor, userId, title, body });
      break;

    default:
      res.status(400).json({ error: "Unsupported eventType" });
      return;
  }

  if (
    (
      eventType.startsWith("ORDER_") ||
      eventType.startsWith("DELIVERY_") ||
      eventType.startsWith("PAYMENT_") ||
      eventType.startsWith("REFUND_")
    ) &&
    !orderId
  ) {
    res.status(400).json({ error: "orderId is required for this eventType" });
    return;
  }

  if (!event) {
    res.status(400).json({ error: "Failed to create event" });
    return;
  }

  await publish(event);

  res.json({ success: true });
};
