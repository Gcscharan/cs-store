# Fast2SMS Quick Test Instructions

## What Was Fixed

1. **Environment Loading Issue** - Moved `dotenv.config()` to the very top of `index.ts` before any imports
2. **Fast2SMS Detection** - Fixed detection logic to properly check if API key exists and is not empty
3. **Twilio Fallback Control** - Added `USE_TWILIO` flag (defaults to false) to prevent unwanted Twilio usage
4. **Enhanced Debugging** - All logs now show API key status, key length, and provider selection

## Required Environment Variables

Add to `backend/.env`:

```env
FAST2SMS_API_KEY=your_actual_api_key_here
FAST2SMS_SENDER_ID=TXTIND
USE_TWILIO=false
```

⚠️ **Important**: 
- No spaces around the `=` sign
- No quotes around the value
- Make sure this file is in the `backend/` directory

## Testing Steps

### Step 1: Restart Backend (IMPORTANT!)
```bash
# Kill any existing backend process completely
# Then start fresh:
cd /Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend
npm run dev
```

### Step 2: Test Debug Endpoint
```bash
curl -X POST http://localhost:5001/api/otp/debug/sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"9963882890"}'
```

### Step 3: Check Response

**SUCCESS Response (expected):**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "phone": "9963882890",
  "environment": {
    "provider": "fast2sms",
    "fast2smsEnabled": true,
    "fast2smsKeyLength": 40,
    "fast2smsSenderId": "TXTIND",
    "useTwilio": "not set",
    "twilioEnv": { ... },
    "mockSms": "not set"
  },
  "note": "Check backend logs for detailed Fast2SMS response"
}
```

**FAILURE Response (if API key missing):**
```json
{
  "success": false,
  "error": "SMS sending failed",
  "phone": "9963882890",
  "environment": {
    "provider": "none",
    "fast2smsEnabled": false,
    "fast2smsKeyLength": 0,
    ...
  }
}
```

### Step 4: Check Backend Logs

**Look for these logs (SUCCESS):**
```
[DEBUG][SMS] Testing SMS to: 9963882890
[DEBUG][SMS] Environment check: { provider: 'fast2sms', fast2smsEnabled: true, ... }
[SMS][DEBUG] sendSMS() called with: { rawPhone: '9963882890', messageLength: 15 }
[SMS][DEBUG] FAST2SMS_API_KEY: present (length: 40)
[SMS][DEBUG] USE_TWILIO: not set (defaults to false)
[SMS][DEBUG] Fast2SMS is enabled, attempting Fast2SMS...
[SMS][DEBUG] Formatted phone: 9963882890
[SMS][DEBUG] Calling Fast2SMS with: { route: 'v3', sender_id: 'TXTIND', ... }
[SMS][DEBUG] Fast2SMS URL: https://www.fast2sms.com/dev/bulkV2
[SMS][DEBUG] Fast2SMS raw response: 200 { return: true, ... }
[SMS] Fast2SMS success: true
[DEBUG][SMS] SMS test SUCCESS
```

**If you see these logs (FAILURE):**
```
[SMS][DEBUG] FAST2SMS_API_KEY: missing
[SMS][ERROR] No SMS provider configured
```

Then:
1. Double-check your `.env` file exists in `backend/` directory
2. Make sure `FAST2SMS_API_KEY=...` is on a single line with no spaces
3. Completely stop and restart the backend server

## Verification Checklist

- [ ] `backend/.env` file exists and contains `FAST2SMS_API_KEY=...`
- [ ] Backend server completely restarted (not just hot reload)
- [ ] Debug endpoint returns `"provider": "fast2sms"` (not "twilio" or "none")
- [ ] Backend logs show `[SMS][DEBUG] FAST2SMS_API_KEY: present (length: XX)`
- [ ] Backend logs show `[SMS] Fast2SMS success: true`
- [ ] You received the test SMS on your phone

## If Still Failing

1. **Check your Fast2SMS account:**
   - Login to https://www.fast2sms.com/dashboard
   - Verify API key is correct
   - Check account balance (need credits to send SMS)
   - Verify sender ID is approved

2. **Print environment variables:**
   ```bash
   cd backend
   node -e "require('dotenv').config(); console.log('FAST2SMS_API_KEY:', process.env.FAST2SMS_API_KEY ? 'PRESENT (len=' + process.env.FAST2SMS_API_KEY.length + ')' : 'MISSING')"
   ```

3. **Check for typos in .env:**
   - Variable name must be exactly `FAST2SMS_API_KEY` (not `FAST2SMS_KEY` or `FAST_2_SMS_API_KEY`)
   - No extra spaces: `FAST2SMS_API_KEY=abc123` ✅ vs `FAST2SMS_API_KEY = abc123` ❌

## Next Steps After Success

Once the debug endpoint works, test the actual OTP flow:

```bash
# Test verification OTP
curl -X POST http://localhost:5001/api/otp/verification/generate \
  -H "Content-Type: application/json" \
  -d '{"phone":"9963882890"}'
```

You should receive an actual OTP via SMS.
