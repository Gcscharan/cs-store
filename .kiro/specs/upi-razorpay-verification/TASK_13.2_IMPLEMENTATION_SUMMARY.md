# Task 13.2 Implementation Summary: Add Timeout Handling UI

## Overview
Successfully implemented timeout handling UI for payment verification in the CheckoutScreen component. This provides users with clear feedback when payment verification takes longer than expected (after 20 polling attempts / 40 seconds).

## Implementation Details

### 1. State Management
Added new state variable to control timeout modal visibility:
```typescript
const [isTimeoutModalVisible, setIsTimeoutModalVisible] = React.useState(false);
```

### 2. Timeout Logic
Modified the `pollPaymentStatus` function to show the timeout modal instead of using `Alert.alert`:
```typescript
// After 20 polling attempts (40 seconds)
setIsVerifyingPayment(false);
logEvent('payment_verification_timeout', { method: 'upi', app: selectedApp.id, orderId });
setIsTimeoutModalVisible(true);
```

### 3. Timeout Modal UI
Created a custom modal with the following features:

#### Visual Elements
- **Icon**: Clock alert icon (`clock-alert-outline`) in amber color (#f59e0b) at size 48
- **Title**: "Verification Taking Longer"
- **Message**: "Payment verification is taking longer than expected. Please check your order status in "My Orders"."

#### User Actions
- **Primary Button**: "Check Orders" - Navigates to Orders screen and logs analytics event
- **Secondary Button**: "OK" - Dismisses the modal

### 4. Modal Implementation
```typescript
<Modal
  visible={isTimeoutModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setIsTimeoutModalVisible(false)}
>
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <MaterialCommunityIcons 
        name="clock-alert-outline" 
        size={48} 
        color="#f59e0b" 
        style={{ marginBottom: 16 }} 
      />
      <Text style={styles.modalTitle}>Verification Taking Longer</Text>
      <Text style={styles.modalMessage}>
        Payment verification is taking longer than expected. 
        Please check your order status in "My Orders".
      </Text>
      <TouchableOpacity
        style={styles.modalButton}
        onPress={() => {
          setIsTimeoutModalVisible(false);
          logEvent('payment_timeout_check_orders', { orderId: pendingPaymentOrderId });
          navigation.navigate('Orders');
        }}
      >
        <Text style={styles.modalButtonText}>Check Orders</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modalButton, styles.modalButtonSecondary]}
        onPress={() => setIsTimeoutModalVisible(false)}
      >
        <Text style={[styles.modalButtonText, styles.modalButtonSecondaryText]}>OK</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

## Requirements Validation

### Task 13.2 Requirements ✅
- ✅ Create alert for timeout scenario
- ✅ Show "Verification Taking Longer" title
- ✅ Show message: "Please check your order status in My Orders"
- ✅ Add "Check Orders" button that navigates to Orders screen

### US-002 Acceptance Criteria ✅
- ✅ If timeout, user sees "Check order status" message
- ✅ User has clear path to check their order status
- ✅ User is not blocked or stuck in loading state

## User Experience Flow

1. **Payment Initiated**: User completes payment in UPI app and returns to merchant app
2. **Verification Starts**: App shows "Verifying Payment" modal with loading spinner
3. **Polling**: App polls backend every 2 seconds for payment status
4. **Timeout (40s)**: After 20 attempts, verification modal closes
5. **Timeout Modal Shown**: User sees timeout modal with clear message
6. **User Action**: User can either:
   - Press "Check Orders" to navigate to Orders screen
   - Press "OK" to dismiss and stay on checkout screen

## Analytics Events

The implementation logs the following analytics events:
- `payment_verification_timeout`: When timeout occurs
- `payment_timeout_check_orders`: When user presses "Check Orders" button

## Testing

Created comprehensive unit tests in `CheckoutScreen.timeoutModal.test.tsx`:
- ✅ 19 tests covering all requirements
- ✅ All tests passing
- ✅ Validates UI elements, user actions, and integration scenarios

### Test Coverage
- Timeout modal state management
- UI element validation (title, message, buttons, icon)
- User interaction flows
- Analytics event logging
- Requirements validation

## Design Consistency

The timeout modal follows the same design pattern as other modals in the CheckoutScreen:
- Uses consistent `modalContainer` and `modalContent` styles
- Uses consistent button styles (`modalButton`, `modalButtonSecondary`)
- Uses consistent typography styles (`modalTitle`, `modalMessage`)
- Maintains visual hierarchy with icon, title, message, and action buttons

## Benefits

1. **Clear Communication**: Users understand why verification is taking longer
2. **Actionable Guidance**: Users know exactly what to do next
3. **No Dead Ends**: Users have a clear path to check their order status
4. **Consistent UX**: Modal design matches other payment-related modals
5. **Analytics Tracking**: Events logged for monitoring and optimization

## Files Modified

1. `apps/customer-app/src/screens/checkout/CheckoutScreen.tsx`
   - Added `isTimeoutModalVisible` state
   - Modified `pollPaymentStatus` to show timeout modal
   - Added timeout modal UI component

## Files Created

1. `apps/customer-app/src/__tests__/CheckoutScreen.timeoutModal.test.tsx`
   - Comprehensive unit tests for timeout modal functionality

## Next Steps

This task is complete. The timeout handling UI is fully implemented and tested. Users now have a clear, actionable path when payment verification takes longer than expected.

## Related Tasks

- Task 13.1: Update verification modal ✅ (Already completed)
- Task 11.2: Implement polling mechanism ✅ (Already completed)
- Task 12.1: Add pending payment check on app startup (In progress)

## Conclusion

Task 13.2 has been successfully completed. The timeout handling UI provides users with clear feedback and actionable guidance when payment verification takes longer than expected, improving the overall user experience and reducing confusion during the payment flow.
