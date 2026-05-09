# Email Removal Checklist

**Status**: READY TO EXECUTE  
**Estimated Time**: 6-9 hours  
**Risk Level**: LOW

---

## Pre-Flight Checks

- [ ] Read `EMAIL_AUDIT_SUMMARY.md` completely
- [ ] Review `EMAIL_USAGE_AUDIT.json` for technical details
- [ ] Backup current codebase
- [ ] Create feature branch: `git checkout -b remove-customer-email`
- [ ] Ensure all tests currently passing (287/287)

---

## Phase 1: Frontend Changes (2-3 hours)

### 1.1 Remove Email from SignupForm ⏱️ 30 mins

**File**: `frontend/src/components/SignupForm.tsx`

- [ ] Remove email from interface `SignupFormData` (line 11)
- [ ] Remove email from state initialization (line 30)
- [ ] Remove email validation (line 106)
- [ ] Remove email from API payload (line 258)
- [ ] Remove email error handling (line 311)
- [ ] Remove email input field (lines 361-373)
- [ ] Update form layout (remove email section)
- [ ] Test: Signup form renders without email field
- [ ] Test: Form submission works with phone only

**Verification**:
```bash
# Visual check
npm run dev
# Navigate to signup page
# Verify no email field visible
```

---

### 1.2 Remove Email from OtpLoginModal ⏱️ 45 mins

**File**: `frontend/src/components/OtpLoginModal.tsx`

- [ ] Remove `email` from AuthMethod type (line 15)
- [ ] Remove email state (line 27)
- [ ] Remove email from payload (lines 87-88)
- [ ] Remove email from identifier (line 118)
- [ ] Remove email from OTP verification (line 169)
- [ ] Remove email error messages (lines 179-181)
- [ ] Simplify input to phone-only (lines 304-329)
- [ ] Remove email detection logic
- [ ] Update placeholder text to "Enter phone number"
- [ ] Test: Login modal only accepts phone
- [ ] Test: OTP flow works with phone only

**Verification**:
```bash
# Visual check
npm run dev
# Open login modal
# Verify only phone input visible
# Test OTP flow end-to-end
```

---

### 1.3 Remove Email from OnboardingForm ⏱️ 15 mins

**File**: `frontend/src/components/OnboardingForm.tsx`

- [ ] Remove email display section (lines 390-403)
- [ ] Update form layout
- [ ] Test: Onboarding form renders without email

**Verification**:
```bash
# Visual check
npm run dev
# Complete OAuth flow
# Verify onboarding doesn't show email
```

---

### 1.4 Remove Email from Redux State ⏱️ 30 mins

**File**: `frontend/src/components/OtpVerificationModal.tsx`

- [ ] Remove email from setUser dispatch (line 108)
- [ ] Update user type definition (if needed)
- [ ] Check Redux store structure
- [ ] Test: User state doesn't include email

**Files to Check**:
- `frontend/src/store/authSlice.ts` (or equivalent)
- `frontend/src/types/user.ts` (or equivalent)

**Verification**:
```bash
# Check Redux DevTools
# Verify user object doesn't have email field
```

---

### 1.5 Keep Customer Care Email ✅ NO CHANGE

**File**: `frontend/src/pages/CustomerCarePage.tsx`

- [ ] Verify email field is for support contact (legitimate use)
- [ ] No changes needed

---

## Phase 2: Backend Changes (1-2 hours)

### 2.1 Add Email Generation for Payments ⏱️ 30 mins

**Location**: Find where payment is created (likely in payment service or order controller)

**Search for**:
```bash
cd backend
grep -r "razorpay.orders.create" src/
grep -r "Payment.create" src/
```

**Add email generation**:
```typescript
// Generate email for payment gateway
const email = user.email || `${user.phone}@customer.internal`;

// Use in payment creation
const payment = await razorpay.orders.create({
  // ... other fields
  notes: {
    email: email,
    // ... other notes
  }
});
```

- [ ] Find payment creation location
- [ ] Add email generation logic
- [ ] Test: Payment creation works without user email
- [ ] Test: Generated email format is valid

**Verification**:
```bash
cd backend
npm test -- payment
# Check payment creation tests pass
```

---

### 2.2 Update Profile Validation ⏱️ 30 mins

**File**: `backend/src/domains/identity/controllers/userController.ts`

**Line 85-88**: Update profile update logic

