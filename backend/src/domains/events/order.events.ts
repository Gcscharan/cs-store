import { v4 as uuidv4 } from "uuid";
import { BaseEvent } from "./BaseEvent";

export type OrderEventType =
  | "ORDER_CREATED"
  | "ORDER_CONFIRMED"
  | "ORDER_PACKED"
  | "DELIVERY_ASSIGNED"
  | "ORDER_PICKED_UP"
  | "ORDER_IN_TRANSIT"
  | "ORDER_DELIVERED"
  | "ORDER_FAILED"
  | "ORDER_CANCELLED";

type OrderEventData = {
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  deliveryPartnerName?: string;
  title?: string;
  body?: string;
};

export type OrderEvent = Omit<BaseEvent, "eventType" | "version" | "data"> & {
  eventType: OrderEventType;
  version: 1;
  data: OrderEventData;
};

function createOrderEvent(params: {
  eventType: OrderEventType;
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  deliveryPartnerName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  const {
    eventType,
    source,
    actor,
    eventId,
    occurredAt,
    userId,
    orderId,
    itemCount,
    totalAmount,
    primaryProductName,
    deliveryPartnerName,
    title,
    body,
  } = params;
  return {
    eventId: eventId || uuidv4(),
    eventType,
    version: 1,
    occurredAt: occurredAt || new Date().toISOString(),
    actor,
    source,
    data: {
      userId,
      orderId,
      ...(typeof itemCount === "number" ? { itemCount } : {}),
      ...(typeof totalAmount === "number" ? { totalAmount } : {}),
      ...(typeof primaryProductName === "string" ? { primaryProductName } : {}),
      ...(typeof deliveryPartnerName === "string" ? { deliveryPartnerName } : {}),
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
    },
  };
}

export function createOrderCreatedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_CREATED", ...params });
}

export function createOrderConfirmedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_CONFIRMED", ...params });
}

export function createOrderPackedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_PACKED", ...params });
}

export function createDeliveryAssignedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  deliveryPartnerName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "DELIVERY_ASSIGNED", ...params });
}

export function createOrderPickedUpEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_PICKED_UP", ...params });
}

export function createOrderInTransitEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_IN_TRANSIT", ...params });
}

export function createOrderDeliveredEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_DELIVERED", ...params });
}

export function createOrderFailedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_FAILED", ...params });
}

export function createOrderCancelledEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId: string;
  itemCount?: number;
  totalAmount?: number;
  primaryProductName?: string;
  title?: string;
  body?: string;
}): OrderEvent {
  return createOrderEvent({ eventType: "ORDER_CANCELLED", ...params });
}
