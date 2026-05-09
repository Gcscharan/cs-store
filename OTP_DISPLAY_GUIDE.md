# OTP Display Guide

## ✅ OTPs ARE Being Displayed!

I've verified that OTPs **are being displayed** in the backend terminal. Here's what I found:

### Current Status

The backend is running and successfully displaying OTPs when they're generated. Example from the terminal:

```
==================================================
🔐 [AUTH] GENERATED OTP FOR: 8185870492
👉 OTP CODE: 543300
==================================================
💾 OTP saved to DB: { phone: '8185870492', type: 'login' }
🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪
🧪 MOCK MODE ACTIVE - NOT SENDING SMS
👉 TARGET PHONE: 8185870492
🔑 USE THIS OTP: 543300
🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪🧪
```

## OTP Types and Where They Appear

### 1. Auth/Login OTP (✅ WORKING)
- **Endpoint**: `POST /api/auth/send-otp`
- **When**: User logs in or signs up
- **Log Format**: Banner with `🔐 [AUTH] GENERATED OTP FOR:`
- **File**: `backend/src/domains/identity/controllers/authController.ts`

### 2. Verification OTP
- **Endpoint**: `POST /api/security/otp/verification`
- **When**: Mobile number verification
- **Log Format**: `🔐 OTP GENERATED: { type: "verification", ... }`
- **File**: `backend/src/domains/security/controllers/otpController.ts`

### 3. Payment OTP
- **Endpoint**: `POST /api/security/otp/payment`
- **When**: Payment verification
- **Log Format**: `🔐 OTP GENERATED: { type: "payment", ... }`
- **File**: `backend/src/domains/security/controllers/otpController.ts`

### 4. Delivery OTP
- **Endpoint**: `POST /api/delivery/orders/:orderId/generate-otp`
- **When**: Delivery verification
- **Log Format**: `🔐 OTP GENERATED: { type: "delivery", ... }`
- **File**: `backend/src/domains/operations/controllers/deliveryOrderController.ts`

## How to See OTPs

### Option 1: Watch the Backend Terminal
1. Open the terminal where you ran `npm run dev` in the `backend` folder
2. Keep it visible while testing
3. OTPs will appear immediately when generated

### Option 2: Filter Logs
If there's too much output, filter for OTP logs:

```bash
# In the backend directory
npm run dev 2>&1 | grep -E "OTP|🔐"
```

### Option 3: Check the Kiro Terminal
The backend is currently running in Kiro's terminal (Terminal ID: 12). You can see the output there.

## Testing Different OTP Types

### Test Auth OTP (Login/Signup)
1. Open the mobile app
2. Go to login screen
3. Enter a phone number
4. Tap "Send OTP"
5. Check backend terminal for the OTP

### Test Verification OTP
1. Make a POST request to `/api/security/otp/verification`
2. Include phone number in the body
3. Check backend terminal

### Test Payment OTP
1. Create an order
2. Proceed to payment
3. Enter card details
4. Request OTP
5. Check backend terminal

### Test Delivery OTP
1. Create an order as admin
2. Assign to delivery partner
3. Generate delivery OTP
4. Check backend terminal

## Environment Configuration

Make sure these are set in `backend/.env`:

```env
NODE_ENV=development
MOCK_OTP=true
```

This ensures:
- OTPs are logged to console
- SMS is not actually sent (mock mode)
- OTPs appear in terminal output

## Troubleshooting

### If you don't see OTPs:

1. **Check the correct terminal**: Make sure you're looking at the terminal where `npm run dev` is running in the `backend` folder

2. **Check environment variables**:
   ```bash
   # In backend terminal, you should see:
   ⚙️ MOCK_OTP === 'true': true
   ```

3. **Check if OTP endpoint is being called**: Look for HTTP request logs like:
   ```
   [INFO] 🔥 [TRAFFIC] POST /api/auth/send-otp
   ```

4. **Restart backend**: If needed, stop and restart:
   ```bash
   cd backend
   npm run dev
   ```

5. **Check for errors**: Look for any error messages in the terminal

## Current Backend Status

✅ Backend is running on port 5001
✅ MOCK_OTP is enabled
✅ OTPs are being logged to console
✅ Auth OTP tested and working

## Next Steps

If you're still not seeing OTPs:
1. Tell me which OTP type you're trying to test (auth, verification, payment, or delivery)
2. Share a screenshot of your backend terminal
3. Let me know what action you're performing in the app

The OTP logging is working correctly - it's just a matter of looking at the right terminal at the right time!
