# UPI Razorpay-Only Revert — Bugfix Design

## Overview

The `handleUpiPayment` function in `apps/customer-app/src/screens/checkout/CheckoutScreen.tsx`
accumulated hybrid UPI deep-link complexity that causes `BAD_REQUEST` errors and an
inconsistent two-path payment flow. The fix reverts the function to a clean,
Razorpay-SDK-only implementation.

**Bug**: The function attempts to construct and open a `upi://pay` deep link via
`Linking.openURL()` before falling back to Razorpay, using `EXPO_PUBLIC_MERCHANT_UPI_VPA`
as the merchant address. When that VPA is missing or rejected, the payment fails with a
`BAD_REQUEST` error. The fallback path also sets `show_default_blocks: false`, hiding the
standard PhonePe / Google Pay / Paytm selection UI.

**Fix strategy**: Remove `constructUpiDeepLink()`, `fallbackToRazorpayIntent()`,
`Linking.openURL()`, and all `EXPO_PUBLIC_MERCHANT_UPI_VPA` references. Open
`RazorpayCheckout` directly with `show_default_blocks: true` and UPI-only method
restrictions. All downstream logic (order creation, AsyncStorage, polling, error handling,
COD, address, coupons) is unchanged.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the hybrid deep-link path is
  active, meaning `constructUpiDeepLink()` is called, `Linking.openURL()` is invoked with a
  `upi://` URL, `fallbackToRazorpayIntent()` is invoked, or `EXPO_PUBLIC_MERCHANT_UPI_VPA`
  is read during payment initiation.
- **Property (P)**: The desired behavior when a UPI payment is initiated — `RazorpayCheckout.open()`
  is called directly with `show_default_blocks: true`, no deep-link construction, no
  `Linking.openURL()`, and no merchant VPA env-var read.
- **Preservation**: All non-payment-initiation logic that must remain unchanged: order
  creation, AsyncStorage persistence, `pollPaymentStatus()`, error handling, COD flow,
  address/coupon management, and backend webhook/verification endpoints.
- **handleUpiPayment**: The async function in `CheckoutScreen.tsx` that initiates a UPI
  payment for a selected UPI app.
- **RazorpayCheckout.open**: The Razorpay React Native SDK call that presents the Razorpay
  payment sheet to the user.
- **show_default_blocks**: A Razorpay config flag (`config.display.preferences.show_default_blocks`)
  that, when `true`, causes Razorpay to display its standard UPI app selection UI (PhonePe,
  GPay, Paytm, etc.).
- **pollPaymentStatus**: The existing polling function (20 attempts × 2 s = 40 s window)
  that verifies payment status from the backend after Razorpay returns.

---

## Bug Details

### Bug Condition

The bug manifests whenever `handleUpiPayment` is called and the hybrid deep-link path
executes. The function either attempts to construct a `upi://pay` URL using
`EXPO_PUBLIC_MERCHANT_UPI_VPA` (which may be missing or misconfigured), calls
`Linking.openURL()` to open that URL, or invokes `fallbackToRazorpayIntent()` with
`show_default_blocks: false` — all of which are unnecessary when Razorpay handles the
full UPI flow.

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type UpiPaymentAttempt
  OUTPUT: boolean

  RETURN X.usesDirectUpiDeepLink = true
      OR X.usesMerchantVpaEnvVar = true
      OR X.callsFallbackToRazorpayIntent = true
      OR X.callsLinkingOpenURL = true
