import { v4 as uuidv4 } from "uuid";
import { BaseEvent } from "./BaseEvent";

export type DeliveryEventType =
  | "DELIVERY_PICKUP_REMINDER"
  | "DELIVERY_OTP_GENERATED"
  | "DELIVERY_COMPLETED"
  | "EARNINGS_CREDITED"
  | "EARNINGS_DAILY_SUMMARY"
  | "PERFORMANCE_MILESTONE"
  | "COD_SETTLEMENT_REMINDER";

type DeliveryEventData = {
  userId: string;
  orderId?: string;
  amount?: number;
  totalEarnings?: number;
  milestoneCount?: number;
  deliveriesCompleted?: number;
  dailyEarnings?: number;
  codAmount?: number;
  otp?: string;
  title?: string;
  body?: string;
};

export type DeliveryEvent = Omit<BaseEvent, "eventType" | "version" | "data"> & {
  eventType: DeliveryEventType;
  version: 1;
  data: DeliveryEventData;
};

function createDeliveryEvent(params: {
  eventType: DeliveryEventType;
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  amount?: number;
  totalEarnings?: number;
  milestoneCount?: number;
  deliveriesCompleted?: number;
  dailyEarnings?: number;
  codAmount?: number;
  otp?: string;
  title?: string;
  body?: string;
}): DeliveryEvent {
  const {
    eventType,
    source,
    actor,
    eventId,
    occurredAt,
    userId,
    orderId,
    amount,
    totalEarnings,
    milestoneCount,
    deliveriesCompleted,
    dailyEarnings,
    codAmount,
    otp,
    title,
    body,
  } = params;

  const data: DeliveryEventData = {
    userId,
    ...(orderId ? { orderId } : {}),
    ...(typeof amount === "number" ? { amount } : {}),
    ...(typeof totalEarnings === "number" ? { totalEarnings } : {}),
    ...(typeof milestoneCount === "number" ? { milestoneCount } : {}),
    ...(typeof deliveriesCompleted === "number" ? { deliveriesCompleted } : {}),
    ...(typeof dailyEarnings === "number" ? { dailyEarnings } : {}),
    ...(typeof codAmount === "number" ? { codAmount } : {}),
    ...(otp ? { otp } : {}),
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

export function createDeliveryPickupReminderEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "DELIVERY_PICKUP_REMINDER", ...params });
}

export function createDeliveryOtpGeneratedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  otp?: string;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "DELIVERY_OTP_GENERATED", ...params });
}

export function createDeliveryCompletedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  amount?: number;
  totalEarnings?: number;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "DELIVERY_COMPLETED", ...params });
}

export function createEarningsCreditedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  orderId?: string;
  amount?: number;
  totalEarnings?: number;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "EARNINGS_CREDITED", ...params });
}

export function createEarningsDailySummaryEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  deliveriesCompleted?: number;
  dailyEarnings?: number;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "EARNINGS_DAILY_SUMMARY", ...params });
}

export function createPerformanceMilestoneEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  milestoneCount?: number;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "PERFORMANCE_MILESTONE", ...params });
}

export function createCodSettlementReminderEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  codAmount?: number;
  title?: string;
  body?: string;
}): DeliveryEvent {
  return createDeliveryEvent({ eventType: "COD_SETTLEMENT_REMINDER", ...params });
}
