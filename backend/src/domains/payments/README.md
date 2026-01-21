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