END FUNCTION
```

### Examples

- **Example 1 — Missing VPA**: User taps "Pay with PhonePe". `EXPO_PUBLIC_MERCHANT_UPI_VPA`
  is undefined. `constructUpiDeepLink()` produces a malformed URL. `Linking.openURL()` fails
  or the UPI app rejects the request with `BAD_REQUEST`. Expected: Razorpay sheet opens
  directly showing PhonePe, GPay, Paytm.

- **Example 2 — VPA present but rejected**: `EXPO_PUBLIC_MERCHANT_UPI_VPA` is set to a
  test VPA not accepted by the target UPI app. The deep link opens the UPI app but the
  payment is rejected. Expected: Razorpay handles merchant routing internally; no VPA
  needed in the app.

- **Example 3 — Fallback hides app selection**: `Linking.canOpenURL()` returns false.
  `fallbackToRazorpayIntent()` is called with `show_default_blocks: false`. The Razorpay
  sheet opens but hides PhonePe / GPay / Paytm. Expected: `show_default_blocks: true` so
  all UPI apps are visible.

- **Edge case — `other` UPI app**: User selects "Other UPI App" and enters a verified VPA.
  The VPA gate check must still run before opening Razorpay. Expected: gate check passes,
  Razorpay opens with `show_default_blocks: true`; no deep-link construction.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Order creation via `createOrder()` API call with idempotency key, `addressId`, and
  optional `couponCode` must continue to work exactly as before.
- Pending order persistence to `AsyncStorage` under `pendingPaymentOrderId` and
  `pendingPaymentTimestamp` must continue to work exactly as before.
- `pollPaymentStatus(orderId, selectedApp)` with 20 attempts at 2-second intervals must
  continue to work exactly as before.
- App-kill recovery via `AsyncStorage` detection on restart must continue to work exactly
  as before.
- COD flow via `handleCodPayment()` must be completely unaffected.
- Address selection, coupon application, and cart management must be completely unaffected.
- Backend webhook handler and payment verification endpoint must be completely unaffected.
- Error handling for `PAYMENT_CANCELLED`, `NETWORK_ERROR`, and `400` responses must
  continue to work exactly as before.
- The `other` UPI VPA gate check (require verified VPA before proceeding) must continue
  to work exactly as before.
- Analytics/logging calls (`logEvent`, `console.log`) must continue to fire at the same
  points with the same payloads.

**Scope:**

All inputs that do NOT involve the hybrid deep-link path (i.e., all non-payment-initiation
logic) should be completely unaffected by this fix. This includes:

- COD order placement
- Address selection and management
- Coupon validation and application
- Cart item display and stock checks
- UPI VPA verification for the `other` option
- Backend order creation, webhook processing, and payment verification

---

## Hypothesized Root Cause

Based on the bug description and code inspection, the most likely issues are:

1. **Unnecessary deep-link construction**: `constructUpiDeepLink()` builds a `upi://pay`
   URL using `EXPO_PUBLIC_MERCHANT_UPI_VPA`. This env var is not reliably set in all
   environments, causing the URL to be malformed or the payment to be routed to the wrong
   merchant VPA.

2. **Fragile two-path flow**: The primary path (`Linking.openURL`) and fallback path
   (`fallbackToRazorpayIntent`) have divergent option sets. The fallback sets
   `show_default_blocks: false`, which hides the standard UPI app selection UI that
   Razorpay provides by default — degrading UX even in the "working" fallback case.

3. **Redundant intent flags**: The current Razorpay options include `upi.flow: 'intent'`,
   `intent: true`, `upi.preferred_app`, and `options['_[app]']`. These are unnecessary
   when `show_default_blocks: true` is set, and some may conflict with Razorpay's internal
   routing logic.

4. **Razorpay already handles UPI app selection natively**: When `method.upi = true` and
   `show_default_blocks: true`, Razorpay's SDK presents PhonePe, GPay, Paytm, and other
   installed UPI apps without any deep-link construction on the app side. The entire
   hybrid path is redundant.

---

## Correctness Properties

Property 1: Bug Condition — Razorpay-Only UPI Initiation

_For any_ UPI payment attempt where the bug condition holds (i.e., the current code would
invoke `constructUpiDeepLink()`, `Linking.openURL()`, `fallbackToRazorpayIntent()`, or read
`EXPO_PUBLIC_MERCHANT_UPI_VPA`), the fixed `handleUpiPayment` function SHALL instead call
`RazorpayCheckout.open(options)` directly with:
- `config.display.preferences.show_default_blocks: true`
- `method: { upi: true, card: false, netbanking: false, wallet: false }`
- `prefill: { contact, name }` from user/address state
- `theme: { color: '#3399cc' }`
- No `upi.flow`, `intent`, `upi.preferred_app`, or `options['_[app]']` fields
- No reference to `EXPO_PUBLIC_MERCHANT_UPI_VPA`

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Non-Payment-Initiation Behavior Unchanged

_For any_ input where the bug condition does NOT hold (i.e., all logic outside the
deep-link/fallback path: order creation, AsyncStorage, polling, error handling, COD,
address, coupons, analytics), the fixed `handleUpiPayment` function SHALL produce exactly
the same behavior as the original function, preserving all existing downstream logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

---

## Fix Implementation

### Changes Required

**File**: `apps/customer-app/src/screens/checkout/CheckoutScreen.tsx`

**Function**: `handleUpiPayment`

