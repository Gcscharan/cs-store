# Payment Idempotency Architecture

## Overview

This document explains the architectural decisions and implementation details behind the payment idempotency fixes. It describes the "why" behind each fix, the problems they solve, and how they work together to ensure data integrity.

**Target Audience**: Backend engineers, architects, technical leads

## Problem Statement

The payment system experienced critical race conditions and duplicate data issues:

1. **Duplicate Orders**: Same order created multiple times for a single user action
2. **Duplicate Admin Assignments**: Same order assigned to admin multiple times
3. **Duplicate Razorpay Gateway Orders**: Multiple gateway orders created for single payment intent
4. **Payment Finalization Races**: Multiple workers attempting to mark order as PAID simultaneously

These issues caused:
- Data integrity violations
- Financial discrepancies
- Inventory overselling
- Customer confusion
- Support burden

## Architectural Principles

### 1. Defense in Depth

We implement multiple layers of deduplication:

```
Layer 1: Client-Provided Idempotency Key
         ↓ (prevents client-side duplicates)
Layer 2: Content-Based Cart Hash
         ↓ (prevents server-side duplicates)
Layer 3: Atomic Database Operations
         ↓ (prevents race conditions)
Result: Zero Duplicates
```

**Why**: Single-layer protection is insufficient. Network retries, client bugs, and race conditions can bypass any single layer.

### 2. Atomic Operations

All critical state transitions use atomic compare-and-set operations:

```typescript
// BEFORE (Non-Atomic - Race Condition)
const order = await Order.findById(orderId);
if (order.finalizedAt) return;
await Order.updateOne({ _id: orderId }, { finalizedAt: new Date() });

// AFTER (Atomic - No Race)
const result = await Order.updateOne(
  { _id: orderId, finalizedAt: { $exists: false } },
  { $set: { finalizedAt: new Date() } }
);
// Only one worker succeeds (modifiedCount = 1)
```

**Why**: Separate read-then-write operations create race windows. Atomic operations eliminate these windows entirely.

### 3. Fail-Fast on Conflicts

When conflicts occur, we fail immediately rather than retrying:

```typescript
if (result.modifiedCount === 0) {
  // Already processed - return immediately
  return { updated: false };
}
```

**Why**: Retrying on conflicts can cause cascading failures. Failing fast allows the system to recover quickly and provides clear signals for monitoring.

## Component Architecture

### Component 1: Mandatory Idempotency Key

#### Problem

Optional idempotency keys allowed non-deterministic behavior:

```typescript
// BEFORE
idempotencyKey?: string;  // Optional

// Partial index only enforces uniqueness when key exists
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { 
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } }
  }
);
```

**Issue**: Requests without idempotency keys bypass uniqueness checks entirely.

#### Solution

Make idempotency key mandatory:

```typescript
// AFTER
idempotencyKey: string;  // Required

// Full index enforces uniqueness always
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);
```

**Benefits**:
- Every request is idempotent by design
- No special cases or conditional logic
- Database enforces uniqueness at all times

#### Why UUID v4?

- **Globally unique**: No coordination needed between clients
- **Unpredictable**: Cannot be guessed or enumerated
- **Standard format**: Easy to validate and debug
- **Collision-resistant**: 2^122 possible values

### Component 2: Cart Hash Deduplication

#### Problem

Different idempotency keys could create duplicate orders with identical cart contents:

```
User Action: Click "Place Order"
Request 1: idempotencyKey=key-1, cart=[A, B] → Order 1 created
Request 2: idempotencyKey=key-2, cart=[A, B] → Order 2 created (DUPLICATE!)
```

**Root Cause**: Client generates new idempotency key on each retry, bypassing idempotency.

#### Solution

Content-based deduplication using cart hash:

