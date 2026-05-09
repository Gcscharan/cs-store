import { BaseEvent } from "../../events/BaseEvent";
import { subscribe } from "../../events/eventBus";
import { assignOrderToAdmin } from "./adminAssignmentService";
import { logger } from "../../../utils/logger";
import ProcessedEvent from "../../../models/ProcessedEvent";

const CONSUMER_NAME = "adminAssignment";

let initialized = false;

/**
 * Initialize admin assignment event consumer.
 * Subscribes to ORDER_CREATED events and assigns orders to admin.
 *
 * Idempotency: uses ProcessedEvent dedupe key per (eventId, consumerName).
 * Even if the outbox re-delivers the same event, this consumer processes it
 * exactly once — the DB-level atomic guard in assignOrderToAdmin is a second
 * layer of protection, but this guard prevents unnecessary work and side effects.
 */
export function initializeAdminAssignmentConsumer(): void {
  if (initialized) return;
  initialized = true;

  subscribe(async (event: BaseEvent) => {
    const eventType = String(event?.eventType || "");

    // Only process ORDER_CREATED events
    if (eventType !== "ORDER_CREATED") return;

    const eventId = String(event?.eventId || "");
    const data = (event?.data || {}) as Record<string, any>;
    const orderId = typeof data.orderId === "string" ? data.orderId : undefined;

    if (!orderId) {
      logger.warn("[EVENT_CONSUMED] consumer=adminAssignment skipped=true reason=missing_orderId", {
        eventId,
        eventType,
      });
      return;
    }

    // ── Consumer-level idempotency ─────────────────────────────────────────────
    // Insert a dedupe record. If it already exists (E11000), this event was
    // already processed by this consumer — skip to avoid duplicate side effects.
    try {
      await ProcessedEvent.create({
        eventId,
        consumerName: CONSUMER_NAME,
        processedAt: new Date(),
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        // Already processed — safe to skip
        logger.info("[EVENT_CONSUMED] consumer=adminAssignment skipped=true reason=already_processed", {
          eventId,
          eventType,
          orderId,
        });
        return;
      }
      // Unexpected error — rethrow so outbox retries
      throw err;
    }

    logger.info("[EVENT_CONSUMED] consumer=adminAssignment skipped=false", {
      eventId,
      eventType,
      orderId,
    });

    // Idempotent assignment — atomic DB guard prevents duplicate writes
    // even if consumer-level dedupe somehow fails
    const result = await assignOrderToAdmin({ orderId });

    if (result.assigned) {
      logger.info("[ADMIN][CONSUMER] Order assigned via event", {
        orderId,
        eventId,
        eventType,
      });
    } else {
      logger.debug("[ADMIN][CONSUMER] Order already assigned (DB guard caught it)", {
        orderId,
        eventId,
        eventType,
      });
    }
  });

  logger.info("[ADMIN][CONSUMER] Admin assignment consumer initialized");
}
