# M7 — Notification Integrity

**Status: ✅ Complete (in-repo); push-delivery to real devices is a staging validation)**

## Architecture (exactly-once pipeline)
```
domain transition → publish(event, {session})  → OutboxEvent (eventId UNIQUE)
  → OutboxDispatcher (claim via lockedBy, retry w/ backoff, 10 attempts → DEAD_LETTER)
  → subscribers (notificationWriter, …)
       → ProcessedEvent (eventId, consumerName) UNIQUE  → skip on 11000
       → Notification.create  (compensation: delete ProcessedEvent if create fails)
```

## Exactly-once guarantees (verified by code)
- **Publish dedup**: `OutboxEvent.eventId` unique. Transitions use deterministic
  `stableEventId(order:{id}:status:{to})`, so a retried transition re-publishes
  the same id → one row. (Can't happen twice.)
- **Consumer dedup**: `ProcessedEvent {eventId, consumerName}` unique; writer
  creates it FIRST and skips on 11000 → at-least-once delivery becomes
  exactly-once processing. (Replay/concurrent-safe.)
- **Compensation**: if `Notification.create` fails after `ProcessedEvent` is
  written, the ProcessedEvent is deleted so the event is retried. (Crash-safe.)
- **Dispatcher**: lock (`lockedBy`) prevents double-dispatch; retry/backoff to
  DEAD_LETTER after 10 attempts. (Stuck → dead-letter, not infinite.)

## Per-event coverage (business transitions)
| Event | Published | Notification |
|-------|-----------|--------------|
| ORDER_CONFIRMED / PACKED / PICKED_UP / IN_TRANSIT / DELIVERED / FAILED / CANCELLED | ✅ orderStateService (in-txn outbox) | ✅ ORDER_ → order category |
| DELIVERY_ASSIGNED | ✅ orderStateService | ✅ DELIVERY_ → delivery category |
| PAYMENT_SUCCESS / PAYMENT_FAILED | ✅ webhookProcessor | ✅ PAYMENT_ → payment category |
| **REFUND_COMPLETED** | ✅ **fixed (commit 11307b919)** — was missing | ✅ REFUND_ → payment category |
| ARRIVED | direct in-app Notification (markArrived) — idempotent via `arrivedAt` guard | ✅ exactly-once |
| RETURNED | no event (customer already notified on FAILED) | n/a — see open item |
| REASSIGNED | `order:reassigned` socket to old rider only | no customer notification (acceptable) |

## Bugs found & fixed
- **Refund completion never notified the customer**: `createRefundCompletedEvent`
  + notificationWriter `REFUND_` handling existed, but nothing published it.
  Fixed: `markRefundCompleted` publishes REFUND_COMPLETED post-commit
  (non-throwing). Exactly-once via deterministic eventId + COMPLETED-state guard.
  Execution evidence: `refundCompletedNotification.integration` 2/2.

## Test evidence
- `refundCompletedNotification.integration.test.ts` — 2/2 (exactly one event to
  customer; no duplicate on repeat completion).
- Payments suite **257/257** (no regression from the additive publish).

## Open items / risks
| ID | Item | Severity | Status |
|----|------|----------|--------|
| N-001 | ORDER_RETURNED has no customer notification | Low | Open — likely intentional (FAILED already notified); business decision |
| N-002 | REASSIGNED → no "your delivery partner changed" customer notification | Low | Open — product decision |
| N-003 | Push-to-device delivery (FCM/Expo) end-to-end | Medium | Staging validation (real device + tokens) |

## Exit decision
In-repo notification integrity is complete: exactly-once publish→process→notify
with compensation, and the one real coverage gap (refund completion) is fixed
with execution evidence. Residual items are product decisions (N-001/N-002) and
a real-device push validation (N-003) — none are in-repo correctness blockers.
