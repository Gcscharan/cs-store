# Payment Idempotency Operations Runbook

## Overview

This runbook provides step-by-step procedures for investigating and resolving issues related to payment idempotency. It is designed for on-call engineers responding to production incidents.

**Target Audience**: On-call engineers, SREs, operations team

## Quick Reference

### Common Issues

| Issue | Severity | First Response Time | Escalation |
|-------|----------|---------------------|------------|
| Duplicate orders detected | 🔴 Critical | 15 minutes | Immediately |
| Finalization conflicts >10% | 🟡 Warning | 1 hour | After 2 hours |
| Gateway creation timeouts | 🟡 Warning | 1 hour | After 4 hours |
| Admin assignment duplicates | 🟢 Info | 4 hours | After 24 hours |

### Key Metrics Dashboard

```
Grafana Dashboard: "Payment Idempotency"
URL: https://grafana.example.com/d/payment-idempotency

Key Panels:
- Duplicate Order Rate (target: 0%)
- Finalization Conflict Rate (target: <5%)
- Gateway Creation Wait Time (target: <2s P95)
- Admin Assignment Conflict Rate (target: <10%)
```

### Emergency Contacts

- **Backend Team Lead**: [Contact Info]
- **Database Team**: [Contact Info]
- **Razorpay Support**: support@razorpay.com
- **Escalation Path**: Backend Lead → CTO → CEO

## Investigation Procedures

### Procedure 1: Investigate Duplicate Orders

#### Symptoms
- Alert: "Duplicate order rate >0.1%"
- Customer complaint: "I was charged twice"
- Support ticket: "Multiple orders for same cart"

#### Step 1: Identify Duplicate Orders

**Query 1: Find orders with same cart hash within 5 minutes**

```javascript
// MongoDB query
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }
  },
  {
    $group: {
      _id: { userId: "$userId", cartHash: "$cartHash" },
      orders: { $push: { orderId: "$_id", createdAt: "$createdAt", idempotencyKey: "$idempotencyKey" } },
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
      timeDiff: {
        $subtract: [
          { $max: "$orders.createdAt" },
          { $min: "$orders.createdAt" }
        ]
      }
    }
  },
  {
    $match: { timeDiff: { $lt: 5 * 60 * 1000 } } // Within 5 minutes
  }
]);
```

**Query 2: Find orders with same idempotency key**

```javascript
// MongoDB query
db.orders.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: { userId: "$userId", idempotencyKey: "$idempotencyKey" },
      orders: { $push: { orderId: "$_id", createdAt: "$createdAt" } },
      count: { $sum: 1 }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
]);
```

#### Step 2: Analyze Duplicate Orders

For each duplicate order set, check:

1. **Idempotency Keys**: Are they the same or different?
   ```javascript
   db.orders.find({ _id: { $in: [orderId1, orderId2] } })
     .projection({ idempotencyKey: 1, cartHash: 1, createdAt: 1 });
   ```

2. **Cart Contents**: Are the carts identical?
   ```javascript
   db.orders.find({ _id: { $in: [orderId1, orderId2] } })
     .projection({ items: 1, total: 1, address: 1 });
   ```

3. **Creation Timestamps**: How far apart were they created?
   ```javascript
   // Calculate time difference
   const order1 = db.orders.findOne({ _id: orderId1 });
   const order2 = db.orders.findOne({ _id: orderId2 });
   const diffMs = order2.createdAt - order1.createdAt;
   console.log(`Time difference: ${diffMs}ms`);
   ```

#### Step 3: Determine Root Cause

**Scenario A: Same idempotency key, different orders**
- **Root Cause**: Index not enforcing uniqueness
- **Action**: Check index status
  ```javascript
  db.orders.getIndexes();
  // Look for: { userId: 1, idempotencyKey: 1 } with unique: true
  ```
- **Escalation**: Immediately escalate to backend team

**Scenario B: Different idempotency keys, same cart**
- **Root Cause**: Cart hash not working or index missing
- **Action**: Check cart hash index
  ```javascript
  db.orders.getIndexes();
  // Look for: { userId: 1, cartHash: 1, createdAt: 1 } with unique: true
  ```
- **Escalation**: Immediately escalate to backend team

**Scenario C: Different idempotency keys, different carts**
- **Root Cause**: Not a duplicate (legitimate orders)
- **Action**: Verify carts are actually different
- **Escalation**: None (close ticket)

