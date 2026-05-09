# Payment Idempotency Fixes - Verification Guide

## Overview

This guide provides comprehensive verification procedures to ensure the payment idempotency fixes are working correctly in production. It includes database queries, log analysis, performance monitoring, and automated verification scripts.

**Target Audience**: DevOps, SREs, Backend Engineers

## Quick Verification Checklist

After deployment, verify the following:

- [ ] **11.1**: No duplicate orders detected
- [ ] **11.2**: Atomic finalization working correctly
- [ ] **11.3**: Gateway creation conflicts handled properly
- [ ] **11.4**: Admin assignment idempotency working
- [ ] **11.5**: Performance within acceptable limits (<5% increase)

## 11.1 Verify No Duplicate Orders

### Automated Verification Script

Run the automated verification script:

```bash
cd backend
node scripts/verify-no-duplicate-orders.js
```

**Expected Output**:
```
✅ No duplicate orders found (by idempotency key)
✅ No duplicate orders found (by cart hash)
✅ Verification passed
```

### Manual Database Queries

#### Query 1: Find Duplicate Orders by Idempotency Key

```javascript
// MongoDB query
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }
  },
  {
    $group: {
      _id: { userId: "$userId", idempotencyKey: "$idempotencyKey" },
      orders: { 
        $push: { 
          orderId: "$_id", 
          createdAt: "$createdAt",
          paymentStatus: "$paymentStatus",
          total: "$grandTotal"
        } 
      },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  },
  {
    $project: {
      userId: "$_id.userId",
      idempotencyKey: "$_id.idempotencyKey",
      orders: 1,
      count: 1
    }
  }
]);
```

**Expected Result**: Empty array (no duplicates)

**If Duplicates Found**:
1. Document the duplicate order IDs
2. Check if they have identical cart contents
3. Investigate which deduplication layer failed
4. Follow incident response procedure in PAYMENT_IDEMPOTENCY_RUNBOOK.md

#### Query 2: Find Duplicate Orders by Cart Hash (Within 5 Minutes)

```javascript
// MongoDB query
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }
  },
  {
    $group: {
      _id: { userId: "$userId", cartHash: "$cartHash" },
      orders: { 
        $push: { 
          orderId: "$_id", 
          createdAt: "$createdAt",
          idempotencyKey: "$idempotencyKey",
          paymentStatus: "$paymentStatus"
        } 
      },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  },
  {
    $project: {
      userId: "$_id.userId",
      cartHash: "$_id.cartHash",
      orders: 1,
      count: 1,
      minCreatedAt: { $min: "$orders.createdAt" },
      maxCreatedAt: { $max: "$orders.createdAt" },
      timeDiffMs: {
        $subtract: [
          { $max: "$orders.createdAt" },
          { $min: "$orders.createdAt" }
        ]
      }
    }
  },
  {
    $match: { 
      timeDiffMs: { $lt: 5 * 60 * 1000 } // Within 5 minutes
    }
  }
]);
```

**Expected Result**: Empty array (no duplicates within 5 minutes)

**Note**: Orders with same cart hash >5 minutes apart are legitimate (user can reorder same items later)

#### Query 3: Check Index Health

```javascript
// Verify idempotency key index exists
db.orders.getIndexes().filter(idx => 
  idx.key.userId && idx.key.idempotencyKey
);

// Expected: { userId: 1, idempotencyKey: 1 }, unique: true

// Verify cart hash index exists
db.orders.getIndexes().filter(idx => 
  idx.key.userId && idx.key.cartHash
);

// Expected: { userId: 1, cartHash: 1, createdAt: 1 }, unique: true
```

### Metrics to Monitor

```promql
# Prometheus queries

# Duplicate order rate (should be 0%)
rate(order_creation_cart_hash_conflicts_total[24h]) / rate(order_creation_attempts_total[24h]) * 100

# Idempotent returns (expected <5% - legitimate retries)
rate(order_creation_idempotent_returns_total[24h]) / rate(order_creation_attempts_total[24h]) * 100
```

### Investigation Procedure

If duplicates are found:

1. **Identify the pattern**:
   - Same idempotency key? → Index not enforcing uniqueness
   - Same cart hash? → Cart hash index missing or not working
   - Different keys and hashes? → Not actually duplicates (legitimate orders)

2. **Check index status**:
   ```javascript
   db.orders.getIndexes();
   ```

3. **Verify atomic operations are in place**:
   ```bash
   grep -A 5 "finalizedAt.*exists.*false" backend/src/domains/payments/services/orderPaymentFinalizer.ts
   ```

4. **Follow incident response**:
   - See PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 1

## 11.2 Verify Atomic Finalization

### Automated Verification Script

Run the automated verification script:

```bash
cd backend
node scripts/verify-atomic-finalization.js
```

**Expected Output**:
```
✅ No duplicate PAID writes detected
✅ Finalization conflict rate: 2.3% (within acceptable range <5%)
✅ All conflicts handled correctly
✅ Verification passed
```

### Manual Log Analysis

#### Check Finalization Conflict Rate

```bash
# SSH to production server
ssh production-server

# Count finalization attempts
grep "FINALIZATION_GUARD\|FINALIZED" /var/log/backend.log | wc -l

# Count conflicts (already finalized)
grep "FINALIZATION_GUARD.*already finalized" /var/log/backend.log | wc -l

# Calculate conflict rate
# Conflict Rate = (Conflicts / Total Attempts) * 100
# Expected: <5%
```

#### Verify No Duplicate PAID Writes

```javascript
// MongoDB query - check for orders with multiple finalization timestamps
// This should return 0 results
db.orders.aggregate([
  {
    $match: {
      paymentStatus: "PAID",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }
  },
  {
    $project: {
      orderId: "$_id",
      finalizedAt: 1,
      paymentStatus: 1,
      paymentConfirmedBy: 1,
      // Check if finalizedAt is an array (would indicate multiple writes)
      isArray: { $isArray: "$finalizedAt" }
    }
  },
  {
    $match: { isArray: true }
  }
]);

// Should return empty array
```

#### Check Finalization Sources

```bash
# Check distribution of finalization sources
grep "FINALIZED" /var/log/backend.log | grep -oP 'confirmedBy":\s*"\K[^"]+' | sort | uniq -c

# Expected distribution:
# - WEBHOOK: ~70-80% (primary source)
# - POLLING: ~20-30% (backup verification)
# - RECONCILIATION: <1% (edge cases)
```

### Metrics to Monitor

```promql
# Finalization conflict rate (should be <5%)
rate(finalization_conflicts_total[1h]) / rate(finalization_attempts_total[1h]) * 100

# Finalization success rate (should be >99%)
rate(finalization_attempts_total[1h] - finalization_conflicts_total[1h]) / rate(finalization_attempts_total[1h]) * 100
```

### Investigation Procedure

If issues detected:

1. **High conflict rate (>10%)**:
   - Check if Razorpay webhooks are delayed
   - Verify polling interval is appropriate
   - See PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 2

2. **Duplicate PAID writes found**:
   - **CRITICAL**: Atomic operation not working
   - Check code for race conditions
   - Verify `finalizedAt: { $exists: false }` filter is in place
   - Escalate immediately to backend team

## 11.3 Verify Gateway Creation

### Automated Verification Script

Run the automated verification script:

```bash
cd backend
node scripts/verify-gateway-creation.js
```

**Expected Output**:
```
✅ No duplicate Razorpay orders detected
✅ Gateway creation wait time P95: 1.2s (within acceptable range <2s)
✅ Claim loss rate: 15% (expected during concurrent retries)
✅ All claim losers waited successfully
✅ Verification passed
```

### Manual Log Analysis

#### Check Gateway Creation Conflicts

```bash
# Count gateway creation claims
grep "GATEWAY_CLAIM" /var/log/backend.log | wc -l

# Count claim wins
grep "GATEWAY_CLAIM_WON" /var/log/backend.log | wc -l

# Count claim losses
grep "GATEWAY_CLAIM_LOST" /var/log/backend.log | wc -l

# Count successful waits
grep "GATEWAY_CLAIM_WAIT_SUCCESS" /var/log/backend.log | wc -l

# Count timeouts
grep "GATEWAY_CLAIM_WAIT_TIMEOUT" /var/log/backend.log | wc -l

# Verify: claim_losses ≈ successful_waits (losers should wait successfully)
```

