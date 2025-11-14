# Complete State Management & Data Flow Analysis

## Executive Summary

**State Management:** Redux Toolkit with RTK Query  
**Data Source:** MongoDB (Backend)  
**Caching:** RTK Query automatic caching  
**Persistence:** localStorage for auth only  
**Synchronization:** Tag-based cache invalidation  

---

## 1. Global State Management: Redux Toolkit

### Store Configuration (`/store/index.ts`)

```typescript
configureStore({
  reducer: {
    auth: authReducer,    // Authentication & session
    cart: cartReducer,     // Shopping cart
    ui: uiReducer,         // UI preferences
    api: api.reducer,      // RTK Query cache
  }
});
```

---

## 2. State Slices

### 2.1 Auth Slice

**Data Stored:**
- ✅ User ID, email, role, isAdmin
- ✅ Access & refresh tokens
- ❌ NOT profile data (name, phone)
- ❌ NOT addresses

**Actions:**
- `setAuth` - Login
- `logout` - Clear session
- `setTokens` - Refresh tokens

**Persistence:** `localStorage.setItem("auth", ...)`

### 2.2 Cart Slice

**Data Stored:**
- Cart items
- Total price
- Item count

**Source:** MongoDB (fetched via RTK Query)

### 2.3 RTK Query API

**Endpoints:**
- `useGetAddressesQuery()` → Returns `{ addresses, defaultAddressId }`
- `useSetDefaultAddressMutation()` → Updates default
- `useGetCartQuery()` → Fetches cart from backend
- `useGetProfileQuery()` → Fetches user profile

---

## 3. Default Address Flow

### Storage:
```
MongoDB → RTK Query Cache → Component Props
```

### Retrieval:
```typescript
const { data: addressesData } = useGetAddressesQuery();
const defaultAddressId = addressesData?.defaultAddressId;
const defaultAddress = addresses.find(a => a.id === defaultAddressId);
```

### Update:
```typescript
await setDefaultAddressMutation(addressId);
// Auto-refetches → All components update
```

---

## 4. localStorage Keys

### `"auth"`
```json
{
  "user": { "id": "...", "email": "...", "role": "..." },
  "tokens": { "accessToken": "...", "refreshToken": "..." },
  "isAuthenticated": true
}
```
- Written: On login
- Removed: On logout
- Read: On app init

### `"autofillAddress"`
```json
{
  "addressLine": "...",
  "city": "...",
  "state": "...",
  "pincode": "...",
  "lat": 17.385,
  "lng": 78.486
}
```
- Written: After GPS detection
- Removed: After form auto-fill
- Read: Once by AddressesPage

---

## 5. Data Sources Summary

### From Backend (MongoDB):
- ✅ User profile (name, phone)
- ✅ Addresses
- ✅ Cart items
- ✅ Products
- ✅ Orders

### Temporary (React State):
- Form inputs
- Modal states
- UI toggles

### Persistent (localStorage):
- ✅ Auth tokens
- ✅ Autofill data (temporary)

---

## 6. Authentication Validation

### On Every API Request:
```typescript
prepareHeaders: (headers, { getState }) => {
  const token = getState().auth?.tokens?.accessToken;
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
}
```

### Protected Routes:
```typescript
if (!auth.isAuthenticated) {
  return <Navigate to="/login" />;
}
```

---

## 7. Key Flow: Change Default Address

```
User clicks address
  ↓
setDefaultAddressMutation(id)
  ↓
PATCH /api/user/addresses/:id/default
  ↓
RTK Query invalidates "Address" tag
  ↓
All useGetAddressesQuery() auto-refetch
  ↓
Components re-render with new default
```

**Components Updated:**
- Layout navbar
- ChooseLocation modal
- AddressesPage
- CheckoutPage (delivery fee)

---

## 8. No localStorage for:
- ❌ Cart (MongoDB source)
- ❌ Addresses (MongoDB source)  
- ❌ Profile data (MongoDB source)
- ❌ Products (API cache)

---

## Conclusion

**Single Source of Truth:** MongoDB  
**Caching Layer:** RTK Query  
**Synchronization:** Automatic tag invalidation  
**Persistence:** Only auth tokens in localStorage  
**No Manual Syncing:** RTK Query handles everything
