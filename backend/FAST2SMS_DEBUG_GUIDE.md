# Fast2SMS Debugging Guide

## Changes Applied

### 1. Fixed Environment Loading (`backend/src/index.ts`)
- ✅ Moved `dotenv.config()` to the VERY TOP before any imports
- ✅ This ensures `FAST2SMS_API_KEY` is available when `sms.ts` loads
- ✅ Removed duplicate `dotenv.config()` from `app.ts`

### 2. Enhanced SMS Utility (`backend/src/utils/sms.ts`)
- ✅ Added `USE_TWILIO` flag to force disable Twilio (default: false)
- ✅ Fast2SMS detection: `fast2smsKey && fast2smsKey.trim() !== ""`
- ✅ Debug logging shows: API key presence, key length, USE_TWILIO status
- ✅ ALWAYS uses Fast2SMS when `FAST2SMS_API_KEY` is configured
- ✅ Only falls back to Twilio if `USE_TWILIO=true` AND Fast2SMS fails
- ✅ Phone formatting: Strips +91, validates 10-digit format (6-9XXXXXXXXX)
- ✅ Detailed Fast2SMS request/response logging
- ✅ Safe JSON parsing with error handling
- ✅ Success criteria: `status === 200 AND (body.return === true OR body.success === true)`
- ✅ Error logging with `[SMS][ERROR]` prefix

### 3. Enhanced OTP Controller (`backend/src/domains/security/controllers/otpController.ts`)
- ✅ Added `[OTP][DEBUG]` logging before SMS sends
- ✅ Added `[OTP][ERROR]` logging when SMS fails
- ✅ Clear error messages with provider configuration details
- ✅ Shows `fast2smsEnabled`, `fast2smsKeyLength`, and `useTwilio` in debug info

### 4. Debug SMS Endpoint (`backend/src/domains/security/routes/otpRoutes.ts`)
- ✅ Added `POST /api/otp/debug/sms` endpoint
- ✅ No authentication required - easy testing
- ✅ Directly tests sendSMS() function
- ✅ Returns detailed environment check in response:
  - `provider`: "fast2sms", "twilio", or "none"
  - `fast2smsEnabled`: true/false
  - `fast2smsKeyLength`: Length of API key
  - `useTwilio`: "true", "false", or "not set"
  - Twilio credentials status

## Environment Variables Required

Add to `backend/.env`:

```env
# Fast2SMS Configuration (REQUIRED)
FAST2SMS_API_KEY=your_fast2sms_api_key_here
FAST2SMS_SENDER_ID=TXTIND

# Twilio Configuration (Optional - only if you want fallback)
USE_TWILIO=false
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=...

# Optional: For testing without real SMS
MOCK_SMS=false
```

## Testing Instructions

### Step 1: Restart Backend
```bash
cd /Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend
npm run dev
```

### Step 2: Test Direct SMS (No Auth Required)
```bash
curl -X POST http://localhost:5000/api/otp/debug/sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

**Expected Backend Logs:**
```
[DEBUG][SMS] Testing SMS to: 9876543210
[DEBUG][SMS] Environment check: {
  provider: 'fast2sms',
  fast2smsEnabled: true,
  fast2smsKeyLength: 40,
  fast2smsSenderId: 'TXTIND',
  useTwilio: 'not set',
  twilioEnv: { ... },
  mockSms: 'not set'
}
[SMS][DEBUG] sendSMS() called with: { rawPhone: '9876543210', messageLength: 15 }
[SMS][DEBUG] FAST2SMS_API_KEY: present (length: 40)
[SMS][DEBUG] USE_TWILIO: not set (defaults to false)
[SMS][DEBUG] Fast2SMS is enabled, attempting Fast2SMS...
[SMS][DEBUG] Formatted phone: 9876543210
[SMS][DEBUG] Calling Fast2SMS with: { route: 'v3', sender_id: 'TXTIND', ... }
[SMS][DEBUG] Fast2SMS URL: https://www.fast2sms.com/dev/bulkV2
[SMS][DEBUG] Fast2SMS raw response: 200 {...}
[SMS][DEBUG] Fast2SMS parsed response: { return: true, ... }
[SMS] Fast2SMS success: true
[DEBUG][SMS] SMS test SUCCESS
```

### Step 3: Test OTP Verification Endpoint
```bash
curl -X POST http://localhost:5000/api/otp/verification/generate \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

