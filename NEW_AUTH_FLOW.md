# New Authentication Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      LOGIN SCREEN                           │
│                                                             │
│  Welcome to Vyapara Setu                                   │
│  Enter your phone number to continue                       │
│                                                             │
│  Phone Number: [__________]                                │
│                                                             │
│  [Continue Button]                                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                  User enters phone
                          │
                          ▼
              POST /api/auth/send-otp
              { phone: "9876543210" }
                          │
                          ▼
              Backend checks if user exists
                          │
                ┌─────────┴─────────┐
                │                   │
           User Exists          User New
                │                   │
                ▼                   ▼
        OTP type: "login"   OTP type: "signup"
                │                   │
                └─────────┬─────────┘
                          │
                          ▼
                  OTP sent via SMS
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   OTP VERIFICATION                          │
│                                                             │
│  Verify OTP                                                │
│  Sent to +91 9876543210                                    │
│                                                             │
│  [• • • • • •]                                             │
│                                                             │
│  [Verify & Continue]                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                  User enters OTP
                          │
                          ▼
             POST /api/auth/verify-otp
             { phone: "9876543210", otp: "123456" }
                          │
                          ▼
              Backend verifies OTP
                          │
                ┌─────────┴─────────┐
                │                   │
           User Exists          User New
                │                   │
                ▼                   ▼
        Return tokens       Return requiresOnboarding
        + user data         { requiresOnboarding: true }
                │                   │
                ▼                   ▼
        ┌───────────┐      ┌────────────────┐
        │   HOME    │      │  ONBOARDING    │
        │  SCREEN  │      │    SCREEN      │
        └───────────┘      └────────────────┘
                                   │
                                   ▼
                          User enters name
                          Phone pre-filled
                                   │
                                   ▼
                    POST /api/auth/complete-onboarding
                    { name: "John Doe", phone: "9876543210" }
                                   │
                                   ▼
                          Account created
                          Return tokens
                                   │
                                   ▼
                           ┌───────────┐
                           │   HOME    │
                           │  SCREEN  │
                           └───────────┘
```

## Key Changes

### Before (Old Flow):
```
Login Screen → Choose Login or Signup
  ├─ Login: Enter phone → OTP → Home
  └─ Signup: Enter phone → OTP → Create account → Home
```

### After (New Flow):
```
Login Screen → Enter phone → OTP
  ├─ Existing User: Home
  └─ New User: Onboarding → Home
```

## Benefits

1. **Simpler UX**: No need to choose between login/signup
2. **Automatic Detection**: Backend determines if user is new
3. **Proper Onboarding**: New users complete profile before accessing app
4. **Single Entry Point**: All users start at same screen
5. **Less Confusion**: Users don't need to remember if they signed up before

## Technical Details

### Backend Response Handling

**For Existing Users**:
```typescript
{
  message: "Login successful",
  user: { id, name, email, phone, ... },
  accessToken: "jwt_token",
  refreshToken: "refresh_token"
}
```

**For New Users**:
```typescript
{
  message: "OTP verified successfully",
  requiresOnboarding: true,
  phone: "9876543210"
}
```

### Frontend Navigation Logic

```typescript
const result = await verifyOtp({ phone, otp }).unwrap();

if (result.requiresOnboarding) {
  // New user - go to onboarding
  navigation.navigate('Onboarding', { phone });
} else {
  // Existing user - complete login
  dispatch(setTokens({ accessToken, refreshToken }));
  dispatch(setUser(result.user));
  dispatch(setStatus('ACTIVE'));
}
```

## Migration Notes

- Existing users are unaffected
- No database migration required
- Backward compatible with existing accounts
- SignupScreen component can be safely removed
- Signup route can be removed from navigation