**Specific Changes**:

1. **Remove deep-link construction**: Delete any call to `constructUpiDeepLink()` and the
   `upi://pay` URL assembly logic. Remove the `EXPO_PUBLIC_MERCHANT_UPI_VPA` read.

2. **Remove `Linking.openURL()` call**: Delete the `Linking.canOpenURL()` check and the
   `Linking.openURL(upiUrl)` call. The `Linking` import can be removed from the file if
   it is no longer used elsewhere.

3. **Remove `fallbackToRazorpayIntent()`**: Delete the fallback function and its
   invocation. The Razorpay options previously in the fallback become the single set of
   options used directly.

4. **Update Razorpay options**:
   - Set `config.display.preferences.show_default_blocks: true`
   - Keep `method: { upi: true, card: false, netbanking: false, wallet: false }`
   - Keep `prefill: { contact: user?.phone || selectedAddress?.phone || '9999999999', name: user?.name || selectedAddress?.name || 'Customer' }`
   - Add `theme: { color: '#3399cc' }`
   - Remove `upi: { flow: 'intent' }`, `intent: true`, `upi.preferred_app`, `options['_[app]']`

5. **Call `RazorpayCheckout.open(options)` directly**: After order creation and
   AsyncStorage persistence (Steps 1–3 in the existing function), open Razorpay directly.
   On success, call `pollPaymentStatus(orderId, selectedApp)` as before.

6. **Preserve all other logic unchanged**: The `other` VPA gate check, idempotency key
   generation, order creation payload, AsyncStorage writes, `saveLastUsedUpiApp()`,
   `pollPaymentStatus()` call, and all error-handling branches remain identical.

**Resulting `handleUpiPayment` structure (pseudocode)**:

```
handleUpiPayment(selectedApp):
  setIsPlacingOrder(true)
  clear stale AsyncStorage keys                          // unchanged
  logEvent('checkout_started', ...)                      // unchanged

  if selectedApp.id === 'other':
    gate-check upiVpa and upiVerified                    // unchanged

  idempotencyKey = timestamp-based unique key            // unchanged
  orderPayload = { paymentMethod: 'upi', idempotencyKey, ... }  // unchanged
  res = await createOrder(orderPayload).unwrap()         // unchanged

  orderId = res.order._id
  razorpayOrderId = res.order.razorpayOrderId

  await AsyncStorage.setItem('pendingPaymentOrderId', orderId)   // unchanged
  await AsyncStorage.setItem('pendingPaymentTimestamp', ...)      // unchanged
  await saveLastUsedUpiApp(selectedApp.id)                        // unchanged

  razorpayKey = Constants.expoConfig.extra.EXPO_PUBLIC_RAZORPAY_KEY_ID

  options = {
    key: razorpayKey,
    amount: Math.round(res.order.totalAmount * 100),
    currency: 'INR',
    order_id: razorpayOrderId,
    method: { upi: true, card: false, netbanking: false, wallet: false },
    prefill: { contact: user?.phone || selectedAddress?.phone || '9999999999',
               name:    user?.name  || selectedAddress?.name  || 'Customer' },
    config: { display: { preferences: { show_default_blocks: true } } },
    theme: { color: '#3399cc' },
    // NO upi.flow, NO intent, NO upi.preferred_app, NO options['_[app]']
    // NO EXPO_PUBLIC_MERCHANT_UPI_VPA
  }

  data = await RazorpayCheckout.open(options)            // direct open, no deep link
  logEvent('razorpay_payment_initiated', ...)            // unchanged

  await pollPaymentStatus(orderId, selectedApp)          // unchanged

  catch (error):
    // all existing error branches unchanged
    // PAYMENT_CANCELLED → recovery modal
    // NETWORK_ERROR → Alert
    // 400 → Alert
    // other → Alert + recovery modal

  finally:
    setIsPlacingOrder(false)
```

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that
demonstrate the bug on unfixed code, then verify the fix works correctly and preserves
existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix.
Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that mock `handleUpiPayment` internals and assert that
`Linking.openURL` is NOT called and `RazorpayCheckout.open` IS called with
`show_default_blocks: true`. Run these tests on the UNFIXED code to observe failures and
confirm the root cause.

**Test Cases**:

1. **Direct deep-link test**: Call `handleUpiPayment` with `selectedApp = gpay` on unfixed
   code. Assert `Linking.openURL` is called with a `upi://pay` URL. (Will pass on unfixed
   code — confirms bug exists.)