```typescript
// BEFORE
const { name, phone, email } = req.body;
const result = await userProfileService.updateUserProfile(userId, { name, phone, email });

// AFTER
const { name, phone } = req.body;
// Reject email for customers
if (req.body.email && req.user.role === 'customer') {
  return res.status(400).json({ error: "Email updates not allowed for customers" });
}
const result = await userProfileService.updateUserProfile(userId, { name, phone });
```

- [ ] Add customer role check
- [ ] Reject email in customer profile updates
- [ ] Keep email for delivery/admin
- [ ] Test: Customer cannot update email
- [ ] Test: Delivery partner can update email

**Verification**:
```bash
cd backend
npm test -- userController
```

---

### 2.3 Update Auth Controller (Optional) ⏱️ 30 mins

**File**: `backend/src/domains/identity/controllers/authController.ts`

**Current Status**: Already accepts email as optional (line 90)

**Optional Enhancement**: Add logging to track OAuth email usage

```typescript
// Line 90
email: email || undefined, // Optional email field

// Add logging
if (email) {
  logger.info(`[SIGNUP] Email provided: ${email.substring(0, 3)}***`);
} else {
  logger.info(`[SIGNUP] Phone-only signup`);
}
```

- [ ] Review current implementation
- [ ] Add logging (optional)
- [ ] Test: Signup works with and without email
- [ ] Test: OAuth signup preserves email

**Verification**:
```bash
cd backend
npm test -- auth.integration.test.ts
```

---

## Phase 3: Test Updates (3-4 hours)

### 3.1 Update Test Helpers ⏱️ 1 hour

**File**: `backend/tests/helpers/auth.ts`

```typescript
// BEFORE
export async function createTestUser(overrides: any = {}) {
  return await User.create({
    name: "Test User",
    email: "test@example.com", // REMOVE THIS
    phone: uniquePhone,
    // ...
  });
}

// AFTER
export async function createTestUser(overrides: any = {}) {
  return await User.create({
    name: "Test User",
    // email only if explicitly provided or role is delivery/admin
    ...(overrides.email || overrides.role !== 'customer' ? { email: overrides.email } : {}),
    phone: uniquePhone,
    // ...
  });
}
```

- [ ] Update createTestUser to make email optional
- [ ] Update createTestAdmin to keep email
- [ ] Update token generation to handle missing email
- [ ] Test: Helper functions work without email

**File**: `backend/tests/helpers/tokenHelper.ts`

```typescript
// BEFORE
return {
  userId: "507f1f77bcf86cd799439011",
  email: `${role}@example.com`, // Make optional
  role,
};

// AFTER
return {
  userId: "507f1f77bcf86cd799439011",
  ...(role !== 'customer' ? { email: `${role}@example.com` } : {}),
  role,
};
```

- [ ] Make email optional in token payload
- [ ] Test: Tokens work without email

---

### 3.2 Update Integration Tests ⏱️ 2-3 hours

**Strategy**: Update tests file by file

**Priority Order**:
1. Auth tests (highest priority)
2. Order tests
3. Cart tests
4. Payment tests
5. Other integration tests

**For each test file**:
- [ ] Find all `createTestUser({ email: "..." })`
- [ ] Remove email for customer users
- [ ] Keep email for delivery/admin users
- [ ] Run test file
- [ ] Fix any failures

**Example**:
```typescript
// BEFORE
const user = await createTestUser({ email: "test@example.com" });

// AFTER (for customer)
const user = await createTestUser({ phone: "9876543210" });

// AFTER (for delivery)
const delivery = await createTestUser({ 
  email: "delivery@example.com",
  role: "delivery" 
});
```

**Files to Update** (89 files):
- [ ] `backend/tests/integration/auth.test.ts`
- [ ] `backend/tests/integration/products.test.ts`
- [ ] `backend/tests/integration/orders.test.ts`
- [ ] `backend/tests/integration/cart.test.ts`
- [ ] `backend/tests/integration/paymentIntents.creation.test.ts`
- [ ] `backend/tests/integration/fullOrderLifecycle.test.ts`
- [ ] `backend/tests/integration/reliability.spec.ts`
- [ ] `backend/tests/integration/trackingPhase*.test.ts`
- [ ] ... (continue for all 89 files)

**Verification After Each File**:
```bash
cd backend
npm test -- <filename>
```

---

### 3.3 Update Stress Tests ⏱️ 30 mins

**File**: `backend/tests/stress/inventoryConcurrency.test.ts`

- [ ] Update user creation pattern (line 29)
- [ ] Update cleanup pattern (line 109, 238)
- [ ] Use phone-based patterns instead of email

