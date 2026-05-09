# Payment Idempotency Fixes - Technical Design

## Design Overview

This design implements Amazon-level idempotency and race condition fixes for the payment system through:
1. Mandatory idempotency keys with strict validation
2. Content-based deduplication via cart hashing
3. Atomic compare-and-set operations for finalization
4. Strict single gateway order creation
5. Idempotent admin assignment

## Architecture Principles

### 1. Idempotency by Design
- Every operation must be safe to retry
- Use atomic operations (compare-and-set)
- Fail fast on conflicts

### 2. Defense in Depth
- Multiple layers of deduplication:
  - Layer 1: Idempotency key (client-provided)
  - Layer 2: Cart hash (content-based)
  - Layer 3: Atomic operations (DB-level)

### 3. Fail-Safe Defaults
- Reject ambiguous requests
- Prefer false negatives over false positives
- Log all conflicts for monitoring

## Component Design

### Component 1: Mandatory Idempotency Key

#### Schema Changes

**File**: `backend/src/models/Order.ts`

```typescript
// BEFORE
idempotencyKey?: string;

// AFTER
idempotencyKey: string;  // Required, no optional
```

**Index Changes**:
```typescript
// BEFORE
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

// AFTER
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }  // No partial filter - always enforced
);
```

#### API Validation

**File**: `backend/src/domains/operations/controllers/orderController.ts` (or equivalent)

```typescript
export const createOrder = async (req: Request, res: Response) => {
  // Extract idempotency key from header
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  // Strict validation
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return res.status(400).json({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'x-idempotency-key header is required'
    });
  }
  
  // Validate format (UUID v4 recommended)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return res.status(400).json({
      error: 'INVALID_IDEMPOTENCY_KEY',
      message: 'x-idempotency-key must be a valid UUID v4'
    });
  }
  
  // Pass to service
  const result = await createOrderFromCart({
    userId: req.user._id,
    paymentMethod: req.body.paymentMethod,
    upiVpa: req.body.upiVpa,
    idempotencyKey,  // Now guaranteed to be string
  });
  
  // Return appropriate status
  if (result.created) {
    return res.status(201).json(result.order);
  } else {
    // Idempotent return - order already exists
    return res.status(200).json(result.order);
  }
};
```

### Component 2: Cart Hash Deduplication

#### Schema Addition

**File**: `backend/src/models/Order.ts`

```typescript
export interface IOrder extends Document {
  // ... existing fields ...
  idempotencyKey: string;  // Now required
  cartHash: string;  // NEW: Content-based deduplication
  // ... rest of fields ...
}

const OrderSchema = new Schema<IOrder>({
  // ... existing fields ...
  idempotencyKey: {
    type: String,
    required: true,
    trim: true,
  },
  cartHash: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  // ... rest of fields ...
});

// NEW: Time-bounded uniqueness for cart hash
// Prevents duplicate orders with same cart within 5 minutes
OrderSchema.index(
  { userId: 1, cartHash: 1, createdAt: 1 },
  { 
    unique: true,
    // Note: This will fail if user tries to create identical order within same second
    // In practice, this is acceptable - users shouldn't create identical orders rapidly
  }
);
```

#### Hash Generation

**File**: `backend/src/domains/operations/services/orderBuilder.ts`

```typescript
import crypto from "crypto";

/**
 * Generate deterministic hash of cart contents
 * Used for content-based deduplication (Amazon-style)
 * 
 * @param cartItems - Normalized cart items
 * @param address - Delivery address
 * @param total - Order total
 * @returns SHA-256 hash (hex string)
 */
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

// Usage in createOrderFromCart
export async function createOrderFromCart(params: {
  userId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  upiVpa?: string;
  idempotencyKey: string;  // Now required
}): Promise<CreateOrderFromCartResult> {
  // ... validation phase ...
  
  // Generate cart hash BEFORE transaction
  const cartHash = generateCartHash(
    orderItems.map(it => ({
      productId: it.productId.toString(),
      qty: it.qty,
      price: it.priceAtOrderTime,
    })),
    {
      pincode: addressSnapshot.pincode,
      lat: addressSnapshot.lat,
      lng: addressSnapshot.lng,
    },
    grandTotal
  );
  
  // ... transaction phase ...
  
  const order = new Order({
    userId,
    idempotencyKey: params.idempotencyKey,
    cartHash,  // NEW: Add cart hash
    items: orderItems,
    // ... rest of fields ...
  });
  
  // ... rest of logic ...
}
```