```typescript
function generateCartHash(
  cartItems: Array<{ productId: string; qty: number; price: number }>,
  address: { pincode: string; lat: number; lng: number },
  total: number
): string {
  // Normalize payload for consistent hashing
  const payload = JSON.stringify({
    items: cartItems
      .map(i => ({
        productId: i.productId.toString(),
        qty: i.qty,
        price: i.price,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)), // Sort for consistency
    address: {
      pincode: address.pincode,
      lat: Math.round(address.lat * 1000000) / 1000000, // 6 decimal places
      lng: Math.round(address.lng * 1000000) / 1000000,
    },
    total: Math.round(total * 100) / 100, // 2 decimal places
  });
  
  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

**Key Design Decisions**:

1. **Normalization**: Sort items, round coordinates, round total
   - **Why**: Ensures identical carts produce identical hashes regardless of input order or floating-point precision

2. **Time Window**: 5 minutes
   - **Why**: Prevents rapid duplicates while allowing legitimate re-orders after reasonable time

3. **Compound Index**: `{ userId: 1, cartHash: 1, createdAt: 1 }`
   - **Why**: Enforces uniqueness per user, per cart, within time window

4. **SHA-256 Hash**:
   - **Why**: Cryptographically secure, collision-resistant, fixed length

#### Conflict Handling

```typescript
if (e?.code === 11000 && errorMessage.includes('cartHash')) {
  // Cart hash conflict - return existing order
  const existing = await Order.findOne({ 
    userId, 
    cartHash,
    createdAt: { $gte: new Date(Date.now() - 5 * 60_000) }
  });
  
  if (existing) {
    logger.warn('[OrderBuilder] Duplicate cart detected', {
      userId: String(userId),
      cartHash,
      existingOrderId: String(existing._id),
      newIdempotencyKey: params.idempotencyKey,
    });
    
    return { order: existing, created: false };
  }
}
```

**Why Return Existing Order**: Idempotent behavior. Client gets the order they wanted, regardless of how many times they retry.

### Component 3: Atomic Finalization

#### Problem

Non-atomic finalization created race conditions:

```typescript
// BEFORE (Race Condition)
const existing = await Order.findById(orderId);
if (existing.finalizedAt) {
  return { updated: false };
}
// ⚠️ RACE WINDOW: Another worker can check here too
await Order.updateOne({ _id: orderId }, { $set: { finalizedAt: new Date() } });
```

**Race Timeline**:
```
Time  Worker A                    Worker B
----  -------------------------   -------------------------
T0    Read order (finalizedAt=null)
T1                                Read order (finalizedAt=null)
T2    Write PAID + finalizedAt
T3                                Write PAID + finalizedAt (DUPLICATE!)
```

#### Solution

Atomic compare-and-set operation:

```typescript
// AFTER (Atomic - No Race)
const result = await Order.updateOne(
  {
    _id: orderId,
    finalizedAt: { $exists: false },  // Atomic guard
  },
  { $set: { 
    paymentStatus: "PAID",
    finalizedAt: new Date(),
    // ... other fields
  } }
);

if (result.modifiedCount === 0) {
  // Another worker already finalized
  return { updated: false };
}

// We won the race
return { updated: true };
```

**Key Design Decisions**:

1. **Single Database Operation**: Read and write in one atomic operation
   - **Why**: Eliminates race window entirely

2. **Check modifiedCount**: Determines if we won the race
   - **Why**: MongoDB guarantees only one worker will have modifiedCount=1

3. **Fail-Fast on Conflict**: Return immediately if already finalized
   - **Why**: Idempotent behavior, no side effects

#### Inventory Commit Integration

Critical: Inventory must be committed BEFORE finalization:

```typescript
// Step 1: Commit inventory (within transaction)
const commitResult = await inventoryReservationService.commitReservationsForOrder({
  session,
  orderId,
});

if (!commitResult.committed) {
  // Check if already committed
  const committedCount = await InventoryReservation.countDocuments({
    orderId,
    status: "COMMITTED",
  }).session(session);
  
  if (committedCount === 0) {
    throw new Error("Inventory commit failed - cannot finalize payment");
  }
}

// Step 2: Finalize order (atomic)
const out = await finalizeOrderOnCapturedPayment({
  orderId,
  session,
});
```

**Why This Order**:
1. Inventory commit can fail (out of stock)
2. Finalization should only succeed if inventory is secured
3. Transaction ensures atomicity of both operations

### Component 4: Strict Gateway Order Creation

#### Problem

Crash window in gateway creation allowed duplicate Razorpay orders:

```typescript
// BEFORE (Has Crash Window)
const claim = await PaymentIntent.updateOne(
  { _id: intentId, gatewayCreateAttemptedAt: { $exists: false } },
  { $set: { gatewayCreateAttemptedAt: new Date() } }
);