#### Step 4: Immediate Mitigation

**If duplicates confirmed**:

1. **Identify affected users**:
   ```javascript
   const affectedUserIds = db.orders.aggregate([
     // ... duplicate query from Step 1 ...
   ]).map(doc => doc.userId);
   ```

2. **Cancel duplicate orders** (if not yet paid):
   ```javascript
   // For each duplicate order (keep the first one)
   db.orders.updateOne(
     { _id: duplicateOrderId, paymentStatus: "PENDING" },
     { $set: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Duplicate order detected" } }
   );
   ```

3. **Refund duplicate payments** (if already paid):
   ```javascript
   // For each duplicate order that was paid
   // Follow refund procedure (see Procedure 5)
   ```

4. **Notify affected users**:
   ```javascript
   // Send email/SMS to affected users
   // Template: "We detected a duplicate order and have cancelled/refunded it"
   ```

#### Step 5: Long-Term Fix

1. **Verify indexes are in place**:
   ```bash
   # SSH to production server
   ssh production-server
   
   # Connect to MongoDB
   mongo
   
   # Check indexes
   use your_database
   db.orders.getIndexes()
   ```

2. **If indexes missing, create them**:
   ```javascript
   // Idempotency key index
   db.orders.createIndex(
     { userId: 1, idempotencyKey: 1 },
     { unique: true, background: true }
   );
   
   // Cart hash index
   db.orders.createIndex(
     { userId: 1, cartHash: 1, createdAt: 1 },
     { unique: true, background: true }
   );
   ```

3. **Monitor for 24 hours**:
   - Check duplicate order rate every hour
   - Verify no new duplicates are created

#### Step 6: Post-Incident Report

Document:
- Number of duplicate orders detected
- Root cause analysis
- Users affected
- Mitigation actions taken
- Long-term fix implemented
- Lessons learned

### Procedure 2: Investigate Finalization Conflicts

#### Symptoms
- Alert: "Finalization conflicts >10%"
- Logs: Multiple "Order already finalized" messages
- Metric: `finalization_conflicts_total` increasing rapidly

#### Step 1: Check Conflict Rate

**Query Prometheus/Grafana**:
```promql
# Conflict rate
rate(finalization_conflicts_total[5m]) / rate(finalization_attempts_total[5m]) * 100
```

**Expected**: <5% (some conflicts are normal due to webhook + polling)
**Critical**: >10% (indicates systemic issue)

#### Step 2: Identify Affected Orders

**Query logs**:
```bash
# SSH to production server
ssh production-server

# Search logs for finalization conflicts
grep "FINALIZATION_GUARD" /var/log/backend.log | tail -100

# Extract order IDs
grep "FINALIZATION_GUARD" /var/log/backend.log | jq -r '.orderId' | sort | uniq -c | sort -rn
```

**Look for**:
- Orders with many conflict attempts (>5)
- Patterns in order IDs or timestamps

#### Step 3: Analyze Conflict Pattern

**Pattern A: High conflict rate, distributed across orders**
- **Root Cause**: Webhook + polling both attempting finalization (expected)
- **Action**: Verify this is the cause
  ```bash
  grep "FINALIZATION_GUARD" /var/log/backend.log | jq -r '.confirmedBy' | sort | uniq -c
  # Should see mix of WEBHOOK, POLLING, RECONCILIATION
  ```
- **Escalation**: None if <10% (expected behavior)

**Pattern B: High conflict rate, concentrated on specific orders**
- **Root Cause**: Retry storm or infinite loop
- **Action**: Check for retry loops
  ```bash
  # Find orders with >10 finalization attempts
  grep "FINALIZATION_GUARD" /var/log/backend.log | jq -r '.orderId' | sort | uniq -c | awk '$1 > 10'
  ```
- **Escalation**: Immediately escalate to backend team

**Pattern C: Sudden spike in conflict rate**
- **Root Cause**: Razorpay webhook delay or outage
- **Action**: Check Razorpay status
  ```bash
  curl https://status.razorpay.com/api/v2/status.json
  ```
- **Escalation**: Monitor for 1 hour, escalate if persists

#### Step 4: Verify Atomic Operation

**Check database operations**:
```javascript
// MongoDB query - verify only one finalization per order
db.orders.find({
  _id: ObjectId("order_id_here"),
  paymentStatus: "PAID"
}).projection({ finalizedAt: 1, paymentConfirmedBy: 1 });

// Should have exactly one finalizedAt timestamp
```