**Expected Backend Logs:**
```
[OTP][DEBUG] Sending OTP to: 9876543210
[OTP] Sending via Fast2SMS: 9876543210
[SMS][DEBUG] sendSMS() called with...
[SMS] Fast2SMS success: true
```

## Troubleshooting

### Error: "Invalid phone format after formatting"
- Phone must be 10 digits
- Must start with 6-9
- Try: `9876543210` (valid)
- Avoid: `0987654321` (starts with 0)

### Error: "Fast2SMS API key not configured" or "FAST2SMS_API_KEY: missing"
- Check `.env` file has `FAST2SMS_API_KEY=...` (no spaces, no quotes)
- Make sure `.env` is in `backend/` directory
- Restart backend completely: Kill the process and run `npm run dev` again
- Check logs show: `[SMS][DEBUG] FAST2SMS_API_KEY: present (length: XX)`

### Error: "Fast2SMS raw response: 401 {...}"
- Invalid API key
- Check Fast2SMS dashboard for correct key

### Error: "Fast2SMS raw response: 400 {...}"
- Check Fast2SMS account balance
- Verify sender ID is approved
- Check message format

### Success but no SMS received
- Check Fast2SMS dashboard for delivery status
- Verify phone number is correct
- Check account has sufficient credits

## Expected Log Patterns

### ✅ Success Flow
```
[SMS][DEBUG] FAST2SMS_API_KEY: present (length: 40)
[SMS][DEBUG] USE_TWILIO: not set (defaults to false)
[SMS][DEBUG] Fast2SMS is enabled, attempting Fast2SMS...
[SMS][DEBUG] Formatted phone: 9876543210
[SMS][DEBUG] Calling Fast2SMS with: {...}
[SMS][DEBUG] Fast2SMS raw response: 200 {...}
[SMS] Fast2SMS success: true
```

### ❌ Phone Format Error
```
[SMS][ERROR] Fast2SMS error: Invalid phone format after formatting: 0987654321
[SMS][ERROR] Original phone: 0987654321
```

### ❌ API Error
```
[SMS][DEBUG] Fast2SMS raw response: 401 {...}
[SMS][ERROR] Fast2SMS error details: { statusCode: 401, ... }
[SMS][ERROR] Fast2SMS failed: {...}
```

### ❌ Network Error
```
[SMS][ERROR] Fast2SMS network error: { ... }
```

## Quick Reference

**Debug SMS Endpoint:**
```
POST /api/otp/debug/sms
Body: { "phone": "9876543210" }
No auth required
```

**OTP Verification:**
```
POST /api/otp/verification/generate
Body: { "phone": "9876543210" }
No auth required (has debug bypass route)
```

**Check Logs:**
- All SMS logs: `[SMS]` prefix
- Debug info: `[SMS][DEBUG]`
- Errors: `[SMS][ERROR]` or `[OTP][ERROR]`

## Phone Number Formats Supported

| Input | Formatted | Valid? |
|-------|-----------|--------|
| 9876543210 | 9876543210 | ✅ Yes |
| +919876543210 | 9876543210 | ✅ Yes |
| 919876543210 | 9876543210 | ✅ Yes |
| 0987654321 | 0987654321 | ❌ No (starts with 0) |
| 9876 | 9876 | ❌ No (too short) |
| 5876543210 | 5876543210 | ❌ No (starts with 5) |