```typescript
// BEFORE
email: `user${index}@test.com`,
await User.deleteMany({ email: /user\d+@test\.com/ });

// AFTER
phone: `98765${String(index).padStart(5, '0')}`,
await User.deleteMany({ phone: /98765\d{5}/ });
```

---

## Phase 4: Verification (30 mins)

### 4.1 Run Full Test Suite ⏱️ 10 mins

```bash
cd backend
npm test
```

**Expected Results**:
- [ ] Security tests: 130/130 ✅
- [ ] Property tests: 59/60 ✅
- [ ] Integration tests: 97/97 ✅
- [ ] Auth tests: 22/22 ✅
- [ ] All other tests passing

**If failures**:
- [ ] Review failure logs
- [ ] Fix issues
- [ ] Re-run tests

---

### 4.2 Manual Testing ⏱️ 10 mins

**Frontend**:
- [ ] Open signup page - no email field visible
- [ ] Complete signup with phone only
- [ ] Open login modal - only phone input visible
- [ ] Complete login with phone + OTP
- [ ] Check profile page - no email displayed
- [ ] Try OAuth signup - works, email not shown

**Backend**:
- [ ] Create order - payment works
- [ ] Check payment record - email generated
- [ ] Update profile - email rejected for customer
- [ ] Delivery partner login - email works

---

### 4.3 API Testing ⏱️ 10 mins

```bash
# Test customer signup (no email)
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","phone":"9876543210"}'

# Test customer login (phone only)
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","type":"login"}'

# Test profile update (email rejected)
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Expected: 400 error

# Test delivery partner signup (email works)
curl -X POST http://localhost:5000/api/delivery/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Delivery","email":"delivery@example.com","phone":"9876543211","password":"test123","vehicleType":"bike"}'
```

---

## Phase 5: Deployment (Ongoing)

### 5.1 Pre-Deployment

- [ ] All tests passing
- [ ] Manual testing complete
- [ ] Code review complete
- [ ] Create PR with detailed description
- [ ] Get approval

---

### 5.2 Deployment

- [ ] Merge to main
- [ ] Deploy backend first
- [ ] Monitor backend logs
- [ ] Deploy frontend
- [ ] Monitor frontend errors

---

### 5.3 Post-Deployment Monitoring

**First Hour**:
- [ ] Check error logs (backend)
- [ ] Check error logs (frontend)
- [ ] Monitor signup rate
- [ ] Monitor login rate
- [ ] Check payment success rate

**First Day**:
- [ ] Review customer support tickets
- [ ] Check for email-related errors
- [ ] Monitor conversion rates
- [ ] Verify no regressions

**First Week**:
- [ ] Analyze signup/login metrics
- [ ] Review any edge cases
- [ ] Document lessons learned

---

## Rollback Plan

**If critical issues arise**:

1. **Frontend Rollback** (5 mins)
   ```bash
   git revert <frontend-commit>
   npm run build
   deploy frontend
   ```

2. **Backend Rollback** (5 mins)
   ```bash
   git revert <backend-commit>
   npm run build
   npm start
   ```

3. **Database** (No rollback needed)
   - Email field is optional
   - Existing data unaffected

---

## Success Criteria

- [ ] ✅ All 287 tests passing
- [ ] ✅ Customer signup works (phone-only)
- [ ] ✅ Customer login works (phone-only)
- [ ] ✅ Payments work (email generated)
- [ ] ✅ Delivery partner auth works (email preserved)
- [ ] ✅ Admin functions work (email preserved)
- [ ] ✅ No customer-facing email fields
- [ ] ✅ No regressions in existing features

---

## Completion

**When all checkboxes are checked**:

1. Update `EMAIL_AUDIT_SUMMARY.md` with "COMPLETED" status
2. Create final commit:
   ```bash
   git add .
   git commit -m "feat: remove email from customer domain

   - Remove email field from customer signup/login UI
   - Add email generation for payment gateway
   - Update profile validation to reject customer email
   - Update 89 test files to use phone-only for customers
   - Preserve email for delivery partners and admins
   
   Tests: 287/287 passing
   Risk: LOW
   Effort: 6-9 hours
   
   Closes #remove-customer-email"
   ```

3. Push and create PR
4. Celebrate! 🎉

---

**Total Estimated Time**: 6-9 hours  
**Actual Time**: _____ hours  
**Issues Encountered**: _____  
**Lessons Learned**: _____