**Check for duplicate finalizations**:
```javascript
// This should return 0 results
db.orders.aggregate([
  {
    $match: {
      paymentStatus: "PAID",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: "$_id",
      finalizedAtCount: { $sum: { $cond: [{ $ne: ["$finalizedAt", null] }, 1, 0] } }
    }
  },
  {
    $match: { finalizedAtCount: { $gt: 1 } }
  }
]);
```

#### Step 5: Mitigation

**If conflict rate >10% and persisting**:

1. **Check Razorpay webhook health**:
   ```bash
   # Check recent webhook deliveries
   curl -u <razorpay_key>:<razorpay_secret> \
     https://api.razorpay.com/v1/webhooks/<webhook_id>/events
   ```

2. **Temporarily disable polling** (if webhook is working):
   ```bash
   # Set environment variable
   export DISABLE_PAYMENT_POLLING=true
   
   # Restart backend
   pm2 restart backend
   ```

3. **Monitor for 1 hour**:
   - Conflict rate should drop to near 0%
   - Verify payments still being finalized

4. **Re-enable polling** (after webhook stabilizes):
   ```bash
   unset DISABLE_PAYMENT_POLLING
   pm2 restart backend
   ```

#### Step 6: Post-Incident Actions

- Document conflict rate during incident
- Verify no orders stuck in PENDING state
- Check for any missed payments
- Update alerting thresholds if needed

### Procedure 3: Investigate Gateway Creation Issues

#### Symptoms
- Alert: "Gateway creation wait time >10s P95"
- Customer complaint: "Payment page not loading"
- Logs: "Gateway creation timeout" errors

#### Step 1: Check Gateway Creation Metrics

**Query Prometheus/Grafana**:
```promql
# Wait time P95
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[5m]))

# Claim loss rate
rate(gateway_creation_claim_losses_total[5m]) / rate(gateway_creation_claims_total[5m]) * 100

# Timeout rate
rate(gateway_creation_timeouts_total[5m])
```

#### Step 2: Identify Stuck Payment Intents

**Query database**:
```javascript
// Find payment intents with attemptedAt but no gatewayOrderId
db.paymentintents.find({
  gatewayCreateAttemptedAt: { $exists: true },
  gatewayOrderId: { $exists: false },
  createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
});
```

**For each stuck intent**:
```javascript
const intent = db.paymentintents.findOne({ _id: intentId });

// Check status
console.log('Status:', intent.status);
console.log('Attempted at:', intent.gatewayCreateAttemptedAt);
console.log('Age:', Date.now() - intent.gatewayCreateAttemptedAt);

// Check associated order
const order = db.orders.findOne({ _id: intent.orderId });
console.log('Order status:', order.paymentStatus);
```

#### Step 3: Determine Root Cause

**Scenario A: High claim loss rate (>50%)**
- **Root Cause**: Many concurrent retries (expected during high traffic)
- **Action**: Verify losers are waiting successfully
  ```bash
  grep "GATEWAY_CLAIM_WAIT_SUCCESS" /var/log/backend.log | wc -l
  # Should be close to claim loss count
  ```
- **Escalation**: None if wait succeeds (expected behavior)

**Scenario B: High timeout rate (>5%)**
- **Root Cause**: Razorpay API slow or winner crashes
- **Action**: Check Razorpay API latency
  ```bash
  # Check recent Razorpay API calls
  grep "Razorpay API" /var/log/backend.log | jq -r '.duration' | awk '{sum+=$1; count++} END {print sum/count}'
  ```
- **Escalation**: If Razorpay API >5s, escalate to Razorpay support

**Scenario C: Stuck intents (attemptedAt but no gatewayOrderId)**
- **Root Cause**: Winner crashed before saving gatewayOrderId
- **Action**: Manual recovery (see Step 4)
- **Escalation**: Escalate to backend team if >10 stuck intents

#### Step 4: Manual Recovery for Stuck Intents

**For each stuck intent**:

1. **Check if Razorpay order exists**:
   ```bash
   curl -u <razorpay_key>:<razorpay_secret> \
     https://api.razorpay.com/v1/orders?receipt=<order_id>
   ```

2. **If Razorpay order exists**:
   ```javascript
   // Update payment intent with gatewayOrderId
   db.paymentintents.updateOne(
     { _id: intentId },
     { $set: { gatewayOrderId: razorpayOrderId } }
   );
   ```

