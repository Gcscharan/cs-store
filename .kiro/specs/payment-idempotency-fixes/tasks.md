# Payment Idempotency Fixes - Implementation Tasks

## Task 1: Schema Changes (Non-Breaking)

### 1.1 Add cartHash field to Order model
- [ ] Update `IOrder` interface in `backend/src/models/Order.ts`
  - Add `cartHash: string` field
- [ ] Update `OrderSchema` in `backend/src/models/Order.ts`
  - Add cartHash field definition with required: true
  - Add index: true
- [ ] Add compound index for cart hash deduplication
  - Index: `{ userId: 1, cartHash: 1, createdAt: 1 }` with unique: true

### 1.2 Add admin assignment fields to Order model
- [ ] Update `IOrder` interface in `backend/src/models/Order.ts`
  - Add `adminAssigned?: boolean` field
  - Add `adminAssignedAt?: Date` field
  - Add `adminAssignedBy?: string` field
- [ ] Update `OrderSchema` in `backend/src/models/Order.ts`
  - Add adminAssigned field with default: false and index: true
  - Add adminAssignedAt field
  - Add adminAssignedBy field

### 1.3 Update idempotency key index
- [ ] Remove partial filter from idempotency key index in `backend/src/models/Order.ts`
  - Change from: `{ unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }`
  - Change to: `{ unique: true }`
  - Keep field optional for now (will enforce in Phase 3)

## Task 2: Cart Hash Implementation

### 2.1 Create cart hash utility
- [ ] Create `generateCartHash` function in `backend/src/domains/operations/services/orderBuilder.ts`
  - Accept cartItems, address, total as parameters
  - Normalize payload (sort items, round coordinates, round total)
  - Generate SHA-256 hash
  - Return hex string

### 2.2 Integrate cart hash into order creation
- [ ] Update `createOrderFromCart` in `backend/src/domains/operations/services/orderBuilder.ts`
  - Generate cart hash before transaction
  - Pass cart hash to Order constructor
  - Add cart hash to order document

### 2.3 Handle cart hash conflicts
- [ ] Update E11000 error handler in `createOrderFromCart`
  - Detect cart hash conflicts (check error message)
  - Query for existing order with same cart hash within 5 minutes
  - Log warning with details
  - Return existing order (idempotent behavior)

## Task 3: Atomic Finalization

### 3.1 Refactor finalizeOrderOnCapturedPayment
- [ ] Update `finalizeOrderOnCapturedPayment` in `backend/src/domains/payments/services/orderPaymentFinalizer.ts`
  - Remove separate read operation
  - Use atomic updateOne with `finalizedAt: { $exists: false }` filter
  - Check `modifiedCount` to determine if update succeeded
  - Return `{ updated: false }` if modifiedCount is 0
  - Return `{ updated: true }` if modifiedCount is 1

### 3.2 Update webhook processor
- [ ] Update `processRazorpayWebhook` in `backend/src/domains/payments/services/webhookProcessor.ts`
  - Ensure inventory commit happens BEFORE finalization
  - Handle `{ updated: false }` response (already finalized)
  - Log appropriate messages for both cases

### 3.3 Update verification controller
- [ ] Update `verifyPayment` in `backend/src/domains/payments/controllers/verificationController.ts`
  - Ensure inventory commit happens BEFORE finalization
  - Handle `{ updated: false }` response (already finalized)
  - Log appropriate messages for both cases

### 3.4 Update reconciliation service
- [ ] Update `runReconciliationScanOnce` in `backend/src/domains/payments/services/paymentReconciliationService.ts`
  - Ensure inventory commit happens BEFORE finalization
  - Handle `{ updated: false }` response (already finalized)
  - Log appropriate messages for both cases

## Task 4: Strict Gateway Order Creation

### 4.1 Implement wait loop for claim losers
- [ ] Update `createRazorpayPaymentIntent` in `backend/src/domains/payments/services/paymentIntentService.ts`
  - After claim fails (modifiedCount=0), implement wait loop
  - Poll for gatewayOrderId with 500ms intervals
  - Max wait time: 30 seconds
  - Return existing gateway order if found
  - Check for FAILED/EXPIRED status and throw error
  - Throw timeout error if max wait exceeded

### 4.2 Add logging for gateway creation conflicts
- [ ] Add detailed logging in `createRazorpayPaymentIntent`
  - Log when claim is won
  - Log when claim is lost
  - Log when waiting for winner
  - Log when winner succeeds
  - Log when winner fails
  - Log when timeout occurs

### 4.3 Add metrics for gateway creation
- [ ] Create metrics in `backend/src/domains/payments/services/paymentMetricsService.ts`
  - Counter: gateway_creation_claims_total
  - Counter: gateway_creation_claim_losses_total
  - Histogram: gateway_creation_wait_time_ms
  - Track in createRazorpayPaymentIntent

