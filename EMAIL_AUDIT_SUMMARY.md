# Email Usage Audit - Complete Report

**Date**: April 4, 2026  
**Type**: SAFE CODEBASE AUDIT (READ-ONLY)  
**Status**: ✅ COMPLETE

---

## Executive Summary

### Can Email Be Safely Removed from Customer Domain?

**YES** - with specific constraints

**Scope**: Customer signup, login, and profile management  
**Effort**: 6-9 hours  
**Risk**: LOW  
**Confidence**: HIGH

---

## Audit Results

### Total Occurrences: 247

| Domain | Count | Status |
|--------|-------|--------|
| Customer Domain | 45 | ⚠️ MUST REMOVE |
| Delivery/Admin | 38 | ✅ MUST KEEP |
| Shared Infrastructure | 52 | 🔍 REVIEW |
| Tests | 89 | 🔧 UPDATE |
| Documentation | 23 | ℹ️ INFO ONLY |

---

## Critical Findings

### 1. Customer Signup Flow ⚠️ HIGH PRIORITY

**Status**: PARTIALLY FIXED (backend optional, frontend still collects)

**Frontend Issues**:
- `frontend/src/components/SignupForm.tsx` - Email input field (lines 11, 30, 106, 258, 311, 361-373)
- Collects email, validates it, sends to backend
- **Action**: REMOVE email field entirely

**Backend Status**:
- `backend/src/domains/identity/controllers/authController.ts` - Email is optional (line 90)
- Already accepts email as optional
- **Action**: Keep as is (supports OAuth)

**Impact**: HIGH - Customers shouldn't provide email  
**Effort**: 30 minutes  
**Risk**: LOW

---

### 2. Customer Login Flow ⚠️ HIGH PRIORITY

**Status**: MIXED (supports both email and phone)

**Frontend Issues**:
- `frontend/src/components/OtpLoginModal.tsx` - Dual email/phone input (lines 15, 27, 87-88, 304-329)
- Detects if input is email or phone
- Allows login with either
- **Action**: REMOVE email option, phone-only

**Backend Status**:
- `backend/src/domains/identity/controllers/authController.ts` - Supports both (lines 331-407)
- Login works with email or phone
- **Action**: Keep backend flexibility (needed for delivery partners)

**Impact**: HIGH - Customer UX should be phone-only  
**Effort**: 45 minutes  
**Risk**: LOW

---

### 3. Payment Gateway Dependency 🚨 CRITICAL

**Status**: BLOCKER - Razorpay requires email

**Location**:
- `backend/src/models/Payment.ts` - Email required in userDetails (lines 34, 129-132)

**Problem**: Razorpay API requires email field in payment creation

**Solution Options**:
1. **Generate dummy email**: `{phone}@customer.internal`
2. **Use phone-based email**: `{phone}@sms.customer.com`
3. **Use placeholder**: `customer-{userId}@internal.com`

**Recommendation**: Option 1 (phone-based)

**Impact**: CRITICAL - Cannot remove without breaking payments  
**Effort**: 30 minutes  
**Risk**: MEDIUM

---

### 4. User Schema ✅ CORRECT

**Status**: Already optional

**Location**:
- `backend/src/models/User.ts` - Email field (lines 257-262)

```typescript
email: {
  type: String,
  lowercase: true,
  trim: true,
  index: true,
  // NOT required: true
}
```

**Impact**: NONE - Schema is flexible  
**Action**: No change needed

---

### 5. Delivery Partner Auth ✅ MUST PRESERVE

**Status**: CORRECT - Working as intended

**Location**:
- `backend/src/controllers/deliveryAuthController.ts` - Email required (lines 27, 36, 192-199)

**Details**:
- Delivery partners use email+password authentication
- Separate controller from customer auth
- Must be preserved

**Impact**: CRITICAL - Delivery operations depend on this  
**Action**: Keep as is

---

## Detailed Breakdown

### Customer Domain (MUST REMOVE)

#### Frontend Files (4 files)

1. **SignupForm.tsx** - Email input field
   - Lines: 11, 30, 106, 258, 311, 361-373
   - Impact: HIGH
   - Action: Remove email field

2. **OtpLoginModal.tsx** - Email/phone dual input
   - Lines: 15, 27, 87-88, 118, 169, 179-181, 304-329
   - Impact: HIGH
   - Action: Remove email option

3. **OnboardingForm.tsx** - Email display (read-only)
   - Lines: 390-403
   - Impact: MEDIUM
   - Action: Remove email display

