# Payment Idempotency Deployment Checklist

## Pre-Deployment (All Phases)

### General Preparation
- [ ] All tests passing in CI/CD
- [ ] Code review completed and approved
- [ ] Staging environment available and healthy
- [ ] Production database backup completed
- [ ] Monitoring dashboards configured
- [ ] Alerting rules configured
- [ ] On-call engineer identified and briefed
- [ ] Rollback procedures reviewed
- [ ] Communication plan prepared

### Team Coordination
- [ ] Backend team notified
- [ ] DevOps team notified
- [ ] Mobile team notified (for Phase 3)
- [ ] Support team briefed on potential issues
- [ ] Deployment window scheduled (low-traffic period)

### Documentation
- [ ] Deployment guide reviewed
- [ ] Runbook updated
- [ ] API documentation prepared
- [ ] Mobile team documentation prepared (for Phase 3)

---

## Phase 1: Schema Changes

### Pre-Deployment
- [ ] Migration script tested in staging
- [ ] Index creation time estimated
- [ ] Backup completed
- [ ] Rollback script tested

### Staging Deployment
- [ ] SSH to staging server
- [ ] Run migration: `node scripts/migrations/07_add_idempotency_fields.js`
- [ ] Verify indexes created: `db.orders.getIndexes()`
- [ ] Test order creation
- [ ] Check logs for errors
- [ ] Run verification: `node scripts/verify-idempotency-deployment.js --phase=1`

### Production Deployment
- [ ] Create production backup
- [ ] Run migration: `node scripts/migrations/07_add_idempotency_fields.js`
- [ ] Verify indexes created
- [ ] Monitor logs for 2 hours
- [ ] Check order creation rate (should be unchanged)
- [ ] Run verification: `node scripts/verify-idempotency-deployment.js --phase=1`

### Post-Deployment
- [ ] No errors in logs
- [ ] Order creation rate stable
- [ ] All indexes created successfully
- [ ] No customer complaints
- [ ] Update deployment log

### Rollback (If Needed)
- [ ] Run rollback script: `node scripts/rollback-idempotency-deployment.js --from=1 --to=0`
- [ ] Verify system working
- [ ] Document issues
- [ ] Schedule fix and re-deployment

---

## Phase 2: Code Changes

### Pre-Deployment
- [ ] Code changes tested in staging
- [ ] Integration tests passing
- [ ] Performance tests passing
- [ ] Backup completed

### Staging Deployment
- [ ] Pull latest code
- [ ] Install dependencies: `npm install`
- [ ] Build: `npm run build`
- [ ] Restart backend: `pm2 restart backend`
- [ ] Check logs for errors
- [ ] Test order creation with cart hash
- [ ] Test idempotent order creation
- [ ] Test atomic finalization
- [ ] Run verification: `node scripts/verify-idempotency-deployment.js --phase=2`

### Production Deployment
- [ ] Create production backup
- [ ] Pull latest code
- [ ] Install dependencies: `npm install`
- [ ] Build: `npm run build`
- [ ] Restart backend: `pm2 reload backend` (zero-downtime)
- [ ] Check logs for errors

### Monitoring (24 Hours)
- [ ] Hour 1: Watch error logs continuously
- [ ] Hour 1: Check order creation rate
- [ ] Hour 1: Check cart hash conflicts (<1%)
- [ ] Hour 1: Check finalization conflicts (<5%)
- [ ] Hour 2-24: Check metrics every 2 hours
- [ ] Hour 24: Run verification: `node scripts/verify-idempotency-deployment.js --phase=2`

### Success Criteria
- [ ] No errors in logs
- [ ] Order creation rate unchanged
- [ ] Idempotent returns <5%
- [ ] Cart hash conflicts <1%
- [ ] Finalization conflicts <5%
- [ ] Gateway creation wait time <2s P95
- [ ] No customer complaints

