# 🔄 Rollback Guide - Email to Phone Migration

## Overview

This guide provides step-by-step instructions to safely rollback the email-to-phone migration if issues are discovered in production.

**Risk Level:** LOW (no database schema changes)  
**Rollback Time:** ~5 minutes  
**Data Loss:** None (email field preserved in schema)

---

## 🚨 When to Rollback

Rollback immediately if:
- ❌ Customer signup fails
- ❌ Customer login fails
- ❌ Payment gateway rejects generated email
- ❌ Existing users cannot login
- ❌ Console shows critical errors
- ❌ Test suite fails

Do NOT rollback if:
- ✅ Minor UI issues (can be fixed forward)
- ✅ Non-critical console warnings
- ✅ Individual test failures (can be fixed)

---

## 📋 Pre-Rollback Checklist

Before rolling back:

1. **Capture Evidence:**
   - [ ] Screenshot of error
   - [ ] Console logs
   - [ ] Network payloads
   - [ ] Error stack traces
   - [ ] Affected user count

2. **Verify Issue:**
   - [ ] Reproduce in staging
   - [ ] Confirm not a transient issue
   - [ ] Check if forward fix is possible

3. **Notify Team:**
   - [ ] Alert engineering team
   - [ ] Notify product/business
   - [ ] Document incident

---

## 🔄 Rollback Steps

### Step 1: Revert Frontend Changes

**Files to revert (8 files):**

```bash
# Navigate to frontend directory
cd frontend

# Revert all modified files
git checkout HEAD~1 -- src/components/SignupForm.tsx
git checkout HEAD~1 -- src/components/OtpLoginModal.tsx
git checkout HEAD~1 -- src/components/OnboardingForm.tsx
git checkout HEAD~1 -- src/components/OtpVerificationModal.tsx
git checkout HEAD~1 -- src/pages/AdminUsersPage.tsx
git checkout HEAD~1 -- src/pages/AdminDeliveryBoysPage.tsx
git checkout HEAD~1 -- src/pages/AdminOrderDetailsPage.tsx
git checkout HEAD~1 -- src/pages/CheckoutPage.tsx
```

**Verify:**
```bash
npm run build
# Should complete without errors
```

---

### Step 2: Revert Backend Changes

**Files to revert (2 files):**

```bash
# Navigate to backend directory
cd backend

# Delete new utility file
rm src/utils/generateCustomerEmail.ts

# Revert test helper
git checkout HEAD~1 -- tests/helpers/auth.ts
```

**Verify:**
```bash
npm run build
# Should complete without errors

npm test
# All tests should pass
```

---

### Step 3: Deploy Rollback

**Deployment order (CRITICAL):**

1. **Deploy Backend First:**
   ```bash
   # Backend deployment
   npm run build
   npm run deploy:production
   ```

2. **Wait 2 minutes** (ensure backend is stable)

3. **Deploy Frontend:**
   ```bash
   # Frontend deployment
   npm run build
   npm run deploy:production
   ```

---

### Step 4: Verify Rollback

**Critical Flows to Test:**

1. **Customer Signup:**
   - [ ] Can signup with email + phone
   - [ ] Receives confirmation
   - [ ] Can login after signup

2. **Customer Login:**
   - [ ] Can login with email
   - [ ] Can login with phone
   - [ ] Session persists after refresh

3. **Payment:**
   - [ ] Razorpay accepts email
   - [ ] Payment completes successfully
   - [ ] Order created correctly

4. **Delivery/Admin:**
   - [ ] Delivery login works
   - [ ] Admin login works
   - [ ] Email display correct

---

### Step 5: Monitor

**Monitor for 30 minutes:**

- [ ] Error rate (should return to baseline)
- [ ] Signup success rate
- [ ] Login success rate
- [ ] Payment success rate
- [ ] Console errors (should be minimal)

---

## 🗄️ Database Considerations

### No Database Rollback Needed ✅

**Why:**
- Email field was never removed from schema
- All existing data intact
- No migrations were run
- No data was deleted

**Verification:**
```bash
# Check database schema
mongo
use production-db
db.users.findOne()
# Should show email field present
```

---

## 🔍 Post-Rollback Analysis

### Root Cause Analysis

**Questions to answer:**

1. **What failed?**
   - Specific component/flow
   - Error message
   - Affected users