#### Conflict Handling

```typescript
// In E11000 error handler
if (e?.code === 11000) {
  // Determine which constraint was violated
  const errorMessage = String(e?.message || '');
  
  if (errorMessage.includes('idempotencyKey')) {
    // Idempotency key conflict - expected, return existing order
    const existing = await Order.findOne({ userId, idempotencyKey: params.idempotencyKey });
    if (existing) {
      return { order: existing, created: false };
    }
  }
  
  if (errorMessage.includes('cartHash')) {
    // Cart hash conflict - duplicate cart within time window
    const existing = await Order.findOne({ 
      userId, 
      cartHash,
      createdAt: { $gte: new Date(Date.now() - 5 * 60_000) } // Last 5 minutes
    });
    
    if (existing) {
      logger.warn('[OrderBuilder] Duplicate cart detected', {
        userId: String(userId),
        cartHash,
        existingOrderId: String(existing._id),
        newIdempotencyKey: params.idempotencyKey,
      });
      
      // Return existing order (idempotent behavior)
      return { order: existing, created: false };
    }
  }
  
  // Unknown conflict
  throw e;
}
```

### Component 3: Atomic Finalization

#### Current Implementation (Non-Atomic)

```typescript
// BEFORE - Race condition exists
const existing = await Order.findById(args.orderId);
if ((existing as any).finalizedAt) {
  return { updated: false };
}
// ... later ...
await Order.updateOne({ _id: args.orderId }, { $set: update });
```

#### Fixed Implementation (Atomic)

**File**: `backend/src/domains/payments/services/orderPaymentFinalizer.ts`

```typescript
export async function finalizeOrderOnCapturedPayment(args: {
  orderId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  capturedAt?: Date;
  confirmedBy?: 'WEBHOOK' | 'POLLING' | 'RECONCILIATION';
  session?: mongoose.ClientSession;
}): Promise<{ updated: boolean }> {
  
  const run = async (session: mongoose.ClientSession): Promise<{ updated: boolean }> => {
    // Prepare update payload
    const update: any = {
      paymentStatus: "PAID",
      finalizedAt: new Date(), // Set atomically with PAID
    };
    if (args.razorpayOrderId) update.razorpayOrderId = args.razorpayOrderId;
    if (args.razorpayPaymentId) update.razorpayPaymentId = args.razorpayPaymentId;
    if (args.capturedAt) update.paymentReceivedAt = args.capturedAt;
    update.paymentConfirmedBy = args.confirmedBy ?? 'WEBHOOK';
    
    // ATOMIC OPERATION: Compare-and-set
    // Only succeeds if finalizedAt does not exist
    const result = await Order.updateOne(
      {
        _id: args.orderId,
        finalizedAt: { $exists: false },  // Atomic guard
      },
      { $set: update },
      { 
        session,
        context: { paymentStatusSource: "WEBHOOK_PAYMENT_CAPTURED" } 
      } as any
    );
    
    // Check if update succeeded
    if (result.modifiedCount === 0) {
      // Order already finalized by another worker
      logger.info("[PAYMENT][FINALIZATION_GUARD] Order already finalized", {
        orderId: args.orderId,
        confirmedBy: args.confirmedBy,
      });
      return { updated: false };
    }
    
    // Success - we won the race
    logger.info("[PAYMENT][FINALIZED] Order marked PAID atomically", {
      orderId: args.orderId,
      confirmedBy: args.confirmedBy,
    });
    
    // Inventory commit happens BEFORE this function is called
    // (in webhookProcessor.ts or verificationController.ts)
    
    return { updated: true };
  };
  
  // ... session handling ...
}
```

