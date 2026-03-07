# Controlled Failure Simulations Test Plan

## Overview

This document describes controlled failure simulations to validate system resilience under realistic production failure scenarios. These tests verify that the payment and order systems handle edge cases gracefully without data corruption or inconsistent state.

---

## Scenario 1: Webhook Never Arrives

### Description
Payment is captured at Razorpay but the webhook never reaches our server due to network issues, misconfiguration, or Razorpay outage.

### How to Simulate

**Method A: Block Webhook Endpoint Temporarily**
```bash
# In test environment, add a middleware that returns 503 for webhook endpoint
# Or use iptables to drop incoming requests to /api/payments/webhooks/razorpay
```

**Method B: Use Invalid Webhook URL**
```bash
# Configure Razorpay test mode with an invalid webhook URL
# Or point webhook to a non-existent endpoint
```

**Method C: Test Script Approach**
1. Create a payment intent
2. Complete payment via Razorpay test mode
3. Prevent webhook from being processed (skip the webhook call)
4. Wait for reconciliation job to run (5+ minutes)

### Expected System Behavior

| Component | Behavior |
|-----------|----------|
| PaymentIntent | Remains in `GATEWAY_ORDER_CREATED` or `PAYMENT_PROCESSING` |
| Order | Remains `PENDING_PAYMENT` |
| Stuck Payment Scanner | Transitions to `PAYMENT_RECOVERABLE` after timeout |
| Reconciliation Service | Fetches status from Razorpay, marks as PAID |

### Pass Criteria

- [ ] Order eventually transitions to PAID (within 10 min)
- [ ] No duplicate orders created
- [ ] Payment status matches Razorpay ground truth
- [ ] No negative stock or double reservation

### Log Validation Steps

```bash
# Check for stuck payment detection
grep "stuck_payment_detected" logs/app.log

# Check for reconciliation success
grep "reconciled_success" logs/app.log

# Verify PaymentIntent state transitions
grep "PaymentIntent.*status.*CAPTURED" logs/app.log
```

---

## Scenario 2: Webhook Arrives Twice (Duplicate)

### Description
Razorpay sends the same webhook twice due to timeout retries or infrastructure issues.

### How to Simulate

**Method A: Manual Duplicate Request**
```bash
# Capture a real webhook payload
# Replay it twice within seconds
curl -X POST http://localhost:5001/api/payments/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: <valid_signature>" \
  -d '<webhook_payload>'

# Immediately send the same request again
```

**Method B: Test Script**
```typescript
// In test file
const webhookPayload = { /* captured payment event */ };
const signature = computeSignature(webhookPayload);

// Send twice
await request(app)
  .post("/api/payments/webhooks/razorpay")
  .set("X-Razorpay-Signature", signature)
  .send(webhookPayload);

await request(app)
  .post("/api/payments/webhooks/webhooks/razorpay")
  .set("X-Razorpay-Signature", signature)
  .send(webhookPayload);
```

### Expected System Behavior

| Component | Behavior |
|-----------|----------|
| WebhookEventInbox | First request creates record with `PROCESSED` status |
| Second Request | Finds existing record, returns 200 immediately (idempotent) |
| Order | Updated only once |
| Ledger | Only one entry created |

### Pass Criteria

- [ ] Both webhook calls return 200
- [ ] Only one order state change occurs
- [ ] Only one ledger entry created
- [ ] No duplicate inventory reservation commits

### Log Validation Steps

```bash
# Check for idempotent handling
grep "WebhookEventInbox.*already.*processed" logs/app.log

# Count ledger entries for the payment
db.ledgerentries.countDocuments({ paymentId: "<payment_id>" })
# Expected: 1

# Check order status updated only once
grep "order.*status.*PAID" logs/app.log | wc -l
# Expected: 1
```

---

## Scenario 3: Razorpay API Timeout

### Description
Calls to Razorpay API (fetch payment status, create order) timeout or fail.

