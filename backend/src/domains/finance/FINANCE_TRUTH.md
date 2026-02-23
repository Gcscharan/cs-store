# Finance Truth Sources (PHASE 4.1)

This document defines the **authoritative, accounting-safe sources of truth** for payments/refunds reporting.

Constraints:

- Reporting is **read-only**.
- Do **not** infer PAID/REFUNDED unless backend truth already confirms it.
- Prefer **append-only / immutable** sources.

## Canonical money-movement truth (Razorpay)

### LedgerEntry (authoritative for gateway money events)

- **Collection/model:** `LedgerEntry` (`backend/src/domains/payments/models/LedgerEntry.ts`)
- **Write path:** `appendLedgerEntry()` (`backend/src/domains/payments/services/ledgerService.ts`)
- **Current usage:** `processRazorpayWebhook()` appends a ledger row on `payment.captured` (`backend/src/domains/payments/services/webhookProcessor.ts`).

Ledger fields:

- `eventType`: one of `AUTH | CAPTURE | FAIL | REFUND` (`backend/src/domains/payments/types.ts`)
- `amount`, `currency`
- `gateway`, `gatewayEventId`
- `dedupeKey` (**unique**, enforces idempotency)
- `occurredAt` (gateway-provided time when available)
- `recordedAt` (server record time)

Accounting rule:

- **Captured revenue must be recognized from `LedgerEntry(eventType=CAPTURE)`**, preferably using `occurredAt` when present, otherwise `recordedAt`.

### WebhookEventInbox (audit/idempotency, not accounting)

- **Collection/model:** `WebhookEventInbox` (`backend/src/domains/payments/models/WebhookEventInbox.ts`)
- Purpose: webhook delivery dedupe + processing visibility.
- Not a money ledger and should not be used to compute amounts.

### PaymentIntent (operational state, not accounting)

- **Collection/model:** `PaymentIntent` (`backend/src/domains/payments/models/PaymentIntent.ts`)
- Purpose: orchestrates checkout attempts and reconciliation states.

Accounting note:

- PaymentIntent `status` indicates internal progress (e.g., `CAPTURED`, `PAYMENT_PROCESSING`) but **is not a standalone accounting source**.
- For reporting, it is useful for **operational KPIs** (attempts, failure/pending classification), but **revenue should come from LedgerEntry CAPTURE**.

## Canonical money-movement truth (COD)

### CodCollection (authoritative for COD cash/UPI collection)

- **Collection/model:** `CodCollection` (`backend/src/models/CodCollection.ts`)
- Properties:
  - `orderId`, `mode` (`CASH|UPI`), `amount`, `currency`, `collectedAt`
  - `idempotencyKey`
- Invariants:
  - `CodCollection` is **immutable** (pre-update hooks throw)
  - Unique by `orderId`

Accounting rule:

- **COD revenue must be recognized from `CodCollection.collectedAt`**, not from order creation.

## Canonical money-movement truth (UPI)

Current state:

- UPI orders can be marked paid via the operations endpoint:
  - `PUT /api/orders/:orderId/payment-status` (`backend/src/domains/operations/controllers/orderController.ts`)

Accounting rule:

- This is **not** part of the Razorpay ledger/webhook pipeline.
- For finance reporting, **do not treat `Order.paymentStatus` alone as UPI accounting truth** unless paired with an immutable UPI collection source.

## Order summary fields (supporting, not primary ledger)

### Order amounts

- **Collection/model:** `Order` (`backend/src/models/Order.ts`)
- Relevant fields:
  - `totalAmount` (current field used for checkout)
  - `discount` (legacy/simple)
  - `deliveryFee`, `itemsTotal` (may exist)

Reporting rule:

- Prefer money amounts from ledger-like sources (LedgerEntry/CodCollection).
- Use `Order.totalAmount` to **enrich** ledger rows, but do not treat it as “earned” unless paired with a capture/collection event.

### Order.paymentStatus (derived business state)

Order stores multiple values (mixed casing variants):

- `PENDING`, `AWAITING_UPI_APPROVAL`, `PAID`, `FAILED`, plus lower-case `pending`, `paid`, `failed`, and `refunded`.

Canonical “paid” write path in the new architecture:

- `finalizeOrderOnCapturedPayment()` (`backend/src/domains/payments/services/orderPaymentFinalizer.ts`) sets `paymentStatus: "PAID"` after a ledger `CAPTURE` is appended.

Important:

- `Order.paymentStatus` is useful for **UI and quick filtering**, but for accounting we treat it as **secondary** to ledger/collection.

## Refund truth (current state)

### Current gap

- `LedgerEntry` supports `eventType=REFUND` in type definitions, but **the canonical webhook processor currently only appends `CAPTURE`**.
- There is **no canonical append-only refund ledger** in the new payments domain at this time.

### Existing (legacy) refund fields (NOT authoritative)

Migrations reference refund-related fields on `Order` and `Payment` (e.g., `refundAmount`, `refundCompletedAt`), but these are:

- introduced via migrations under `scripts/migrations/*`
- not clearly maintained by the canonical payments flow

Therefore, they must be treated as **legacy / best-effort metadata**, not accounting truth.

### Gateway verification (read-only, on-demand)

Admin verification fetches refunds from Razorpay (`backend/src/domains/payments/verification/razorpayVerificationService.ts`) as a **read-only** external call.

Accounting note:

- This is suitable for **ops reconciliation**, but **not** the primary source for financial reporting (expensive, non-deterministic over time, depends on external availability).

## Legacy / unsafe paths (do not use for finance reporting)

### domains/finance Razorpay controller

- `backend/src/domains/finance/controllers/razorpayController.ts` directly sets `order.paymentStatus = "paid"` / `"failed"`.
- This bypasses the canonical webhook inbox + ledger idempotency chain.

Status:

- The customer checkout flow is currently using `/api/payment-intents` (new architecture), so these legacy endpoints should be treated as **non-canonical**.
- **Do not compute finance metrics from this path.**

### Payment model

- `backend/src/models/Payment.ts` represents a legacy payments collection, with fields like `status: captured|failed|refunded`.

Status:

- Not used by the canonical PaymentIntent+ledger flow.
- Treat as **legacy** and avoid using it as finance truth.

## PHASE 4 implication

For PHASE 4 reporting, we will build accounting-safe views using:

- **Revenue ledger:**
  - Razorpay: `LedgerEntry(eventType=CAPTURE)`
  - COD: `CodCollection`
- **Refund ledger:**
  - (current gap) must be defined in a way that does not depend on mutable fields or ad-hoc gateway calls.
  - safest next step is to introduce an append-only, backend-truth refund event source (additive) or derive from an existing immutable stream if already present.