3. **If Razorpay order does NOT exist**:
   ```javascript
   // Reset attemptedAt to allow retry
   db.paymentintents.updateOne(
     { _id: intentId },
     { $unset: { gatewayCreateAttemptedAt: 1 } }
   );
   
   // Notify user to retry payment
   // (or trigger retry programmatically)
   ```

#### Step 5: Mitigation

**If timeout rate >5%**:

1. **Increase timeout** (temporary):
   ```bash
   # Set environment variable
   export GATEWAY_CREATION_TIMEOUT_MS=60000  # 60 seconds
   
   # Restart backend
   pm2 restart backend
   ```

2. **Monitor for 1 hour**:
   - Timeout rate should decrease
   - Wait time will increase (acceptable tradeoff)

3. **Revert timeout** (after Razorpay stabilizes):
   ```bash
   export GATEWAY_CREATION_TIMEOUT_MS=30000  # 30 seconds
   pm2 restart backend
   ```

#### Step 6: Post-Incident Actions

- Document timeout rate and wait time during incident
- Check Razorpay status page for outages
- Verify no users stuck in payment flow
- Consider increasing timeout permanently if needed

### Procedure 4: Investigate Admin Assignment Duplicates

#### Symptoms
- Alert: "Admin assignment duplicates detected"
- Admin complaint: "Same order assigned to me twice"
- Logs: Multiple assignment events for same order

#### Step 1: Identify Duplicate Assignments

**Query database**:
```javascript
// Find orders with adminAssigned=true but multiple assignment events
db.orders.aggregate([
  {
    $match: {
      adminAssigned: true,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  },
  {
    $lookup: {
      from: "events",
      localField: "_id",
      foreignField: "data.orderId",
      as: "events"
    }
  },
  {
    $project: {
      orderId: "$_id",
      adminAssignedAt: 1,
      adminAssignedBy: 1,
      eventCount: { $size: "$events" }
    }
  },
  {
    $match: { eventCount: { $gt: 1 } }
  }
]);
```

#### Step 2: Analyze Assignment Pattern

**Check logs**:
```bash
# Search for assignment conflicts
grep "ADMIN.*ASSIGNMENT_GUARD" /var/log/backend.log | tail -100

# Count conflicts
grep "ADMIN.*ASSIGNMENT_GUARD" /var/log/backend.log | wc -l
```

**Expected**: Some conflicts (due to duplicate events)
**Critical**: Actual duplicate assignments in database

#### Step 3: Verify Atomic Operation

**Check database**:
```javascript
// Verify each order has at most one assignment
db.orders.aggregate([
  {
    $match: { adminAssigned: true }
  },
  {
    $group: {
      _id: "$_id",
      assignmentCount: { $sum: 1 }
    }
  },
  {
    $match: { assignmentCount: { $gt: 1 } }
  }
]);

// Should return 0 results
```

#### Step 4: Mitigation

**If duplicate assignments found**:

1. **Identify affected orders**:
   ```javascript
   const affectedOrders = db.orders.find({
     // ... query from Step 1 ...
   }).toArray();
   ```

2. **Manual cleanup** (if needed):
   ```javascript
   // Keep first assignment, remove duplicates
   // (This should not be needed if atomic operation is working)
   ```

3. **Verify atomic operation is in place**:
   ```bash
   # Check code
   grep -A 10 "assignOrderToAdmin" backend/src/domains/admin/services/adminAssignmentService.ts
   # Should see: adminAssigned: { $ne: true }
   ```

#### Step 5: Post-Incident Actions

- Document number of duplicate assignments
- Verify atomic operation is working
- Check for event deduplication issues
- Update monitoring if needed

### Procedure 5: Rollback Procedures

#### Rollback Scenario 1: Duplicate Orders Detected

**Trigger**: Duplicate order rate >0.1% for >1 hour

**Steps**:

1. **Revert API enforcement**:
   ```bash
   # SSH to production server
   ssh production-server
   
   # Set environment variable
   export IDEMPOTENCY_KEY_OPTIONAL=true
   
   # Restart backend
   pm2 restart backend
   ```

2. **Verify rollback**:
   ```bash
   # Test order creation without idempotency key
   curl -X POST https://api.example.com/api/orders/create \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"paymentMethod":"UPI"}'
   
   # Should succeed (not return 400)
   ```

3. **Monitor for 1 hour**:
   - Duplicate order rate should stabilize
   - No new duplicates should be created

