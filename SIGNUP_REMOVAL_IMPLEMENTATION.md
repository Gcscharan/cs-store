# Signup Feature Removal - Implementation Summary

## Overview
Removed the separate signup feature and implemented a unified login flow where new users are automatically redirected to onboarding after OTP verification.

## Changes Made

### Backend Changes

#### 1. `backend/src/domains/identity/controllers/authController.ts`

**sendAuthOTP Function**:
- ✅ Removed `mode` parameter (signup/login distinction)
- ✅ Always lookup user by phone/email
- ✅ For new users: Send OTP with type "signup" for onboarding
- ✅ For existing users: Send OTP with type "login"
- ✅ Added `isNewUser` flag in response to indicate if user needs onboarding
- ✅ Removed 404 error for non-existent users (they get OTP for onboarding)

**verifyAuthOTP Function**:
- ✅ Removed `mode` parameter
- ✅ Automatically detect if user exists
- ✅ For new users: Return `{ requiresOnboarding: true, phone, email }` instead of creating account
- ✅ For existing users: Complete login with tokens
- ✅ Removed automatic user creation in verify step

### Frontend Changes

#### 1. `apps/customer-app/src/screens/auth/LoginScreen.tsx`

- ✅ Removed signup link from footer
- ✅ Updated header title from "Login or Signup" to "Login"
- ✅ Updated hero text to be more welcoming
- ✅ Removed `mode` parameter from `sendOtp` call
- ✅ Removed `mode` parameter from `verifyOtp` call
- ✅ Added logic to check `requiresOnboarding` flag in verify response
- ✅ Navigate to Onboarding screen for new users
- ✅ Complete login for existing users

#### 2. `apps/customer-app/src/api/authApi.ts`

- ✅ Updated `sendOtp` mutation signature (removed `mode` parameter)
- ✅ Updated `verifyOtp` mutation signature (removed `mode` parameter)
- ✅ Updated `verifyOtp` response type to handle onboarding redirect
- ✅ Removed query parameter from API calls

## User Flow

### New User Flow:
1. User enters phone number on Login screen
2. Backend checks if user exists → No
3. Backend sends OTP (type: "signup")
4. User enters OTP
5. Backend verifies OTP → Returns `{ requiresOnboarding: true, phone }`
6. Frontend redirects to Onboarding screen
7. User completes profile (name + phone verification)
8. Account created with tokens → User logged in

### Existing User Flow:
1. User enters phone number on Login screen
2. Backend checks if user exists → Yes
3. Backend sends OTP (type: "login")
4. User enters OTP
5. Backend verifies OTP → Returns tokens + user data
6. User logged in immediately

## Files Modified

### Backend:
- `backend/src/domains/identity/controllers/authController.ts`

### Frontend:
- `apps/customer-app/src/screens/auth/LoginScreen.tsx`
- `apps/customer-app/src/api/authApi.ts`

## Files to Remove (Optional Cleanup):
- `apps/customer-app/src/screens/auth/SignupScreen.tsx` (no longer used)
- Remove Signup route from navigation files

## Testing Checklist

- [ ] New user can enter phone and receive OTP
- [ ] New user is redirected to onboarding after OTP verification
- [ ] Existing user can login with OTP
- [ ] Existing user is NOT redirected to onboarding
- [ ] OTP expiration works correctly
- [ ] OTP retry limit works correctly
- [ ] Invalid phone number shows error
- [ ] Invalid OTP shows error

## API Contract Changes

### POST /api/auth/send-otp
**Before**:
```json
{
  "phone": "9876543210",
  "mode": "login" | "signup"
}
```

**After**:
```json
{
  "phone": "9876543210"
}
```

**Response**:
```json
{
  "message": "OTP sent successfully",
  "expiresIn": 600,
  "sentTo": "phone",
  "isNewUser": true | false
}
```

### POST /api/auth/verify-otp
**Before**:
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "mode": "login" | "signup"
}
```

**After**:
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

**Response for New User**:
```json
{
  "message": "OTP verified successfully",
  "requiresOnboarding": true,
  "phone": "9876543210"
}
```

**Response for Existing User**:
```json
{
  "message": "Login successful",
  "user": { ... },
  "accessToken": "...",
  "refreshToken": "..."
}
```

## Benefits

1. **Simplified UX**: Single entry point for all users
2. **Reduced Confusion**: No need to choose between login/signup
3. **Better Onboarding**: New users get proper profile setup flow
4. **Cleaner Code**: Removed mode parameter complexity
5. **Consistent Flow**: All users follow same initial steps

## Notes

- The OnboardingScreen already exists and handles profile completion
- The backend already has `completeOnboarding` endpoint
- No database schema changes required
- Backward compatible with existing users