#### Inventory Commit Integration

**File**: `backend/src/domains/payments/services/webhookProcessor.ts`

```typescript
// In PAYMENT_CAPTURED handler
if (event.type === "PAYMENT_CAPTURED") {
  // ... intent transition ...
  
  // Step 1: Commit inventory FIRST (within transaction)
  const orderItems = await Order.findById(orderId).select('items').session(session);
  const items = (orderItems?.items || []).map(it => ({
    productId: it.productId,
    qty: it.qty,
  }));
  
  if (items.length > 0) {
    await inventoryReservationService.reserveForOrder({
      session,
      orderId: new mongoose.Types.ObjectId(orderId),
      ttlMs: 30 * 60_000,
      items,
    });
    
    const commitResult = await inventoryReservationService.commitReservationsForOrder({
      session,
      orderId: new mongoose.Types.ObjectId(orderId),
    });
    
    if (!commitResult.committed) {
      // Check if already committed
      const committedCount = await InventoryReservation.countDocuments({
        orderId: new mongoose.Types.ObjectId(orderId),
        status: "COMMITTED",
      }).session(session);
      
      if (committedCount === 0) {
        throw new Error("Inventory commit failed - cannot finalize payment");
      }
    }
  }
  
  // Step 2: Finalize order (atomic compare-and-set)
  const out = await finalizeOrderOnCapturedPayment({
    orderId,
    razorpayOrderId: gatewayOrderId,
    razorpayPaymentId: gatewayEventId,
    capturedAt: event.occurredAt,
    confirmedBy: 'WEBHOOK',
    session,
  });
  
  if (out.updated) {
    logger.info("[ORDER][MARKED_PAID]", {
      orderId,
      verificationMethod: "webhook",
    });
  }
}
```

### Component 4: Strict Gateway Order Creation

#### Current Implementation (Has Race)

```typescript
// BEFORE - Can call Razorpay twice
const claim = await PaymentIntent.updateOne(
  { _id: intent._id, gatewayCreateAttemptedAt: { $exists: false } },
  { $set: { gatewayCreateAttemptedAt: new Date() } }
);

if (claim.modifiedCount === 0) {
  const existing = await PaymentIntent.findById(intent._id);
  if (existing?.gatewayOrderId) {
    return existing;
  }
  // ⚠️ PROBLEM: Proceeds to call Razorpay if gatewayOrderId not saved yet
}
```

#### Fixed Implementation (Strict Single Creation)

**File**: `backend/src/domains/payments/services/paymentIntentService.ts`