2. **Why did it fail?**
   - Code issue
   - Integration issue
   - Data issue
   - Infrastructure issue

3. **How to prevent?**
   - Better testing
   - Staged rollout
   - Feature flags
   - Monitoring

### Document Findings

Create incident report:
- Timeline of events
- Root cause
- Impact assessment
- Prevention measures
- Forward fix plan

---

## 🔧 Forward Fix (Alternative to Rollback)

If issue is minor, consider forward fix instead:

### Example: Payment Email Issue

**Problem:** Razorpay rejects generated email

**Forward Fix:**
```typescript
// Update CheckoutPage.tsx
email: (user as any)?.email || `customer-${(user as any)?._id}@internal.local`
```

**Deploy:** Frontend only (faster than full rollback)

### Example: UI Display Issue

**Problem:** Email shows "undefined" instead of "Not set"

**Forward Fix:**
```typescript
// Update ProfilePage.tsx
{user?.email || 'Not set'}
```

**Deploy:** Frontend only

---

## 📊 Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| Customer signup broken | CRITICAL | Rollback immediately |
| Customer login broken | CRITICAL | Rollback immediately |
| Payment fails | CRITICAL | Rollback immediately |
| UI shows "undefined" | LOW | Forward fix |
| Console warning | LOW | Forward fix |
| Single test fails | LOW | Forward fix |
| Delivery login broken | CRITICAL | Rollback immediately |
| Admin login broken | CRITICAL | Rollback immediately |

---

## 🎯 Rollback Success Criteria

Rollback is successful when:

- ✅ All critical flows work
- ✅ Error rate returns to baseline
- ✅ No new errors in logs
- ✅ Test suite passes
- ✅ Users can signup/login/pay
- ✅ Monitoring shows green

---

## 📞 Escalation

If rollback fails:

1. **Immediate:**
   - Alert senior engineer
   - Page on-call engineer
   - Notify CTO/VP Engineering

2. **Communication:**
   - Update status page
   - Notify customer support
   - Prepare user communication

3. **Emergency Actions:**
   - Consider full system rollback
   - Restore from backup (if needed)
   - Enable maintenance mode

---

## 🔐 Rollback Permissions

**Who can rollback:**
- Senior Engineers
- DevOps Team
- On-call Engineer
- Engineering Manager

**Approval needed:**
- None (if critical issue)
- Engineering Manager (if non-critical)

---

## 📝 Rollback Checklist

Use this checklist during rollback:

```
[ ] Evidence captured
[ ] Issue verified
[ ] Team notified
[ ] Frontend reverted (8 files)
[ ] Backend reverted (2 files)
[ ] Backend deployed
[ ] Wait 2 minutes
[ ] Frontend deployed
[ ] Customer signup tested
[ ] Customer login tested
[ ] Payment tested
[ ] Delivery/Admin tested
[ ] Monitoring checked
[ ] Error rate normal
[ ] Incident report created
[ ] Post-mortem scheduled
```

---

## 🚀 Re-Deployment Plan

After rollback and fix:

1. **Fix Issues:**
   - Address root cause
   - Add missing tests
   - Improve monitoring

2. **Test Thoroughly:**
   - Run full test suite
   - Manual testing
   - Staging deployment
   - Load testing

3. **Staged Rollout:**
   - Deploy to 10% users
   - Monitor for 24 hours
   - Deploy to 50% users
   - Monitor for 24 hours
   - Deploy to 100% users

4. **Feature Flag (Recommended):**
   ```typescript
   const usePhoneOnlyAuth = featureFlags.get('phone-only-auth');
   
   if (usePhoneOnlyAuth) {
     // New phone-only flow
   } else {
     // Old email flow
   }
   ```

---

## 📚 Related Documents

- `EMAIL_REMOVAL_COMPLETE_SUMMARY.md` - Migration summary
- `PHASE_1_COMPLETE.md` - Frontend changes
- `PHASE_2_BACKEND_COMPLETE.md` - Backend changes
- `PHASE_3_TESTS_COMPLETE.md` - Test changes
- `MASTER_PROMPT_EMAIL_TO_PHONE_MIGRATION.md` - Migration guide

---

**Created:** April 5, 2026  
**Version:** 1.0  
**Last Updated:** April 5, 2026  
**Owner:** Engineering Team  
**Status:** Ready for Use