### How to Simulate

**Method A: Network Proxy**
```bash
# Use a proxy to introduce delays
# Or configure Razorpay SDK with very low timeout
```

**Method B: Mock in Test**
```typescript
// Mock Razorpay adapter to throw timeout error
jest.spyOn(razorpayAdapter, 'fetchPaymentStatus')
  .mockRejectedValue(new Error('ETIMEDOUT'));
```

**Method C: Environment Variable**
```bash
# Set impossibly low timeout
RAZORPAY_TIMEOUT_MS=1
```

### Expected System Behavior

| Component | Behavior |
|-----------|----------|
| Payment Intent Creation | Returns error to client, no order created |
| Reconciliation Service | Logs error, continues processing other orders |
| Webhook Processing | Not affected (webhooks are incoming) |
| Logger | Captures error with `type: PAYMENT` tag |

### Pass Criteria

- [ ] Client receives appropriate error message
- [ ] No orphaned PaymentIntent records
- [ ] System retries on next reconciliation cycle
- [ ] Error logged to Sentry with proper tagging

### Log Validation Steps

```bash
# Check for timeout errors
grep "ETIMEDOUT\|ECONNRESET\|Razorpay.*timeout" logs/app.log

# Check Sentry for captured errors
# Look for type: PAYMENT tag

# Verify no orphaned payment intents
db.paymentintents.find({
  status: "GATEWAY_ORDER_CREATED",
  gatewayOrderId: { $exists: false }
})
```

---

## Scenario 4: DB Disconnect During Order Creation

### Description
MongoDB connection drops mid-transaction during order creation or payment finalization.

### How to Simulate

**Method A: Kill MongoDB Mid-Request**
```bash
# Start order creation request
# During execution:
docker stop mongodb
# Or
kill -9 <mongod_pid>
```

**Method B: Test with Mock**
```typescript
// Mock mongoose to throw connection error
jest.spyOn(mongoose, 'startSession')
  .mockRejectedValue(new Error('Connection refused'));
```

**Method C: Network Partition**
```bash
# Use iptables to drop MongoDB traffic mid-test
iptables -A INPUT -p tcp --dport 27017 -j DROP
```

### Expected System Behavior

| Component | Behavior |
|-----------|----------|
| Transaction | Aborted, no partial writes |
| Client | Receives 500 or 503 error |
| Inventory | Reserved stock rolled back (if transactional) |
| Cart | Not cleared (order failed) |

### Pass Criteria

- [ ] No partial order created
- [ ] No inventory reserved without order
- [ ] Cart remains intact for retry
- [ ] Client can retry successfully after DB reconnects

### Log Validation Steps

```bash
# Check for connection errors
grep "MongoNetworkError\|Connection refused" logs/app.log

# Verify no orphaned reservations
db.inventoryreservations.find({ status: "ACTIVE", orderId: null })

# Verify cart still has items
db.carts.find({ userId: "<user_id>" })
```

---

## Scenario 5: User Refresh During Payment

### Description
User refreshes the browser page while Razorpay checkout is open or after payment submission.

### How to Simulate

**Method A: Manual Browser Test**
1. Add items to cart
2. Click "Pay Now" to open Razorpay checkout
3. Complete payment
4. Immediately refresh the page (F5 or Cmd+R)
5. Observe page state

**Method B: Test Script**
```typescript
// Simulate: Start checkout, then poll for status
const intent = await createPaymentIntent();

// Simulate refresh: Clear local state, re-fetch
const freshIntent = await fetchPaymentIntent(intent._id);

// Complete payment via webhook simulation
await processWebhook({ paymentId: intent.paymentId, status: 'captured' });

// User returns and polls
const status = await pollPaymentStatus(intent._id);
```

### Expected System Behavior

| Component | Behavior |
|-----------|----------|
| Frontend | Loads payment session from storage or fetches from backend |
| Backend | PaymentIntent persists state across requests |
| Poll Endpoint | Returns current payment status |
| Order | Created via webhook or reconciliation |

