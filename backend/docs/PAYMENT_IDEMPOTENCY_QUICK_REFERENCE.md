# Payment Idempotency Deployment - Quick Reference

## Overview

4-phase rollout over 4 weeks. Each phase builds on the previous one.

| Phase | Week | Duration | Risk | Key Actions |
|-------|------|----------|------|-------------|
| 1 | Week 1 | 2-3 hours | Low | Add schema fields & indexes |
| 2 | Week 2 | 4-6 hours | Low-Medium | Deploy code changes |
| 3 | Week 3 | 2 weeks | High | Enforce idempotency key (BREAKING) |
| 4 | Week 4 | 4-6 hours | Low | Backfill data & cleanup |

---

## Phase 1: Schema Changes

### Commands
```bash
# Staging
ssh staging-server
node scripts/migrations/07_add_idempotency_fields.js
node scripts/verify-idempotency-deployment.js --phase=1

# Production
ssh production-server
mongodump --uri="$MONGODB_URI" --out=/backups/pre-idempotency-phase1-$(date +%Y%m%d-%H%M%S)
node scripts/migrations/07_add_idempotency_fields.js
node scripts/verify-idempotency-deployment.js --phase=1
```

### Success Criteria
- ✅ All indexes created
- ✅ No errors in logs
- ✅ Order creation rate unchanged

### Rollback
```bash
node scripts/rollback-idempotency-deployment.js --from=1 --to=0
```

---

## Phase 2: Code Changes

### Commands
```bash
# Staging
ssh staging-server
cd /path/to/backend
git pull origin main
npm install
npm run build
pm2 restart backend
node scripts/verify-idempotency-deployment.js --phase=2

# Production
ssh production-server
mongodump --uri="$MONGODB_URI" --out=/backups/pre-idempotency-phase2-$(date +%Y%m%d-%H%M%S)
cd /path/to/backend
git pull origin main
npm install
npm run build
pm2 reload backend
node scripts/verify-idempotency-deployment.js --phase=2
```

### Success Criteria
- ✅ Recent orders have cart hash (>95%)
- ✅ No duplicate orders
- ✅ Finalization conflicts <5%
- ✅ Gateway creation wait time <2s P95

### Rollback
```bash
git revert HEAD
npm run build
pm2 reload backend
```

---

## Phase 3: Enforcement

### Commands
```bash
# Staging
ssh staging-server
export IDEMPOTENCY_KEY_REQUIRED=true
pm2 restart backend

# Production (Grace Period)
ssh production-server
export IDEMPOTENCY_KEY_REQUIRED=true
export IDEMPOTENCY_KEY_GRACE_PERIOD=true
pm2 restart backend

# Production (Remove Grace Period - after 1 week)
ssh production-server
unset IDEMPOTENCY_KEY_GRACE_PERIOD
pm2 restart backend
node scripts/verify-idempotency-deployment.js --phase=3
```

### Success Criteria
- ✅ Client adoption >95%
- ✅ Error rate <1%
- ✅ No duplicate orders

### Rollback
```bash
export IDEMPOTENCY_KEY_GRACE_PERIOD=true
pm2 restart backend
```

---

## Phase 4: Cleanup

### Commands
```bash
# Backfill
ssh production-server
node scripts/migrations/08_backfill_cart_hashes.js

# Deploy Cleanup Code
git pull origin main
npm install
npm run build
pm2 reload backend
node scripts/verify-idempotency-deployment.js --phase=4
```

### Success Criteria
- ✅ All orders have cart hash (>99%)
- ✅ Documentation updated
- ✅ Archive created

---

## Monitoring Queries