### Rollback (If Needed)
- [ ] Revert code: `git revert HEAD`
- [ ] Rebuild: `npm run build`
- [ ] Restart: `pm2 reload backend`
- [ ] Verify system working
- [ ] Document issues

---

## Phase 3: Enforcement

### Pre-Deployment
- [ ] Mobile team notified (2 weeks advance notice)
- [ ] Mobile app updated with idempotency key support
- [ ] Mobile app tested in staging
- [ ] Grace period plan prepared
- [ ] Communication plan for users prepared

### Staging Deployment
- [ ] Set environment: `export IDEMPOTENCY_KEY_REQUIRED=true`
- [ ] Restart backend: `pm2 restart backend`
- [ ] Test without idempotency key (should fail)
- [ ] Test with invalid idempotency key (should fail)
- [ ] Test with valid idempotency key (should succeed)
- [ ] Test with mobile app

### Production Deployment (Grace Period)
- [ ] Create production backup
- [ ] Set environment: `export IDEMPOTENCY_KEY_REQUIRED=true`
- [ ] Set environment: `export IDEMPOTENCY_KEY_GRACE_PERIOD=true`
- [ ] Restart backend: `pm2 restart backend`
- [ ] Monitor client adoption rate

### Grace Period Monitoring (1 Week)
- [ ] Day 1: Check adoption rate (target >50%)
- [ ] Day 3: Check adoption rate (target >75%)
- [ ] Day 5: Check adoption rate (target >90%)
- [ ] Day 7: Check adoption rate (target >95%)
- [ ] Send reminders to mobile team if adoption <95%

### Remove Grace Period
- [ ] Verify adoption >95% for 3 consecutive days
- [ ] Remove grace period: `unset IDEMPOTENCY_KEY_GRACE_PERIOD`
- [ ] Restart backend: `pm2 restart backend`
- [ ] Monitor error rate (<1%)
- [ ] Run verification: `node scripts/verify-idempotency-deployment.js --phase=3`

### Success Criteria
- [ ] Client adoption >95%
- [ ] Error rate <1%
- [ ] No duplicate orders detected
- [ ] No customer complaints

### Rollback (If Needed)
- [ ] Re-enable grace period: `export IDEMPOTENCY_KEY_GRACE_PERIOD=true`
- [ ] Restart backend: `pm2 restart backend`
- [ ] Notify mobile team of extended timeline
- [ ] Monitor for 24 hours
- [ ] Document issues

---

## Phase 4: Cleanup

### Pre-Deployment
- [ ] Backfill script tested in staging
- [ ] Cleanup code reviewed
- [ ] Documentation updates prepared
- [ ] Backup completed

### Backfill Cart Hashes
- [ ] Run backfill: `node scripts/migrations/08_backfill_cart_hashes.js`
- [ ] Verify backfill completed
- [ ] Check for skipped orders
- [ ] Document any issues

### Deploy Cleanup Code
- [ ] Pull latest code
- [ ] Install dependencies: `npm install`
- [ ] Build: `npm run build`
- [ ] Restart backend: `pm2 reload backend`
- [ ] Monitor logs for 1 hour
- [ ] Run verification: `node scripts/verify-idempotency-deployment.js --phase=4`

### Update Documentation
- [ ] Update API documentation
- [ ] Update architecture documentation
- [ ] Update runbook
- [ ] Update changelog

### Archive Old Code
- [ ] Create archive branch: `git checkout -b archive/pre-idempotency-enforcement`
- [ ] Push archive branch: `git push origin archive/pre-idempotency-enforcement`
- [ ] Tag release: `git tag -a v1.0.0-pre-idempotency -m "Pre-idempotency enforcement release"`
- [ ] Push tag: `git push origin v1.0.0-pre-idempotency`

### Success Criteria
- [ ] All orders have cart hash (>99%)
- [ ] No errors in logs
- [ ] Documentation updated
- [ ] Archive created

---

## Post-Deployment Verification (All Phases)

