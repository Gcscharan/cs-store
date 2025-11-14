# ✅ 403 Forbidden Error Fix Guide

## Problem
When trying to add an address, you get:
```
POST http://localhost:3000/api/user/addresses 403 (Forbidden)
Error: "Invalid or expired token"
```

---

## Root Cause

The issue is **NOT with the API configuration** - it's that you need to be logged in!

### Current API Configuration (Already Correct ✅):

```typescript
// frontend/src/store/api.ts
const baseQuery = fetchBaseQuery({
  baseUrl: "/api",  // ✅ Correct - uses Vite proxy
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as any).auth?.tokens?.accessToken;
    
    if (token) {
      headers.set("authorization", `Bearer ${token}`);  // ✅ Sends JWT
    }
    
    headers.set("content-type", "application/json");  // ✅ Added
    return headers;
  },
});
```

### Vite Proxy Configuration (Already Correct ✅):

```typescript
// frontend/vite.config.ts
server: {
  port: 3000,
  proxy: {
    "/api": {
      target: "http://localhost:5001",  // ✅ Proxies to backend
      changeOrigin: true,
      secure: false,
    },
  },
}
```

---

## What I Fixed

### 1. **Added Debug Logging** ✅
```typescript
console.log("🔐 API Request - Token check:", {
  hasToken: !!token,
  tokenPreview: token ? `${token.substring(0, 20)}...` : "none",
});
```

This will show in console whether the token is present for each API request.

### 2. **Added Content-Type Header** ✅
```typescript
headers.set("content-type", "application/json");
```

### 3. **Added Login Redirect** ✅
```typescript
// In AddressesPage.tsx
useEffect(() => {
  if (!auth.isAuthenticated) {
    showError("Please log in to manage your addresses");
    navigate("/login", { replace: true });
  }
}, [auth.isAuthenticated, navigate, showError]);
```

---

## How to Fix: Step-by-Step

### **Step 1: Clear Old Data**
```javascript
// Open browser console and run:
localStorage.clear();
```
Then refresh the page.

### **Step 2: Log In via OTP**

1. **Go to:** http://localhost:3000/login

2. **Enter Email:** `gcs.charan@gmail.com`

3. **Click "Send OTP"**

4. **Check Backend Console** for OTP:
   ```
   🔔 OTP Login Request
   📧 Email: gcs.charan@gmail.com
   🔑 Generated OTP: XXXX
   ```

5. **Enter the OTP** shown in backend console

6. **Click "Verify OTP"**

7. **Should redirect** to homepage (you're now logged in!)

### **Step 3: Check Authentication**

Open browser console and verify:
```javascript
// Should show your user data and tokens
localStorage.getItem('auth')
```

You should see:
```json
{
  "user": {
    "id": "...",
    "email": "gcs.charan@gmail.com",
    "role": "customer"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "isAuthenticated": true
}
```

### **Step 4: Test Adding Address**

1. **Go to:** http://localhost:3000/addresses

2. **Click "ADD NEW ADDRESS"**

3. **Fill all required fields:**
   - Name: `GCS. Charan`
   - Pincode: `521235`
   - City: `Tiruvuru`
   - State: `Andhra Pradesh`
   - Address: `Patha Tiruvuru`
   - Phone: `9381795162`
   - Label: `HOME`

4. **Click "Add Address"**

5. **Check Console Logs:**
   ```
   🔐 API Request - Token check: { hasToken: true, tokenPreview: "eyJ..." }
   ✅ Address added to MongoDB
   ```

6. **✅ Address should save successfully!**

---

## Debugging

### If Still Getting 403:

#### Check 1: Is Token Present?
```javascript
// Browser console:
const state = JSON.parse(localStorage.getItem('auth'));
console.log('Token:', state?.tokens?.accessToken);
```

If **null** → You're not logged in → Go back to Step 2

#### Check 2: Is Token Valid?
```javascript
// Check token expiry
const token = JSON.parse(localStorage.getItem('auth'))?.tokens?.accessToken;
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token expires:', new Date(payload.exp * 1000));
  console.log('Is expired:', Date.now() > payload.exp * 1000);
}
```

If **expired** → Log in again

#### Check 3: Backend Response
Look at Network tab in DevTools:
- Request URL: `http://localhost:3000/api/user/addresses`
- Request Headers: Should have `Authorization: Bearer eyJ...`
- Response: If 403, check response body for error message

---

## Request Flow

```
Frontend (localhost:3000)
  ↓
  POST /api/user/addresses
  ↓
Vite Proxy
  ↓
  POST http://localhost:5001/api/user/addresses
  + Authorization: Bearer <token>
  ↓
Backend (localhost:5001)
  ↓
authenticateToken middleware
  ↓
Verify JWT token
  ↓
  ✅ Valid → addUserAddress controller → Save to MongoDB
  ❌ Invalid → 403 Forbidden
```

---

## Summary

**The API configuration is correct!** The issue is simply that you need to:

1. ✅ Clear localStorage
2. ✅ Log in via OTP (check backend console for OTP)
3. ✅ Try adding address again

**Expected Result:**
- ✅ Address saves to MongoDB
- ✅ No 403 errors
- ✅ Address appears in list

---

## Verification Checklist

After logging in, verify these in browser console:

- [ ] `localStorage.getItem('auth')` shows user data
- [ ] Token is present and not null
- [ ] Token is not expired
- [ ] `🔐 API Request - Token check: { hasToken: true }` appears in console when making requests
- [ ] Network tab shows `Authorization` header in request
- [ ] Address saves successfully

If all checked ✅ → You're good to go!
