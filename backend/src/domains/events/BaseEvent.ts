export interface BaseEvent {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  actor: {
    type: "system" | "user" | "admin" | "delivery";
    id?: string;
  };
  source: string;
  data: Record<string, any>;
}
