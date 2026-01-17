import os from "os";
import { randomUUID } from "crypto";
import { OutboxEvent } from "../../models/OutboxEvent";
import type { BaseEvent } from "./BaseEvent";
import { deliverToSubscribers } from "./eventBus";
import { incCounter } from "../../ops/opsMetrics";

let started = false;

function backoffMs(attempts: number): number {
  const a = Math.max(0, Math.min(20, attempts));
  return Math.min(10 * 60_000, 1000 * Math.pow(2, a));
}

export function initializeOutboxDispatcher(params?: {
  pollIntervalMs?: number;
  lockTtlMs?: number;
  maxAttempts?: number;
}): void {
  if (started) return;
  started = true;

  const pollIntervalMs = Number(params?.pollIntervalMs || 1000);
  const lockTtlMs = Number(params?.lockTtlMs || 30_000);
  const maxAttempts = Number(params?.maxAttempts || 25);

  const workerId = `${os.hostname()}:${process.pid}:${randomUUID()}`;

  const tick = async () => {
    const now = new Date();
    const lockExpiry = new Date(Date.now() - lockTtlMs);

    const claimed = await OutboxEvent.findOneAndUpdate(
      {
        status: "PENDING",
        $and: [
          {
            $or: [
              { nextAttemptAt: { $exists: false } },
              { nextAttemptAt: null },
              { nextAttemptAt: { $lte: now } },
            ],
          },
          {
            $or: [
              { lockedAt: { $exists: false } },
              { lockedAt: null },
              { lockedAt: { $lte: lockExpiry } },
            ],
          },
        ],
      },
      {
        $set: {
          lockedAt: now,
          lockedBy: workerId,
        },
      },
      { new: true, sort: { occurredAt: 1 } }
    ).lean();

    if (!claimed) return;

    const baseEvent: BaseEvent = {
      eventId: String((claimed as any).eventId),
      eventType: String((claimed as any).eventType),
      version: Number((claimed as any).version),
      occurredAt: String((claimed as any).occurredAt),
      actor: (claimed as any).actor,
      source: String((claimed as any).source),
      data: (claimed as any).data,
    };

    try {
      await deliverToSubscribers(baseEvent);

      incCounter("outbox_dispatched_total", 1);

      await OutboxEvent.updateOne(
        { eventId: baseEvent.eventId },
        {
          $set: {
            status: "DISPATCHED",
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        }
      );
    } catch (err: any) {
      incCounter("outbox_dispatch_errors_total", 1);
      const attempts = Number((claimed as any).attempts || 0) + 1;
      const nextAttemptAt = new Date(Date.now() + backoffMs(attempts));
      const lastError = String(err?.message || err);

      if (attempts >= maxAttempts) {
        incCounter("outbox_failed_transitions_total", 1);
      }

      await OutboxEvent.updateOne(
        { eventId: baseEvent.eventId },
        {
          $set: {
            status: attempts >= maxAttempts ? "FAILED" : "PENDING",
            lockedAt: null,
            lockedBy: null,
            nextAttemptAt,
            lastError,
          },
          $inc: { attempts: 1 },
        }
      );
    }
  };

  setInterval(() => {
    void tick().catch(() => undefined);
  }, pollIntervalMs);

  for (let i = 0; i < 5; i++) {
    void tick().catch(() => undefined);
  }
}
