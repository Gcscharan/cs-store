# Payments Domain (Webhook-first Razorpay)

## Canonical Endpoints

- `POST /api/payment-intents`
- `POST /api/webhooks/razorpay`

## Manual Test: Create PaymentIntent

### Request

- **Endpoint**: `POST /api/payment-intents`
- **Auth**: Required (Bearer token)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <access_token>`
  - Optional: `Idempotency-Key: <string>`

Body:

```json
{
  "orderId": "<valid_order_id>",
  "method": "RAZORPAY",
  "idempotencyKey": "order_<id>_attempt_1"
}
```

### Expected

- `PaymentIntent` is created (or reused if the same `idempotencyKey` is sent)
- Attempt count is enforced (max 3 per Order)
- A Razorpay order is created via `RazorpayAdapter`
- Response contains `checkoutPayload` with **public key only**

## Manual Test: Razorpay Webhook (payment.captured)

### Trigger

Use Razorpay Dashboard:

- Dashboard → Webhooks → Send Test Event
- Event: `payment.captured`

### Expected Backend Effects

- `WebhookEventInbox` entry is created (deduped by gateway event id)
- `LedgerEntry` appended with `eventType=CAPTURE` (append-only, deduped by `dedupeKey`)
- `PaymentIntent` transitions to `CAPTURED`
- Order is finalized only from ledger CAPTURE via `orderPaymentFinalizer`

### Idempotency Expectations

- Duplicate webhook deliveries must:
  - return HTTP 200
  - not append additional ledger entries

## Stuck Payment Scanner (classification-only)

The backend runs a periodic scanner that classifies **stale Razorpay PaymentIntents** for recovery and audit.

What “stuck payment” means:

- A `PaymentIntent` that has remained in a non-terminal state beyond expected time thresholds.

Safety guarantees:

- The scanner is **non-destructive** and **does not change money state**.
- It does **not** auto-refund or auto-cancel.
- It does **not** mark Orders as PAID/FAILED.
- It never touches intents that are already `CAPTURED` (or Orders that are already `PAID`).

The scanner only annotates intents for manual/admin follow-up (e.g., `PAYMENT_RECOVERABLE`, `VERIFYING`, or `isLocked`).

## Internal Reconciliation (read-only)

Endpoint:

- `GET /internal/payments/reconciliation`

Purpose:

- Provides **internal/admin** visibility into non-terminal Razorpay `PaymentIntent`s that may require manual reconciliation.

Safety guarantees:

- **READ-ONLY — no money movement.**
- Does not retry/capture/refund/cancel.
- Does not transition `PaymentIntent` or `Order` state.

This endpoint complements the Stuck Payment Scanner by surfacing intents already classified (e.g., `PAYMENT_RECOVERABLE`, `VERIFYING`, and locked intents).

## Manual Recovery Hooks (admin-initiated)

Endpoint:

- `POST /internal/payments/recovery/:paymentIntentId/action`

Purpose:

- Allows an **admin** to explicitly classify or lock a stuck `PaymentIntent` after reviewing reconciliation data.

Safety guarantees:

- **NO MONEY MOVEMENT.**
- No Razorpay API calls.
- No webhook simulation.
- Never marks Orders as PAID/FAILED.

Relationship:

- The Stuck Payment Scanner classifies stale intents.
- The Reconciliation endpoint makes those non-terminal intents visible.
- Manual Recovery provides **explicit, admin-triggered** classification/locking only.

## Razorpay Verification (Read-Only)

Purpose:

- Provides a **read-only gateway truth fetcher** for reconciliation.
- Used to verify a Razorpay Order / Payment / Refunds without trusting frontend signals or webhook delivery.

Safety guarantees:

- **READ-ONLY — no money movement.**
- Only issues **GET** requests to Razorpay.
- Never captures, refunds, cancels, or replays webhooks.
- Never mutates the database.

Notes:

- This module is designed as a pure, isolated island under `src/domains/payments/verification/`.
- Intended to be used by STEP 3B.2+.

## Internal Payment Verification (STEP 3B.2)

Endpoint:

- `GET /internal/payments/verify`

Access:

- `authenticateToken` + `requireRole(["admin"])`

Purpose:

- Correlates **internal read-only** state (`PaymentIntent` / `Order`) with **gateway truth** from Razorpay (STEP 3B.1).
- Produces a deterministic discrepancy assessment for safe human decision-making before using Manual Recovery Hooks (STEP 3A.3).

Safety guarantees:

- **READ-ONLY — no money movement.**
- No Razorpay write APIs.
- No webhook replay.
- No database writes.

Assessment output:

- `WEBHOOK_MISSING`
- `AWAITING_CAPTURE`
- `GATEWAY_FAILED`
- `NO_GATEWAY_PAYMENT`
- `CONSISTENT_PAID`

## Assisted Auto-Recovery Suggestions (STEP 3B.3)

Endpoint:

- `GET /internal/payments/recovery-suggestion`

Access:

- `authenticateToken` + `requireRole(["admin"])`

Purpose:

- Converts verification facts (STEP 3B.2) into deterministic, human-in-the-loop recovery suggestions.
- Suggestions are used by admins to decide whether to execute Manual Recovery Hooks (STEP 3A.3).

Safety guarantees:

- **READ-ONLY — no money movement.**
- No Razorpay calls.
- No webhook replay.
- No database writes.
- `canAutoExecute` is `true` only when the feature flag is enabled and the suggested action is allowed by the guarded execution FSM.

## STEP 4 — Guarded Auto-Recovery (Feature-Flagged)

Endpoint:

- `POST /internal/payments/recovery-execute/:paymentIntentId`

Access:

- `authenticateToken` + `requireRole(["admin"])`

Feature flag:

- Execution is allowed only when `PAYMENT_AUTO_RECOVERY_ENABLED === "true"`.
- When disabled, the endpoint returns `403 { error: "FEATURE_DISABLED" }`.

Purpose:

- Converts a suggested action into an **admin-initiated, single state transition** on a `PaymentIntent`.
- This is strictly **human-in-the-loop** and is intended to be invoked from the Ops UI with explicit typed confirmation.

Hard safety guarantees:

- **NO MONEY MOVEMENT.**
- No Razorpay write APIs.
- No refunds/captures/cancels.
- No webhook simulation.
- Never marks Orders as `PAID`.

Request requirements (strict):

```json
{
  "action": "MARK_VERIFYING" | "MARK_RECOVERABLE",
  "reason": "string (min 15 chars)",
  "confirm": "YES_I_UNDERSTAND_THIS_CHANGES_STATE"
}
```

FSM enforcement:

- Execution re-validates the current `PaymentIntent` and `Order` state inside a transaction.
- Attempts to execute from disallowed states return `409 { error: "INVALID_STATE_TRANSITION" }`.

Audit logging (append-only):

- Successful executions write a `PaymentRecoveryExecutionAudit` record within the same transaction.
- The audit includes: `paymentIntentId`, `orderId`, `action`, `previousStatus`, `newStatus`, `adminUserId`, `adminEmail`, `reason`, `executedAt`, and `featureFlagVersion`.

## Production Readiness (PHASE 5)

- See: `src/domains/payments/PRODUCTION_READINESS.md`
- See: `src/domains/payments/INCIDENT_PLAYBOOKS.md`

## Checkout UX (PHASE 1)

- See: `src/domains/payments/CHECKOUT_UX_AUDIT.md`
- See: `src/domains/payments/CHECKOUT_UX_DESIGN.md`
