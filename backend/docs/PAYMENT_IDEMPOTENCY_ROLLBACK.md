# Payment Idempotency Rollback Procedures

## Overview

This document provides comprehensive rollback procedures for the payment idempotency fixes. Each deployment phase has different rollback complexity and procedures.

**Quick Reference**:
- **Phase 1 (Schema)**: Low complexity, easy rollback
- **Phase 2 (Code)**: Low-Medium complexity, easy rollback
- **Phase 3 (Enforcement)**: Medium complexity, requires client coordination
- **Phase 4 (Cleanup)**: High complexity, data changes involved

## Rollback Decision Matrix

| Symptom | Severity | Rollback Phase | Script |
|---------|----------|----------------|--------|
| Duplicate orders detected | 🔴 Critical | Phase 2 | `rollback-phase2-code.sh` |
| Order creation errors | 🔴 Critical | Phase 1 | `rollback-phase1-schema.js` |
| High client error rate (>5%) | 🟡 Warning | Phase 3 | `rollback-phase3-enforcement.js` |
| Finalization conflicts >10% | 🟡 Warning | Investigate | `rollback-atomic-finalization.js` |
| Gateway creation timeouts >5% | 🟡 Warning | Investigate | `rollback-gateway-creation.js` |
| Admin assignment issues | 🟢 Info | Investigate | `rollback-admin-assignment.js` |

## Phase 1 Rollback: Schema Changes

### When to Rollback

- Index creation fails
- Order creation starts failing after deployment
- Database errors related to new indexes
- Performance degradation due to indexes

### Rollback Complexity

**Low** - Only drops indexes, does not delete data

### Rollback Procedure

#### Step 1: Run Rollback Script

```bash
# SSH to production server
ssh production-server

# Navigate to backend directory
cd /path/to/backend

# Run rollback script
node backend/scripts/rollback/rollback-phase1-schema.js
```

**What it does**:
- Drops `cartHash` index
- Drops `adminAssigned` index
- Restores old `idempotencyKey` index (with partial filter)

#### Step 2: Restart Backend

```bash
# Restart backend service
pm2 restart backend

# Check logs
pm2 logs backend --lines 50
```

#### Step 3: Verify Rollback

```bash
# Test order creation
curl -X POST http://localhost:3000/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI"}'

# Should succeed (200 or 201)
```

#### Step 4: Monitor

Monitor for 1 hour:
- Order creation rate (should be stable)
- Error rate (should be low)
- No new index-related errors

### Rollback Impact

- **Data Loss**: None
- **Downtime**: None (zero-downtime restart)
- **User Impact**: None
- **Reversibility**: Easy (can re-deploy Phase 1)

---

## Phase 2 Rollback: Code Changes

### When to Rollback

- Duplicate orders detected (any amount)
- Payment finalization failures >1%
- Order creation latency >2x baseline
- Gateway creation issues
- Any critical production issue

### Rollback Complexity

**Low-Medium** - Reverts code, preserves schema

### Rollback Procedure

#### Step 1: Run Rollback Script

```bash
# SSH to production server
ssh production-server

# Navigate to backend directory
cd /path/to/backend

# Run rollback script
bash backend/scripts/rollback/rollback-phase2-code.sh
```

**What it does**:
- Creates backup tag
- Reverts to previous commit
- Rebuilds application
- Restarts backend service

#### Step 2: Verify Rollback

```bash
# Check current commit
git log -1 --oneline

# Test order creation
curl -X POST http://localhost:3000/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $(uuidgen)" \
  -d '{"paymentMethod":"UPI"}'

# Should succeed
```

#### Step 3: Check for Duplicate Orders

```bash
# Run verification script
node backend/scripts/verify-no-duplicate-orders.js

# Should report 0 duplicates
```

#### Step 4: Monitor

Monitor for 24 hours:
- Duplicate order rate (should be 0%)
- Order creation rate (should be stable)
- Payment finalization rate (should be stable)
- No new errors

### Rollback Impact

- **Data Loss**: None
- **Downtime**: ~30 seconds (during restart)
- **User Impact**: Minimal (brief service interruption)
- **Reversibility**: Easy (can re-deploy Phase 2)

### Re-Deployment After Rollback

1. **Investigate root cause**:
   - Check logs for errors
   - Analyze duplicate orders (if any)
   - Review metrics

