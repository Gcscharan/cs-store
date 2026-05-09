# Payment Idempotency Fixes - Deployment Guide

## Overview

This guide provides comprehensive deployment procedures for the payment idempotency fixes. The deployment follows a **4-phase rollout plan** to minimize risk and ensure backward compatibility.

**Estimated Total Timeline**: 4 weeks
**Risk Level**: Medium (breaking changes in Phase 3)
**Rollback Complexity**: Low (Phases 1-2), Medium (Phase 3), High (Phase 4)

## Pre-Deployment Checklist

Before starting any phase:

- [ ] All tests passing in CI/CD
- [ ] Code review completed and approved
- [ ] Staging environment available and healthy
- [ ] Production database backup completed
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured
- [ ] On-call engineer identified and briefed
- [ ] Rollback procedures reviewed
- [ ] Mobile team notified (for Phase 3)

## Phase 1: Schema Changes (Week 1)

**Goal**: Add new fields and indexes without breaking existing functionality

**Risk Level**: Low (non-breaking changes)
**Estimated Duration**: 2-3 hours
**Rollback Complexity**: Low

### Phase 1.1: Deploy to Staging

#### Step 1: Run Schema Migration

```bash
# SSH to staging server
ssh staging-server

# Navigate to backend directory
cd /path/to/backend

# Run migration script
node scripts/migrations/07_add_idempotency_fields.js
```

**Expected Output**:
```
✅ Connected to MongoDB
✅ Added cartHash field to Order schema
✅ Added adminAssigned fields to Order schema
✅ Created cartHash index
✅ Updated idempotency key index
✅ Migration completed successfully
```

#### Step 2: Verify Index Creation

```bash
# Connect to MongoDB
mongo

# Switch to database
use your_database

# Check indexes
db.orders.getIndexes()
```

**Expected Indexes**:
```javascript
[
  { "key": { "_id": 1 }, "name": "_id_" },
  { "key": { "userId": 1, "idempotencyKey": 1 }, "name": "userId_1_idempotencyKey_1", "unique": true },
  { "key": { "userId": 1, "cartHash": 1, "createdAt": 1 }, "name": "userId_1_cartHash_1_createdAt_1", "unique": true },
  { "key": { "adminAssigned": 1 }, "name": "adminAssigned_1" },
  // ... other existing indexes ...
]
```

#### Step 3: Verify No Errors

```bash
# Check application logs
tail -f /var/log/backend.log | grep -i error

# Should see no errors related to schema changes
```

#### Step 4: Test Order Creation

```bash
# Test order creation still works
curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $(uuidgen)" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }'

# Should succeed and return order
```

### Phase 1.2: Deploy to Production

#### Step 1: Create Production Backup

```bash
# SSH to production server
ssh production-server

# Create backup
mongodump --uri="$MONGODB_URI" --out=/backups/pre-idempotency-phase1-$(date +%Y%m%d-%H%M%S)

# Verify backup
ls -lh /backups/
```

#### Step 2: Run Migration in Production

```bash
# Navigate to backend directory
cd /path/to/backend

# Run migration script
node scripts/migrations/07_add_idempotency_fields.js
```

#### Step 3: Monitor for Issues

**Monitor for 2 hours**:

```bash
# Watch error logs
tail -f /var/log/backend.log | grep -i error

# Watch order creation rate
# (Use Grafana dashboard or Prometheus query)
rate(order_creation_attempts_total[5m])

# Watch for index-related errors
grep "index" /var/log/backend.log | tail -20
```

**Success Criteria**:
- No errors in logs
- Order creation rate unchanged
- All indexes created successfully
- No customer complaints

### Phase 1.3: Rollback Procedure (If Needed)

**Trigger**: Errors in logs, order creation failures, or index creation failures

```bash
# SSH to production server
ssh production-server

# Connect to MongoDB
mongo

# Switch to database
use your_database

# Drop new indexes
db.orders.dropIndex("userId_1_cartHash_1_createdAt_1")
db.orders.dropIndex("adminAssigned_1")

# Restore old idempotency key index (if modified)
db.orders.dropIndex("userId_1_idempotencyKey_1")
db.orders.createIndex(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
)

# Restart backend
pm2 restart backend

# Verify system is working
curl -X POST https://api.example.com/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI"}'
```