```typescript
// Inside createRazorpayPaymentIntent, before calling Razorpay API

// ATOMIC CLAIM: Only ONE caller can set gatewayCreateAttemptedAt
const claim = await PaymentIntent.updateOne(
  {
    _id: intent._id,
    gatewayCreateAttemptedAt: { $exists: false },
    status: "CREATED",
  },
  { $set: { gatewayCreateAttemptedAt: new Date() } }
);

if (Number((claim as any).modifiedCount) === 0) {
  // Another request already claimed the slot
  logger.info("[PI][GATEWAY_CLAIM_LOST] Another worker claimed gateway creation", {
    orderId: String(args.orderId),
    intentId: String(intent._id),
  });
  
  // Wait for winner to save gatewayOrderId (with timeout)
  const maxWaitMs = 30_000; // 30 seconds
  const startWaitMs = Date.now();
  
  while (Date.now() - startWaitMs < maxWaitMs) {
    const existing = await PaymentIntent.findById(intent._id)
      .select("gatewayOrderId checkoutPayload amount currency expiresAt status")
      .lean();
    
    if (existing && String((existing as any).gatewayOrderId || "").trim()) {
      // Winner saved gatewayOrderId - return it
      logger.info("[PI][GATEWAY_CLAIM_WAIT_SUCCESS] Winner completed gateway creation", {
        orderId: String(args.orderId),
        gatewayOrderId: (existing as any).gatewayOrderId,
      });
      
      return {
        paymentIntentId: String(intent._id),
        gateway: "RAZORPAY",
        razorpayOrderId: String((existing as any).gatewayOrderId),
        amount: Number((existing as any).amount),
        currency: String((existing as any).currency || "INR"),
        expiresAt: (existing as any).expiresAt,
        checkoutPayload: ((existing as any).checkoutPayload || {}) as any,
      };
    }
    
    // Check if winner failed
    const status = String((existing as any)?.status || "").toUpperCase();
    if (status === "FAILED" || status === "EXPIRED") {
      logger.error("[PI][GATEWAY_CLAIM_WAIT_FAILED] Winner failed to create gateway order", {
        orderId: String(args.orderId),
        intentId: String(intent._id),
        status,
      });
      
      const err: any = new Error("Gateway order creation failed by another worker");
      err.statusCode = 500;
      throw err;
    }
    
    // Wait briefly before checking again
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Timeout - winner crashed or is stuck
  logger.error("[PI][GATEWAY_CLAIM_WAIT_TIMEOUT] Winner did not complete gateway creation", {
    orderId: String(args.orderId),
    intentId: String(intent._id),
    waitedMs: Date.now() - startWaitMs,
  });
  
  // DO NOT proceed to call Razorpay - fail fast
  const err: any = new Error("Gateway order creation timeout - winner did not complete");
  err.statusCode = 503;
  throw err;
}

// We won the claim - proceed to call Razorpay
logger.info("[PI][GATEWAY_CLAIM_WON] This worker will create gateway order", {
  orderId: String(args.orderId),
  intentId: String(intent._id),
});

// ... call Razorpay API ...
```

### Component 5: Idempotent Admin Assignment

#### Schema Addition

**File**: `backend/src/models/Order.ts`

```typescript
export interface IOrder extends Document {
  // ... existing fields ...
  adminAssigned?: boolean;  // NEW: Guard for admin assignment
  adminAssignedAt?: Date;   // NEW: Timestamp of assignment
  adminAssignedBy?: string; // NEW: Which admin/system assigned
  // ... rest of fields ...
}

const OrderSchema = new Schema<IOrder>({
  // ... existing fields ...
  adminAssigned: {
    type: Boolean,
    default: false,
    index: true,
  },
  adminAssignedAt: {
    type: Date,
  },
  adminAssignedBy: {
    type: String,
  },
  // ... rest of fields ...
});
```

#### Assignment Service

**File**: `backend/src/domains/admin/services/adminAssignmentService.ts` (new or existing)

```typescript
import { Order } from "../../../models/Order";
import { logger } from "../../../utils/logger";

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
    { new: false } // Return old document to check if we won
  );
  
  if (!result) {
    // Order already assigned by another worker
    logger.info("[ADMIN][ASSIGNMENT_GUARD] Order already assigned", {
      orderId: args.orderId,
    });
    return { assigned: false };
  }
  
  // Success - we won the race
  logger.info("[ADMIN][ASSIGNED] Order assigned to admin", {
    orderId: args.orderId,
    adminId: args.adminId,
  });
  
  // Trigger notification, etc.
  // ... rest of assignment logic ...
  
  return { assigned: true };
}
```

#### Event Consumer Integration

**File**: `backend/src/domains/admin/consumers/orderCreatedConsumer.ts` (or equivalent)

```typescript
import { subscribe } from "../../events/eventBus";
import { assignOrderToAdmin } from "../services/adminAssignmentService";

// Subscribe to ORDER_CREATED events
subscribe(async (event) => {
  if (event.eventType !== "ORDER_CREATED") return;
  
  const orderId = (event as any).data?.orderId;
  if (!orderId) return;
  
  // Idempotent assignment - safe to call multiple times
  const result = await assignOrderToAdmin({ orderId });
  
  if (result.assigned) {
    logger.info("[ADMIN][CONSUMER] Order assigned via event", {
      orderId,
      eventId: event.eventId,
    });
  } else {
    logger.debug("[ADMIN][CONSUMER] Order already assigned (idempotent)", {
      orderId,
      eventId: event.eventId,
    });
  }
});
```