#### Verify No Duplicate Razorpay Orders

```javascript
// MongoDB query - check for payment intents with multiple gateway orders
db.paymentintents.aggregate([
  {
    $match: {
      gatewayOrderId: { $exists: true },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: "$orderId",
      gatewayOrders: { $push: "$gatewayOrderId" },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
]);

// Should return empty array
```

#### Check for Stuck Payment Intents

```javascript
// Find payment intents with attemptedAt but no gatewayOrderId
db.paymentintents.find({
  gatewayCreateAttemptedAt: { $exists: true },
  gatewayOrderId: { $exists: false },
  status: "CREATED",
  createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
});

// Should return empty array or very few results
// If found, follow recovery procedure in PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 3
```

### Metrics to Monitor

```promql
# Gateway creation wait time P95 (should be <2s)
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[1h]))

# Claim loss rate (expected 10-30% during concurrent retries)
rate(gateway_creation_claim_losses_total[1h]) / rate(gateway_creation_claims_total[1h]) * 100

# Timeout rate (should be <1%)
rate(gateway_creation_timeouts_total[1h]) / rate(gateway_creation_claims_total[1h]) * 100
```

### Investigation Procedure

If issues detected:

1. **High timeout rate (>5%)**:
   - Check Razorpay API latency
   - Check for winner crashes
   - See PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 3

2. **Duplicate Razorpay orders found**:
   - **CRITICAL**: Atomic claim not working
   - Check code for race conditions
   - Verify wait loop is implemented correctly
   - Escalate immediately to backend team

## 11.4 Verify Admin Assignment

### Automated Verification Script

Run the automated verification script:

```bash
cd backend
node scripts/verify-admin-assignment.js
```

**Expected Output**:
```
✅ No duplicate admin assignments detected
✅ Admin assignment conflict rate: 8% (within acceptable range <10%)
✅ All conflicts handled correctly
✅ Event consumer idempotency working
✅ Verification passed
```

### Manual Database Queries

#### Check for Duplicate Assignments

```javascript
// MongoDB query - check for orders with multiple admin assignments
db.orders.aggregate([
  {
    $match: {
      adminAssigned: true,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }
  },
  {
    $project: {
      orderId: "$_id",
      adminAssigned: 1,
      adminAssignedAt: 1,
      adminAssignedBy: 1,
      // Check if adminAssignedAt is an array (would indicate multiple assignments)
      isArray: { $isArray: "$adminAssignedAt" }
    }
  },
  {
    $match: { isArray: true }
  }
]);

// Should return empty array
```

### Manual Log Analysis

#### Check Assignment Conflict Rate

```bash
# Count assignment attempts
grep "ADMIN.*ASSIGNMENT" /var/log/backend.log | wc -l

# Count conflicts (already assigned)
grep "ADMIN.*ASSIGNMENT_GUARD.*already assigned" /var/log/backend.log | wc -l

# Calculate conflict rate
# Conflict Rate = (Conflicts / Total Attempts) * 100
# Expected: <10%
```

### Metrics to Monitor

```promql
# Admin assignment conflict rate (should be <10%)
rate(admin_assignment_conflicts_total[1h]) / rate(admin_assignment_attempts_total[1h]) * 100

# Admin assignment success rate (should be >90%)
rate(admin_assignment_attempts_total[1h] - admin_assignment_conflicts_total[1h]) / rate(admin_assignment_attempts_total[1h]) * 100
```

### Investigation Procedure

If issues detected:

1. **Duplicate assignments found**:
   - **CRITICAL**: Atomic operation not working
   - Check code for race conditions
   - Verify `adminAssigned: { $ne: true }` filter is in place
   - Escalate immediately to backend team

2. **High conflict rate (>10%)**:
   - Check for duplicate ORDER_CREATED events
   - Verify event deduplication is working
   - See PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 4

## 11.5 Performance Verification

### Automated Verification Script

Run the automated verification script:

```bash
cd backend
node scripts/verify-performance.js --baseline-file=baseline-metrics.json
```

**Expected Output**:
```
✅ Order creation latency P50: 85ms (baseline: 82ms, +3.7%)
✅ Order creation latency P95: 145ms (baseline: 140ms, +3.6%)
✅ Order creation latency P99: 210ms (baseline: 205ms, +2.4%)
✅ Finalization latency P50: 42ms (baseline: 40ms, +5.0%)
✅ Finalization latency P95: 78ms (baseline: 75ms, +4.0%)
✅ Gateway creation latency P95: 1.2s (baseline: 1.1s, +9.1%)
⚠️  Gateway creation latency increased by 9.1% (threshold: 10%)
✅ All metrics within acceptable range (<10% increase)
✅ Verification passed
```

### Baseline Metrics Collection

Before deployment, collect baseline metrics:

```bash
cd backend
node scripts/collect-baseline-metrics.js --output=baseline-metrics.json
```

This will create a baseline file with current performance metrics.

### Manual Performance Queries

#### Order Creation Latency

```promql
# Prometheus queries

# P50 (median)
histogram_quantile(0.50, rate(order_creation_duration_ms_bucket[1h]))

# P95
histogram_quantile(0.95, rate(order_creation_duration_ms_bucket[1h]))

# P99
histogram_quantile(0.99, rate(order_creation_duration_ms_bucket[1h]))
```

#### Finalization Latency

```promql
# P50
histogram_quantile(0.50, rate(finalization_duration_ms_bucket[1h]))

# P95
histogram_quantile(0.95, rate(finalization_duration_ms_bucket[1h]))

# P99
histogram_quantile(0.99, rate(finalization_duration_ms_bucket[1h]))
```

#### Gateway Creation Latency

```promql
# P50
histogram_quantile(0.50, rate(gateway_creation_duration_ms_bucket[1h]))

# P95
histogram_quantile(0.95, rate(gateway_creation_duration_ms_bucket[1h]))

# P99
histogram_quantile(0.99, rate(gateway_creation_duration_ms_bucket[1h]))
```

### Performance Thresholds

| Metric | Baseline | Threshold | Critical |
|--------|----------|-----------|----------|
| Order creation P95 | ~140ms | <150ms (+7%) | >200ms (+43%) |
| Order creation P99 | ~205ms | <220ms (+7%) | >300ms (+46%) |
| Finalization P95 | ~75ms | <80ms (+7%) | >100ms (+33%) |
| Gateway creation P95 | ~1.1s | <1.2s (+9%) | >2s (+82%) |

### Investigation Procedure

If performance degradation detected:

1. **Check slow query log**:
   ```javascript
   // MongoDB
   db.setProfilingLevel(2, { slowms: 100 });
   db.system.profile.find({ ns: "your_database.orders" }).sort({ ts: -1 }).limit(10);
   ```

2. **Verify index usage**:
   ```javascript
   // Explain order creation query
   db.orders.find({ userId: userId, idempotencyKey: key }).explain("executionStats");
   // Should use index, not COLLSCAN
   ```

3. **Check for lock contention**:
   ```bash
   # MongoDB server status
   db.serverStatus().locks
   ```

4. **Follow rollback procedure if needed**:
   - See PAYMENT_IDEMPOTENCY_DEPLOYMENT.md → Rollback Scenario 2

## Continuous Monitoring

### Daily Verification

Run daily verification checks:

```bash
# Add to cron job
0 9 * * * cd /path/to/backend && node scripts/daily-verification.js
```

This script runs all verification checks and sends a summary report.

### Alerting Rules

Ensure the following alerts are configured:

```yaml
# Critical Alerts
- alert: DuplicateOrdersDetected
  expr: duplicate_order_rate > 0.001  # 0.1%
  for: 15m
  severity: critical

- alert: FinalizationConflictsHigh
  expr: finalization_conflict_rate > 0.10  # 10%
  for: 30m
  severity: critical

# Warning Alerts
- alert: GatewayCreationSlow
  expr: gateway_creation_wait_time_p95 > 2000  # 2 seconds
  for: 1h
  severity: warning

- alert: AdminAssignmentConflictsHigh
  expr: admin_assignment_conflict_rate > 0.10  # 10%
  for: 4h
  severity: warning
```