## Phase 2: Code Changes (Week 2)

**Goal**: Deploy code that uses new fields and atomic operations

**Risk Level**: Low-Medium (backward compatible)
**Estimated Duration**: 4-6 hours
**Rollback Complexity**: Low

### Phase 2.1: Deploy to Staging

#### Step 1: Deploy Code

```bash
# SSH to staging server
ssh staging-server

# Pull latest code
cd /path/to/backend
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart backend
pm2 restart backend

# Check logs
pm2 logs backend --lines 50
```

#### Step 2: Verify Metrics Are Being Tracked

```bash
# Check Prometheus metrics endpoint
curl http://localhost:3000/metrics | grep order_creation

# Should see:
# order_creation_attempts_total
# order_creation_idempotent_returns_total
# order_creation_cart_hash_conflicts_total
# finalization_attempts_total
# finalization_conflicts_total
# gateway_creation_claims_total
# gateway_creation_claim_losses_total
# admin_assignment_attempts_total
# admin_assignment_conflicts_total
```

#### Step 3: Run Integration Tests

```bash
# Run integration tests
npm run test:integration

# Should see all tests passing
```

#### Step 4: Test Order Creation Flow

**Test 1: Order creation with cart hash**

```bash
# Create order
ORDER_RESPONSE=$(curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $(uuidgen)" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }')

# Extract order ID
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '._id')

# Verify cart hash was generated
mongo --eval "db.orders.findOne({_id: ObjectId('$ORDER_ID')}, {cartHash: 1})"

# Should see cartHash field populated
```

**Test 2: Idempotent order creation**

```bash
# Create order with specific idempotency key
IDEMPOTENCY_KEY=$(uuidgen)

# First request
RESPONSE1=$(curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }')

ORDER_ID1=$(echo $RESPONSE1 | jq -r '._id')

# Second request (should return same order)
RESPONSE2=$(curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }')

ORDER_ID2=$(echo $RESPONSE2 | jq -r '._id')

# Verify same order returned
if [ "$ORDER_ID1" == "$ORDER_ID2" ]; then
  echo "✅ Idempotency working correctly"
else
  echo "❌ Idempotency FAILED - different orders returned"
fi
```

**Test 3: Atomic finalization**

```bash
# Create order and trigger payment
# (Use test Razorpay credentials)

# Simulate concurrent webhook and polling
# (This requires custom test script - see tests/integration/payment-finalization.test.ts)

# Verify only one finalization occurred
mongo --eval "db.orders.findOne({_id: ObjectId('$ORDER_ID')}, {finalizedAt: 1, paymentStatus: 1})"

# Should see single finalizedAt timestamp
```

### Phase 2.2: Deploy to Production

#### Step 1: Create Production Backup

```bash
# SSH to production server
ssh production-server

# Create backup
mongodump --uri="$MONGODB_URI" --out=/backups/pre-idempotency-phase2-$(date +%Y%m%d-%H%M%S)
```

#### Step 2: Deploy Code

```bash
# Pull latest code
cd /path/to/backend
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart backend (zero-downtime)
pm2 reload backend

# Check logs
pm2 logs backend --lines 50
```

#### Step 3: Monitor Metrics for 24 Hours

**Hour 1-2: Critical Monitoring**

```bash
# Watch error logs
tail -f /var/log/backend.log | grep -i error

# Watch order creation rate
# (Grafana dashboard: "Payment Idempotency")

# Watch for cart hash conflicts
grep "DUPLICATE_CART" /var/log/backend.log | tail -20

# Watch for finalization conflicts
grep "FINALIZATION_GUARD" /var/log/backend.log | tail -20
```

**Hour 2-24: Periodic Checks**

Check every 2 hours:

```promql
# Prometheus queries

# Order creation rate (should be stable)
rate(order_creation_attempts_total[5m])

# Idempotent returns (should be low, <5%)
rate(order_creation_idempotent_returns_total[5m]) / rate(order_creation_attempts_total[5m]) * 100

# Cart hash conflicts (should be very low, <1%)
rate(order_creation_cart_hash_conflicts_total[5m]) / rate(order_creation_attempts_total[5m]) * 100

# Finalization conflicts (should be <5%)
rate(finalization_conflicts_total[5m]) / rate(finalization_attempts_total[5m]) * 100

# Gateway creation wait time (should be <2s P95)
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[5m]))
```

