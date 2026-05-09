# Task 15.2: Wire Mobile App API Calls - Implementation Summary

## Overview
This task ensures that the mobile app's payment verification API call is correctly configured to match the backend endpoint.

## Changes Made

### 1. Updated API Endpoint Configuration
**File**: `apps/customer-app/src/api/ordersApi.ts`

**Changes**:
- ✅ Updated `getPaymentStatus` endpoint URL from `/payment-status/:orderId` to `/payments/verify/:orderId`
- ✅ Enhanced response type to include all fields returned by backend:
  ```typescript
  {
    orderId: string;
    paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    verifiedAt?: string;
    amount: number;
  }
  ```

**Before**:
```typescript
getPaymentStatus: builder.query<{ paymentStatus: string }, string>({
  query: (orderId) => ({
    url: `/payment-status/${orderId}`,
    method: 'GET',
  }),
}),
```

**After**:
```typescript
getPaymentStatus: builder.query<{
  orderId: string;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  verifiedAt?: string;
  amount: number;
}, string>({
  query: (orderId) => ({
    url: `/payments/verify/${orderId}`,
    method: 'GET',
  }),
}),
```

### 2. Created Tests
**File**: `apps/customer-app/src/api/__tests__/ordersApi.test.ts`

**Test Coverage**:
- ✅ Verifies correct endpoint URL (`/payments/verify/:orderId`)
- ✅ Documents expected response structure
- ✅ Validates all payment status values (PAID, PENDING, FAILED)
- ✅ Documents backend route mapping
- ✅ Documents authentication requirement
- ✅ Documents polling configuration

**Test Results**:
```
PASS  src/api/__tests__/ordersApi.test.ts
  ordersApi - Payment Verification
    getPaymentStatus endpoint configuration
      ✓ should use the correct backend endpoint URL
      ✓ should expect correct response structure
      ✓ should handle all payment status values
    API endpoint documentation
      ✓ should document the correct backend route
      ✓ should document authentication requirement
      ✓ should document polling usage

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

## Verification

### 1. Backend Endpoint Verification
- ✅ Backend route is registered at: `GET /api/payments/verify/:orderId`
- ✅ Route is properly wired in `backend/src/createApp.ts` via `apiRouter.use("/payments", paymentsRoutes)`
- ✅ Controller implementation in `backend/src/domains/payments/controllers/verificationController.ts`

### 2. Mobile App Usage Verification
The API is used in two places:

**CheckoutScreen.tsx** (Polling):
```typescript
const res = await getPaymentStatus(orderId).unwrap();
const verdict = resolvePaymentStatus(res?.paymentStatus);
```

**PendingPaymentTracker.tsx** (Background verification):
```typescript
const res = await getPaymentStatus(orderId).unwrap();
const paymentStatus = res?.paymentStatus;
```

Both usages are compatible with the updated response type.

### 3. Type Safety
- ✅ Response type includes all fields returned by backend
- ✅ Payment status is properly typed as union: `'PAID' | 'PENDING' | 'FAILED'`
- ✅ Optional fields (razorpayPaymentId, verifiedAt) are correctly marked as optional
- ✅ TypeScript compilation passes without errors

## API Endpoint Mapping

| Component | Endpoint | Full URL |
|-----------|----------|----------|
| Backend Route | `/api/payments/verify/:orderId` | `http://localhost:5001/api/payments/verify/:orderId` |
| Frontend API | `/payments/verify/:orderId` | Base URL + `/payments/verify/:orderId` |

**Note**: The frontend omits `/api` prefix because it's added by the base URL configuration.

## Requirements Satisfied

✅ **TR-003**: Backend Verification Endpoint
- Endpoint matches backend route: `GET /api/payments/verify/:orderId`
- Response structure matches backend controller output
- Authentication is handled by backend middleware

✅ **Task 15.2 Requirements**:
- `getPaymentStatus` API call is implemented in RTK Query
- API endpoint matches backend route
- Tests verify endpoint configuration with mock data

## Testing

### Unit Tests
```bash
npm test -- ordersApi.test.ts
```

All tests pass successfully.

### Manual Testing Checklist
- [ ] Create order with UPI payment method
- [ ] Verify API call is made to correct endpoint
- [ ] Verify response includes all expected fields
- [ ] Test with PAID status response
- [ ] Test with PENDING status response
- [ ] Test with FAILED status response
- [ ] Test error handling (404, 401, 500)

## Next Steps

The mobile app API is now correctly wired to the backend verification endpoint. The next tasks in the spec are:

- **Task 15.3**: Write integration tests for end-to-end flow
- **Task 16.1**: Add logging and observability
- **Task 17**: Final testing and validation

## Notes

- The API endpoint was previously using `/payment-status/:orderId` which was incorrect
- The correct endpoint is `/payments/verify/:orderId` as specified in the design document (TR-003)
- The response type has been enhanced to include all fields returned by the backend
- Existing code in CheckoutScreen and PendingPaymentTracker is already compatible with the updated response type
