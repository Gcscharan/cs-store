# Payments & Finance — Production Readiness (PHASE 5)

## 1) Freeze Boundaries

### Payment-critical modules (treat as frozen)

The following areas are **payment-critical** and must not be changed casually:

- `src/domains/payments/services/webhookProcessor.ts` (canonical webhook processing)
- `src/domains/payments/services/ledgerService.ts` (append-only ledger)
- `src/domains/payments/services/orderPaymentFinalizer.ts` (order PAID derived from ledger CAPTURE)
- `src/domains/payments/services/paymentIntentService.ts` (PaymentIntent creation + gateway order create)
- `src/domains/payments/services/paymentIntentStateMachine.ts` (allowed transitions)
- `src/domains/payments/models/*` (PaymentIntent, LedgerEntry, inbox)
- `src/domains/payments/routes/*` (canonical external routes)
- `src/routes/internalPaymentRecoveryExecute.ts` (admin-only state transition)

### Change process required for payment-critical modules

Any change touching the above must include:

- A feature flag (off-by-default) OR explicit kill-switch plan
- A clear rollback procedure
- Test coverage additions for the new behavior
- Explicit statement of what does **not** change (money movement, webhook semantics)

## 2) Kill Switches

These are **configuration-only** and intended for incident response.

### Backend

- `PAYMENTS_CREATE_INTENT_RAZORPAY_ENABLED` (default: `true`)
  - When `false`, blocks creation of *new* Razorpay PaymentIntents.
  - Safety: **idempotent retries** (same `Idempotency-Key`) still return the previously created intent.

- `PAYMENT_RECOVERY_EXECUTION_ENABLED` (default: `true`)
  - When `false`, blocks `/internal/payments/recovery-execute/*`.
  - Note: `PAYMENT_AUTO_RECOVERY_ENABLED` is still required.

- `REFUND_EXECUTION_ENABLED` (default: `true`)
  - When `false`, blocks admin refund initiation via `POST /internal/refunds`.
  - Note: refund history queries remain available (`GET /internal/refunds/:orderId`).

- `PAYMENTS_LEGACY_ROUTES_BLOCKED` (default: `false`)
  - Intended for guarding legacy routes if they are ever mounted.

### Frontend (UI-only)

- `VITE_REFUNDS_UI_ENABLED` (default: `true`)
  - When `false`, hides the refunds section in Order details UI.
  - UI-only; does not change refund processing.

## 3) Incident Playbooks (quick references)

### Customer says "money deducted" but order pending

- Use: `GET /internal/payments/reconciliation`
- Use: `GET /internal/payments/verify?orderId=<id>` (or paymentIntentId)
- Use: `GET /internal/payments/recovery-suggestion?...`
- If and only if approved: `POST /internal/payments/recovery-execute/:paymentIntentId`
- Finance cross-check: `/internal/finance/revenue-ledger` (ledger CAPTURE is authoritative)

Truth note:

- Razorpay paid state is derived from webhook + ledger capture in the payments domain.
- UPI/COD payment status may be set via operations flows and is not part of the Razorpay ledger/webhook truth chain.

### Duplicate payment suspected

- Check duplicate gateway event IDs in ledger CAPTURE (`LedgerEntry.gatewayEventId`)
- Use: `/internal/payments/verify` to compare gateway truth vs internal state
- Use: `/internal/finance/revenue-ledger` export to trace event IDs

## 3A) Checkout UX (PHASE 1)

- See: `src/domains/payments/CHECKOUT_UX_AUDIT.md`
- See: `src/domains/payments/CHECKOUT_UX_DESIGN.md`

### Refund delayed beyond SLA

- Check refund ledger truth: `/internal/finance/refund-ledger`
- Use verification endpoint to fetch gateway refund status (read-only)
- Confirm refund recognition rules: refunds are recognized on completion timestamp

### Gateway outage

- Flip kill switch to stop creating new intents:
  - `PAYMENTS_CREATE_INTENT_RAZORPAY_ENABLED=false`
- Keep webhook endpoint running (do not block capture processing)
- Use reconciliation report to track non-terminal intents

## 4) Deprecation Safety (do not delete)

The following are **legacy** and must not be used as accounting truth:

- `src/domains/finance/controllers/razorpayController.ts`
- `src/domains/finance/controllers/webhookController.ts`
- `src/domains/finance/routes/*`
- `src/routes/paymentRoutes.js`

These files may exist for historical reasons. They should remain unmounted in `app.ts`.

## 5) Final Verification

Before shipping payment-related changes:

- Backend: `npm test` and `npm run build`
- Frontend: `npm run build`

Definition of done:

- No changes to money movement
- No silent behavior changes
- Flags default to preserving existing behavior
