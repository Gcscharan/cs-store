/**
 * Property-based idempotency & isolation invariants for the Notification Orchestrator.
 *
 * These tests target the highest-risk correctness properties flagged in the
 * notification chaos audit:
 *
 *   INV-1  Same eventId never creates more than one notification per recipient
 *          (duplicate event storm / webhook replay / double-click / outbox retry).
 *   INV-2  A user never receives another user's notification (tenant isolation).
 *   INV-3  Notification count for an event is bounded by its recipient set
 *          (no amplification under concurrency).
 *   INV-4  Unknown / unmapped event types never create notifications.
 *
 * Strategy: drive the orchestrator's exported _handleEvent directly (same entry
 * point the outbox dispatcher uses) under randomized inputs and concurrency,
 * asserting the invariants hold regardless of ordering or repetition.
 */

import fc from "fast-check";
import mongoose from "mongoose";

import Notification from "../../src/models/Notification";
import ProcessedEvent from "../../src/models/ProcessedEvent";
import { User } from "../../src/models/User";
import {
  _handleEvent,
  _resetOrchestrator,
  _setSocketEmitter,
} from "../../src/domains/communication/services/notificationOrchestrator";
import {
  _resetBatchQueue,
  _resetRateLimitState,
} from "../../src/domains/communication/services/pushGateway";

// Avoid real Expo HTTP calls — push delivery is irrelevant to these invariants.
jest.mock("node-fetch", () => jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [{ status: "ok", id: "ticket" }] }),
})));

// No-op socket emitter so socket delivery never touches a real io instance.
const noopEmitter = {
  emitNotificationNew: () => {},
  emitNotificationRead: () => {},
  emitNotificationReadAll: () => {},
  emitUnreadCount: () => {},
  emitNotificationSync: () => {},
};

const CUSTOMER_EVENTS = [
  "ORDER_CONFIRMED",
  "ORDER_PACKED",
  "ORDER_DELIVERED",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
] as const;

function makeEvent(eventType: string, userId: string, eventId: string) {
  return {
    eventId,
    eventType,
    version: 1,
    occurredAt: new Date().toISOString(),
    actor: { type: "system" as const },
    source: "property-test",
    data: {
      userId,
      orderId: new mongoose.Types.ObjectId().toString(),
      orderNumber: `ORD-${eventId.slice(0, 6)}`,
      amount: 499,
      failureReason: "insufficient_funds",
    },
  };
}

describe("Property: Notification Orchestrator idempotency & isolation", () => {
  beforeAll(() => {
    process.env.NOTIFICATION_ORCHESTRATOR_ENABLED = "true";
    _setSocketEmitter(noopEmitter as any);
  });

  afterAll(() => {
    _resetOrchestrator();
    _setSocketEmitter(null);
  });

  beforeEach(async () => {
    _resetBatchQueue();
    _resetRateLimitState();
    await Notification.deleteMany({});
    await ProcessedEvent.deleteMany({});
  });

  // INV-1: duplicate event storm — N repeated deliveries of the same eventId
  // must yield exactly one notification for the recipient.
  it("INV-1: same eventId never creates duplicate notifications, regardless of repeat count or concurrency", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...CUSTOMER_EVENTS),
        fc.integer({ min: 2, max: 15 }), // storm size
        fc.boolean(), // concurrent vs sequential
        async (eventType, repeats, concurrent) => {
          await Notification.deleteMany({});
          await ProcessedEvent.deleteMany({});

          const user = await (global as any).createTestUser({
            email: `inv1-${Date.now()}-${Math.random()}@test.com`,
            role: "customer",
          });
          const userId = String(user._id);
          const eventId = `storm-${new mongoose.Types.ObjectId().toString()}`;
          const event = makeEvent(eventType, userId, eventId);

          if (concurrent) {
            // Fire all deliveries simultaneously to exercise the dedup race.
            await Promise.all(
              Array.from({ length: repeats }, () => _handleEvent(event as any))
            );
          } else {
            for (let i = 0; i < repeats; i++) {
              await _handleEvent(event as any);
            }
          }

          const count = await Notification.countDocuments({
            userId: user._id,
            eventType,
          });

          // Exactly one notification regardless of how many times the event arrived.
          expect(count).toBe(1);
        }
      ),
      { numRuns: 15 }
    );
  });

  // INV-2: tenant isolation — a notification created for user A must never be
  // addressed to user B.
  it("INV-2: a user never receives another user's notification", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...CUSTOMER_EVENTS),
        async (eventType) => {
          await Notification.deleteMany({});
          await ProcessedEvent.deleteMany({});

          const userA = await (global as any).createTestUser({
            email: `inv2a-${Date.now()}-${Math.random()}@test.com`,
            role: "customer",
          });
          const userB = await (global as any).createTestUser({
            email: `inv2b-${Date.now()}-${Math.random()}@test.com`,
            role: "customer",
          });

          const event = makeEvent(
            eventType,
            String(userA._id),
            `iso-${new mongoose.Types.ObjectId().toString()}`
          );
          await _handleEvent(event as any);

          const bNotifs = await Notification.countDocuments({ userId: userB._id });
          expect(bNotifs).toBe(0);

          const aNotifs = await Notification.countDocuments({ userId: userA._id });
          expect(aNotifs).toBe(1);
        }
      ),
      { numRuns: 10 }
    );
  });

  // INV-4: unmapped event types never produce notifications.
  it("INV-4: unknown event types never create notifications", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !/[$.]/.test(s)),
        async (randomType) => {
          await Notification.deleteMany({});
          await ProcessedEvent.deleteMany({});

          const user = await (global as any).createTestUser({
            email: `inv4-${Date.now()}-${Math.random()}@test.com`,
            role: "customer",
          });

          const event = makeEvent(
            `UNKNOWN_${randomType}`,
            String(user._id),
            `unk-${new mongoose.Types.ObjectId().toString()}`
          );
          await _handleEvent(event as any);

          const count = await Notification.countDocuments({ userId: user._id });
          expect(count).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });
});
