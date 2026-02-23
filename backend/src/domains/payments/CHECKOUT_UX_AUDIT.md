# Checkout UX Audit (PHASE 1)

## Scope

This document audits checkout UX risks and safety requirements for a webhook-first payments architecture.

Assumptions:

- The backend is the source of truth for payment status.
- Money truth is derived from:
  - Webhook `payment.captured` ingestion, and
  - Append-only `LedgerEntry(eventType=CAPTURE)`.
- The frontend must treat gateway redirects/SDK callbacks as **non-canonical hints**.

## 1) Pending payment UX risks

### Risk: user sees "Pending" too long and churns

- **What happens**
  - Payment is captured at gateway but webhook delivery/processing is delayed.
  - Order remains `PENDING` in UI even though money is deducted.

- **Consequence**
  - Customer panic, support load, duplicate attempts.

- **UX requirement**
  - Pending state must explain that payment confirmation can take time.
  - UI must provide safe next steps:
    - "We are verifying payment" messaging
    - a single "Check status" action (refreshing canonical backend state)
    - escalation path (support/receipt submission) without encouraging retries

### Risk: gateway app switching breaks user expectation

- **What happens**
  - UPI / app switching flows cause users to return late or via back button.

- **Consequence**
  - Customer repeats payment initiation.

- **UX requirement**
  - On return, UI must prefer resuming an existing attempt rather than creating a new one.

## 2) Retry panic risks

### Risk: multiple "Pay" clicks or repeated attempts create duplicates

- **What happens**
  - User retries while the first attempt is still in flight.
  - Mobile network jitter makes SDK callbacks unreliable.

- **Consequence**
  - Duplicate payments at gateway.

- **UX requirement**
  - Disable the primary pay action while an attempt is pending.
  - Never present two equally prominent retry actions.
  - Treat the payment attempt as a single in-flight operation with one canonical status.

### Risk: user refreshes and re-creates payment intent

- **What happens**
  - Page reload leads to a new intent without referencing the prior attempt.

- **Consequence**
  - Duplicate gateway orders / payments.

- **UX requirement**
  - Resume logic must be implemented (see refresh/resume section).

## 3) Refresh / resume behavior

### Required properties

- **Refresh is safe**
  - Refresh must never create a second attempt by default.

- **Resume is deterministic**
  - If an attempt exists, UI should re-use it and poll/cross-check canonical backend state.

### UX behaviors

- On opening checkout for an order:
  - fetch current order payment state
  - if an in-flight PaymentIntent exists, resume it

- On payment return / callback:
  - show pending verification state
  - poll backend status until resolved or timeout

## 4) Duplicate payment prevention rationale

### Why duplicates happen

- Mobile redirects/UPI app switching are not reliable as a single completion signal.
- Webhooks can be delayed; frontend callbacks can be missing.
- Users react to ambiguity by retrying.

### What prevents duplicates

- **Idempotent intent creation**
  - `POST /api/payment-intents` must be called with a stable `idempotencyKey` per order attempt.
  - Backend must return the same intent for retries of the same key.

- **Append-only ledger truth**
  - Only a ledger CAPTURE proves payment.
  - UI must not treat gateway redirects as final truth.

### UX design implication

- The UI should default to "resume or verify" rather than "retry".
- If retry is allowed, it must be guarded by explicit conditions (see CHECKOUT_UX_DESIGN).