## Task 5: Idempotent Admin Assignment

### 5.1 Create admin assignment service
- [ ] Create `backend/src/domains/admin/services/adminAssignmentService.ts`
  - Implement `assignOrderToAdmin` function
  - Use atomic findOneAndUpdate with `adminAssigned: { $ne: true }` filter
  - Return `{ assigned: boolean }` result
  - Log assignment success/conflict

### 5.2 Update event consumer
- [ ] Update ORDER_CREATED event consumer (location TBD based on existing code)
  - Call `assignOrderToAdmin` instead of direct assignment
  - Handle `{ assigned: false }` response (already assigned)
  - Log appropriate messages

### 5.3 Add admin assignment endpoint (if needed)
- [ ] Create/update admin assignment endpoint
  - Call `assignOrderToAdmin` service
  - Return appropriate response
  - Handle conflicts gracefully

## Task 6: API Validation (Enforcement Phase)

### 6.1 Add idempotency key validation
- [ ] Update order creation controller (location TBD based on existing code)
  - Extract `x-idempotency-key` header
  - Validate presence (return 400 if missing)
  - Validate format (UUID v4 regex)
  - Pass to service as required parameter

### 6.2 Update service signature
- [ ] Update `createOrderFromCart` signature in `backend/src/domains/operations/services/orderBuilder.ts`
  - Change `idempotencyKey?: string` to `idempotencyKey: string`
  - Remove optional handling logic
  - Update all callers

### 6.3 Make idempotencyKey required in schema
- [ ] Update `IOrder` interface in `backend/src/models/Order.ts`
  - Change `idempotencyKey?: string` to `idempotencyKey: string`
- [ ] Update `OrderSchema` in `backend/src/models/Order.ts`
  - Add `required: true` to idempotencyKey field

## Task 7: Testing

### 7.1 Unit tests for cart hash
- [ ] Create test file `backend/src/domains/operations/services/__tests__/cartHash.test.ts`
  - Test: Same cart produces same hash
  - Test: Different items produce different hash
  - Test: Different quantities produce different hash
  - Test: Different addresses produce different hash
  - Test: Different totals produce different hash
  - Test: Item order doesn't affect hash (sorted)
  - Test: Floating point precision handling

### 7.2 Unit tests for atomic operations
- [ ] Create test file `backend/src/domains/payments/services/__tests__/atomicFinalization.test.ts`
  - Test: First finalization succeeds
  - Test: Second finalization returns false
  - Test: modifiedCount is checked correctly
  - Test: Concurrent finalizations (one succeeds)

### 7.3 Integration tests for order creation
- [ ] Create test file `backend/src/domains/operations/services/__tests__/orderCreation.integration.test.ts`
  - Test: Concurrent requests with same idempotency key
  - Test: Concurrent requests with same cart hash
  - Test: E11000 recovery for idempotency key
  - Test: E11000 recovery for cart hash
  - Test: Different idempotency keys with same cart

### 7.4 Integration tests for payment finalization
- [ ] Create test file `backend/src/domains/payments/services/__tests__/paymentFinalization.integration.test.ts`
  - Test: Concurrent webhook and polling
  - Test: Multiple webhook retries
  - Test: Inventory commit before finalization
  - Test: Finalization without inventory commit fails

### 7.5 Integration tests for gateway creation
- [ ] Create test file `backend/src/domains/payments/services/__tests__/gatewayCreation.integration.test.ts`
  - Test: Concurrent gateway creation attempts
  - Test: Claim winner proceeds
  - Test: Claim loser waits and returns existing
  - Test: Claim loser timeout handling
  - Test: Winner crash scenario

### 7.6 Integration tests for admin assignment
- [ ] Create test file `backend/src/domains/admin/services/__tests__/adminAssignment.integration.test.ts`
  - Test: First assignment succeeds
  - Test: Duplicate assignment returns false
  - Test: Concurrent assignments (one succeeds)
  - Test: Event consumer idempotency

### 7.7 Property-based tests
- [ ] Create test file `backend/src/domains/operations/services/__tests__/orderCreation.property.test.ts`
  - Property: CP-1 (Order creation idempotency)
  - Property: CP-2 (Cart content deduplication)
- [ ] Create test file `backend/src/domains/payments/services/__tests__/paymentFinalization.property.test.ts`
  - Property: CP-3 (Atomic finalization)
- [ ] Create test file `backend/src/domains/payments/services/__tests__/gatewayCreation.property.test.ts`
  - Property: CP-4 (Single gateway order creation)
- [ ] Create test file `backend/src/domains/admin/services/__tests__/adminAssignment.property.test.ts`
  - Property: CP-5 (Idempotent admin assignment)

## Task 8: Monitoring & Metrics