### Grafana Dashboards

Access the monitoring dashboard:

```
URL: https://grafana.example.com/d/payment-idempotency
```

**Key Panels**:
1. Duplicate Order Rate (target: 0%)
2. Finalization Conflict Rate (target: <5%)
3. Gateway Creation Wait Time (target: <2s P95)
4. Admin Assignment Conflict Rate (target: <10%)
5. Order Creation Latency (target: <150ms P95)

## Verification Report Template

After running all verification checks, document results:

```markdown
# Payment Idempotency Verification Report

**Date**: YYYY-MM-DD
**Environment**: Production
**Verified By**: [Your Name]

## Summary
- [ ] All verification checks passed
- [ ] Issues found (see details below)

## 11.1 Duplicate Orders
- Duplicate orders (idempotency key): 0
- Duplicate orders (cart hash): 0
- Status: ✅ PASS

## 11.2 Atomic Finalization
- Finalization conflict rate: 2.3%
- Duplicate PAID writes: 0
- Status: ✅ PASS

## 11.3 Gateway Creation
- Gateway creation wait time P95: 1.2s
- Duplicate Razorpay orders: 0
- Claim loss rate: 15%
- Status: ✅ PASS

## 11.4 Admin Assignment
- Admin assignment conflict rate: 8%
- Duplicate assignments: 0
- Status: ✅ PASS

## 11.5 Performance
- Order creation P95: 145ms (+3.6%)
- Finalization P95: 78ms (+4.0%)
- Gateway creation P95: 1.2s (+9.1%)
- Status: ✅ PASS

## Issues Found
None

## Recommendations
- Continue monitoring for 7 days
- Review metrics weekly
- Update baseline metrics after stabilization

## Sign-off
- Backend Team: ✅
- DevOps Team: ✅
- On-Call Engineer: ✅
```

## Troubleshooting

### Common Issues

#### Issue 1: Verification Script Fails to Connect to Database

**Symptoms**: Connection timeout, authentication error

**Solution**:
```bash
# Check MongoDB connection string
echo $MONGODB_URI

# Test connection
mongo $MONGODB_URI --eval "db.adminCommand('ping')"

# Verify credentials
mongo $MONGODB_URI --eval "db.runCommand({connectionStatus: 1})"
```

#### Issue 2: Metrics Not Available in Prometheus

**Symptoms**: Prometheus queries return no data

**Solution**:
```bash
# Check if metrics endpoint is accessible
curl http://localhost:3000/metrics | grep order_creation

# Verify Prometheus is scraping the endpoint
# Check Prometheus targets: http://prometheus:9090/targets

# Restart backend if metrics not exposed
pm2 restart backend
```

#### Issue 3: High False Positive Rate in Duplicate Detection

**Symptoms**: Legitimate reorders flagged as duplicates

**Solution**:
- Verify time window is set correctly (5 minutes for cart hash)
- Check if cart hash is being generated consistently
- Review cart hash generation logic for floating point precision issues

## References

- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
- **API Documentation**: `backend/docs/PAYMENT_IDEMPOTENCY_API.md`
- **Architecture**: `backend/docs/PAYMENT_IDEMPOTENCY_ARCHITECTURE.md`
- **Design Document**: `.kiro/specs/payment-idempotency-fixes/design.md`
- **Bugfix Document**: `.kiro/specs/payment-idempotency-fixes/bugfix.md`

## Appendix: Quick Reference Commands

```bash
# Run all verification checks
cd backend
npm run verify:idempotency

# Run individual checks
node scripts/verify-no-duplicate-orders.js
node scripts/verify-atomic-finalization.js
node scripts/verify-gateway-creation.js
node scripts/verify-admin-assignment.js
node scripts/verify-performance.js

# Collect baseline metrics
node scripts/collect-baseline-metrics.js --output=baseline-metrics.json

# Daily verification (add to cron)
node scripts/daily-verification.js

# Generate verification report
node scripts/generate-verification-report.js --output=verification-report.md
```
