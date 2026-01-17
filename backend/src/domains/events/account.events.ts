import { v4 as uuidv4 } from "uuid";
import { BaseEvent } from "./BaseEvent";

export type AccountEventType =
  | "ACCOUNT_PROFILE_UPDATED"
  | "ACCOUNT_PASSWORD_CHANGED"
  | "ACCOUNT_NEW_LOGIN";

type AccountEventData = {
  userId: string;
  title?: string;
  body?: string;
};

export type AccountEvent = Omit<BaseEvent, "eventType" | "version" | "data"> & {
  eventType: AccountEventType;
  version: 1;
  data: AccountEventData;
};

function createAccountEvent(params: {
  eventType: AccountEventType;
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  title?: string;
  body?: string;
}): AccountEvent {
  const { eventType, source, actor, eventId, occurredAt, userId, title, body } = params;

  return {
    eventId: eventId || uuidv4(),
    eventType,
    version: 1,
    occurredAt: occurredAt || new Date().toISOString(),
    actor,
    source,
    data: {
      userId,
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
    },
  };
}

export function createAccountProfileUpdatedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  title?: string;
  body?: string;
}): AccountEvent {
  return createAccountEvent({ eventType: "ACCOUNT_PROFILE_UPDATED", ...params });
}

export function createAccountPasswordChangedEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  title?: string;
  body?: string;
}): AccountEvent {
  return createAccountEvent({ eventType: "ACCOUNT_PASSWORD_CHANGED", ...params });
}

export function createAccountNewLoginEvent(params: {
  source: string;
  actor: BaseEvent["actor"];
  eventId?: string;
  occurredAt?: string;
  userId: string;
  title?: string;
  body?: string;
}): AccountEvent {
  return createAccountEvent({ eventType: "ACCOUNT_NEW_LOGIN", ...params });
}
