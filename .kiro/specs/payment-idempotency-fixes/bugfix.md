# Payment System Idempotency & Race Condition Fixes

## Bug Summary

The payment system experiences duplicate orders, duplicate admin assignments, and race conditions during payment finalization despite having idempotency mechanisms in place. This is a critical production issue affecting data integrity and user experience.

## Observed Symptoms

1. **Duplicate Orders**: Same order created multiple times for a single user action
2. **Duplicate Admin Assignments**: Same order assigned to admin multiple times
3. **Duplicate Razorpay Gateway Orders**: Multiple gateway orders created for single payment intent
4. **Payment Finalization Races**: Multiple workers attempting to mark order as PAID simultaneously

## Root Causes Identified

### RC-1: Optional Idempotency Key
**Location**: `backend/src/models/Order.ts`, `backend/src/domains/operations/services/orderBuilder.ts`

**Current State**:
```typescript
idempotencyKey?: string;  // Optional field
```

**Problem**: 
- Optional idempotency key allows non-deterministic behavior
- Partial index only enforces uniqueness when key exists
- Mobile retries, double-clicks, and network retries can bypass idempotency

**Evidence**:
```typescript
// Current index with partialFilterExpression
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);
```

### RC-2: Missing Cart Hash Deduplication
**Location**: `backend/src/domains/operations/services/orderBuilder.ts`

**Problem**:
- No content-based deduplication
- Different idempotency keys can create duplicate orders with identical cart contents
- Amazon-style cart hash missing

**Impact**: Users can create multiple orders with same items, address, and total by retrying with different keys

### RC-3: Non-Atomic Finalization Check
**Location**: `backend/src/domains/payments/services/orderPaymentFinalizer.ts`

**Current State**:
```typescript
const existing = await Order.findById(args.orderId);
if ((existing as any).finalizedAt) {
  return { updated: false };
}
// ... later ...
await Order.updateOne({ _id: args.orderId }, { $set: update });
```

**Problem**:
- Check and update are separate operations (not atomic)
- Race window between read and write
- Multiple workers can both pass the check and both write

**Race Condition Timeline**:
```
Worker A: Read order (finalizedAt = null)
Worker B: Read order (finalizedAt = null)  ← RACE WINDOW
Worker A: Write PAID + finalizedAt
Worker B: Write PAID + finalizedAt  ← DUPLICATE WRITE
```

### RC-4: Razorpay Gateway Creation Race
**Location**: `backend/src/domains/payments/services/paymentIntentService.ts`

**Current State**:
```typescript
const claim = await PaymentIntent.updateOne(
  { _id: intent._id, gatewayCreateAttemptedAt: { $exists: false } },
  { $set: { gatewayCreateAttemptedAt: new Date() } }
);
if (Number((claim as any).modifiedCount) === 0) {
  // Wait for existing gatewayOrderId
  const existing = await PaymentIntent.findById(intent._id);
  if (existing && String((existing as any).gatewayOrderId || "").trim()) {
    return { /* existing */ };
  }
  // ⚠️ PROBLEM: If gatewayOrderId not saved yet, proceeds to call Razorpay again
}
```

**Problem**:
- Crash window: mark `gatewayCreateAttemptedAt` → crash → retry calls Razorpay AGAIN
- Loser of atomic claim can still proceed if winner crashes before saving `gatewayOrderId`
- Creates duplicate gateway orders at Razorpay

### RC-5: Non-Idempotent Admin Assignment
**Location**: Admin assignment consumer (not shown in provided files)

**Problem**:
- Duplicate ORDER_CREATED events trigger multiple admin assignments
- No atomic guard preventing duplicate assignments
- Missing `adminAssigned` flag or equivalent

### RC-6: Event ID Generation Inconsistency
**Location**: `backend/src/domains/events/order.events.ts`

**Current State**:
```typescript
function createOrderEvent(params: { eventId?: string; /* ... */ }) {
  return {
    eventId: eventId || uuidv4(),  // ⚠️ Random if not provided
    // ...
  };
}
```

**Problem**:
- `createOrderEvent` defaults to random UUID if `eventId` not provided
- Only `createOrderCreatedEvent` in `orderBuilder.ts` uses `stableEventId`
- Other event creators may generate random IDs
- Transaction retries can create duplicate events with different IDs

## Bug Condition C(X)

**Definition**: The system allows duplicate orders, duplicate admin assignments, and race conditions during payment finalization.

**Formal Condition**:
```
C(X) = ∃ order O, user U, cart items I, timestamp T:
  (
    // Duplicate order creation
    (count(orders where userId=U AND items=I AND createdAt≈T) > 1)
    
    OR
    
    // Duplicate admin assignment
    (count(admin_assignments where orderId=O) > 1)
    
    OR
    
    // Finalization race
    (count(finalization_writes where orderId=O) > 1)
    
    OR
    
    // Duplicate gateway orders
    (count(razorpay_orders where paymentIntentId=P) > 1)
  )
```

**Preservation Check**: After fixes, C(X) must be FALSE for all valid inputs.

## Impact Assessment

### Data Integrity
- **Severity**: CRITICAL
- **Impact**: Duplicate orders corrupt inventory, billing, and fulfillment
- **Affected Users**: All users during payment flow