if (claim.modifiedCount === 0) {
  const existing = await PaymentIntent.findById(intentId);
  if (existing?.gatewayOrderId) {
    return existing;
  }
  // ⚠️ PROBLEM: If gatewayOrderId not saved yet, proceeds to call Razorpay again
}
```

**Crash Scenario**:
```
Time  Winner                      Loser
----  -------------------------   -------------------------
T0    Claim won (set attemptedAt)
T1    Call Razorpay API
T2    Receive gatewayOrderId
T3    💥 CRASH before saving      Check for gatewayOrderId
T4                                Not found → Call Razorpay AGAIN (DUPLICATE!)
```

#### Solution

Wait loop with timeout for claim losers:

```typescript
// AFTER (Strict Single Creation)
const claim = await PaymentIntent.updateOne(
  { _id: intentId, gatewayCreateAttemptedAt: { $exists: false } },
  { $set: { gatewayCreateAttemptedAt: new Date() } }
);

if (claim.modifiedCount === 0) {
  // We lost the claim - wait for winner
  const maxWaitMs = 30_000;
  const startWaitMs = Date.now();
  
  while (Date.now() - startWaitMs < maxWaitMs) {
    const existing = await PaymentIntent.findById(intentId);
    
    if (existing?.gatewayOrderId) {
      // Winner succeeded - return existing
      return existing;
    }
    
    if (existing?.status === "FAILED") {
      // Winner failed - throw error
      throw new Error("Gateway creation failed by winner");
    }
    
    // Wait briefly before checking again
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Timeout - DO NOT call Razorpay
  throw new Error("Gateway creation timeout");
}

// We won the claim - proceed to call Razorpay
```

**Key Design Decisions**:

1. **Atomic Claim**: Only one worker can set `gatewayCreateAttemptedAt`
   - **Why**: Ensures only one worker calls Razorpay

2. **Wait Loop**: Losers wait for winner to complete
   - **Why**: Prevents duplicate Razorpay calls even if winner crashes

3. **Timeout**: 30 seconds max wait
   - **Why**: Prevents infinite waiting if winner crashes

4. **Fail-Fast on Timeout**: Throw error instead of calling Razorpay
   - **Why**: Better to fail the request than create duplicate gateway orders

5. **Poll Interval**: 500ms
   - **Why**: Balance between responsiveness and database load

#### Why Not Retry on Timeout?

**Bad Approach**:
```typescript
if (timeout) {
  // Reset attemptedAt and try again
  await PaymentIntent.updateOne(
    { _id: intentId },
    { $unset: { gatewayCreateAttemptedAt: 1 } }
  );
  return createRazorpayPaymentIntent(args); // Retry
}
```

**Why This is Wrong**:
- Winner might still be processing (slow network)
- Retry could create duplicate gateway order
- Better to fail and let client retry entire flow

**Correct Approach**:
```typescript
if (timeout) {
  // Fail fast - let client retry
  throw new Error("Gateway creation timeout");
}
```

### Component 5: Idempotent Admin Assignment

#### Problem

Duplicate ORDER_CREATED events triggered multiple admin assignments:

```
Event 1: ORDER_CREATED (eventId=abc) → Assign to admin
Event 2: ORDER_CREATED (eventId=abc) → Assign to admin AGAIN (DUPLICATE!)
```

**Root Cause**: Event deduplication not enforced at consumer level.

#### Solution

Atomic admin assignment guard:

```typescript
export async function assignOrderToAdmin(args: {
  orderId: string;
  adminId?: string;
}): Promise<{ assigned: boolean }> {
  // ATOMIC OPERATION: Only assign if not already assigned
  const result = await Order.findOneAndUpdate(
    {
      _id: args.orderId,
      adminAssigned: { $ne: true },  // Atomic guard
    },
    {
      $set: {
        adminAssigned: true,
        adminAssignedAt: new Date(),
        adminAssignedBy: args.adminId || 'system',
      },
    },
    { new: false }
  );
  
  if (!result) {
    // Already assigned
    return { assigned: false };
  }
  
  // We won the race
  return { assigned: true };
}
```

**Key Design Decisions**:

1. **Boolean Flag**: `adminAssigned` field
   - **Why**: Simple, efficient, easy to query

2. **Atomic Update**: `findOneAndUpdate` with guard
   - **Why**: Only one worker can set flag from false to true

3. **Return Value**: Indicates if assignment succeeded
   - **Why**: Consumer can log appropriately

4. **Idempotent**: Safe to call multiple times
   - **Why**: Event consumers may receive duplicate events

#### Event Consumer Integration

```typescript
subscribe(async (event) => {
  if (event.eventType !== "ORDER_CREATED") return;
  
  const orderId = event.data?.orderId;
  if (!orderId) return;
  
  // Idempotent assignment
  const result = await assignOrderToAdmin({ orderId });
  
  if (result.assigned) {
    logger.info("[ADMIN][CONSUMER] Order assigned", { orderId });
  } else {
    logger.debug("[ADMIN][CONSUMER] Already assigned", { orderId });
  }
});
```

**Why This Works**:
- Duplicate events are harmless (idempotent)
- No need for event deduplication at consumer level
- Simple, robust, easy to reason about

## Data Flow

### Order Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Client Request                                              │
│ x-idempotency-key: 550e8400-e29b-41d4-a716-446655440000    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Validate Idempotency Key                                    │
│ - Check presence (400 if missing)                           │
│ - Check format (400 if invalid)                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Generate Cart Hash                                          │
│ - Normalize cart items (sort, round)                        │
│ - Include address, total                                    │
│ - SHA-256 hash                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Start Transaction                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Check Existing Order (Fast Path)                            │
│ - Query by userId + idempotencyKey                          │
│ - If found: Return existing (200)                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Create Order                                                │
│ - Insert with idempotencyKey + cartHash                     │
│ - E11000 on idempotencyKey → Return existing (200)          │
│ - E11000 on cartHash → Return existing (200)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Reserve Inventory                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Publish ORDER_CREATED Event                                 │
│ - Deterministic eventId                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Commit Transaction                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Return Order (201 or 200)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Payment Finalization Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Webhook/Polling Trigger                                     │
│ - Razorpay payment.captured event                           │
│ - OR polling detects captured payment                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Start Transaction                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Commit Inventory (BEFORE marking PAID)                      │
│ - Check if already committed                                │
│ - If not: Commit reservations                               │
│ - If commit fails: Abort transaction                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Atomic Finalization                                         │
│ updateOne({                                                 │
│   _id: orderId,                                             │
│   finalizedAt: { $exists: false }  ← Atomic guard           │
│ }, {                                                        │
│   $set: { paymentStatus: "PAID", finalizedAt: new Date() } │
│ })                                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Check modifiedCount                                         │
│ - modifiedCount=0 → Already finalized (idempotent)          │
│ - modifiedCount=1 → Success (we won the race)               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Commit Transaction                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Return Success                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Database Impact

**Additional Indexes**:
```typescript
// Cart hash index
{ userId: 1, cartHash: 1, createdAt: 1 } // ~100 bytes per document

// Admin assignment index
{ adminAssigned: 1 } // ~10 bytes per document
```

**Impact**: Minimal. Indexes are selective and small.

**Atomic Operations**:
- Compare-and-set operations are single round-trips
- No performance degradation vs. separate read-write
- Actually faster due to eliminating retry loops

**Hash Generation**:
- SHA-256 hashing: <1ms for typical cart
- Happens before transaction (no lock contention)

### Concurrency Impact

**Before (With Retries)**:
```
Request → Read → Race → Retry → Read → Race → Retry → Success
Latency: 3x database round-trips
```

**After (Atomic)**:
```
Request → Atomic Update → Success or Conflict
Latency: 1x database round-trip
```

**Result**: Lower latency, higher throughput, less database load.

### Wait Loop Performance

Gateway creation wait loop:
- **Frequency**: Rare (only on concurrent retries)
- **Duration**: Typically <2 seconds (winner completes quickly)
- **Max Duration**: 30 seconds (timeout)
- **Impact**: Minimal (affects only concurrent retries)

## Monitoring & Observability

### Metrics

```typescript
// Order creation
order_creation_attempts_total
order_creation_idempotent_returns_total
order_creation_cart_hash_conflicts_total

// Finalization
finalization_attempts_total
finalization_conflicts_total

// Gateway creation
gateway_creation_claims_total
gateway_creation_claim_losses_total
gateway_creation_wait_time_ms (histogram)

// Admin assignment
admin_assignment_attempts_total
admin_assignment_conflicts_total
```

### Alerts

**Critical**:
- Duplicate order rate >0.1%
- Finalization conflicts >10% of attempts

**Warning**:
- Gateway creation wait time >10 seconds (P95)
- Cart hash conflicts >5% of attempts

**Info**:
- Gateway creation claim losses (expected during retries)
- Admin assignment conflicts (expected with duplicate events)

### Logging

**Order Creation**:
```typescript
logger.info('[OrderBuilder] Order created', {
  orderId,
  userId,
  idempotencyKey,
  cartHash,
  created: true,
});

logger.warn('[OrderBuilder] Duplicate cart detected', {
  orderId,
  userId,
  cartHash,
  existingOrderId,
  newIdempotencyKey,
});
```

**Finalization**:
```typescript
logger.info('[PAYMENT][FINALIZED] Order marked PAID atomically', {
  orderId,
  confirmedBy: 'WEBHOOK',
});

logger.info('[PAYMENT][FINALIZATION_GUARD] Order already finalized', {
  orderId,
  confirmedBy: 'POLLING',
});
```

**Gateway Creation**:
```typescript
logger.info('[PI][GATEWAY_CLAIM_WON] This worker will create gateway order', {
  orderId,
  intentId,
});

logger.info('[PI][GATEWAY_CLAIM_LOST] Another worker claimed gateway creation', {
  orderId,
  intentId,
});

logger.info('[PI][GATEWAY_CLAIM_WAIT_SUCCESS] Winner completed gateway creation', {
  orderId,
  gatewayOrderId,
});
```

## Testing Strategy

### Unit Tests

1. **Cart Hash Generation**:
   - Same cart → same hash
   - Different items → different hash
   - Item order doesn't affect hash (sorted)
   - Floating point precision handling

2. **Atomic Operations**:
   - First operation succeeds (modifiedCount=1)
   - Second operation fails (modifiedCount=0)
   - Concurrent operations (only one succeeds)

### Integration Tests

1. **Order Creation**:
   - Concurrent requests with same idempotency key
   - Concurrent requests with same cart hash
   - E11000 recovery for both constraints

2. **Payment Finalization**:
   - Concurrent webhook and polling
   - Multiple webhook retries
   - Inventory commit integration

3. **Gateway Creation**:
   - Concurrent gateway creation attempts
   - Claim winner/loser scenarios
   - Timeout handling

### Property-Based Tests

See `bugfix.md` for detailed property definitions:
- CP-1: Order Creation Idempotency
- CP-2: Cart Content Deduplication
- CP-3: Atomic Finalization
- CP-4: Single Gateway Order Creation
- CP-5: Idempotent Admin Assignment

## Migration Strategy

### Phase 1: Schema Changes (Non-Breaking)
- Add `cartHash` field (optional)
- Add `adminAssigned` fields (optional)
- Deploy to production
- **Risk**: Low (backward compatible)

### Phase 2: Code Changes (Backward Compatible)
- Update order creation to generate cart hash
- Update finalization to use atomic operations
- Update gateway creation to enforce strict single creation
- Update admin assignment to use atomic guard
- Deploy to production
- **Risk**: Medium (new code paths, but backward compatible)

### Phase 3: Enforcement (Breaking)
- Make `idempotencyKey` required in API
- Update index to remove partial filter
- Deploy to production
- **Risk**: High (breaks clients without idempotency keys)

### Phase 4: Cleanup
- Backfill missing cart hashes
- Remove old idempotency logic
- Update documentation
- **Risk**: Low (cleanup only)

## Rollback Procedures

### If Duplicate Orders Detected
1. Revert API enforcement (make idempotency key optional)
2. Keep atomic operations (safe)
3. Investigate root cause
4. Fix and re-deploy

### If Performance Degradation
1. Check slow query log
2. Verify index usage (`explain()`)
3. Adjust indexes if needed
4. Consider sharding if necessary

### If Client Compatibility Issues
1. Add grace period for idempotency key requirement
2. Log warnings instead of errors
3. Gradually enforce over 2 weeks
4. Communicate with mobile team

## Success Metrics

### Correctness
- **Zero duplicate orders**: Target 0, measured by duplicate cart hash queries
- **Zero finalization races**: Target 0, measured by finalization conflict rate
- **Zero duplicate gateway orders**: Target 0, measured by Razorpay reconciliation

### Performance
- **Order creation latency**: <5% increase (target <100ms P95)
- **Finalization latency**: <5% increase (target <50ms P95)
- **Gateway creation latency**: <10% increase (target <500ms P95)

### Reliability
- **Order creation success rate**: >99.9%
- **Payment finalization success rate**: >99.9%
- **Gateway creation success rate**: >99.5%

## References

- [Amazon Idempotency Best Practices](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [MongoDB Atomic Operations](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
- [Stripe Idempotency](https://stripe.com/docs/api/idempotent_requests)
- [Martin Kleppmann - Designing Data-Intensive Applications](https://dataintensive.net/)
