import { BaseEvent } from "./BaseEvent";
import type mongoose from "mongoose";
import { OutboxEvent } from "../../models/OutboxEvent";

export type EventHandler = (event: BaseEvent) => void | Promise<void>;

type Unsubscribe = () => void;

const subscribers = new Set<EventHandler>();
const deliveredEventIds = new Set<string>();

export function subscribe(handler: EventHandler): Unsubscribe {
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
}

export async function publish(
  event: BaseEvent,
  options?: { session?: mongoose.ClientSession }
): Promise<void> {
  if (!event || typeof event !== "object") return;

  const eventId = String((event as any).eventId || "");
  const eventType = String((event as any).eventType || "");
  if (!eventId || !eventType) return;

  try {
    await OutboxEvent.create(
      [
        {
          eventId,
          eventType,
          version: Number((event as any).version || 1),
          occurredAt: String((event as any).occurredAt || new Date().toISOString()),
          actor: (event as any).actor,
          source: String((event as any).source || ""),
          data: (event as any).data || {},
          status: "PENDING",
          attempts: 0,
        },
      ],
      options?.session ? { session: options.session } : undefined
    );
  } catch (err: any) {
    if (err?.code === 11000) {
      return;
    }
    throw err;
  }
}

export async function deliverToSubscribers(event: BaseEvent): Promise<void> {
  if (!event || typeof event !== "object") return;

  const eventId = String((event as any).eventId || "");
  if (!eventId) return;

  if (deliveredEventIds.has(eventId)) return;

  for (const handler of subscribers) {
    await handler(event);
  }

  deliveredEventIds.add(eventId);
}
