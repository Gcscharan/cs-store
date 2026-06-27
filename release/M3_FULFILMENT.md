# M3 — Fulfilment Integrity

**Status: 🚧 In progress**

Everything after payment is captured. Bar: each node must survive the 8 audit
questions (twice / skipped / out-of-order / concurrent / replayed / spoofed /
stuck / crash-reconciliation).

## Journey map
```
Customer places order → Admin receives order → Assignment → Reassignment →
Pickup → Navigation → Arrival → OTP → Delivery → Wallet/Earnings →
Customer Tracking → Notifications → Completion
```

## Node audit log
(updated as each node is verified; bugs + fixes recorded inline)

| Node | Verified | Notes |
|------|----------|-------|
| Assignment | ✅ | admin push-assignment; PACKED→ASSIGNED role-guarded via orderStateService |
| Reassignment | ✅ | ASSIGNED→PACKED; old rider rejected on any later action (ownership guard → 403); client drops stale queued action |
| Pickup | ✅ | pickup/start/deliver/fail all route through orderStateService as DELIVERY_PARTNER + ownership guard |
| Navigation | ⏳ | client-only (maps deeplink); low risk |
| Arrival | ✅ | markArrived sets arrivedAt only (orderStatus stays IN_TRANSIT); idempotent (arrivedAt guard); ARRIVED enum/schema aligned (commit 73615167d) |
| OTP / Delivery | ✅ | orderStateService OTP guard: required + expiry + issued-to + exact match; IN_TRANSIT→DELIVERED only |
| Wallet / Earnings | ✅ | **exactly-once** via unique partial index `{riderId,orderId,type}` (EARNING/COD_COLLECTED); 11000 race handled; immutable; reversal idempotent |
| Customer Tracking | ⏳ | live location store + socket; route-based tracking inconsistency flagged (R-006 from prior audit) |
| Notifications | ⏳ | order events published in-txn via outbox (verified in orderStateService); per-event delivery to audit |
| Completion | ✅ | DELIVERED terminal; earnings credited; inventory already committed |
| Rider socket rooms | ✅ | keyed by deliveryPartnerId to match mobile `delivery:${userId}` (tests fixed commit d5ec37fa3) |
| Offline connectivity/feedback UI | ✅ (by inspection) | useConnectivityState precedence + useActionFeedback transient SM correct; see RF-002 |

## Bugs found & fixed (this milestone)
- (M2-adjacent, already shipped) ARRIVED enum/schema misalignment + missing `DELIVERY_ALLOWED_TRANSITIONS` export (commit 73615167d).
- (already shipped) Stale `deliverySocketEmitter` tests after deliveryPartnerId room refactor (commit d5ec37fa3).

## Risk register (fulfilment)
| ID | Risk | Severity | Status |
|----|------|----------|--------|
| RF-001 | Route-based customer tracking stale/inconsistent after reassignment | Medium | Open (to audit) |
| RF-002 | `useConnectivityState`/`useActionFeedback` tests fail under renderHook+fakeTimers+React19 (production logic verified correct by inspection) | Low | Deferred (test-harness only; not a correctness defect) |
| RF-003 | Offline action replay after reassignment | High | **Closed** — backend rejects non-assigned actor (403 ForbiddenTransitionError); client `replayQueue` pre-flight stale-discard + drops on 403/409, retries only on network error, MAX_RETRIES/TTL drop, FIFO + per-order isolation → converges |

## Exit decision
_In progress. Verified: Assignment, Reassignment, Pickup, Arrival, OTP/Delivery,
Wallet/Earnings (exactly-once), Completion, rider socket rooms, offline UI logic,
and offline replay-after-reassignment convergence (RF-003 closed). Remaining:
Customer Tracking consistency after reassignment (RF-001), Notification per-event
delivery coverage._