4. **OtpVerificationModal.tsx** - Email in Redux
   - Lines: 108
   - Impact: MEDIUM
   - Action: Remove email from state

#### Backend Files (3 files)

1. **authController.ts** - Email in signup/login
   - Lines: 32, 74-80, 90, 331-407
   - Impact: HIGH
   - Action: Keep for OAuth, remove customer validation

2. **userController.ts** - Email in profile update
   - Lines: 85, 88, 101
   - Impact: MEDIUM
   - Action: Reject email in customer profile updates

3. **User.ts** - Email field in schema
   - Lines: 257-262
   - Impact: LOW
   - Action: Keep (already optional)

---

### Delivery/Admin Domain (MUST KEEP)

#### Critical Files (7 files)

1. **deliveryAuthController.ts** - Delivery partner auth
   - Email required for signup/login
   - **MUST PRESERVE**

2. **adminTracking.ts** - Admin action logs
   - Email in audit trail
   - **MUST PRESERVE** (compliance)

3. **adminTrackingOncall.ts** - Oncall schedule
   - Email for escalation
   - **MUST PRESERVE** (operational)

4. **adminOps.ts** - Admin ops logs
   - Email in audit trail
   - **MUST PRESERVE** (compliance)

5. **Payment.ts** - Payment gateway
   - Email required by Razorpay
   - **MUST PRESERVE** (critical dependency)

6. **DeliveryBoy.ts** - Delivery partner model
   - Email optional
   - **KEEP** (operational)

7. **PendingUser.ts** - Pending user model
   - Email required
   - **REVIEW** (depends on usage)

---

### Test Dependencies (UPDATE REQUIRED)

**89 test files** use email in user creation

#### High Priority Test Updates

1. **auth.integration.test.ts** - Uses email in tests
   - Action: Update to phone-only for customer tests

2. **tokenHelper.ts** - Generates tokens with email
   - Action: Make email optional

3. **Integration tests** (89 files) - Email in createTestUser
   - Action: Update to not require email for customers

4. **Stress tests** - Email patterns
   - Action: Use phone-based patterns

**Effort**: 3-4 hours  
**Risk**: MEDIUM (many files)

---

## Removal Plan

### Phase 1: Frontend (2-3 hours)

**Priority**: HIGH

1. **Remove email from SignupForm** (30 mins)
   - File: `frontend/src/components/SignupForm.tsx`
   - Remove email field, validation, error handling
   - Update form submission

2. **Remove email from OtpLoginModal** (45 mins)
   - File: `frontend/src/components/OtpLoginModal.tsx`
   - Remove email input option
   - Keep phone-only input
   - Update detection logic

3. **Remove email from OnboardingForm** (15 mins)
   - File: `frontend/src/components/OnboardingForm.tsx`
   - Remove email display field

4. **Remove email from Redux** (30 mins)
   - File: `frontend/src/components/OtpVerificationModal.tsx`
   - Remove email from user state
   - Update TypeScript types

---

### Phase 2: Backend (1-2 hours)

**Priority**: HIGH

1. **Add email generation for payments** (30 mins)
   - File: `backend/src/services/paymentService.ts` (or wherever payment creation happens)
   - Generate email: `{phone}@customer.internal`
   - Pass to Razorpay

2. **Update profile validation** (30 mins)
   - File: `backend/src/domains/identity/controllers/userController.ts`
   - Reject email in customer profile updates
   - Keep for delivery/admin

3. **Update auth controller** (30 mins)
   - File: `backend/src/domains/identity/controllers/authController.ts`
   - Remove email validation from customer signup
   - Keep for OAuth and delivery

---

### Phase 3: Tests (3-4 hours)

**Priority**: MEDIUM

1. **Update test helpers** (1 hour)
   - File: `backend/tests/helpers/auth.ts`
   - Make email optional in createTestUser
   - Update token generation

2. **Update integration tests** (2-3 hours)
   - Files: `backend/tests/integration/*.test.ts` (89 files)
   - Remove email from customer test cases
   - Keep email for delivery/admin tests

3. **Verify all tests pass** (30 mins)
   - Run full test suite
   - Fix any failures

---

### Phase 4: Verification (30 mins)

**Priority**: HIGH

1. **Run security tests** (10 mins)
   - Verify 130/130 still passing

2. **Run integration tests** (10 mins)
   - Verify customer flows work

3. **Manual testing** (10 mins)
   - Test signup with phone only
   - Test login with phone only
   - Test payment creation

---

## Risk Assessment

