# Refunds (PHASE 2)

## 1) Goals

This refund subsystem is designed to be:

- **Production-safe**: internal/admin-only APIs; no customer-triggered refunds.
- **Auditable**: immutable RefundRequest records and append-only ledger entries.
- **Idempotent**: refund creation is idempotent via a unique idempotency key.
- **Ledger-backed**: refunds are represented in the canonical LedgerEntry stream.

## 2) What this does NOT do

- Does **NOT** auto-refund anything.
- Does **NOT** call payment gateway refund APIs.
- Does **NOT** change or mutate the CAPTURE ledger entries.
- Does **NOT** update orders to a "refunded" state.

## 3) Canonical Truth

### Refund operational truth

Refund operations are represented by **RefundRequest** documents:

- Immutable request intent via `idempotencyKey`.
- Status: `REQUESTED | PROCESSING | COMPLETED | FAILED`.

### Refund accounting truth

Refund accounting is represented by **LedgerEntry(eventType=REFUND)** entries:

- **Append-only** ledger entries.
- **Deduped** by `dedupeKey`.
- Amount is stored as a **negative number**.

Finance reporting reads from the ledger and treats refund amounts as absolute values.

## 4) Invariants / Safety Constraints

Refunds are only allowed when:

- Order payment status is **PAID**.
- There exists at least one **CAPTURE** ledger entry for the `(orderId, paymentIntentId)`.
- Total refunds do not exceed captured amount.
  - Multiple refunds are allowed as partial refunds.
  - `Sum(refunds) <= capturedAmount` is enforced.

Refund requests are **idempotent**:

- Creating with the same `idempotencyKey` returns the same refund request.
- Re-using an idempotency key with different parameters is rejected.

## 5) Why refunds are append-only

Append-only is required to:

- Preserve a verifiable audit trail.
- Avoid corrupting historical capture/revenue recognition.
- Make finance reports deterministic and reconstruction-friendly.

## 6) Internal APIs

Admin-only endpoints:

- `POST /internal/refunds`
  - Creates a RefundRequest (idempotent).
  - Validates eligibility.
  - Does not contact gateways.

- `GET /internal/refunds/:orderId`
  - Returns refund request history for an order.

## 7) Next steps (future)

Gateway refund execution can be added later by:

- Transitioning RefundRequest `REQUESTED -> PROCESSING`.
- Performing gateway refund creation (write call) behind explicit operator action.
- Transitioning to `COMPLETED` only on verified completion and appending a REFUND ledger entry.