2. **Missing VPA test**: Set `EXPO_PUBLIC_MERCHANT_UPI_VPA` to `undefined`. Call
   `handleUpiPayment`. Assert a `BAD_REQUEST`-style error is thrown or the payment fails.
   (Will pass on unfixed code — confirms VPA dependency.)

3. **show_default_blocks test**: Call `handleUpiPayment` on unfixed code. Capture the
   Razorpay options passed to `RazorpayCheckout.open` (via fallback). Assert
   `show_default_blocks` is `false`. (Will pass on unfixed code — confirms UX regression.)

4. **`other` app gate check**: Call `handleUpiPayment` with `selectedApp = other` and no
   verified VPA. Assert early return with Alert. (Should pass on both unfixed and fixed
   code — confirms preservation.)

**Expected Counterexamples**:

- `Linking.openURL` is invoked with a `upi://pay` URL before `RazorpayCheckout.open`
- `EXPO_PUBLIC_MERCHANT_UPI_VPA` is read during payment initiation
- `show_default_blocks` is `false` in the Razorpay options passed to the fallback

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function
produces the expected behavior.

**Pseudocode:**

```
FOR ALL X WHERE isBugCondition(X) DO
  result := handleUpiPayment_fixed(X)
  ASSERT result.calledLinkingOpenURL = false
     AND result.readMerchantVpaEnvVar = false
     AND result.calledFallbackToRazorpayIntent = false
     AND result.razorpayOptions.show_default_blocks = true
     AND result.razorpayOptions.method.upi = true
     AND result.razorpayOptions.method.card = false
     AND result.razorpayOptions.method.netbanking = false
     AND result.razorpayOptions.method.wallet = false
     AND result.openedRazorpayDirectly = true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed
function produces the same result as the original function.

**Pseudocode:**

```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleUpiPayment_original(X) = handleUpiPayment_fixed(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking
because:

- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for order creation, AsyncStorage
writes, polling, and error handling, then write property-based tests capturing that
behavior.

**Test Cases**:

1. **Order creation preservation**: Verify `createOrder()` is called with the same payload
   shape (idempotency key, `paymentMethod: 'upi'`, optional `upiVpa`, optional
   `couponCode`) on both unfixed and fixed code.

2. **AsyncStorage preservation**: Verify `pendingPaymentOrderId` and
   `pendingPaymentTimestamp` are written to `AsyncStorage` with the same values on both
   unfixed and fixed code.

3. **Polling preservation**: Verify `pollPaymentStatus(orderId, selectedApp)` is called
   with the same arguments after `RazorpayCheckout.open` succeeds on both unfixed and
   fixed code.

4. **Error handling preservation**: Verify that `PAYMENT_CANCELLED` triggers the recovery
   modal, `NETWORK_ERROR` triggers an Alert, and `400` triggers an order-creation-failed
   Alert — identically on both unfixed and fixed code.

5. **`other` VPA gate preservation**: Verify that calling `handleUpiPayment` with
   `selectedApp.id === 'other'` and no verified VPA triggers an early return with an Alert
   on both unfixed and fixed code.

### Unit Tests

- Test that `RazorpayCheckout.open` is called with `show_default_blocks: true` on the
  fixed code
- Test that `Linking.openURL` is never called on the fixed code
- Test that `EXPO_PUBLIC_MERCHANT_UPI_VPA` is never read on the fixed code
- Test the `other` UPI VPA gate check (no VPA → Alert + early return)
- Test error branches: cancellation → recovery modal, network error → Alert, 400 → Alert

### Property-Based Tests

- Generate random `selectedApp` values (gpay, phonepe, paytm, bhim, other with verified
  VPA) and verify that `RazorpayCheckout.open` is always called with
  `show_default_blocks: true` and UPI-only method restrictions
- Generate random order amounts and verify the `amount` passed to Razorpay is always
  `Math.round(totalAmount * 100)` (paise conversion)
- Generate random user/address states and verify `prefill.contact` and `prefill.name` are
  always populated with a non-empty fallback value

### Integration Tests

- Full UPI payment flow: order creation → Razorpay open → polling → success navigation
- App-kill recovery: order creation → AsyncStorage write → simulated restart → polling
  resumes
- Cancellation flow: Razorpay returns `PAYMENT_CANCELLED` → recovery modal shown
- COD flow: verify `handleCodPayment()` is completely unaffected by the fix
