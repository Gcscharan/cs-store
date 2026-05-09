# Order Creation 400 Error - Debugging Guide

## Error Summary
```
ERROR  ❌ API REQUEST FAILED: {
  "attempts": 1,
  "baseUrl": "http://192.168.1.4:5002/api",
  "code": "ERR_BAD_REQUEST",
  "fullUrl": "http://192.168.1.4:5002/api/orders",
  "message": "Request failed with status code 400",
  "method": "POST",
  "status": 400,
  "url": "/orders"
}
```

## Context
- User just transformed 1 address (LOG shows: "Transformed: 1 addresses")
- Order creation immediately fails with 400 Bad Request
- This happens during checkout flow

## Root Cause Analysis

The `POST /orders` endpoint (`createOrderFromCart` function) has **strict validation** that can fail for multiple reasons:

### Validation Checks (in order)
1. ✅ **UPI VPA** - Only if payment method is UPI
2. ✅ **User exists** - User must be found in database
3. ❌ **Default address required** - User must have an address with `isDefault: true`
4. ❌ **Address fields required** - All fields must be present and non-empty:
   - `name` (recipient name)
   - `phone` (recipient phone)
   - `pincode` (6 digits)
   - `city`
   - `state`
   - `addressLine`
5. ❌ **Valid phone number** - Must be valid Indian mobile (10 digits)
6. ❌ **Valid pincode format** - Must be exactly 6 digits
7. ❌ **Pincode serviceable** - Must be in serviceable area
8. ❌ **Valid coordinates** - Address must have valid `lat` and `lng`
9. ❌ **Pincode resolution** - Pincode must resolve to district/state
10. ❌ **Delivery available** - Delivery must be available to that state

## Most Likely Causes

### 1. Missing Default Address (HIGH PROBABILITY)
**Error Message**: "Default address is required"

**Why**: The address was just added but might not be marked as `isDefault: true`

**Check**:
```typescript
// Backend logs will show:
"NO DEFAULT ADDRESS FOUND!"
"This means no address has isDefault: true"
```

**Fix**: Ensure the address is marked as default when created/selected

### 2. Missing Coordinates (HIGH PROBABILITY)
**Error Message**: "Address coordinates are missing"

**Why**: The address might not have valid `lat` and `lng` values

**Check**:
```typescript
// Backend logs will show:
"[ORDER VALIDATION] FAILED - Invalid coordinates: { lat: undefined, lng: undefined }"
```

**Fix**: Ensure coordinates are set when address is created

### 3. Pincode Not Serviceable (MEDIUM PROBABILITY)
**Error Message**: "Delivery not available to this pincode"

**Why**: The pincode might not be in the serviceable area list

**Check**:
```typescript
// Backend logs will show:
"[ORDER VALIDATION] FAILED - Pincode not serviceable: 123456"
```

**Fix**: Add pincode to serviceable area or use a test pincode

## Debugging Steps

### Step 1: Check Backend Logs
Look for these log messages in the backend console:

```
=== CHECKOUT DEBUG START ===
Checkout User ID: ...
Total Addresses Count: 1
All User Addresses:
  [0] ID: ...
      Label: HOME
      isDefault: true/false  <-- CHECK THIS
      lat: ... (type: number)  <-- CHECK THIS
      lng: ... (type: number)  <-- CHECK THIS
=== CHECKOUT DEBUG END ===
```

### Step 2: Check Address Data
The backend will log the exact validation failure:

```
[ORDER VALIDATION] Address being validated: {
  "_id": "...",
  "name": "...",
  "pincode": "...",
  "lat": ...,  <-- Should be a number
  "lng": ...,  <-- Should be a number
  "latType": "number",  <-- Should be "number", not "undefined"
  "lngType": "number",  <-- Should be "number", not "undefined"
  "hasValidCoords": true  <-- Should be true
}
```

### Step 3: Check Error Response
The backend returns a specific error message in the response body:

```json
{
  "message": "Default address is required"
  // OR
  "message": "Address coordinates are missing"
  // OR
  "message": "Delivery not available to this pincode"
  // OR
  "message": "Address field 'name' is required"
}
```

## Solution Paths

### If "Default address is required"
**Mobile App Fix**: Ensure address is marked as default when created

```typescript
// In address creation/selection
const address = {
  ...addressData,
  isDefault: true,  // ✅ Mark as default
};
```

### If "Address coordinates are missing"
**Mobile App Fix**: Ensure coordinates are captured from map/location

```typescript
// In address creation
const address = {
  ...addressData,
  lat: location.latitude,   // ✅ Must be a number
  lng: location.longitude,  // ✅ Must be a number
};
```

### If "Pincode not serviceable"
**Backend Fix**: Add pincode to serviceable list or use test mode

```typescript
// In backend/src/domains/operations/services/orderBuilder.ts
function isPincodeServiceable(pincode: string): boolean {
  const serviceable = ['500001', '500002', ...];  // Add your pincode
  return serviceable.includes(pincode);
}
```

## Quick Test

### Test with Known Good Address
Use this test address format:

```json
{
  "name": "Test User",
  "phone": "9876543210",
  "addressLine": "123 Test Street",
  "city": "Hyderabad",
  "state": "Telangana",
  "pincode": "500001",
  "lat": 17.385044,
  "lng": 78.486671,
  "isDefault": true,
  "label": "HOME"
}
```

## Files to Check

### Mobile App
- `apps/customer-app/src/screens/address/AddAddressScreen.tsx` - Address creation
- `apps/customer-app/src/screens/address/AddressListScreen.tsx` - Address selection
- `apps/customer-app/src/screens/checkout/CheckoutScreen.tsx` - Checkout flow

### Backend
- `backend/src/domains/operations/services/orderBuilder.ts` - Validation logic (line 110-300)
- `backend/src/domains/operations/controllers/orderController.ts` - createOrder endpoint

## Next Steps

1. **Check backend logs** for the exact error message
2. **Verify address data** has all required fields
3. **Ensure coordinates** are present and valid
4. **Confirm default flag** is set to true
5. **Test with known good address** to isolate the issue

## Related Issues

This validation was added to prevent:
- ❌ Orders without delivery addresses
- ❌ Orders with incomplete addresses
- ❌ Orders to non-serviceable areas
- ❌ Orders with invalid coordinates (can't route)

All validation is intentional and protects data integrity.
