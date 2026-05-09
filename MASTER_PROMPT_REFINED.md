# ✅ MASTER PROMPT: Email → Phone-First Migration (Production-Safe)

You are working on a production-grade full-stack application.

---

## 🎯 GOAL

Migrate the system from **email-first authentication → phone-first authentication** for CUSTOMER users.

Preserve email usage for:
- Delivery partners
- Admin users
- OAuth users
- Payment gateways (Razorpay)

---

## ⚠️ CRITICAL CONSTRAINTS

- DO NOT break existing functionality
- DO NOT remove email from database schema
- DO NOT send `email: ""` or `email: null`
- ONLY omit email field (undefined) for customers
- Follow SAFE, PHASE-WISE execution
- VERIFY after each phase before proceeding

---

# 🔹 PHASE 1: FRONTEND (PHONE-ONLY CUSTOMER FLOW)

### Tasks:

1. Remove email from:
   - SignupForm
   - Login (OTP modal)
   - Onboarding form

2. Ensure API payload:
   
   ✅ MUST be:
   ```json
   {
     "name": "...",
     "phone": "..."
   }
   ```
   
   ❌ MUST NOT include:
   - `email: ""`
   - `email: null`
   - `email: undefined`
   - `email` field at all

3. Update UI:
   - Phone-only input
   - Remove email validation
   - Remove email error handling

4. TypeScript:
   - `email: string` → `email?: string`

5. Admin/Delivery:
   - KEEP email intact using:
     ```tsx
     {user.email && <div>{user.email}</div>}
     ```

---

## 🔍 PHASE 1 VERIFICATION (MANDATORY)

**Network Test:**
- Signup request MUST NOT contain `email`

**Refresh Test:**
- Login → refresh → user stays logged in

**Input Validation:**
- Reject letters
- Accept only valid 10-digit numbers

**Code Scan:**
❌ No:
- `phone || email`
- `email || phone`

👉 **STOP if ANY test fails**

---

# 🔹 PHASE 2: BACKEND (SAFE EMAIL HANDLING)

### DO NOT REMOVE EMAIL FROM SCHEMA

### Create Utility:

📁 `backend/src/utils/generateCustomerEmail.ts`

```typescript
export function generateCustomerEmail(user) {
  return user.email || `${user.phone}@customer.internal`;
}

export function isInternalEmail(email) {
  return email.endsWith('@customer.internal');
}

export function extractPhoneFromEmail(email) {
  if (!isInternalEmail(email)) return null;
  const match = email.match(/^(\d+)@customer\.internal$/);
  return match ? match[1] : null;
}
```

### Apply Logic:

**Payments (Razorpay)**
- ALWAYS send email using utility

**Auth Controller**
- Accept email if provided
- DO NOT require for customers
- DO NOT reject if missing

**Profile Updates**
- Customers → cannot update email
- Admin/Delivery → allowed

---

# 🔹 PHASE 3: TESTS (SMART STRATEGY)

⚠️ **DO NOT edit 89 test files manually**

### Update ONLY helper:

📁 `backend/tests/helpers/auth.ts`

```typescript
const role = overrides.role || "customer";
const shouldHaveEmail = role !== "customer";

const emailField = 
  overrides.email !== undefined 
    ? { email: overrides.email }
    : shouldHaveEmail
    ? { email: `test.${role}.${Date.now()}@example.com` }
    : {};
```

### Run tests:
- All must pass automatically

---

# 🔹 PHASE 4: FINAL VERIFICATION

### Run:
- Full test suite

### Manual testing:

✔ **Customer:**
- Signup (phone-only)
- Login (OTP)
- Payment (generated email)

✔ **Delivery/Admin:**
- Email login works
- No regression

✔ **System:**
- No crashes
- No console errors
- No missing email issues

---

## 🚫 STRICT RULES

- NEVER remove email from DB
- NEVER send empty/null email
- NEVER break delivery/admin flows
- NEVER mass-edit test files
- ALWAYS verify each phase

---

## ✅ SUCCESS CRITERIA

- Customer flow = phone-only
- Email optional everywhere
- Payments work with generated email
- All tests pass
- No regressions

---

## 📤 OUTPUT FORMAT

After each phase:

```
Phase X Complete ✅

Verification:
- Test 1: PASSED
- Test 2: PASSED
- Test 3: PASSED

Ready for next phase.
```

---

## 🔄 ROLLBACK (IF NEEDED)

**Frontend:**
- Revert 8 files

**Backend:**
- Remove utility file
- Revert changes

**Tests:**
- Revert helper

**Database:**
- No rollback required

---

## 🎯 RESULT

- Safe migration
- Zero breaking changes
- Clean architecture shift
- Production-ready system

**Proceed phase by phase.**

---

## 💡 Next Steps Available

I can provide:
- 🔥 **Deployment prompt**
- 📊 **Monitoring & alerts prompt**
- 🧪 **Production testing prompt**
- ⚡ **Feature flag version (safer rollout)**

Just ask!
