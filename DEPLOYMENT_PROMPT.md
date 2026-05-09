# 🔥 DEPLOYMENT PROMPT: Email → Phone Migration

## Context
You have completed the email-to-phone migration (Phases 1-4). All tests pass. Now deploy to production safely.

---

## 🎯 DEPLOYMENT STRATEGY: STAGED ROLLOUT

### Why Staged?
- Minimize blast radius
- Early detection of issues
- Easy rollback if needed
- Gradual user migration

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before deploying:

- [ ] All 287 tests pass
- [ ] No TypeScript errors
- [ ] No console errors in dev
- [ ] Manual testing complete
- [ ] Staging deployment successful
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Monitoring configured

**STOP if ANY item unchecked**

---

## 🚀 STAGE 1: DEPLOY TO 10% USERS (24 HOURS)

### Deploy:

```bash
# Backend first
cd backend
npm run build
npm run deploy:production -- --percentage 10

# Wait 5 minutes

# Frontend second
cd frontend
npm run build
npm run deploy:production -- --percentage 10
```

### Monitor (24 hours):

**Critical Metrics:**
- Signup success rate: ≥95%
- Login success rate: ≥98%
- Payment success rate: ≥95%
- Error rate: ≤2%
- API response time: ≤500ms

**User Feedback:**
- Customer support tickets
- User complaints
- Social media mentions

### Decision Gate:

✅ **Proceed to Stage 2 if:**
- All metrics within threshold
- No critical bugs reported
- No user complaints

❌ **Rollback if:**
- Any metric below threshold
- Critical bugs detected
- High volume of complaints

---

## 🚀 STAGE 2: DEPLOY TO 50% USERS (24 HOURS)

### Deploy:

```bash
# Backend
npm run deploy:production -- --percentage 50

# Wait 5 minutes

# Frontend
npm run deploy:production -- --percentage 50
```

### Monitor (24 hours):

**Same metrics as Stage 1**

**Additional checks:**
- Database performance
- Server load
- Payment gateway logs
- Third-party integrations

### Decision Gate:

✅ **Proceed to Stage 3 if:**
- All metrics stable
- No new issues
- User feedback positive

❌ **Rollback if:**
- Metrics degrade
- New critical issues
- Infrastructure strain

---

## 🚀 STAGE 3: DEPLOY TO 100% USERS (48 HOURS)

### Deploy:

```bash
# Backend
npm run deploy:production -- --percentage 100

# Wait 5 minutes

# Frontend
npm run deploy:production -- --percentage 100
```

### Monitor (48 hours):

**Extended monitoring:**
- All previous metrics
- Long-term stability
- Edge cases
- Rare user flows

### Success Criteria:

✅ **Migration complete if:**
- All metrics stable for 48 hours
- No critical issues
- User feedback positive
- Team confident

---

## 📊 MONITORING DASHBOARD

### Real-Time Metrics:

```bash
# Setup monitoring
npm run monitor:production -- --metrics signup,login,payment,errors

# View dashboard
open https://monitoring.yourapp.com/email-migration
```

### Alerts:

**Critical (immediate action):**
- Signup success rate < 90%
- Login success rate < 95%
- Payment success rate < 90%
- Error rate > 5%

**Warning (investigate):**
- Signup success rate < 95%
- Login success rate < 98%
- Payment success rate < 95%
- Error rate > 2%

---

## 🚨 EMERGENCY ROLLBACK

### Trigger Conditions:

Rollback immediately if:
- Critical metric below threshold for >5 minutes
- Payment gateway failures spike
- Database errors spike
- User complaints flood in
- Security issue detected

### Rollback Command:

```bash
# Emergency rollback (all stages)
npm run rollback:production -- --emergency

# Notify team
npm run notify:team -- --message "Emergency rollback initiated"

# Monitor rollback
npm run monitor:rollback
```

### Post-Rollback:

1. Capture evidence
2. Root cause analysis
3. Fix issues
4. Re-test thoroughly
5. Re-deploy with fixes

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### After each stage:

**Automated Tests:**
```bash
npm run test:production -- --smoke
npm run test:production -- --e2e
```

**Manual Tests:**
- Customer signup (phone-only)
- Customer login (OTP)
- Customer payment (Razorpay)
- Delivery login (email)
- Admin login (email)

**Database Checks:**
```bash
# Verify data integrity
npm run db:verify -- --check email-migration
```

---

## 📈 SUCCESS METRICS

### After 48 hours at 100%:

**Technical:**
- ✅ 287/287 tests passing
- ✅ Error rate ≤2%
- ✅ API response time ≤500ms
- ✅ No critical bugs

**Business:**
- ✅ Signup rate maintained or improved
- ✅ Login rate maintained or improved
- ✅ Payment rate maintained or improved
- ✅ User satisfaction maintained

**Operational:**
- ✅ No rollbacks needed
- ✅ Team confident
- ✅ Documentation complete
- ✅ Monitoring stable

---

## 🎯 DEPLOYMENT TIMELINE

| Stage | Duration | Users | Monitor | Decision |
|-------|----------|-------|---------|----------|
| Stage 1 | 24h | 10% | Intensive | Go/No-Go |
| Stage 2 | 24h | 50% | Intensive | Go/No-Go |
| Stage 3 | 48h | 100% | Extended | Complete |

**Total:** 4 days (96 hours)

---

## 📞 ESCALATION

### If issues occur:

**Level 1: On-call Engineer**
- Minor issues
- Metrics slightly off
- Non-critical bugs

**Level 2: Engineering Manager**
- Metrics below threshold
- Critical bugs
- Rollback consideration

**Level 3: CTO/VP Engineering**
- Emergency rollback
- Major incident
- Business impact

---

## 📝 DEPLOYMENT CHECKLIST

Use during deployment:

```
Stage 1 (10%):
[ ] Pre-deployment checks complete
[ ] Backend deployed
[ ] Frontend deployed
[ ] Monitoring active
[ ] 24-hour observation
[ ] Metrics within threshold
[ ] Decision: Proceed/Rollback

Stage 2 (50%):
[ ] Stage 1 successful
[ ] Backend deployed
[ ] Frontend deployed
[ ] Monitoring active
[ ] 24-hour observation
[ ] Metrics within threshold
[ ] Decision: Proceed/Rollback

Stage 3 (100%):
[ ] Stage 2 successful
[ ] Backend deployed
[ ] Frontend deployed
[ ] Monitoring active
[ ] 48-hour observation
[ ] Metrics stable
[ ] Migration complete

Post-Deployment:
[ ] Documentation updated
[ ] Team debriefed
[ ] Lessons learned documented
[ ] Monitoring continues
```

---

## 🎉 COMPLETION

When all stages complete successfully:

1. **Announce success** to team
2. **Update documentation**
3. **Archive migration docs**
4. **Schedule retrospective**
5. **Celebrate!** 🎊

---

**Created:** April 5, 2026  
**Version:** 1.0  
**Status:** Production-Ready  
**Risk Level:** LOW (with staged rollout)  
**Confidence:** HIGH