**Success Criteria**:
- No errors in logs
- Order creation rate unchanged
- Idempotent returns <5%
- Cart hash conflicts <1%
- Finalization conflicts <5%
- Gateway creation wait time <2s P95
- No customer complaints

### Phase 2.3: Rollback Procedure (If Needed)

**Trigger**: High error rate, duplicate orders detected, or performance degradation

```bash
# SSH to production server
ssh production-server

# Revert to previous code version
cd /path/to/backend
git revert HEAD
npm install
npm run build
pm2 reload backend

# Verify system is working
curl -X POST https://api.example.com/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $(uuidgen)" \
  -d '{"paymentMethod":"UPI"}'

# Monitor for 1 hour
tail -f /var/log/backend.log | grep -i error
```

## Phase 3: Enforcement (Week 3)

**Goal**: Make idempotency key mandatory (BREAKING CHANGE)

**Risk Level**: High (requires client updates)
**Estimated Duration**: 2 weeks (with grace period)
**Rollback Complexity**: Medium

### Phase 3.1: Enable in Staging

#### Step 1: Deploy Enforcement Code

```bash
# SSH to staging server
ssh staging-server

# Set environment variable
export IDEMPOTENCY_KEY_REQUIRED=true

# Restart backend
pm2 restart backend
```

#### Step 2: Test with Mobile App

**Test 1: Request without idempotency key (should fail)**

```bash
curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }'

# Expected response:
# {
#   "error": "IDEMPOTENCY_KEY_REQUIRED",
#   "message": "x-idempotency-key header is required"
# }
```

**Test 2: Request with invalid idempotency key (should fail)**

```bash
curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: invalid-key" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }'

# Expected response:
# {
#   "error": "INVALID_IDEMPOTENCY_KEY",
#   "message": "x-idempotency-key must be a valid UUID v4"
# }
```

**Test 3: Request with valid idempotency key (should succeed)**

```bash
curl -X POST https://staging-api.example.com/api/orders/create \
  -H "Authorization: Bearer <staging_token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $(uuidgen)" \
  -d '{
    "paymentMethod": "UPI",
    "upiVpa": "test@upi"
  }'

# Expected: 201 Created with order details
```

#### Step 3: Coordinate with Mobile Team

**Send notification to mobile team**:

```
Subject: [ACTION REQUIRED] Payment API Changes - Idempotency Key Now Required

Hi Mobile Team,

We're deploying critical payment system fixes that require client updates.

BREAKING CHANGE:
- The order creation API now requires an `x-idempotency-key` header
- Format: UUID v4 (e.g., "550e8400-e29b-41d4-a716-446655440000")
- Generate a new UUID for each order creation attempt
- Reuse the same UUID when retrying a failed request

TIMELINE:
- Week 3, Day 1: Staging enforcement enabled (test now)
- Week 3, Day 3: Production enforcement with grace period (warnings only)
- Week 4, Day 1: Full enforcement (requests without key will fail)

TESTING:
- Staging API: https://staging-api.example.com
- Test credentials: [provide test account]
- Documentation: backend/docs/PAYMENT_IDEMPOTENCY_API.md

IMPLEMENTATION GUIDE:
1. Generate UUID v4 for each order creation
2. Add header: x-idempotency-key: <uuid>
3. Store UUID locally until order confirmed
4. Reuse same UUID on retry (network error, timeout, etc.)
5. Generate new UUID for new order

Please confirm receipt and provide ETA for mobile app update.

Thanks,
Backend Team
```

### Phase 3.2: Enable in Production with Grace Period

#### Step 1: Deploy Grace Period Code

```bash
# SSH to production server
ssh production-server

# Set environment variables
export IDEMPOTENCY_KEY_REQUIRED=true
export IDEMPOTENCY_KEY_GRACE_PERIOD=true

# Restart backend
pm2 restart backend
```

**Grace Period Behavior**:
- Requests without idempotency key: Log warning, generate server-side UUID, allow request
- Requests with invalid idempotency key: Return 400 error
- Requests with valid idempotency key: Normal behavior