2. **Fix issues**:
   - Fix code bugs
   - Adjust indexes if needed
   - Update tests

3. **Test in staging**:
   - Deploy to staging
   - Run full test suite
   - Load test

4. **Re-deploy to production**:
   - Deploy during low-traffic period
   - Monitor closely
   - Have rollback ready

---

## Phase 3 Rollback: Enforcement

### When to Rollback

- Client adoption <95% after 1 week
- Client error rate >5%
- Customer complaints about errors
- Mobile app compatibility issues

### Rollback Complexity

**Medium** - Requires client coordination

### Rollback Procedure

#### Step 1: Run Rollback Script

```bash
# SSH to production server
ssh production-server

# Navigate to backend directory
cd /path/to/backend

# Run rollback script
node backend/scripts/rollback/rollback-phase3-enforcement.js
```

**What it does**:
- Disables `IDEMPOTENCY_KEY_REQUIRED`
- Enables `IDEMPOTENCY_KEY_GRACE_PERIOD`
- Restarts backend service

#### Step 2: Verify Grace Period Mode

```bash
# Test order creation WITHOUT idempotency key
curl -X POST http://localhost:3000/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI"}'

# Should succeed (not return 400 error)
```

#### Step 3: Notify Mobile Team

Send notification:

```
Subject: Payment API Enforcement Rollback - Extended Timeline

Hi Mobile Team,

We've rolled back the mandatory idempotency key enforcement to give more time for client updates.

CURRENT STATE:
- Idempotency key is now OPTIONAL (grace period mode)
- Requests without key will be logged but allowed
- Server will generate keys for requests without them

NEW TIMELINE:
- Week 4: Continue grace period (current)
- Week 5: Monitor client adoption
- Week 6: Re-enable enforcement if adoption >95%

Please prioritize the mobile app update.

Thanks,
Backend Team
```

#### Step 4: Monitor Client Adoption

```promql
# Prometheus query - client adoption rate
rate(order_creation_with_key_total[5m]) / rate(order_creation_attempts_total[5m]) * 100

# Target: >95%
```

### Rollback Impact

- **Data Loss**: None
- **Downtime**: ~30 seconds (during restart)
- **User Impact**: None (improves compatibility)
- **Reversibility**: Easy (can re-enable enforcement)

### Re-Enabling Enforcement

**Trigger**: Client adoption >95% for 3 consecutive days

```bash
# SSH to production server
ssh production-server

# Edit .env file
nano .env

# Set:
IDEMPOTENCY_KEY_REQUIRED=true
# Remove:
# IDEMPOTENCY_KEY_GRACE_PERIOD=true

# Restart backend
pm2 restart backend

# Monitor for 24 hours
```

---

## Component-Specific Rollbacks

### Atomic Finalization Rollback

**When to use**: Finalization conflict rate >10% for >30 minutes

#### Diagnosis

```bash
# Run analysis script
node backend/scripts/rollback/rollback-atomic-finalization.js

# Shows:
# - Stuck orders (PENDING + finalizedAt)
# - Unfinalized orders (payment captured)
# - Finalization conflict rate
```

#### Fix

```bash
# Run with --fix flag
node backend/scripts/rollback/rollback-atomic-finalization.js --fix

# Fixes:
# - Marks stuck orders as PAID
# - Finalizes unfinalized orders
# - Removes invalid finalizedAt timestamps
```

#### Prevention

- Monitor finalization conflict rate
- Check Razorpay webhook health
- Verify polling is not too aggressive

---

### Gateway Creation Rollback

**When to use**: Gateway creation timeout rate >5%

#### Diagnosis

```bash
# Run analysis script
node backend/scripts/rollback/rollback-gateway-creation.js

# Shows:
# - Stuck payment intents
# - Duplicate gateway orders
# - Success rate
```

#### Fix

```bash
# Run with --fix flag
node backend/scripts/rollback/rollback-gateway-creation.js --fix

# Fixes:
# - Resets stuck payment intents
# - Allows retry on next request
```

#### Prevention

- Monitor gateway creation wait time
- Check Razorpay API latency
- Increase timeout if needed

---

### Admin Assignment Rollback

**When to use**: Assignment rate <95% or duplicate assignments

#### Diagnosis

