# ✅ MASTER PROMPT: Email → Phone-First Migration (Safe, Production-Ready)

You are working on a production-grade full-stack application.

## GOAL
Migrate the system from email-first authentication to phone-first authentication for CUSTOMER users, while preserving email usage for:
- Delivery partners
- Admin users
- OAuth users
- Payment gateways (Razorpay)

## IMPORTANT CONSTRAINTS
- DO NOT break existing functionality
- DO NOT remove email from database schema
- DO NOT send email as "" or null
- Only omit email field (undefined) for customers
- Follow SAFE, PHASE-WISE execution
- After each phase, VERIFY before proceeding

---

## 🔹 PHASE 1: FRONTEND (PHONE-ONLY CUSTOMER FLOW)

### Tasks:
1. Remove email from:
   - SignupForm
   - Login (OTP modal)
   - Onboarding form

2. Ensure:
   - API payload does NOT include email field at all
   - No `email: ""`, `email: null`, or `email: undefined`
   - Only send:
     ```json
     {
       "name": "...",
       "phone": "..."
     }
     ```

3. Update UI:
   - Phone-only input
   - Remove email validation
   - Remove email error messages

4. TypeScript:
   - Convert all `email: string` → `email?: string`

5. Admin/Delivery:
   - KEEP email intact
   - Use conditional rendering:
     ```tsx
     {user.email && <div>{user.email}</div>}
     ```

---

### 🔍 PHASE 1 VERIFICATION (MANDATORY)

Run these tests:

1. **Network Test:**
   - Signup request payload MUST NOT contain email field

2. **Refresh Test:**
   - Login → refresh page → user must stay logged in

3. **Input Validation:**
   - Reject letters in phone
   - Accept only valid 10-digit numbers

4. **Code Scan:**
   - No `phone || email` logic in customer flow

**STOP if ANY test fails.**

---

## 🔹 PHASE 2: BACKEND (SAFE EMAIL HANDLING)

### DO NOT REMOVE email from schema

### Create utility:

**File:** `backend/src/utils/generateCustomerEmail.ts`

```typescript
export function generateCustomerEmail(user: { email?: string; phone?: string; _id?: string }) {
  return user.email || `${user.phone}@customer.internal`;
}

export function isInternalEmail(email: string): boolean {
  return email.endsWith('@customer.internal');
}

export function extractPhoneFromEmail(email: string): string | null {
  if (!isInternalEmail(email)) return null;
  const match = email.match(/^(\d+)@customer\.internal$/);
  return match ? match[1] : null;
}
```

### Update usage:

**Payment (Razorpay):**
- ALWAYS pass email using utility

**Auth Controller:**
- Accept email if provided
- DO NOT require it for customers
- DO NOT reject if missing

**Profile updates:**
- Customers cannot update email
- Admin/Delivery can

---

## 🔹 PHASE 3: TESTS (SMART STRATEGY)

### DO NOT manually edit all test files.

### Update ONLY helper:

**File:** `backend/tests/helpers/auth.ts`

**Logic:**
- Customer → no email
- Delivery/Admin → auto email
- Explicit override → respect it

**Example:**
```typescript
const role = overrides.role || "customer";
const shouldHaveEmail = role !== "customer";

const emailField = overrides.email !== undefined 
  ? { email: overrides.email }
  : shouldHaveEmail 
    ? { email: `test.${role}.${Date.now()}@example.com` }
    : {}; // No email for customers
```

### Run tests:
- All must pass without editing individual files

---

## 🔹 PHASE 4: FINAL VERIFICATION

### Run:
- Full test suite

### Manual flows:
- Customer signup/login (phone-only)
- Payment flow (Razorpay)
- Delivery login (email)
- Admin login (email)

### Ensure:
- No console errors
- No crashes
- No missing email issues

---

## 🚫 STRICT RULES

- NEVER remove email from DB schema
- NEVER send empty/null email
- NEVER break delivery/admin flows
- NEVER manually update all test files
- ALWAYS verify after each phase

---

## ✅ SUCCESS CRITERIA

- Customer flow = phone-only
- Email optional everywhere
- Payments work with generated email
- Tests pass (100%)
- No regressions

---

## OUTPUT FORMAT

After each phase, respond:

```
Phase X Complete ✅

Verification:
- Test 1: PASSED
- Test 2: PASSED
- Test 3: PASSED

Ready for next phase.
```

---

## 🎯 What This Prompt Ensures

- Safe migration (no production breakage)
- Clean architecture shift (email → phone)
- Test stability (no mass edits)
- Payment compatibility (critical)
- Clear phase-by-phase execution

---

## 📋 Quick Reference

### Files to Modify (Frontend)
- `frontend/src/components/SignupForm.tsx`
- `frontend/src/components/OtpLoginModal.tsx`
- `frontend/src/components/OnboardingForm.tsx`
- `frontend/src/pages/CheckoutPage.tsx` (payment integration)
- `frontend/src/pages/Admin*.tsx` (conditional rendering)

### Files to Modify (Backend)
- `backend/src/utils/generateCustomerEmail.ts` (NEW)
- `backend/tests/helpers/auth.ts` (smart email logic)

### Files to Verify (No Changes)
- `backend/src/domains/identity/controllers/authController.ts`
- `backend/src/models/User.ts` (schema unchanged)

---

## 🔄 Rollback Instructions

If anything goes wrong:

1. **Frontend:** Revert 8 files
2. **Backend:** Delete `generateCustomerEmail.ts`, revert CheckoutPage
3. **Tests:** Revert `auth.ts` helper
4. **Database:** No rollback needed (schema unchanged)

---

**Created:** April 5, 2026  
**Version:** 1.0  
**Status:** Production-Ready  
**Risk Level:** LOW  
**Confidence:** HIGH