### Financial Impact
- **Severity**: HIGH
- **Impact**: 
  - Duplicate charges (if payment succeeds multiple times)
  - Inventory overselling
  - Reconciliation complexity

### User Experience
- **Severity**: HIGH
- **Impact**:
  - Confusion from duplicate orders
  - Support burden
  - Trust erosion

## Correctness Properties

### CP-1: Order Creation Idempotency
**Property**: For any user U and idempotency key K, exactly one order is created regardless of retry count.

**Formal**:
```
∀ U, K, N (N = retry count):
  createOrder(U, K) executed N times
  ⇒ count(orders where userId=U AND idempotencyKey=K) = 1
```

**Test Strategy**: Property-based test with concurrent requests using same idempotency key

### CP-2: Cart Content Deduplication
**Property**: For any user U and cart hash H within time window W, exactly one order is created.

**Formal**:
```
∀ U, H, W (W = 5 minutes):
  createOrder(U, cart) executed with hash(cart)=H within window W
  ⇒ count(orders where userId=U AND cartHash=H AND createdAt∈W) = 1
```

**Test Strategy**: Property-based test with identical cart contents, different idempotency keys

### CP-3: Atomic Finalization
**Property**: For any order O, exactly one finalization write succeeds regardless of concurrent attempts.

**Formal**:
```
∀ O, N (N = concurrent workers):
  finalizeOrder(O) executed by N workers concurrently
  ⇒ count(successful_writes where orderId=O) = 1
  ∧ ∀ worker W: W.result ∈ {success, already_finalized}
```

**Test Strategy**: Property-based test with concurrent finalization attempts

### CP-4: Single Gateway Order Creation
**Property**: For any payment intent P, exactly one Razorpay gateway order is created.

**Formal**:
```
∀ P:
  createGatewayOrder(P) executed N times (including retries)
  ⇒ count(razorpay_orders where paymentIntentId=P) = 1
```

**Test Strategy**: Property-based test with crash-retry simulation

### CP-5: Idempotent Admin Assignment
**Property**: For any order O, exactly one admin assignment occurs regardless of event duplicates.

**Formal**:
```
∀ O, N (N = duplicate events):
  assignAdmin(O) triggered N times
  ⇒ count(admin_assignments where orderId=O) = 1
```

**Test Strategy**: Property-based test with duplicate ORDER_CREATED events

## Fix Verification Strategy

### Phase 1: Unit Tests
- Test each atomic operation in isolation
- Verify compare-and-set semantics
- Test idempotency key validation

### Phase 2: Property-Based Tests
- Generate random concurrent scenarios
- Verify correctness properties hold
- Test with crash-retry simulation

### Phase 3: Integration Tests
- Test full order creation flow
- Test payment finalization flow
- Test admin assignment flow

### Phase 4: Load Testing
- Simulate production concurrency
- Verify no duplicates under load
- Measure performance impact

## Success Criteria

1. **Zero Duplicates**: No duplicate orders in 10,000 concurrent test runs
2. **Atomic Operations**: All finalization operations are atomic (single DB write)
3. **Idempotency**: All operations are idempotent (safe to retry)
4. **Performance**: No significant performance degradation (<5% latency increase)
5. **Backward Compatibility**: Existing orders continue to work

## Migration Strategy

### Phase 1: Schema Changes (Non-Breaking)
1. Add `cartHash` field (optional initially)
2. Add `adminAssigned` field (optional initially)
3. Deploy schema changes

### Phase 2: Code Changes (Backward Compatible)
1. Update order creation to generate cart hash
2. Update finalization to use atomic compare-and-set
3. Update gateway creation to enforce strict single creation
4. Update admin assignment to use atomic guard
5. Deploy code changes

### Phase 3: Enforcement (Breaking)
1. Make `idempotencyKey` required in API
2. Update index to enforce uniqueness without partial filter
3. Deploy enforcement

### Phase 4: Cleanup
1. Backfill missing cart hashes
2. Remove old idempotency logic
3. Monitor for issues

## Rollback Plan

### If Issues Detected
1. Revert API enforcement (make idempotency key optional again)
2. Revert atomic operations (restore old logic)
3. Keep schema changes (backward compatible)
4. Investigate and fix issues
5. Re-deploy with fixes

### Rollback Triggers
- Duplicate orders detected in production
- Payment finalization failures >1%
- Order creation latency >2x baseline
- Customer complaints about duplicate charges

## Monitoring & Alerts

### Metrics to Track
1. **Duplicate Order Rate**: Count of orders with same userId + cartHash within 5 minutes
2. **Finalization Conflicts**: Count of `modifiedCount=0` in finalization
3. **Gateway Creation Conflicts**: Count of claim failures in gateway creation
4. **Admin Assignment Duplicates**: Count of duplicate assignments per order

### Alerts
1. **Critical**: Duplicate order rate >0.1%
2. **Warning**: Finalization conflicts >5% of attempts
3. **Info**: Gateway creation conflicts (expected during retries)

## References

- Amazon-style idempotency: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- MongoDB atomic operations: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- Payment system design: Stripe's idempotency implementation