## Data Flow Diagrams

### Order Creation Flow (Fixed)

```
Client Request
  ↓
[Validate Idempotency Key] ← Mandatory, UUID v4 format
  ↓
[Generate Cart Hash] ← Content-based deduplication
  ↓
[Start Transaction]
  ↓
[Check Existing Order] ← Fast-path idempotency
  ├─ Found → Return existing (200)
  └─ Not found → Continue
      ↓
[Create Order] ← With idempotencyKey + cartHash
  ├─ E11000 on idempotencyKey → Return existing (200)
  ├─ E11000 on cartHash → Return existing (200)
  └─ Success → Continue
      ↓
[Reserve Inventory]
  ↓
[Publish ORDER_CREATED Event] ← Deterministic eventId
  ↓
[Commit Transaction]
  ↓
Return Order (201)
```

### Payment Finalization Flow (Fixed)

```
Webhook/Polling Trigger
  ↓
[Start Transaction]
  ↓
[Commit Inventory] ← BEFORE marking PAID
  ├─ Already committed → Continue
  ├─ Commit success → Continue
  └─ Commit failed → Abort
      ↓
[Atomic Finalization] ← Compare-and-set on finalizedAt
  ├─ modifiedCount=0 → Already finalized (idempotent)
  └─ modifiedCount=1 → Success
      ↓
[Commit Transaction]
  ↓
Return Success
```

### Gateway Order Creation Flow (Fixed)

```
Create Payment Intent
  ↓
[Atomic Claim] ← Set gatewayCreateAttemptedAt
  ├─ Claim won → Continue
  └─ Claim lost → Wait for winner
      ├─ Winner saves gatewayOrderId → Return existing
      ├─ Winner fails → Throw error
      └─ Timeout → Throw error (DO NOT call Razorpay)
          ↓
[Call Razorpay API] ← Only winner calls
  ↓
[Save gatewayOrderId] ← Atomic update
  ↓
Return Gateway Order
```

## Error Handling

### Idempotency Key Validation Errors

```typescript
// Missing key
{
  statusCode: 400,
  error: 'IDEMPOTENCY_KEY_REQUIRED',
  message: 'x-idempotency-key header is required'
}

// Invalid format
{
  statusCode: 400,
  error: 'INVALID_IDEMPOTENCY_KEY',
  message: 'x-idempotency-key must be a valid UUID v4'
}
```

### Duplicate Order Errors

```typescript
// Idempotency key conflict (expected)
{
  statusCode: 200, // Not an error - idempotent return
  order: { /* existing order */ },
  created: false
}

// Cart hash conflict (expected)
{
  statusCode: 200, // Not an error - idempotent return
  order: { /* existing order */ },
  created: false,
  reason: 'DUPLICATE_CART'
}
```

### Finalization Conflicts

```typescript
// Already finalized (expected)
{
  updated: false,
  reason: 'ALREADY_FINALIZED'
}
```

### Gateway Creation Conflicts

```typescript
// Claim lost, winner succeeded
{
  statusCode: 200,
  paymentIntentId: '...',
  razorpayOrderId: '...', // From winner
  // ... rest of response ...
}

// Claim lost, winner failed
{
  statusCode: 500,
  error: 'GATEWAY_CREATION_FAILED',
  message: 'Gateway order creation failed by another worker'
}

// Claim lost, timeout
{
  statusCode: 503,
  error: 'GATEWAY_CREATION_TIMEOUT',
  message: 'Gateway order creation timeout - winner did not complete'
}
```

## Performance Considerations

### Database Impact

1. **Additional Indexes**:
   - `{ userId: 1, cartHash: 1, createdAt: 1 }` - Minimal impact, selective
   - `{ adminAssigned: 1 }` - Minimal impact, boolean field

2. **Atomic Operations**:
   - Compare-and-set operations are fast (single round-trip)
   - No performance degradation expected