4. **Investigate root cause**:
   - Check indexes
   - Check atomic operations
   - Check logs for errors

5. **Fix and re-deploy**:
   - Fix root cause
   - Deploy fix to staging
   - Test thoroughly
   - Deploy to production
   - Re-enable enforcement

#### Rollback Scenario 2: Performance Degradation

**Trigger**: Order creation latency >2x baseline for >30 minutes

**Steps**:

1. **Identify slow queries**:
   ```javascript
   // MongoDB slow query log
   db.setProfilingLevel(2, { slowms: 100 });
   
   // Check slow queries
   db.system.profile.find({ ns: "your_database.orders" }).sort({ ts: -1 }).limit(10);
   ```

2. **Check index usage**:
   ```javascript
   // Explain order creation query
   db.orders.find({ userId: userId, idempotencyKey: key }).explain("executionStats");
   
   // Should use index, not COLLSCAN
   ```

3. **If index not used**:
   ```javascript
   // Rebuild index
   db.orders.reIndex();
   ```

4. **If performance still degraded**:
   ```bash
   # Temporarily disable cart hash check
   export DISABLE_CART_HASH_CHECK=true
   pm2 restart backend
   ```

5. **Monitor for 1 hour**:
   - Latency should return to baseline
   - Duplicate order rate may increase (acceptable temporarily)

6. **Investigate and fix**:
   - Analyze slow queries
   - Optimize indexes
   - Consider sharding if needed

#### Rollback Scenario 3: Client Compatibility Issues

**Trigger**: High rate of 400 errors (missing idempotency key)

**Steps**:

1. **Add grace period**:
   ```bash
   # Set environment variable
   export IDEMPOTENCY_KEY_GRACE_PERIOD=true
   
   # Restart backend
   pm2 restart backend
   ```

2. **Update validation logic**:
   ```typescript
   // Log warning instead of error
   if (!idempotencyKey) {
     logger.warn('[OrderController] Missing idempotency key', { userId });
     idempotencyKey = uuidv4(); // Generate server-side
   }
   ```

3. **Notify mobile team**:
   - Send alert about missing idempotency keys
   - Provide timeline for enforcement
   - Share API documentation

4. **Monitor adoption**:
   ```promql
   # Percentage of requests with idempotency key
   rate(order_creation_with_key_total[5m]) / rate(order_creation_attempts_total[5m]) * 100
   ```

5. **Gradually enforce**:
   - Week 1: Log warnings (0% enforcement)
   - Week 2: Reject 10% of requests without key
   - Week 3: Reject 50% of requests without key
   - Week 4: Reject 100% of requests without key

## Monitoring Queries

### Duplicate Order Detection

**Daily check**:
```javascript
// Run this query daily
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
]);

// Should return 0 results
```

### Finalization Conflict Rate

**Hourly check**:
```promql
# Prometheus query
rate(finalization_conflicts_total[1h]) / rate(finalization_attempts_total[1h]) * 100

# Should be <5%
```

### Gateway Creation Health

**Hourly check**:
```promql
# Wait time P95
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[1h]))

# Should be <2000ms (2 seconds)
```

### Admin Assignment Conflicts

**Daily check**:
```promql
# Conflict rate
rate(admin_assignment_conflicts_total[24h]) / rate(admin_assignment_attempts_total[24h]) * 100

# Should be <10%
```

## Alerting Rules

### Critical Alerts (Page Immediately)

```yaml
# Duplicate orders detected
- alert: DuplicateOrdersDetected
  expr: duplicate_order_rate > 0.001  # 0.1%
  for: 15m
  severity: critical
  message: "Duplicate orders detected: {{ $value }}%"

# Finalization conflicts high
- alert: FinalizationConflictsHigh
  expr: finalization_conflict_rate > 0.10  # 10%
  for: 30m
  severity: critical
  message: "Finalization conflicts: {{ $value }}%"
```

### Warning Alerts (Notify Slack)

```yaml
# Gateway creation slow
- alert: GatewayCreationSlow
  expr: gateway_creation_wait_time_p95 > 10000  # 10 seconds
  for: 1h
  severity: warning
  message: "Gateway creation slow: {{ $value }}ms P95"

# Admin assignment conflicts
- alert: AdminAssignmentConflictsHigh
  expr: admin_assignment_conflict_rate > 0.10  # 10%
  for: 4h
  severity: warning
  message: "Admin assignment conflicts: {{ $value }}%"
```

