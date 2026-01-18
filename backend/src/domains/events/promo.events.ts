import uuid from "uuid";
import { BaseEvent } from "./BaseEvent";
const { v4: uuidv4 } = uuid;

export type PromoEventType = "PROMO_CAMPAIGN" | "SYSTEM_ANNOUNCEMENT";

type PromoEventData = {
  userId: string;
  title?: string;
  body?: string;
  deepLink?: string;
};

export type PromoEvent = Omit<BaseEvent, "eventType" | "version" | "data"> & {
  eventType: PromoEventType;
  version: 1;
  data: PromoEventData;
};

function createPromoEvent(params: {
  eventType: PromoEventType;
  source: string;
  actor: BaseEvent["actor"];
  userId: string;
  title?: string;
  body?: string;
  deepLink?: string;
}): PromoEvent {
  const { eventType, source, actor, userId, title, body, deepLink } = params;
  return {
    eventId: uuidv4(),
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    actor,
    source,
    data: {
      userId,
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
      ...(deepLink ? { deepLink } : {}),
    },
  };
}

export function createPromoCampaignEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  userId: string;
  title?: string;
  body?: string;
  deepLink?: string;
}): PromoEvent {
  return createPromoEvent({ eventType: "PROMO_CAMPAIGN", ...params });
}

export function createSystemAnnouncementEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  userId: string;
  title?: string;
  body?: string;
  deepLink?: string;
}): PromoEvent {
  return createPromoEvent({ eventType: "SYSTEM_ANNOUNCEMENT", ...params });
}