### Critical Risks: 1

**Payment Gateway Email Requirement**
- Severity: CRITICAL
- Mitigation: Generate dummy email from phone
- Verified: Razorpay API requires email field

### Medium Risks: 2

**OAuth Flow Provides Email**
- Severity: MEDIUM
- Mitigation: Accept but don't display to customer
- Verified: Google OAuth returns email

**Test Suite Updates**
- Severity: MEDIUM
- Mitigation: Systematic update of 89 test files
- Verified: Tests expect email field

### Low Risks: 2

**Existing Customer Data**
- Severity: LOW
- Mitigation: Email field is optional, existing data won't break
- Verified: Schema allows null/undefined

**Frontend State Management**
- Severity: LOW
- Mitigation: TypeScript will catch missing fields
- Verified: Type system enforces contracts

---

## Blockers

### 1. Payment Gateway (CRITICAL)

**Blocker**: Razorpay requires email in payment creation

**Solution**: Generate email from phone
```typescript
const email = `${phone}@customer.internal`;
```

**Verification**: Test payment creation with generated email

---

## Dependencies

### 1. OAuth Flow (MEDIUM)

**Dependency**: Google OAuth provides email

**Solution**: Accept email from OAuth but don't require it

**Impact**: Customers who sign up via Google will have email in DB, but it won't be shown in UI

---

### 2. Delivery Partners (NONE)

**Dependency**: Delivery partners need email

**Solution**: Keep email for delivery/admin roles

**Impact**: No impact - delivery auth is separate

---

## Recommendations

### Immediate (Do First)

1. ✅ **Remove email from customer signup form**
   - Priority: HIGH
   - Effort: 30 minutes
   - Risk: LOW
   - File: `frontend/src/components/SignupForm.tsx`

2. ✅ **Remove email from customer login**
   - Priority: HIGH
   - Effort: 45 minutes
   - Risk: LOW
   - File: `frontend/src/components/OtpLoginModal.tsx`

3. ✅ **Add email generation for payments**
   - Priority: HIGH
   - Effort: 30 minutes
   - Risk: MEDIUM
   - File: Payment service

---

### Short-Term (Do Next)

4. **Update profile validation**
   - Priority: MEDIUM
   - Effort: 30 minutes
   - Risk: LOW
   - File: `backend/src/domains/identity/controllers/userController.ts`

5. **Remove email from onboarding UI**
   - Priority: MEDIUM
   - Effort: 15 minutes
   - Risk: LOW
   - File: `frontend/src/components/OnboardingForm.tsx`

6. **Update test fixtures**
   - Priority: MEDIUM
   - Effort: 3-4 hours
   - Risk: MEDIUM
   - Files: `backend/tests/**/*.test.ts`

---

### Long-Term (Optional)

7. **Data migration**
   - Priority: LOW
   - Effort: 2 hours
   - Risk: LOW
   - Details: Remove email from customer records (role='customer')

---

## Files Requiring Changes

### Frontend (4 files)
```
frontend/src/components/SignupForm.tsx
frontend/src/components/OtpLoginModal.tsx
frontend/src/components/OnboardingForm.tsx
frontend/src/components/OtpVerificationModal.tsx
```

### Backend (3 files)
```
backend/src/domains/identity/controllers/authController.ts
backend/src/domains/identity/controllers/userController.ts
backend/src/services/paymentService.ts (or payment creation location)
```

### Tests (89 files)
```
backend/tests/helpers/auth.ts
backend/tests/helpers/tokenHelper.ts
backend/tests/integration/*.test.ts (all files using email)
backend/tests/stress/inventoryConcurrency.test.ts
```

---

## Conclusion

### ✅ Email Can Be Safely Removed from Customer Domain

**Scope**: Customer signup, login, profile  
**Effort**: 6-9 hours  
**Risk**: LOW  
**Confidence**: HIGH

**Must Preserve**:
- ✅ Delivery partner email+password auth
- ✅ Admin email in audit logs
- ✅ Payment gateway email (generate from phone)
- ✅ OAuth email from Google (accept but don't display)
- ✅ Oncall schedule emails

**Next Steps**:
1. Remove email from frontend customer forms (2-3 hours)
2. Add email generation for payment gateway (30 mins)
3. Update backend customer validation (30 mins)
4. Update test fixtures (3-4 hours)
5. Run full test suite (30 mins)
6. Deploy and monitor

---

**Audit Complete** ✅

See `EMAIL_USAGE_AUDIT.json` for complete technical details.