#### Step 2: Monitor Client Adoption

```bash
# Check percentage of requests with idempotency key
# (Prometheus query)
rate(order_creation_with_key_total[5m]) / rate(order_creation_attempts_total[5m]) * 100

# Target: >95% within 1 week
```

#### Step 3: Notify Users of Missing Keys

```bash
# Check logs for warnings
grep "Missing idempotency key" /var/log/backend.log | wc -l

# If high (>100/hour), send notification to mobile team
```

### Phase 3.3: Remove Grace Period

**Trigger**: Client adoption >95% for 3 consecutive days

#### Step 1: Remove Grace Period

```bash
# SSH to production server
ssh production-server

# Remove grace period flag
export IDEMPOTENCY_KEY_REQUIRED=true
unset IDEMPOTENCY_KEY_GRACE_PERIOD

# Restart backend
pm2 restart backend
```

#### Step 2: Monitor for Client Errors

```bash
# Watch for 400 errors
grep "IDEMPOTENCY_KEY_REQUIRED" /var/log/backend.log | tail -20

# Check error rate
# (Prometheus query)
rate(order_creation_errors_total{error="IDEMPOTENCY_KEY_REQUIRED"}[5m])

# Target: <1% of requests
```

#### Step 3: Verify No Duplicate Orders

```bash
# Connect to MongoDB
mongo

# Check for duplicate orders (last 24 hours)
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: { userId: "$userId", cartHash: "$cartHash" },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
])

# Should return 0 results
```

**Success Criteria**:
- Client adoption >95%
- Error rate <1%
- No duplicate orders detected
- No customer complaints

### Phase 3.4: Rollback Procedure (If Needed)

**Trigger**: High error rate (>5%), customer complaints, or mobile app issues

```bash
# SSH to production server
ssh production-server

# Re-enable grace period
export IDEMPOTENCY_KEY_REQUIRED=true
export IDEMPOTENCY_KEY_GRACE_PERIOD=true

# Restart backend
pm2 restart backend

# Notify mobile team
# (Send email with extended timeline)

# Monitor for 24 hours
tail -f /var/log/backend.log | grep -i error
```

## Phase 4: Cleanup (Week 4)

**Goal**: Backfill data, remove old code, update documentation

**Risk Level**: Low
**Estimated Duration**: 4-6 hours
**Rollback Complexity**: High (data changes)

### Phase 4.1: Backfill Missing Cart Hashes

#### Step 1: Identify Orders Without Cart Hash

```bash
# Connect to MongoDB
mongo

# Count orders without cart hash
db.orders.countDocuments({ cartHash: { $exists: false } })

# If count > 0, proceed with backfill
```

#### Step 2: Run Backfill Script

```bash
# SSH to production server
ssh production-server

# Run backfill script
node scripts/migrations/08_backfill_cart_hashes.js
```

**Expected Output**:
```
✅ Connected to MongoDB
🔍 Found 1,234 orders without cart hash
🔄 Backfilling cart hashes...
✅ Backfilled 1,234 orders
✅ Backfill completed successfully
```

#### Step 3: Verify Backfill

```bash
# Connect to MongoDB
mongo

# Verify all orders have cart hash
db.orders.countDocuments({ cartHash: { $exists: false } })

# Should return 0
```

### Phase 4.2: Remove Old Idempotency Logic

#### Step 1: Identify Old Code

```bash
# Search for old idempotency logic
grep -r "idempotencyKey?" backend/src/

# Review each file and remove optional handling
```

#### Step 2: Deploy Cleanup Code

```bash
# SSH to production server
ssh production-server

# Pull latest code
cd /path/to/backend
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart backend
pm2 reload backend
```

#### Step 3: Verify No Errors

```bash
# Monitor logs for 1 hour
tail -f /var/log/backend.log | grep -i error

# Should see no errors
```

### Phase 4.3: Update Documentation

#### Step 1: Update API Documentation

- [ ] Update `backend/docs/PAYMENT_IDEMPOTENCY_API.md`
  - Mark idempotency key as required
  - Remove optional handling notes
  - Add examples with required header

#### Step 2: Update Architecture Documentation

