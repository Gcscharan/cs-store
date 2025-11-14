# Critical API Routing Port Fix - 404 Not Found Error Resolution

## Problem Identified
The frontend was sending API requests to the wrong port, causing **404 Not Found** errors during login operations.

**Failing Request**: `POST http://localhost:3000/api/auth/send-otp`
**Root Cause**: API calls were hitting **Frontend Port (3000)** instead of **Backend Port (5001)**

## Issue Analysis

### Configuration Status (BEFORE Fix)
✅ **Environment Variable**: `VITE_API_URL=http://localhost:5001` - **CORRECT**
✅ **Vite Proxy**: Routes `/api` to `http://localhost:5001` - **CORRECT**
❌ **Component Implementation**: Many components using relative URLs `/api/...` instead of full URLs

### Root Cause
While the environment variable and Vite proxy were correctly configured, **individual components were bypassing the configuration** by using:
- ❌ `fetch("/api/auth/send-otp")` (relative URL)
- ✅ Should be: `fetch("${VITE_API_URL}/api/auth/send-otp")` (full URL)

## Complete Fix Implementation

### Updated Components
All direct `fetch` API calls updated to use `import.meta.env.VITE_API_URL` with `http://localhost:5001` fallback:

#### 1. **OTP Login Components**
- **`/frontend/src/components/OtpLoginModal.tsx`**:
  - ✅ Fixed: `send-otp` endpoint
  - ✅ Fixed: `verify-otp` endpoint  
  - ✅ Fixed: Google OAuth redirect

- **`/frontend/src/components/LoginForm.tsx`**:
  - ✅ Fixed: `send-otp` endpoint
  - ✅ Fixed: `verify-otp` endpoint

#### 2. **Authentication Components**
- **`/frontend/src/components/SignupForm.tsx`**:
  - ✅ Fixed: `signup` endpoint

- **`/frontend/src/components/OAuthLogin.tsx`**:
  - ✅ Fixed: Google OAuth redirect

#### 3. **Admin Components**
- **`/frontend/src/pages/AdminProfilePage.tsx`**:
  - ✅ Fixed: `change-password` endpoint

#### 4. **Logout Hook**
- **`/frontend/src/hooks/useLogout.ts`**:
  - ✅ Fixed: `logout` endpoint

### Standard URL Pattern Applied
All components now use the consistent pattern:
```typescript
const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/endpoint`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});
```

## Backend Port Configuration Confirmed
✅ **Backend runs on port 5001**: `const PORT = process.env.PORT || 5001;`
✅ **Environment variable matches**: `VITE_API_URL=http://localhost:5001`
✅ **Vite proxy target correct**: `target: "http://localhost:5001"`

## Components Using Correct API Strategy

### ✅ Already Correct (RTK Query)
These components were already working because they use RTK Query with proper base URL:
- **`/frontend/src/store/api.ts`**: Uses `baseUrl: ${VITE_API_URL}/api`
- All RTK Query endpoints automatically get correct base URL

### ✅ Already Correct (Direct Fetch with Full URLs)
These components were already using full URLs correctly:
- **`/frontend/src/pages/CheckoutPage.tsx`**: Payment verification, OTP generation/verification, Razorpay orders
- **`/frontend/src/components/RazorpayCheckout.tsx`**: Payment callback URL
- **`/frontend/src/components/OnboardingForm.tsx`**: Profile completion
- **`/frontend/src/components/UseCurrentLocationButton.tsx`**: Reverse geocoding
- **`/frontend/src/components/RealtimeOTPVerification.tsx`**: WebSocket connection
- **`/frontend/src/utils/razorpay.ts`**: Payment verification
- **`/frontend/src/utils/razorpayHandler.ts`**: Payment verification

## Development vs Production Considerations

### Development Environment
- **Vite Dev Server**: Runs on port 3000
- **Vite Proxy**: Should handle `/api` requests to backend
- **Direct URLs**: More reliable than proxy for complex requests
- **Environment Variable**: Provides explicit control

### Production Environment  
- **Direct URLs**: Essential since no Vite proxy in production
- **Environment Variable**: Allows different backend URLs per environment
- **Fallback Values**: Ensure functionality even if env var missing

## Testing Verification

### Before Fix (Failing)
```
POST http://localhost:3000/api/auth/send-otp
Response: 404 Not Found (Frontend server doesn't have this endpoint)
```

### After Fix (Working)  
```
POST http://localhost:5001/api/auth/send-otp  
Response: 200 OK (Backend server handles request correctly)
```

## Error Resolution Summary

### Fixed API Endpoints
- ✅ `POST /api/auth/send-otp` (OTP generation)
- ✅ `POST /api/auth/verify-otp` (OTP verification)
- ✅ `POST /api/auth/signup` (User registration)
- ✅ `POST /api/auth/change-password` (Password changes)
- ✅ `POST /api/auth/logout` (Session termination)
- ✅ `GET /api/auth/google` (OAuth redirects)

### Network Request Flow (FIXED)
1. **Component**: Makes API call with full URL
2. **URL**: `http://localhost:5001/api/auth/send-otp`
3. **Network**: Request goes directly to backend server
4. **Backend**: Port 5001 receives and processes request
5. **Response**: Success response returned to frontend

## Best Practices Established

### 1. **Consistent URL Construction**
```typescript
// ✅ GOOD: Full URL with environment variable
const url = `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/endpoint`;

// ❌ BAD: Relative URL (depends on proxy)
const url = "/api/endpoint";
```

### 2. **Environment Variable Usage**
```typescript
// Always provide fallback for development
const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5001";
```

### 3. **Production Readiness**
- All components now work in production (no Vite proxy dependency)
- Environment variables allow different backend URLs per environment
- Fallback values ensure development functionality

## Future Maintenance

### Adding New API Endpoints
When adding new direct `fetch` calls, always use:
```typescript
const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/new-endpoint`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});
```

### Environment Configuration
- **Development**: `.env` file with `VITE_API_URL=http://localhost:5001`
- **Production**: Environment variable set to production backend URL
- **Docker**: Can override with container environment variables

The login **404 Not Found** error has been completely resolved. All authentication endpoints now correctly route to the backend server on port 5001, enabling successful OTP generation, verification, and user authentication flows.