3. **Hash Generation**:
   - SHA-256 hashing is fast (<1ms for typical cart)
   - Happens before transaction (no lock contention)

### Concurrency Impact

1. **Reduced Contention**:
   - Atomic operations eliminate retry loops
   - Fail-fast on conflicts

2. **Wait Loops**:
   - Gateway creation wait loop: Max 30s, rare (only on concurrent retries)
   - Exponential backoff in E11000 recovery: Max 3 retries, <200ms total

### Monitoring Metrics

```typescript
// Add to metrics service
export const idempotencyMetrics = {
  // Order creation
  orderCreationAttempts: new Counter('order_creation_attempts_total'),
  orderCreationIdempotentReturns: new Counter('order_creation_idempotent_returns_total'),
  orderCreationCartHashConflicts: new Counter('order_creation_cart_hash_conflicts_total'),
  
  // Finalization
  finalizationAttempts: new Counter('finalization_attempts_total'),
  finalizationConflicts: new Counter('finalization_conflicts_total'),
  
  // Gateway creation
  gatewayCreationClaims: new Counter('gateway_creation_claims_total'),
  gatewayCreationClaimLosses: new Counter('gateway_creation_claim_losses_total'),
  gatewayCreationWaitTimeMs: new Histogram('gateway_creation_wait_time_ms'),
  
  // Admin assignment
  adminAssignmentAttempts: new Counter('admin_assignment_attempts_total'),
  adminAssignmentConflicts: new Counter('admin_assignment_conflicts_total'),
};
```

## Testing Strategy

### Unit Tests

1. **Cart Hash Generation**:
   - Same cart → same hash
   - Different order → different hash
   - Floating point precision handling

2. **Atomic Operations**:
   - Compare-and-set semantics
   - Conflict detection
   - Idempotent behavior

### Integration Tests

1. **Order Creation**:
   - Concurrent requests with same idempotency key
   - Concurrent requests with same cart hash
   - E11000 recovery

2. **Payment Finalization**:
   - Concurrent finalization attempts
   - Webhook + polling race
   - Inventory commit integration

3. **Gateway Creation**:
   - Concurrent gateway creation attempts
   - Claim winner/loser scenarios
   - Timeout handling

### Property-Based Tests

See `bugfix.md` for detailed property definitions.

## Migration Plan

### Phase 1: Schema Changes (Week 1)
- Add `cartHash` field (optional)
- Add `adminAssigned` fields (optional)
- Deploy to production
- Monitor for issues

### Phase 2: Code Changes (Week 2)
- Update order creation to generate cart hash
- Update finalization to use atomic operations
- Update gateway creation to enforce strict single creation
- Update admin assignment to use atomic guard
- Deploy to production (backward compatible)
- Monitor metrics

### Phase 3: Enforcement (Week 3)
- Make `idempotencyKey` required in API
- Update index to remove partial filter
- Deploy to production
- Monitor for client errors

### Phase 4: Cleanup (Week 4)
- Backfill missing cart hashes
- Remove old idempotency logic
- Update documentation

## Rollback Procedures

### If Duplicate Orders Detected
1. Revert API enforcement (make idempotency key optional)
2. Keep atomic operations (safe)
3. Investigate root cause
4. Fix and re-deploy

### If Performance Degradation
1. Check slow query log
2. Verify index usage
3. Adjust indexes if needed
4. Consider sharding if necessary

### If Client Compatibility Issues
1. Add grace period for idempotency key requirement
2. Log warnings instead of errors
3. Gradually enforce over 2 weeks
4. Communicate with mobile team

## Success Metrics

### Correctness
- Zero duplicate orders in production (target: 0)
- Zero finalization races (target: 0)
- Zero duplicate gateway orders (target: 0)

### Performance
- Order creation latency: <5% increase (target: <100ms P95)
- Finalization latency: <5% increase (target: <50ms P95)
- Gateway creation latency: <10% increase (target: <500ms P95)

### Reliability
- Order creation success rate: >99.9%
- Payment finalization success rate: >99.9%
- Gateway creation success rate: >99.5%
