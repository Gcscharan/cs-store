# Finance Health (PHASE 4.4)

## Purpose

`GET /internal/finance/health` provides **accounting-grade invariant detection** for payments and refunds.

Strict guarantees:

- **Read-only** (no data mutation)
- **Admin-only**
- **Deterministic output** (stable ordering + capped samples)
- **No gateway calls**

The endpoint returns:

```json
{
  "status": "OK" | "WARN" | "ERROR",
  "checks": [
    { "name": "...", "status": "OK" | "WARN" | "ERROR", "details": {} }
  ]
}
```

## Severity classification

- **ERROR**: Financial inconsistency that should not happen and must be triaged.
- **WARN**: Potentially explainable delay or workflow gap; needs monitoring/ops follow-up.
- **OK**: No issues detected.

## Invariants

### 1) Refund exists without CAPTURE ledger

- **What it detects**
  - At least one `LedgerEntry(eventType=REFUND)` exists for a `(orderId, paymentIntentId)` pair, but no `LedgerEntry(eventType=CAPTURE)` exists for that same pair.

- **Why it matters**
  - Refunds must be backed by a prior captured amount. Otherwise, accounting cannot be reconciled.

- **Severity**
  - **ERROR**

- **Ops response**
  - Verify if the capture ledger entry is missing due to ingestion failure.
  - Confirm order/payment intent state; check reconciliation logs.

### 2) Refund amount > captured amount

- **What it detects**
  - For a `(orderId, paymentIntentId)` pair: `sum(abs(REFUND.amount)) > sum(CAPTURE.amount)`.

- **Why it matters**
  - Over-refunding is a direct financial loss or indicates a ledger corruption.

- **Severity**
  - **ERROR**

- **Ops response**
  - Investigate refund requests + any manual adjustments.
  - Validate capture totals and ensure no duplicated refund ledger entries.

### 3) Duplicate ledger entries (same dedupeKey)

- **What it detects**
  - Multiple `LedgerEntry` documents with the same `dedupeKey`.

- **Why it matters**
  - The ledger is designed to be append-only and idempotent with `dedupeKey` uniqueness. Duplicates imply DB/index corruption or unsafe backfill.

- **Severity**
  - **ERROR**

- **Ops response**
  - Check whether the unique index exists and is healthy.
  - Identify how duplicates were inserted (manual writes, migration, etc.).

### 4) Ledger total ≠ Order.paymentStatus

- **What it detects**
  - Order payment status disagrees with derived ledger status.

- **Derived ledger status (simplified)**
  - `capturedTotal <= 0` => UNPAID
  - `refundedTotal >= capturedTotal` => REFUNDED
  - else => PAID

- **Why it matters**
  - The order record is operational state, but the ledger is accounting truth. Mismatch indicates an operational flow bug, webhook ingestion gap, or manual edits.

- **Severity**
  - **WARN** in cases likely caused by delayed updates.
  - **ERROR** when the order claims PAID/REFUNDED but the ledger shows no capture.

- **Ops response**
  - Reconcile affected orders and compare with payment intent / webhook inbox entries.

### 5) Orphan ledger entries (no order/paymentIntent)

- **What it detects**
  - A `LedgerEntry` references an `orderId` or `paymentIntentId` that does not exist.

- **Why it matters**
  - Orphans break traceability and prevent correct reconciliation.

- **Severity**
  - **ERROR**

- **Ops response**
  - Determine whether parent documents were deleted or never created.
  - Investigate migrations or manual data operations.

### 6) Refund marked COMPLETED but no ledger entry

- **What it detects**
  - `RefundRequest(status=COMPLETED)` exists but there is no `LedgerEntry(eventType=REFUND)` with `refundId = RefundRequest._id`.

- **Why it matters**
  - Refund completion must be reflected in the accounting ledger.

- **Severity**
  - **ERROR**

- **Ops response**
  - Investigate refund state transitions and whether ledger append failed.
  - Check for duplicate key errors or transaction rollbacks.

## Notes

- This endpoint is designed for **detection only**.
- It does **not** auto-correct, backfill, or mutate any financial data.
