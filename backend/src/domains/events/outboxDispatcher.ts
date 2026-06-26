import { logger } from '../../utils/logger';
import os from "os";
import { randomUUID } from "crypto";
import { OutboxEvent } from "../../models/OutboxEvent";
import type { BaseEvent } from "./BaseEvent";
import { deliverToSubscribers } from "./eventBus";
import { incCounter } from "../../ops/opsMetrics";

let started = false;

// Exponential backoff: 1s, 2s, 4s, ... capped at 10 minutes
function backoffMs(attempts: number): number {
  const a = Math.max(0, Math.min(20, attempts));
  return Math.min(10 * 60_000, 1000 * Math.pow(2, a));
}

// Dead-letter threshold: after this many delivery attempts, move to DEAD_LETTER
const DEAD_LETTER_THRESHOLD = 10;

export function initializeOutboxDispatcher(params?: {
  pollIntervalMs?: number;
  lockTtlMs?: number;
  maxAttempts?: number;
}): void {
  if (started) return;
  started = true;

  let consecutiveFailures = 0;
  const FAILURE_THRESHOLD = 10;

  const pollIntervalMs = Number(params?.pollIntervalMs || 1000);
  const lockTtlMs = Number(params?.lockTtlMs || 30_000);
  const maxAttempts = Number(params?.maxAttempts || 25);

  const workerId = `${os.hostname()}:${process.pid}:${randomUUID()}`;

  const tick = async () => {
    const now = new Date();
    const lockExpiry = new Date(Date.now() - lockTtlMs);

    // ── Recovery: reset stale DISPATCHING events back to PENDING ──────────────
    // If a worker crashed mid-delivery (after marking DISPATCHING but before
    // marking DISPATCHED), the event stays DISPATCHING until the lock TTL expires.
    // We reset it to PENDING with backoff so it retries, but doesn't tight-loop.
    const recovered = await OutboxEvent.updateMany(
      {
        status: "DISPATCHING",
        lockedAt: { $lte: lockExpiry },
      },
      {
        $set: {
          status: "PENDING",
          lockedAt: null,
          lockedBy: null,
          nextAttemptAt: new Date(Date.now() + backoffMs(1)),
          lastError: "Recovered from stale DISPATCHING (worker crash suspected)",
        },
        $inc: { attempts: 1 },
      }
    );

    if (recovered.modifiedCount > 0) {
      logger.warn("[OUTBOX_DISPATCHER] Recovered stale DISPATCHING events", {
        count: recovered.modifiedCount,
        workerId,
      });
      incCounter("outbox_recovered_total", recovered.modifiedCount);
    }

    // ── Claim next PENDING event ───────────────────────────────────────────────
    const claimed = await OutboxEvent.findOneAndUpdate(
      {
        // Only claim PENDING — DISPATCHING means another worker is mid-delivery
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

    const deliveryAttempts = Number((claimed as any).deliveryAttempts || 0) + 1;

    const baseEvent: BaseEvent = {
      eventId: String((claimed as any).eventId),
      eventType: String((claimed as any).eventType),
      version: Number((claimed as any).version),
      occurredAt: String((claimed as any).occurredAt),
      actor: (claimed as any).actor,
      source: String((claimed as any).source),
      data: (claimed as any).data,
    };

    // ── Dead-letter check ──────────────────────────────────────────────────────
    // If this event has been delivered too many times, move to DEAD_LETTER
    // instead of retrying indefinitely.
    if (deliveryAttempts > DEAD_LETTER_THRESHOLD) {
      logger.opsAlert("[OUTBOX_DELIVERY] Event moved to DEAD_LETTER — too many delivery attempts", {
        eventId: baseEvent.eventId,
        eventType: baseEvent.eventType,
        deliveryAttempts,
        workerId,
      });
      incCounter("outbox_dead_letter_total", 1);
      await OutboxEvent.updateOne(
        { eventId: baseEvent.eventId },
        {
          $set: {
            status: "DEAD_LETTER",
            lockedAt: null,
            lockedBy: null,
            lastError: `Dead-lettered after ${deliveryAttempts} delivery attempts`,
            lastAttemptAt: now,
            deliveryAttempts,
          },
        }
      );
      return;
    }

    // ── Mark as DISPATCHING before calling subscribers ─────────────────────────
    // If this worker crashes between here and the DISPATCHED update below,
    // the event stays DISPATCHING (not PENDING) until the lock TTL expires.
    // The recovery block above will reset it to PENDING with backoff.
    const marked = await OutboxEvent.updateOne(
      // Only update if we still own the lock (prevents double-dispatch if lock was stolen)
      { eventId: baseEvent.eventId, lockedBy: workerId },
      {
        $set: {
          status: "DISPATCHING",
          lastAttemptAt: now,
          deliveryAttempts,
        },
        $inc: { attempts: 1 },
      }
    );

    if (marked.modifiedCount === 0) {
      // Lock was stolen by another worker — skip to avoid double-dispatch
      logger.warn("[OUTBOX_DELIVERY] Lock stolen — skipping delivery", {
        eventId: baseEvent.eventId,
        workerId,
      });
      return;
    }

    logger.info("[OUTBOX_DELIVERY] Delivering event", {
      eventId: baseEvent.eventId,
      eventType: baseEvent.eventType,
      deliveryAttempts,
      workerId,
    });

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

      logger.info("[OUTBOX_DELIVERY] Event dispatched successfully", {
        eventId: baseEvent.eventId,
        eventType: baseEvent.eventType,
        deliveryAttempts,
        workerId,
      });

    } catch (err: any) {
      incCounter("outbox_dispatch_errors_total", 1);

      // attempts already incremented above; use deliveryAttempts for backoff
      const nextAttemptAt = new Date(Date.now() + backoffMs(deliveryAttempts));
      const lastError = String(err?.message || err);
      const totalAttempts = Number((claimed as any).attempts || 0) + 1;
      const isExhausted = totalAttempts >= maxAttempts;

      if (isExhausted) {
        incCounter("outbox_failed_transitions_total", 1);
      }

      logger.error("[OUTBOX_DELIVERY] Event delivery failed", {
        eventId: baseEvent.eventId,
        eventType: baseEvent.eventType,
        deliveryAttempts,
        totalAttempts,
        isExhausted,
        nextAttemptAt,
        error: lastError,
        workerId,
      });

      await OutboxEvent.updateOne(
        { eventId: baseEvent.eventId },
        {
          $set: {
            status: isExhausted ? "FAILED" : "PENDING",
            lockedAt: null,
            lockedBy: null,
            nextAttemptAt,
            lastError,
          },
        }
      );
    }
  };

  const safeTick = async () => {
    try {
      await tick();
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      logger.error("[OUTBOX_DISPATCHER_ERROR]", err);

      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        logger.error("[OUTBOX_DISPATCHER_FATAL] Too many consecutive failures. Crashing.");
        process.exit(1);
      }
    }
  };

  setInterval(() => {
    void safeTick();
  }, pollIntervalMs);

  // Warm start — process any backlog immediately
  for (let i = 0; i < 5; i++) {
    void safeTick();
  }
}