## Common Commands

### Check Order Status

```javascript
// MongoDB
db.orders.findOne({ _id: ObjectId("order_id_here") });
```

### Check Payment Intent Status

```javascript
// MongoDB
db.paymentintents.findOne({ orderId: ObjectId("order_id_here") });
```

### Check Razorpay Order

```bash
curl -u <razorpay_key>:<razorpay_secret> \
  https://api.razorpay.com/v1/orders/<razorpay_order_id>
```

### Check Razorpay Payment

```bash
curl -u <razorpay_key>:<razorpay_secret> \
  https://api.razorpay.com/v1/payments/<razorpay_payment_id>
```

### Restart Backend

```bash
# SSH to production server
ssh production-server

# Restart with PM2
pm2 restart backend

# Check logs
pm2 logs backend --lines 100
```

### Check Database Indexes

```javascript
// MongoDB
db.orders.getIndexes();
```

### Rebuild Indexes

```javascript
// MongoDB (use with caution - can be slow)
db.orders.reIndex();
```

## Escalation Procedures

### When to Escalate

**Escalate immediately if**:
- Duplicate orders detected (any amount)
- Finalization conflicts >10% for >30 minutes
- Gateway creation timeouts >5% for >1 hour
- Database errors or index issues
- Razorpay API errors or outages

**Escalate after 2 hours if**:
- Finalization conflicts 5-10% (persistent)
- Gateway creation slow but not timing out
- High conflict rates but no duplicates

**Escalate after 24 hours if**:
- Admin assignment conflicts >10% (persistent)
- Minor performance degradation
- Monitoring gaps or alerting issues

### Escalation Contacts

1. **Backend Team Lead**: [Contact Info]
   - For code issues, logic bugs, design questions

2. **Database Team**: [Contact Info]
   - For index issues, query performance, database errors

3. **Razorpay Support**: support@razorpay.com
   - For Razorpay API issues, webhook problems, gateway errors

4. **CTO**: [Contact Info]
   - For critical incidents affecting customers

## Post-Incident Checklist

After resolving any incident:

- [ ] Document incident timeline
- [ ] Identify root cause
- [ ] Verify mitigation was successful
- [ ] Check for affected users
- [ ] Send user notifications if needed
- [ ] Update runbook with lessons learned
- [ ] Schedule post-mortem meeting
- [ ] Implement long-term fixes
- [ ] Update monitoring and alerting
- [ ] Share incident report with team

## References

- **API Documentation**: `backend/docs/PAYMENT_IDEMPOTENCY_API.md`
- **Architecture Documentation**: `backend/docs/PAYMENT_IDEMPOTENCY_ARCHITECTURE.md`
- **Design Document**: `.kiro/specs/payment-idempotency-fixes/design.md`
- **Bugfix Document**: `.kiro/specs/payment-idempotency-fixes/bugfix.md`
- **Razorpay Documentation**: https://razorpay.com/docs/
- **MongoDB Documentation**: https://www.mongodb.com/docs/

## Appendix: Example Incident Response

### Example: Duplicate Orders Detected

**Timeline**:
```
14:00 - Alert: "Duplicate order rate >0.1%"
14:05 - On-call engineer acknowledges alert
14:10 - Query database, find 5 duplicate orders in last hour
14:15 - Analyze duplicates: Different idempotency keys, same cart hash
14:20 - Root cause: Cart hash index missing
14:25 - Create cart hash index (background)
14:30 - Cancel duplicate orders (not yet paid)
14:35 - Notify affected users
14:40 - Monitor for new duplicates (none detected)
15:00 - Verify index creation complete
15:30 - Close incident
16:00 - Write post-incident report
```

**Actions Taken**:
1. Identified 5 duplicate orders
2. Created missing cart hash index
3. Cancelled 3 duplicate orders (not paid)
4. Refunded 2 duplicate orders (already paid)
5. Notified 5 affected users
6. Monitored for 1 hour (no new duplicates)

**Root Cause**:
- Cart hash index was not created during deployment
- Migration script failed silently
- No monitoring for index existence

**Long-Term Fixes**:
1. Add index existence check to deployment script
2. Add monitoring for index existence
3. Add alert for missing indexes
4. Update deployment checklist

**Lessons Learned**:
- Always verify indexes after deployment
- Monitor index existence, not just query performance
- Test migration scripts in staging
- Add rollback procedures to deployment checklist
