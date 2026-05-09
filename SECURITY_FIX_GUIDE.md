# 🔐 SECURITY FIX IMPLEMENTATION GUIDE

**CRITICAL**: Follow this guide step-by-step to fix all security vulnerabilities.

---

## ⏱️ ESTIMATED TIME: 2-3 hours

---

## 🚨 STEP 1: REVOKE EXPOSED CREDENTIALS (15 minutes)

### 1.1 Revoke Resend API Key
```bash
# 1. Go to: https://resend.com/api-keys
# 2. Find key: re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx
# 3. Click "Revoke" or "Delete"
# 4. Generate new API key
# 5. Copy new key (starts with re_)
```

### 1.2 Revoke Gmail App Password
```bash
# 1. Go to: https://myaccount.google.com/apppasswords
# 2. Find password: lnjhscqyipztkvyu
# 3. Click "Remove" or "Revoke"
# 4. Generate new app password
# 5. Copy new password (16 characters)
```

### 1.3 Update .env Files
```bash
# Update backend/.env
RESEND_API_KEY=re_YOUR_NEW_KEY_HERE
GMAIL_APP_PASSWORD=your_new_app_password_here
```

---

## 🔧 STEP 2: ADD ENVIRONMENT VALIDATION (30 minutes)

### 2.1 Files Already Created ✅
- `backend/src/config/validateEnv.ts` ✅
- `backend/.env.example` ✅

### 2.2 Update backend/src/index.ts

Add this at the VERY TOP of the file (line 1-2):

```typescript
// CRITICAL: Validate environment before anything else
import { validateEnvironment } from './config/validateEnv';
validateEnvironment();

// ... rest of your imports
```

### 2.3 Test Validation

```bash
# Test with missing env var
cd backend
mv .env .env.backup
npm run dev

# Should see error:
# 🔴 ENVIRONMENT VALIDATION FAILED:
# ❌ JWT_SECRET is required but not set
# ...

# Restore .env
mv .env.backup .env
```

---

## 🗑️ STEP 3: DELETE VULNERABLE FILES (10 minutes)

### 3.1 Delete Test Scripts with Hardcoded Secrets

```bash
cd backend

# Delete files with secret fallbacks
rm check-user-role.js
rm test-login-d1.js
rm test-email.js

# Or move to dev-only folder
mkdir -p scripts/dev-only
mv check-user-role.js scripts/dev-only/
mv test-login-d1.js scripts/dev-only/
mv test-email.js scripts/dev-only/

# Add warning to dev-only scripts
echo "# ⚠️ WARNING: These scripts contain hardcoded secrets for development only" > scripts/dev-only/README.md
echo "# NEVER use in production" >> scripts/dev-only/README.md
```

---

## 🔒 STEP 4: FIX HARDCODED CREDENTIALS (45 minutes)

### 4.1 Fix sendEmailOTP.ts

**File**: `backend/src/utils/sendEmailOTP.ts`

**Replace lines 6-9**:
```typescript
// ❌ OLD (INSECURE)
const resend = new Resend(
  process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
);
```

**With**:
```typescript
// ✅ NEW (SECURE)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
  throw new Error('RESEND_API_KEY must be set and valid');
}
const resend = new Resend(RESEND_API_KEY);
```

**Replace lines 24-27** (Gmail credentials):
```typescript
// ❌ OLD (INSECURE)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gcs.charan@gmail.com',
    pass: 'lnjhscqyipztkvyu',
  },
});
```

**With**:
```typescript
// ✅ NEW (SECURE)
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  throw new Error('Gmail credentials must be set: GMAIL_USER, GMAIL_APP_PASSWORD');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});
```

### 4.2 Fix sendDeliveryOtpEmail.ts

**File**: `backend/src/utils/sendDeliveryOtpEmail.ts`

**Replace lines 5-7**:
```typescript
// ❌ OLD
const resend = new Resend(
  process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
);
```

**With**:
```typescript
// ✅ NEW
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
  throw new Error('RESEND_API_KEY must be set and valid');
}
const resend = new Resend(RESEND_API_KEY);
```

### 4.3 Fix RazorpayAdapter.ts

**File**: `backend/src/domains/payments/adapters/RazorpayAdapter.ts`