### Database Verification
- [ ] No duplicate orders (last 7 days)
- [ ] Finalization conflict rate <5%
- [ ] Gateway creation wait time <2s P95
- [ ] Admin assignment conflict rate <10%

### Performance Verification
- [ ] Order creation latency <5% increase
- [ ] Payment finalization latency <5% increase
- [ ] Gateway creation latency <10% increase

### Monitoring Verification
- [ ] All metrics being tracked
- [ ] All alerts configured
- [ ] Dashboards updated

### Documentation Verification
- [ ] API documentation updated
- [ ] Architecture documentation updated
- [ ] Runbook updated
- [ ] Changelog updated

---

## Incident Response

### If Duplicate Orders Detected
1. [ ] Immediately escalate to backend team lead
2. [ ] Run duplicate order query
3. [ ] Identify affected users
4. [ ] Cancel/refund duplicate orders
5. [ ] Notify affected users
6. [ ] Investigate root cause
7. [ ] Consider rollback if issue persists

### If Performance Degradation
1. [ ] Check slow query log
2. [ ] Verify index usage
3. [ ] Check for lock contention
4. [ ] Consider rollback if >2x baseline

### If Client Compatibility Issues
1. [ ] Re-enable grace period
2. [ ] Notify mobile team
3. [ ] Extend timeline
4. [ ] Monitor adoption rate

---

## Communication Templates

### Mobile Team Notification (Phase 3)

**Subject**: [ACTION REQUIRED] Payment API Changes - Idempotency Key Now Required

Hi Mobile Team,

We're deploying critical payment system fixes that require client updates.

**BREAKING CHANGE**:
- The order creation API now requires an `x-idempotency-key` header
- Format: UUID v4 (e.g., "550e8400-e29b-41d4-a716-446655440000")
- Generate a new UUID for each order creation attempt
- Reuse the same UUID when retrying a failed request

**TIMELINE**:
- Week 3, Day 1: Staging enforcement enabled (test now)
- Week 3, Day 3: Production enforcement with grace period (warnings only)
- Week 4, Day 1: Full enforcement (requests without key will fail)

**TESTING**:
- Staging API: https://staging-api.example.com
- Test credentials: [provide test account]
- Documentation: backend/docs/PAYMENT_IDEMPOTENCY_API.md

**IMPLEMENTATION GUIDE**:
1. Generate UUID v4 for each order creation
2. Add header: x-idempotency-key: <uuid>
3. Store UUID locally until order confirmed
4. Reuse same UUID on retry (network error, timeout, etc.)
5. Generate new UUID for new order

Please confirm receipt and provide ETA for mobile app update.

Thanks,
Backend Team

---

### User Notification (Duplicate Order)

**Subject**: Duplicate Order Cancelled - Refund Processed

Hi [User Name],

We detected a duplicate order in our system and have automatically cancelled it. No action is required on your part.

**Details**:
- Original Order: #[ORDER_ID_1]
- Duplicate Order: #[ORDER_ID_2] (cancelled)
- Refund Amount: ₹[AMOUNT]
- Refund Status: Processed (will reflect in 5-7 business days)

We apologize for any inconvenience. If you have any questions, please contact our support team.

Thanks,
[Company Name]

---

## Sign-Off

### Phase 1 Completion
- [ ] Backend Team Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______

### Phase 2 Completion
- [ ] Backend Team Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______

### Phase 3 Completion
- [ ] Backend Team Lead: _________________ Date: _______
- [ ] Mobile Team Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______

### Phase 4 Completion
- [ ] Backend Team Lead: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] CTO: _________________ Date: _______

---

## References

- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
- **Design Document**: `.kiro/specs/payment-idempotency-fixes/design.md`
- **Bugfix Document**: `.kiro/specs/payment-idempotency-fixes/bugfix.md`
- **API Documentation**: `backend/docs/PAYMENT_IDEMPOTENCY_API.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Migration Scripts**: `backend/scripts/migrations/`
