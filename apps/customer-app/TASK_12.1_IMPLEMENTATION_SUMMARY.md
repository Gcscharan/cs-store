# Task 12.1 Implementation Summary: Pending Payment Check on App Startup

## Overview
Implemented app kill recovery functionality for UPI payments. When the app is killed during payment and then restarted, the system automatically checks for pending payments and resumes verification.

## Requirements Addressed
- **BR-004**: App Kill Recovery - Payment verification continues even if app is killed
- **US-003**: Customer's App is Killed During Payment - Payment verified on app restart

## Implementation Details

### 1. Enhanced PendingPaymentTracker Component
**File**: `apps/customer-app/src/components/common/PendingPaymentTracker.tsx`

#### Key Features:
1. **AsyncStorage-based Recovery**
   - Checks for `pendingPaymentOrderId` in AsyncStorage on app mount
   - Checks for `pendingPaymentTimestamp` to validate age
   - Only processes pending orders < 1 hour old

2. **Timestamp Validation**
   - Pending orders older than 1 hour are automatically cleared
   - Prevents stale payment checks that are unlikely to succeed
   - Age is calculated in seconds for analytics

3. **Resume Polling**
   - Automatically resumes polling for pending orders on app startup
   - Uses same polling logic as CheckoutScreen (20 attempts × 2 seconds = 40 seconds)
   - Handles SUCCESS, FAILED, and TIMEOUT scenarios

4. **Duplicate Prevention**
   - Uses `isPollingRef` to prevent duplicate polling sessions
   - Ensures only one polling session runs at a time

5. **Analytics Integration**
   - Logs `pending_payment_recovery_started` when recovery begins
   - Logs `background_payment_verified` on successful verification
   - Logs `background_payment_failed` on payment failure
   - Logs `background_payment_cleared_stale` when clearing old orders
   - Logs `background_payment_timeout` when polling times out

### 2. App.tsx Integration
**File**: `apps/customer-app/App.tsx`

The `PendingPaymentTracker` component is already integrated in the App.tsx file:
```tsx
<PendingPaymentTracker />
```

This ensures the component runs on every app startup and checks for pending payments.

### 3. Test Coverage
**File**: `apps/customer-app/src/__tests__/PendingPaymentTracker.test.tsx`

#### Test Suites:
1. **Timestamp Validation** (3 tests)
   - Validates orders < 1 hour old are processed
   - Validates orders > 1 hour old are rejected
   - Tests edge case at exactly 1 hour

2. **AsyncStorage Operations** (3 tests)
   - Tests reading pending order data
   - Tests clearing data after verification
   - Tests clearing stale data

3. **Polling Logic** (3 tests)
   - Validates 2-second polling interval
   - Validates 20 maximum attempts
   - Validates 40-second total timeout

4. **Analytics Events** (5 tests)
   - Tests all analytics event logging
   - Validates event parameters

5. **Payment Status Handling** (3 tests)
   - Tests PAID, FAILED, and PENDING status handling

**Test Results**: ✅ All 17 tests passing

## How It Works

### Normal Flow (No Pending Payment)
1. App starts
2. PendingPaymentTracker checks AsyncStorage
3. No pending payment found
4. Continues with normal app flow

### Recovery Flow (Pending Payment Found)
1. App starts after being killed during payment
2. PendingPaymentTracker checks AsyncStorage
3. Finds `pendingPaymentOrderId` and `pendingPaymentTimestamp`
4. Validates timestamp (< 1 hour old)
5. Resumes polling for payment status
6. On SUCCESS:
   - Clears AsyncStorage
   - Logs analytics event
   - User can navigate to Orders to see completed order
7. On FAILED:
   - Clears AsyncStorage
   - Logs analytics event
8. On TIMEOUT:
   - Keeps pending order in AsyncStorage
   - Logs timeout event
   - User can check manually in Orders

### Stale Order Cleanup
1. App starts
2. PendingPaymentTracker finds pending order > 1 hour old
3. Automatically clears AsyncStorage
4. Logs stale cleanup event
5. No polling performed (too old to be relevant)

## Configuration

### Constants
- `ONE_HOUR_MS = 3600000` (1 hour in milliseconds)
- `MAX_POLLING_ATTEMPTS = 20` (maximum polling attempts)
- `POLL_INTERVAL_MS = 2000` (2 seconds between polls)

### AsyncStorage Keys
- `pendingPaymentOrderId`: Stores the order ID
- `pendingPaymentTimestamp`: Stores the timestamp when payment was initiated

## Integration Points

### CheckoutScreen
The CheckoutScreen already stores pending payment data:
```typescript
await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());
```

And clears it on successful verification:
```typescript
await AsyncStorage.removeItem('pendingPaymentOrderId');
await AsyncStorage.removeItem('pendingPaymentTimestamp');
```

### Payment Verification API
Uses the existing `getPaymentStatus` API endpoint:
- `GET /api/payments/verify/:orderId`
- Returns payment status: PAID, PENDING, or FAILED

## Benefits

1. **Improved User Experience**
   - Users don't lose payments if app crashes
   - Automatic recovery without user intervention
   - Seamless payment verification on app restart

2. **Reliability**
   - Handles network failures gracefully
   - Prevents stale payment checks
   - Duplicate prevention ensures single polling session

3. **Observability**
   - Comprehensive analytics logging
   - Easy to track recovery success rate
   - Helps identify issues in production

4. **Maintainability**
   - Clean separation of concerns
   - Well-tested logic
   - Clear documentation

## Testing Recommendations

### Manual Testing
1. **Happy Path**:
   - Start payment flow
   - Kill app during payment
   - Complete payment in UPI app
   - Restart merchant app
   - Verify payment is automatically verified

2. **Stale Order**:
   - Manually set old timestamp in AsyncStorage
   - Restart app
   - Verify stale order is cleared

3. **Network Failure**:
   - Start payment flow
   - Kill app
   - Disable network
   - Restart app
   - Verify polling retries when network returns

### Production Monitoring
Monitor these analytics events:
- `pending_payment_recovery_started`: Track recovery attempts
- `background_payment_verified`: Track successful recoveries
- `background_payment_timeout`: Track timeout rate
- `pending_payment_cleared_stale`: Track stale order cleanup

## Compliance with Requirements

### BR-004: App Kill Recovery ✅
- ✅ Pending order ID is persisted to storage
- ✅ On app startup, check for pending orders
- ✅ Resume polling for pending orders
- ✅ Clear pending order after verification

### US-003: Customer's App is Killed During Payment ✅
- ✅ I complete payment in UPI app
- ✅ My merchant app crashes/is killed
- ✅ I reopen merchant app
- ✅ App automatically checks payment status
- ✅ I see order success if payment was successful

## Files Modified
1. `apps/customer-app/src/components/common/PendingPaymentTracker.tsx` - Enhanced with AsyncStorage-based recovery
2. `apps/customer-app/src/__tests__/PendingPaymentTracker.test.tsx` - Added comprehensive test coverage

## Files Unchanged (Already Integrated)
1. `apps/customer-app/App.tsx` - Already includes PendingPaymentTracker component
2. `apps/customer-app/src/screens/checkout/CheckoutScreen.tsx` - Already stores/clears pending payment data

## Conclusion
Task 12.1 has been successfully implemented. The app now automatically checks for pending payments on startup and resumes verification, ensuring users don't lose their payments even if the app crashes during the payment process.