**Replace lines 22-24**:
```typescript
// ❌ OLD
const keyId = String(process.env.RAZORPAY_KEY_ID || (isTest ? "rzp_test_key" : "")).trim();
const keySecret = String(process.env.RAZORPAY_KEY_SECRET || (isTest ? "rzp_test_secret" : "")).trim();
const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || (isTest ? "test-webhook-secret" : "")).trim();
```

**With**:
```typescript
// ✅ NEW
const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

if (!keyId || !keySecret || !webhookSecret) {
  throw new Error(
    'Razorpay credentials required: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET'
  );
}

// Validate format
if (!keyId.startsWith('rzp_')) {
  throw new Error('Invalid RAZORPAY_KEY_ID format (must start with rzp_)');
}

this.keyId = keyId;
this.keySecret = keySecret;
this.webhookSecret = webhookSecret;
```

---

## 🚫 STEP 5: REMOVE DEBUG ENDPOINTS (20 minutes)

### 5.1 Remove OTP Exposure in Development

**File**: `backend/src/domains/security/controllers/otpController.ts`

**Find and REMOVE lines 227-229**:
```typescript
// ❌ REMOVE THIS
if (process.env.NODE_ENV === "development") {
  response.otp = newOtp;
  response.note = "OTP included in response for development only";
}
```

**Replace with logging**:
```typescript
// ✅ ADD THIS
if (process.env.NODE_ENV === "development") {
  logger.debug(`[DEV ONLY] OTP for ${phone}: ${newOtp}`);
}
```

**File**: `backend/src/domains/identity/controllers/authController.ts`

**Find and REMOVE line 1098**:
```typescript
// ❌ REMOVE THIS
...(process.env.NODE_ENV === "development" && { otp, devMode: true }),
```

**Replace with**:
```typescript
// ✅ ADD THIS (outside response object)
if (process.env.NODE_ENV === "development") {
  logger.debug(`[DEV ONLY] OTP sent to ${phone}: ${otp}`);
}
```

### 5.2 Secure or Remove Debug Routes

**File**: `backend/src/routes/debugDbTest.ts`

**Option 1: Delete the entire file** (Recommended)
```bash
rm backend/src/routes/debugDbTest.ts
```

**Option 2: Add strict authentication** (If you need it)
```typescript
// Add at top of each route
if (process.env.NODE_ENV === "production") {
  return; // Don't register debug routes in production
}

router.get("/debug-user/:userId", 
  requireAuth,
  requireRole(['admin']),
  async (req, res) => {
    // ... implementation
  }
);
```

---

## ✅ STEP 6: VERIFY FIXES (20 minutes)

### 6.1 Test Environment Validation

```bash
cd backend

# Test 1: Missing JWT_SECRET
mv .env .env.backup
echo "NODE_ENV=development" > .env
npm run dev

# Expected: Should fail with error
# ❌ JWT_SECRET is required but not set

# Test 2: Short JWT_SECRET
echo "JWT_SECRET=short" >> .env
npm run dev

# Expected: Should fail with error
# ❌ JWT_SECRET must be at least 32 characters

# Test 3: Valid config
mv .env.backup .env
npm run dev

# Expected: Should start successfully
# ✅ Environment validation passed
```

### 6.2 Test Authentication

```bash
# Test login flow
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "9999999999"}'

# Should NOT see OTP in response
# Should only see: {"success": true, "message": "OTP sent"}
```

### 6.3 Test Payment Flow

```bash
# Test Razorpay initialization
# Check logs for:
# ✅ Razorpay initialized with key: rzp_****

# Should NOT see test credentials
```

---

## 📝 STEP 7: UPDATE DOCUMENTATION (10 minutes)

### 7.1 Update README.md

Add security section:

```markdown
## 🔐 Security Setup

### Required Environment Variables

Copy `.env.example` to `.env` and fill in all required values:

```bash
cp .env.example .env
```

### Generate Secure Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Generate JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Get API Keys

1. **Razorpay**: https://dashboard.razorpay.com/app/keys
2. **Resend**: https://resend.com/api-keys
3. **Gmail App Password**: https://myaccount.google.com/apppasswords
4. **Google Maps**: https://console.cloud.google.com/google/maps-apis
5. **Cloudinary**: https://cloudinary.com/console

### Security Checklist

- [ ] All environment variables set
- [ ] Secrets are at least 32 characters
- [ ] No default/example values used
- [ ] .env file in .gitignore
- [ ] Production secrets stored securely
```

