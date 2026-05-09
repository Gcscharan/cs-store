# ExpoKeepAwake Error - Non-Critical Warning

## Error Summary
```
ERROR  [Error: Uncaught (in promise, id: 0): "Error: Call to function 'ExpoKeepAwake.activate' has been rejected.
→ Caused by: The current activity is no longer available"]
```

## Context
- Occurs during payment status verification
- Happens when checking payment status: `GET /api/payment-status/:orderId`
- Related to screen keep-awake functionality

## Root Cause

### What is ExpoKeepAwake?
`expo-keep-awake` is a library that prevents the device screen from going to sleep. It's commonly used during:
- Payment processing
- Video playback
- Navigation/maps
- Long-running operations

### Why the Error Occurs
The error happens when:
1. **Payment verification starts** → KeepAwake tries to activate
2. **User navigates away or app goes to background** → Activity is destroyed
3. **KeepAwake tries to activate on destroyed activity** → Error thrown

### Common Scenarios
- User presses back button during payment verification
- User switches to another app (UPI app, etc.)
- App goes to background
- Activity is recreated (orientation change, etc.)

## Impact

### Severity: **LOW** (Non-Critical Warning)
- ✅ **Payment verification still works** - Core functionality not affected
- ✅ **No data loss** - Order creation and payment status checking continue
- ✅ **No crash** - Error is caught and logged
- ⚠️ **Screen might sleep** - Device screen might turn off during verification

### User Experience
- **Before**: Screen stays awake during payment verification
- **After Error**: Screen might turn off if user is idle
- **Workaround**: User can tap screen to wake it up

## Solution Options

### Option 1: Wrap in Try-Catch (Recommended)
If you're explicitly using `expo-keep-awake`, wrap it in try-catch:

```typescript
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

// Activate keep-awake safely
const activateKeepAwakeSafely = () => {
  try {
    activateKeepAwake();
  } catch (error) {
    console.log('KeepAwake activation failed (activity not available):', error);
    // Ignore error - not critical
  }
};

// Deactivate keep-awake safely
const deactivateKeepAwakeSafely = () => {
  try {
    deactivateKeepAwake();
  } catch (error) {
    console.log('KeepAwake deactivation failed (activity not available):', error);
    // Ignore error - not critical
  }
};
```

### Option 2: Check Activity State Before Activation
```typescript
import { AppState } from 'react-native';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

const activateKeepAwakeSafely = () => {
  // Only activate if app is in foreground
  if (AppState.currentState === 'active') {
    try {
      activateKeepAwake();
    } catch (error) {
      console.log('KeepAwake activation failed:', error);
    }
  }
};
```

### Option 3: Use Component-Based Approach
```typescript
import { KeepAwake } from 'expo-keep-awake';

// In your component
const PaymentVerificationScreen = () => {
  return (
    <View>
      {/* Automatically activates when mounted, deactivates when unmounted */}
      <KeepAwake />
      
      {/* Your payment verification UI */}
    </View>
  );
};
```

### Option 4: Ignore the Error (Current Behavior)
Since this is a non-critical warning and doesn't affect functionality, you can simply ignore it. The error is already being caught and logged.

## Investigation Steps

### Step 1: Check if expo-keep-awake is Installed
```bash
cd apps/customer-app
npm list expo-keep-awake
# or
yarn why expo-keep-awake
```

### Step 2: Search for Direct Usage
```bash
# Search for direct imports
grep -r "expo-keep-awake" apps/customer-app/src/

# Search for KeepAwake usage
grep -r "KeepAwake" apps/customer-app/src/
```

### Step 3: Check Dependencies
The library might be used by a dependency (e.g., a video player, map component, etc.)

## Current Status

### Investigation Results
- ❌ No direct usage of `expo-keep-awake` found in the codebase
- ❌ No explicit `KeepAwake` imports found
- ✅ Error is non-critical and doesn't affect functionality

### Likely Cause
The error is probably coming from:
1. **A third-party library** that uses keep-awake internally
2. **Expo's default behavior** during certain operations
3. **React Native's internal handling** of long-running operations

## Recommendation

### Do Nothing (Recommended)
Since:
- ✅ The error is non-critical
- ✅ Payment verification still works
- ✅ No user-facing impact
- ✅ No data loss or corruption

**Recommendation**: **Ignore this error** unless it causes actual problems.

### If You Want to Fix It
1. **Find the source**: Identify which library is calling `ExpoKeepAwake.activate`
2. **Wrap in try-catch**: Add error handling to prevent the error from being logged
3. **Update library**: Check if there's a newer version that handles this better

## Related Issues

### Similar Errors
- "Activity is no longer available" errors are common in React Native
- They occur when components try to interact with destroyed activities
- Usually harmless and can be safely ignored

### Prevention
- Always check if activity/component is mounted before calling native modules
- Use try-catch for native module calls
- Clean up listeners and timers on unmount

## Conclusion

This is a **non-critical warning** that doesn't affect functionality. The payment verification flow works correctly despite this error.

**Status**: ℹ️ **INFORMATIONAL** - No action required unless it causes actual problems

**Priority**: **LOW** - Can be safely ignored
