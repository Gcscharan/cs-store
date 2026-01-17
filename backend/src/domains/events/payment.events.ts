import { v4 as uuidv4 } from "uuid";
import { BaseEvent } from "./BaseEvent";

export type PaymentEventType =
  | "PAYMENT_PENDING"
  | "PAYMENT_SUCCESS"
  | "REFUND_INITIATED"
  | "REFUND_COMPLETED";

type PaymentEventData = {
  userId: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  title?: string;
  body?: string;
};

export type PaymentEvent = Omit<BaseEvent, "eventType" | "version" | "data"> & {
  eventType: PaymentEventType;
  version: 1;
  data: PaymentEventData;
};

function createPaymentEvent(params: {
  eventType: PaymentEventType;
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  title?: string;
  body?: string;
}): PaymentEvent {
  const { eventType, source, actor, eventId, occurredAt, userId, orderId, paymentId, amount, title, body } = params;

  const data: PaymentEventData = {
    userId,
    ...(orderId ? { orderId } : {}),
    ...(paymentId ? { paymentId } : {}),
    ...(typeof amount === "number" ? { amount } : {}),
    ...(title ? { title } : {}),
    ...(body ? { body } : {}),
  };

  return {
    eventId: eventId || uuidv4(),
    eventType,
    version: 1,
    occurredAt: occurredAt || new Date().toISOString(),
    actor,
    source,
    data,
  };
}

export function createPaymentPendingEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  title?: string;
  body?: string;
}): PaymentEvent {
  return createPaymentEvent({ eventType: "PAYMENT_PENDING", ...params });
}

export function createPaymentSuccessEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  title?: string;
  body?: string;
}): PaymentEvent {
  return createPaymentEvent({ eventType: "PAYMENT_SUCCESS", ...params });
}

export function createRefundInitiatedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  title?: string;
  body?: string;
}): PaymentEvent {
  return createPaymentEvent({ eventType: "REFUND_INITIATED", ...params });
}

export function createRefundCompletedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  title?: string;
  body?: string;
}): PaymentEvent {
  return createPaymentEvent({ eventType: "REFUND_COMPLETED", ...params });
}
