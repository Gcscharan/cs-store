# M2 — Money Integrity

**Status: ❄️ FROZEN** (engineering-complete; one staging validation with the real
gateway pending before public release)

Freeze rule: do not modify the payment/refund/inventory-commit subsystem unless a
bug, security issue, or business-requirement change demands it.

## Journey map
```
Checkout → PaymentIntent created → Razorpay order
  → [capture webhook | client verify | reconciliation poll]
  → ledger CAPTURE (dedup) → inventory reserve+commit → Order PAID → invoice → history
Reverse:
  cancel/return → restore inventory once → auto-refund (exactly once)
  → gateway refund (idempotency key) → refund.processed webhook
  → ledger REFUND (dedup) → RefundRequest COMPLETED
```

## Verified scenarios → evidence
| Area | Evidence |
|------|----------|
| Payment creation / amount binding | `upiPaymentFlow.integration`, `gatewayCreation` |
| Webhook signature/parse/capture | `security-verification` (8 sig tests), `payment-flow` |
| Duplicate webhook → exactly-once | `payment-flow` BR-005, `performance-validation`; inbox+ledger `dedupeKey`, `out.updated` guard |
| Already-PAID consistency | `payment-flow` BR-002 |
| Amount-mismatch anti-fraud | webhook rejects → `WebhookEventInbox=FAILED` |
| Inventory reserve/commit/restore | commit-before-PAID; `restoreCommittedReservationsOnce` idempotent |
| Ledger consistency / idempotency | `ledgerConsistencyScanner`, `idempotencyAuditor` |
| Reconciliation / zombie / stuck recovery | `reconciliationIntegration`, `zombieRecoveryScanner`, `stuckPaymentScanner`, `reconciliationOrchestrator` |
| Refund + over-refund guard | `refundService` ledger caps, reconciliation suite |
| Invoice (idempotent, post-commit) | `generateInvoiceForOrder` |

## Failure scenarios (converge by design)
- Kill before capture → reservation TTL sweep frees stock.
- Kill after capture, before commit → reconciliation commits + finalizes (ledger CAPTURE is source of truth).
- Capture but out of stock (INV-1) → no PAID, `capturedNoStock` flag, post-commit auto-refund.
- Refund gateway timeout (ambiguous) → left PROCESSING, reconciliation finalizes; provider idempotency key prevents double refund.
- Refund definite pre-send failure → revert PROCESSING→REQUESTED, retryable.

## Race scenarios
- Two workers capture same intent → optimistic version lock + `out.updated` → one commit.
- Stale retried attempt webhook → `activePaymentIntentId` guard ignores old attempt.
- Concurrent refund executors → atomic compare-and-set claim → single gateway call.

## Test evidence (regression)
- Payments domain: **257/257**. payment-flow + security integration: **49/49**. Total **306** passing.
- Backend `tsc` 0. No production code changed during the M2 audit (verification-only).

## Release Risk Register (money)
| ID | Risk | Severity | Status |
|----|------|----------|--------|
| R-001 | Duplicate payment / double-capture | Critical | Closed |
| R-002 | Inventory drift on capture/cancel/return | Critical | Closed |
| R-003 | Captured-but-out-of-stock money trap (INV-1) | High | Closed |
| R-004 | Double / over-refund | Critical | Closed |
| R-005 | Ambiguous refund gateway outcome lost | High | Closed |
| R-006 | Dashboard refund diverges from ledger | Medium | Closed |
| R-007 | Amount-tampering fraud via webhook | Critical | Closed |
| R-008 | Stale payment attempt marks order PAID | High | Closed |
| R-009 | Replica-set transactional CI | Low | Deferred (prod uses replica sets; unit+integration coverage sufficient; CI improvement, not correctness) |
| R-010 | RETURNED/failed-delivery refund policy | — | Open — business/product decision |
| R-011 | Real-gateway staging validation (dup/delayed webhooks, refund latency, network faults) | Medium | Open — pre-release staging task |

## Exit decision
Engineering-complete and **frozen**. Releasable pending one staging validation
with the live gateway (R-011). Re-open only per the freeze rule.