### Pass Criteria

- [ ] User sees correct payment status after refresh
- [ ] No duplicate payment intents created
- [ ] Order eventually visible in order history
- [ ] No double charge

### Log Validation Steps

```bash
# Check payment session persistence
grep "paymentSession.*load" logs/frontend.log

# Check for duplicate intent prevention
grep "idempotencyKey.*duplicate" logs/app.log

# Verify single payment intent per order
db.paymentintents.countDocuments({ orderId: "<order_id>" })
# Expected: 1
```

---

## Scenario 6: User Closes Tab Mid-Checkout

### Description
User closes browser tab while payment is processing, abandoning the session.

### How to Simulate

**Method A: Manual Browser Test**
1. Add items to cart
2. Click "Pay Now"
3. Close the tab immediately (before payment completes)
4. Wait for payment to complete (webhook arrives)
5. Open new tab and check order history

**Method B: Automated Test**
```typescript
// 1. Create payment intent
const intent = await createPaymentIntent();

// 2. Simulate user leaving (no polling)
// Don't call poll endpoint

// 3. Webhook arrives
await processWebhook({ paymentId: intent.paymentId, status: 'captured' });

// 4. User returns later (new session)
const orders = await fetchOrders();
expect(orders).toContainEqual({ id: intent.orderId, status: 'PAID' });
```

### Expected System Behavior

| Component | Behavior |
|-----------|----------|
| Webhook | Processes normally, order created |
| Inventory | Reserved and committed |
| User Session | Payment session expires, but order persists |
| Order Status | Visible when user returns |

### Pass Criteria

- [ ] Order created successfully via webhook
- [ ] Inventory correctly reserved and committed
- [ ] User can see order in history when returning
- [ ] No abandoned reservations left

### Log Validation Steps

```bash
# Check webhook processed without user session
grep "webhook.*processed.*user.*null" logs/app.log

# Verify inventory committed
db.inventoryreservations.find({
  orderId: "<order_id>",
  status: "COMMITTED"
})

# Check order visible in user's order list
db.orders.find({ userId: "<user_id>", status: "PAID" })
```

---

## Test Execution Matrix

| Scenario | Priority | Frequency | Environment |
|----------|----------|-----------|-------------|
| Webhook Never Arrives | High | Weekly | Staging |
| Webhook Duplicate | Critical | Per-deploy | CI + Staging |
| Razorpay Timeout | High | Weekly | Staging |
| DB Disconnect | Medium | Monthly | Staging |
| User Refresh | High | Per-release | Staging + Manual |
| User Closes Tab | Medium | Per-release | Manual |

---

## Automation Scripts Location

```
backend/tests/failure/
├── webhook-never-arrives.test.ts
├── webhook-duplicate.test.ts
├── razorpay-timeout.test.ts
├── db-disconnect.test.ts
├── user-refresh.test.ts
└── user-abandon.test.ts
```

---

## Monitoring & Alerting

After running simulations, verify Sentry captured errors correctly:

```bash
# Sentry query for payment errors
tag:type:PAYMENT

# Sentry query for inventory errors
tag:type:INVENTORY

# Check rate limit events
tag:type:SECURITY rate_limit_exceeded
```

---

## Rollback Procedures

If any simulation causes persistent issues:

1. **Orphaned Reservations**: Run inventory sweeper
   ```bash
   npm run sweep:inventory
   ```

2. **Stuck Payment Intents**: Run stuck payment scanner manually
   ```bash
   npm run scan:stuck-payments
   ```

3. **Reconcile Missing Payments**: Run reconciliation manually
   ```bash
   npm run reconcile:payments
   ```

---

## Notes

- Never run these simulations in production
- Always use test-mode Razorpay credentials
- Clean up test data after each simulation
- Document any unexpected behaviors as bugs