### 8.1 Add idempotency metrics
- [ ] Update `backend/src/domains/payments/services/paymentMetricsService.ts`
  - Add counter: order_creation_attempts_total
  - Add counter: order_creation_idempotent_returns_total
  - Add counter: order_creation_cart_hash_conflicts_total
  - Add counter: finalization_attempts_total
  - Add counter: finalization_conflicts_total
  - Add counter: admin_assignment_attempts_total
  - Add counter: admin_assignment_conflicts_total

### 8.2 Add metric tracking in services
- [ ] Update `createOrderFromCart` to track metrics
  - Increment order_creation_attempts_total
  - Increment order_creation_idempotent_returns_total on idempotent return
  - Increment order_creation_cart_hash_conflicts_total on cart hash conflict
- [ ] Update `finalizeOrderOnCapturedPayment` to track metrics
  - Increment finalization_attempts_total
  - Increment finalization_conflicts_total when modifiedCount=0
- [ ] Update `assignOrderToAdmin` to track metrics
  - Increment admin_assignment_attempts_total
  - Increment admin_assignment_conflicts_total when already assigned

### 8.3 Add alerting rules
- [ ] Create alerting configuration (location TBD based on monitoring setup)
  - Critical: Duplicate order rate >0.1%
  - Warning: Finalization conflicts >5% of attempts
  - Info: Gateway creation conflicts (expected)

## Task 9: Documentation

### 9.1 Update API documentation
- [ ] Document x-idempotency-key header requirement
  - Format: UUID v4
  - Required: Yes
  - Example: `x-idempotency-key: 550e8400-e29b-41d4-a716-446655440000`

### 9.2 Update architecture documentation
- [ ] Document cart hash deduplication
- [ ] Document atomic finalization
- [ ] Document gateway creation flow
- [ ] Document admin assignment flow

### 9.3 Create runbook
- [ ] Document how to investigate duplicate orders
- [ ] Document how to investigate finalization conflicts
- [ ] Document how to investigate gateway creation issues
- [ ] Document rollback procedures

## Task 10: Deployment & Migration

### 10.1 Phase 1: Schema changes
- [ ] Deploy schema changes to staging
- [ ] Run migration to add indexes
- [ ] Verify index creation
- [ ] Deploy to production
- [ ] Monitor for issues

### 10.2 Phase 2: Code changes
- [ ] Deploy code changes to staging
- [ ] Run integration tests
- [ ] Verify metrics are being tracked
- [ ] Deploy to production
- [ ] Monitor metrics for 24 hours

### 10.3 Phase 3: Enforcement
- [ ] Enable idempotency key validation in staging
- [ ] Test with mobile app
- [ ] Coordinate with mobile team for client updates
- [ ] Enable in production with grace period
- [ ] Monitor client errors
- [ ] Remove grace period after 2 weeks

### 10.4 Phase 4: Cleanup
- [ ] Backfill missing cart hashes (if any)
- [ ] Remove old idempotency logic
- [ ] Update documentation
- [ ] Archive old code

## Task 11: Verification

### 11.1 Verify no duplicate orders
- [ ] Query production database for duplicate orders
  - Same userId + cartHash within 5 minutes
  - Same userId + idempotencyKey
- [ ] Investigate any duplicates found
- [ ] Fix root cause if duplicates exist

### 11.2 Verify atomic finalization
- [ ] Check logs for finalization conflicts
- [ ] Verify all conflicts are handled correctly
- [ ] Verify no duplicate PAID writes

### 11.3 Verify gateway creation
- [ ] Check logs for gateway creation conflicts
- [ ] Verify claim losers wait correctly
- [ ] Verify no duplicate Razorpay orders

### 11.4 Verify admin assignment
- [ ] Check logs for admin assignment conflicts
- [ ] Verify no duplicate assignments
- [ ] Verify event consumer idempotency

### 11.5 Performance verification
- [ ] Measure order creation latency (P50, P95, P99)
- [ ] Measure finalization latency (P50, P95, P99)
- [ ] Measure gateway creation latency (P50, P95, P99)
- [ ] Compare with baseline
- [ ] Verify <5% increase

## Task 12: Rollback Preparation

### 12.1 Create rollback scripts
- [ ] Script to revert idempotency key enforcement
- [ ] Script to revert atomic finalization
- [ ] Script to revert gateway creation changes
- [ ] Script to revert admin assignment changes

### 12.2 Test rollback procedures
- [ ] Test rollback in staging
- [ ] Verify system works after rollback
- [ ] Document rollback steps

### 12.3 Create monitoring dashboard
- [ ] Dashboard for duplicate order detection
- [ ] Dashboard for finalization conflicts
- [ ] Dashboard for gateway creation conflicts
- [ ] Dashboard for admin assignment conflicts