- [ ] Update `backend/docs/PAYMENT_IDEMPOTENCY_ARCHITECTURE.md`
  - Document cart hash deduplication
  - Document atomic finalization
  - Document gateway creation flow
  - Document admin assignment flow

#### Step 3: Update Runbook

- [ ] Update `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
  - Add new monitoring queries
  - Add new troubleshooting procedures
  - Update rollback procedures

### Phase 4.4: Archive Old Code

#### Step 1: Create Archive Branch

```bash
# Create archive branch
git checkout -b archive/pre-idempotency-enforcement
git push origin archive/pre-idempotency-enforcement

# Tag release
git tag -a v1.0.0-pre-idempotency -m "Pre-idempotency enforcement release"
git push origin v1.0.0-pre-idempotency
```

#### Step 2: Document Changes

Create `CHANGELOG.md` entry:

```markdown
## [1.1.0] - 2024-XX-XX

### Added
- Mandatory idempotency key for order creation
- Cart hash deduplication (Amazon-style)
- Atomic payment finalization
- Strict single gateway order creation
- Idempotent admin assignment

### Changed
- Order creation now requires x-idempotency-key header
- Payment finalization uses atomic compare-and-set
- Gateway creation enforces single Razorpay order per intent

### Fixed
- Duplicate orders from concurrent requests
- Payment finalization race conditions
- Duplicate Razorpay gateway orders
- Duplicate admin assignments

### Breaking Changes
- x-idempotency-key header now required for order creation
- Format: UUID v4
- Clients must be updated to include this header
```

## Post-Deployment Verification

### Verification Checklist

After completing all phases:

- [ ] No duplicate orders in production (query last 7 days)
- [ ] Finalization conflict rate <5%
- [ ] Gateway creation wait time <2s P95
- [ ] Admin assignment conflict rate <10%
- [ ] Order creation latency <5% increase
- [ ] Payment finalization latency <5% increase
- [ ] No customer complaints
- [ ] All documentation updated
- [ ] All tests passing
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured

### Verification Queries

**Check for duplicate orders**:

```javascript
// MongoDB query
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: { userId: "$userId", cartHash: "$cartHash" },
      orders: { $push: { orderId: "$_id", createdAt: "$createdAt" } },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
]);

// Should return 0 results
```

**Check finalization conflict rate**:

```promql
# Prometheus query
rate(finalization_conflicts_total[24h]) / rate(finalization_attempts_total[24h]) * 100

# Should be <5%
```

**Check gateway creation health**:

```promql
# Prometheus query
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[24h]))

# Should be <2000ms (2 seconds)
```

**Check order creation latency**:

```promql
# Prometheus query
histogram_quantile(0.95, rate(order_creation_duration_ms_bucket[24h]))

# Should be <5% increase from baseline
```

## Emergency Contacts

- **Backend Team Lead**: [Contact Info]
- **Database Team**: [Contact Info]
- **Mobile Team Lead**: [Contact Info]
- **DevOps Team**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

## Escalation Path

1. **Minor Issues** (warnings, low conflict rates): On-call engineer
2. **Major Issues** (errors, duplicate orders): Backend team lead
3. **Critical Issues** (system down, data corruption): CTO

## References

- **Design Document**: `.kiro/specs/payment-idempotency-fixes/design.md`
- **Bugfix Document**: `.kiro/specs/payment-idempotency-fixes/bugfix.md`
- **API Documentation**: `backend/docs/PAYMENT_IDEMPOTENCY_API.md`
- **Architecture Documentation**: `backend/docs/PAYMENT_IDEMPOTENCY_ARCHITECTURE.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Migration Scripts**: `backend/scripts/migrations/`

## Appendix: Timeline Summary

| Phase | Week | Duration | Risk | Rollback |
|-------|------|----------|------|----------|
| Phase 1: Schema Changes | Week 1 | 2-3 hours | Low | Easy |
| Phase 2: Code Changes | Week 2 | 4-6 hours | Low-Medium | Easy |
| Phase 3: Enforcement | Week 3 | 2 weeks | High | Medium |
| Phase 4: Cleanup | Week 4 | 4-6 hours | Low | Hard |

**Total Timeline**: 4 weeks
**Total Effort**: ~20-30 hours
**Risk Level**: Medium (breaking changes in Phase 3)
