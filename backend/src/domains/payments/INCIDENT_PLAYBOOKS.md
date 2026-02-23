# Payments & Finance — Incident Playbooks (PHASE 5)

These playbooks are internal guidance for incident response.

Core rule: **do not move money automatically**. Prefer read-only verification + deterministic reports.

## 1) Customer says: "Money deducted but order pending"

### Goal
Determine whether the payment was captured at the gateway and whether internal state is missing a webhook/ledger entry.

### Read-only checks

- Reconciliation (internal state)
  - `GET /internal/payments/reconciliation`
  - Filter for the order’s latest PaymentIntent.

- Verification (gateway truth)
  - `GET /internal/payments/verify?orderId=<orderId>`
  - Or `...verify?paymentIntentId=<paymentIntentId>`

- Finance truth (ledger)
  - `GET /internal/finance/revenue-ledger?from=<...>&to=<...>`
  - Confirm whether there is a `CAPTURE` ledger row for the order/intent.

### If discrepancy indicates WEBHOOK_MISSING
- Use recovery suggestion:
  - `GET /internal/payments/recovery-suggestion?paymentIntentId=<id>`
- If approved by an admin and explicitly confirmed:
  - `POST /internal/payments/recovery-execute/:paymentIntentId`

### What NOT to do
- Do not mark order paid manually.
- Do not trigger any refund/capture via code.
- Do not “fix” records in DB.

## 2) Duplicate payment suspected

### Goal
Identify whether multiple captures occurred for the same order, or whether there are duplicate gateway events.

### Checks
- Revenue ledger export:
  - `GET /internal/finance/revenue-ledger.csv`
  - Trace duplicates by `gatewayEventId` (ledger raw) and by `(orderId, paymentIntentId)`.

- Internal verification:
  - `GET /internal/payments/verify?orderId=<orderId>`

- PaymentIntent attempts:
  - Inspect multiple `PaymentIntent` rows for the order (attemptNo), and ensure only one is `CAPTURED`.

### What NOT to do
- Do not delete intents.
- Do not change ledger entries.

## 3) Refund delayed beyond SLA

### Goal
Determine if the refund is initiated vs completed at gateway, and confirm recognition rules.

### Checks
- Refund ledger:
  - `GET /internal/finance/refund-ledger?from=<...>&to=<...>`
  - Refunds are recognized on completion date when present in ledger.

- Verification:
  - `GET /internal/payments/verify?orderId=<orderId>`
  - Inspect gateway refund objects.

### What NOT to do
- Do not promise instant refund; banks may take time.
- Do not backdate or recompute historical rows.

## 4) Gateway outage

### Goal
Stop creating new payment sessions while keeping webhook ingestion and reconciliation available.

### Mitigation (kill switches)
- Disable new Razorpay PaymentIntent creation:
  - `PAYMENTS_CREATE_INTENT_RAZORPAY_ENABLED=false`

### Operational monitoring
- Reconciliation report for in-flight:
  - `GET /internal/payments/reconciliation`

### What NOT to do
- Do not disable webhook endpoint.
- Do not alter capture/refund execution paths.