```bash
# Run analysis script
node backend/scripts/rollback/rollback-admin-assignment.js

# Shows:
# - Unassigned orders
# - Assignment rate
# - Inconsistent data
```

#### Fix

```bash
# Run with --fix flag
node backend/scripts/rollback/rollback-admin-assignment.js --fix

# Fixes:
# - Assigns unassigned orders
# - Fixes inconsistent assignment data
```

#### Prevention

- Monitor assignment rate
- Check event bus health
- Verify consumers are running

---

## Emergency Rollback (All Phases)

### When to Use

- Critical production incident
- Data corruption detected
- System instability
- Multiple issues simultaneously

### Procedure

#### Step 1: Rollback Code (Phase 2)

```bash
bash backend/scripts/rollback/rollback-phase2-code.sh
```

#### Step 2: Rollback Schema (Phase 1)

```bash
node backend/scripts/rollback/rollback-phase1-schema.js
```

#### Step 3: Disable Enforcement (Phase 3)

```bash
node backend/scripts/rollback/rollback-phase3-enforcement.js
```

#### Step 4: Verify System Stability

```bash
# Check order creation
curl -X POST http://localhost:3000/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI"}'

# Check for duplicates
node backend/scripts/verify-no-duplicate-orders.js

# Check logs
tail -f /var/log/backend.log | grep -i error
```

#### Step 5: Monitor for 24 Hours

- Order creation rate
- Payment finalization rate
- Error rate
- Customer complaints

---

## Rollback Testing

### Pre-Deployment Testing

Before deploying to production, test rollback procedures in staging:

```bash
# 1. Deploy Phase 1 to staging
# 2. Test rollback Phase 1
bash backend/scripts/rollback/rollback-phase1-schema.js

# 3. Deploy Phase 2 to staging
# 4. Test rollback Phase 2
bash backend/scripts/rollback/rollback-phase2-code.sh

# 5. Deploy Phase 3 to staging
# 6. Test rollback Phase 3
node backend/scripts/rollback/rollback-phase3-enforcement.js
```

### Rollback Drill

Conduct quarterly rollback drills:

1. **Simulate incident** (e.g., duplicate orders)
2. **Execute rollback** (follow procedures)
3. **Verify system** (run verification scripts)
4. **Document lessons** (update procedures)

---

## Rollback Checklist

### Before Rollback

- [ ] Identify root cause
- [ ] Determine rollback scope (which phase)
- [ ] Notify team (on-call, backend lead)
- [ ] Create database backup
- [ ] Review rollback procedure
- [ ] Prepare monitoring queries

### During Rollback

- [ ] Execute rollback script
- [ ] Verify rollback success
- [ ] Restart backend service
- [ ] Check logs for errors
- [ ] Test order creation
- [ ] Verify no duplicates

### After Rollback

- [ ] Monitor for 24 hours
- [ ] Document incident
- [ ] Analyze root cause
- [ ] Fix issues
- [ ] Update tests
- [ ] Plan re-deployment

---

## Rollback Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `rollback-phase1-schema.js` | Rollback schema changes | `node backend/scripts/rollback/rollback-phase1-schema.js` |
| `rollback-phase2-code.sh` | Rollback code changes | `bash backend/scripts/rollback/rollback-phase2-code.sh` |
| `rollback-phase3-enforcement.js` | Rollback enforcement | `node backend/scripts/rollback/rollback-phase3-enforcement.js` |
| `rollback-atomic-finalization.js` | Fix finalization issues | `node backend/scripts/rollback/rollback-atomic-finalization.js [--fix]` |
| `rollback-gateway-creation.js` | Fix gateway issues | `node backend/scripts/rollback/rollback-gateway-creation.js [--fix]` |
| `rollback-admin-assignment.js` | Fix assignment issues | `node backend/scripts/rollback/rollback-admin-assignment.js [--fix]` |

---

## Support Contacts

- **Backend Team Lead**: [Contact Info]
- **Database Team**: [Contact Info]
- **DevOps Team**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

## Escalation Path

1. **Minor Issues**: On-call engineer
2. **Major Issues**: Backend team lead
3. **Critical Issues**: CTO

---

## References

- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Design Document**: `.kiro/specs/payment-idempotency-fixes/design.md`
- **Bugfix Document**: `.kiro/specs/payment-idempotency-fixes/bugfix.md`