### Check for Duplicate Orders
```javascript
db.orders.aggregate([
  { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: { userId: "$userId", cartHash: "$cartHash" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

### Check Finalization Conflict Rate
```promql
rate(finalization_conflicts_total[5m]) / rate(finalization_attempts_total[5m]) * 100
```

### Check Gateway Creation Wait Time
```promql
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[5m]))
```

### Check Client Adoption Rate
```promql
rate(order_creation_with_key_total[5m]) / rate(order_creation_attempts_total[5m]) * 100
```

---

## Emergency Contacts

- **Backend Team Lead**: [Contact Info]
- **Database Team**: [Contact Info]
- **Mobile Team Lead**: [Contact Info]
- **DevOps Team**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

---

## Common Issues

### Issue: Duplicate Orders Detected
**Action**: Immediately escalate to backend team lead
**Query**: See "Check for Duplicate Orders" above
**Rollback**: Depends on phase (see rollback sections)

### Issue: High Finalization Conflicts (>10%)
**Action**: Check Razorpay webhook health
**Query**: See "Check Finalization Conflict Rate" above
**Mitigation**: Temporarily disable polling if webhook is working

### Issue: Gateway Creation Timeouts
**Action**: Check Razorpay API latency
**Mitigation**: Increase timeout temporarily
```bash
export GATEWAY_CREATION_TIMEOUT_MS=60000
pm2 restart backend
```

### Issue: Low Client Adoption (<95%)
**Action**: Notify mobile team, extend grace period
**Query**: See "Check Client Adoption Rate" above
**Mitigation**: Keep grace period enabled longer

---

## Key Files

- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
- **Checklist**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT_CHECKLIST.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Migration Scripts**: `backend/scripts/migrations/07_*.js`, `08_*.js`
- **Verification Script**: `backend/scripts/verify-idempotency-deployment.js`
- **Rollback Script**: `backend/scripts/rollback-idempotency-deployment.js`

---

## Testing Commands

### Test Order Creation (with idempotency key)
```bash
curl -X POST https://api.example.com/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $(uuidgen)" \
  -d '{"paymentMethod":"UPI","upiVpa":"test@upi"}'
```

### Test Order Creation (without idempotency key - should fail in Phase 3)
```bash
curl -X POST https://api.example.com/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI","upiVpa":"test@upi"}'
```

### Test Idempotent Behavior
```bash
IDEMPOTENCY_KEY=$(uuidgen)

# First request
curl -X POST https://api.example.com/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{"paymentMethod":"UPI","upiVpa":"test@upi"}'

# Second request (should return same order)
curl -X POST https://api.example.com/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{"paymentMethod":"UPI","upiVpa":"test@upi"}'
```

---

## Timeline Summary

```
Week 1: Phase 1 (Schema Changes)
├─ Day 1: Deploy to staging, test
├─ Day 2: Deploy to production
└─ Day 3-7: Monitor

Week 2: Phase 2 (Code Changes)
├─ Day 1: Deploy to staging, test
├─ Day 2: Deploy to production
└─ Day 3-7: Monitor for 24 hours, then periodic checks

Week 3: Phase 3 (Enforcement)
├─ Day 1: Enable in staging, notify mobile team
├─ Day 3: Enable in production with grace period
├─ Day 4-7: Monitor client adoption
└─ Week 4, Day 1: Remove grace period

Week 4: Phase 4 (Cleanup)
├─ Day 1: Backfill cart hashes
├─ Day 2: Deploy cleanup code
├─ Day 3: Update documentation
└─ Day 4: Archive old code, final verification
```

---

## Success Metrics

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Duplicate Order Rate | 0% | >0.1% |
| Finalization Conflict Rate | <5% | >10% |
| Gateway Creation Wait Time (P95) | <2s | >10s |
| Client Adoption Rate | >95% | <90% |
| Order Creation Latency Increase | <5% | >10% |
| Error Rate | <1% | >5% |

---

## Escalation Path

1. **Minor Issues** (warnings, low conflict rates): On-call engineer
2. **Major Issues** (errors, duplicate orders): Backend team lead
3. **Critical Issues** (system down, data corruption): CTO

---

## Post-Deployment

After all phases complete:

- [ ] Run final verification: `node scripts/verify-idempotency-deployment.js --phase=4`
- [ ] Check all success metrics
- [ ] Update documentation
- [ ] Archive old code
- [ ] Write post-mortem (if issues occurred)
- [ ] Share learnings with team
- [ ] Celebrate! 🎉