---

## 🚀 STEP 8: DEPLOY SAFELY (15 minutes)

### 8.1 Pre-Deployment Checklist

```bash
# 1. Verify all fixes applied
git status

# 2. Run tests
npm test

# 3. Test locally
npm run dev

# 4. Check for exposed secrets
git log --all --full-history --source -- '*env*'

# 5. Verify .gitignore
cat .gitignore | grep .env
```

### 8.2 Production Environment Setup

```bash
# Set environment variables in your hosting platform

# Railway:
railway variables set JWT_SECRET="your-secret-here"

# Vercel:
vercel env add JWT_SECRET

# Heroku:
heroku config:set JWT_SECRET="your-secret-here"

# AWS/Docker:
# Use AWS Secrets Manager or environment files
```

### 8.3 Post-Deployment Verification

```bash
# 1. Check application starts
curl https://your-domain.com/health

# 2. Test authentication
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "9999999999"}'

# 3. Verify no OTP in response
# 4. Check logs for errors
# 5. Monitor for 24 hours
```

---

## 📊 VERIFICATION CHECKLIST

After completing all steps, verify:

### Code Changes
- [ ] Environment validation added to index.ts
- [ ] sendEmailOTP.ts fixed (no hardcoded credentials)
- [ ] sendDeliveryOtpEmail.ts fixed (no hardcoded API key)
- [ ] RazorpayAdapter.ts fixed (no test credential fallbacks)
- [ ] OTP not exposed in API responses
- [ ] Debug endpoints removed or secured
- [ ] Test scripts deleted or moved to dev-only

### Credentials
- [ ] Exposed Resend API key revoked
- [ ] Exposed Gmail app password revoked
- [ ] New Resend API key generated
- [ ] New Gmail app password generated
- [ ] All .env files updated

### Testing
- [ ] Environment validation works (fails with missing vars)
- [ ] Application starts with valid config
- [ ] Authentication works
- [ ] OTP not in API responses
- [ ] Payment flow works
- [ ] No errors in logs

### Documentation
- [ ] .env.example created
- [ ] README.md updated
- [ ] Security guide documented
- [ ] Team notified of changes

### Deployment
- [ ] Production environment variables set
- [ ] Application deployed successfully
- [ ] Health check passes
- [ ] Authentication tested in production
- [ ] Monitoring enabled

---

## 🆘 TROUBLESHOOTING

### Issue: Application won't start

**Error**: `JWT_SECRET is required but not set`

**Solution**:
```bash
# Check .env file exists
ls -la backend/.env

# Check JWT_SECRET is set
grep JWT_SECRET backend/.env

# Generate new secret if needed
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Issue: Email OTP not sending

**Error**: `RESEND_API_KEY must be set and valid`

**Solution**:
```bash
# Verify API key format
echo $RESEND_API_KEY | grep "^re_"

# Generate new key at: https://resend.com/api-keys
```

### Issue: Payment initialization fails

**Error**: `Razorpay credentials required`

**Solution**:
```bash
# Check all Razorpay vars are set
env | grep RAZORPAY

# Verify key format
echo $RAZORPAY_KEY_ID | grep "^rzp_"
```

---

## 📞 SUPPORT

If you encounter issues:

1. Check logs: `tail -f backend/logs/app.log`
2. Verify environment: `npm run validate:env`
3. Test locally first: `npm run dev`
4. Review this guide step-by-step
5. Check CRITICAL_SECURITY_AUDIT_2026.md for details

---

## ✅ COMPLETION

Once all steps are complete:

1. Mark all checklist items as done
2. Test thoroughly in staging
3. Deploy to production
4. Monitor for 24-48 hours
5. Schedule security review in 30 days

**Estimated Total Time**: 2-3 hours  
**Priority**: CRITICAL - Complete before production deployment  
**Next Review**: 30 days after deployment

---

**Guide Created**: April 5, 2026  
**Last Updated**: April 5, 2026  
**Version**: 1.0
