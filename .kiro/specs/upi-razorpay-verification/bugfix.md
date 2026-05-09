# Bugfix Requirements Document

## Introduction

The `handleUpiPayment` function in `apps/customer-app/src/screens/checkout/CheckoutScreen.tsx`
has accumulated hybrid UPI deep-link complexity that is causing instability and `BAD_REQUEST`
errors in production. Specifically, the function now contains direct `upi://pay` deep-link
construction (`constructUpiDeepLink()`), a `fallbackToRazorpayIntent()` helper, calls to
`Linking.openURL()`, and a dependency on the `EXPO_PUBLIC_MERCHANT_UPI_VPA` environment
variable — none of which are needed when Razorpay handles the full UPI flow.

This bugfix reverts the UPI payment initiation path to a clean, Razorpay-SDK-only
implementation. Razorpay already surfaces PhonePe, Google Pay, Paytm, and other UPI apps
natively when `method.upi = true` and `config.display.preferences.show_default_blocks = true`
are set. All downstream logic (polling, app-kill recovery, backend verification, webhooks)
remains unchanged.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user initiates a UPI payment THEN the system attempts to construct and open a
    direct `upi://pay` deep link via `Linking.openURL()`, bypassing the Razorpay SDK for
    the primary payment path.

1.2 WHEN the direct `upi://pay` deep link is opened THEN the system uses
    `EXPO_PUBLIC_MERCHANT_UPI_VPA` as the merchant payment address, causing a
    `BAD_REQUEST` error when the VPA is missing, misconfigured, or not accepted by the
    target UPI app.

1.3 WHEN `Linking.canOpenURL()` returns false or the deep link fails THEN the system
    falls back to `fallbackToRazorpayIntent()`, introducing an inconsistent two-path
    payment flow that is difficult to debug and maintain.

1.4 WHEN the Razorpay fallback is triggered THEN the system sets
    `config.display.preferences.show_default_blocks: false`, which hides the standard
    PhonePe / Google Pay / Paytm selection UI that Razorpay provides by default.

### Expected Behavior (Correct)

2.1 WHEN a user initiates a UPI payment THEN the system SHALL open the Razorpay SDK
    directly (without attempting any `upi://pay` deep link first), presenting the
    standard Razorpay UPI app selection screen.

2.2 WHEN the Razorpay SDK is opened THEN the system SHALL pass
    `config.display.preferences.show_default_blocks: true` so that Razorpay displays
    PhonePe, Google Pay, Paytm, and other available UPI apps for the user to choose from.

2.3 WHEN the Razorpay SDK is opened THEN the system SHALL restrict payment methods to
    UPI only via `method: { upi: true, card: false, netbanking: false, wallet: false }`.

2.4 WHEN the Razorpay SDK is opened THEN the system SHALL NOT require or reference
    `EXPO_PUBLIC_MERCHANT_UPI_VPA`, `constructUpiDeepLink()`, `fallbackToRazorpayIntent()`,
    or `Linking.openURL()`.

2.5 WHEN the Razorpay payment completes successfully THEN the system SHALL call
    `pollPaymentStatus(orderId, selectedApp)` to verify the payment via the backend,
    identical to the existing verified flow.

2.6 WHEN the user cancels the Razorpay payment THEN the system SHALL display the
    recovery modal, identical to the existing cancellation handling.

2.7 WHEN a Razorpay payment error occurs THEN the system SHALL display an Alert with
    the error description, identical to the existing error handling.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a UPI payment order is created THEN the system SHALL CONTINUE TO call the
    backend order creation API and receive a `razorpayOrderId` before opening any
    payment UI.

3.2 WHEN a pending order ID is available THEN the system SHALL CONTINUE TO persist it
    to `AsyncStorage` under the key `pendingPaymentOrderId` for app-kill recovery.

3.3 WHEN a UPI payment is verified THEN the system SHALL CONTINUE TO use
    `pollPaymentStatus()` with 20 attempts at 2-second intervals (40-second total
    window) to confirm payment status from the backend.

3.4 WHEN the app is restarted after being killed during a UPI payment THEN the system
    SHALL CONTINUE TO detect the pending order in `AsyncStorage` and resume polling.

3.5 WHEN a COD order is placed THEN the system SHALL CONTINUE TO use `handleCodPayment()`
    without any changes to that flow.

3.6 WHEN address selection, coupon application, or cart management actions are performed
    THEN the system SHALL CONTINUE TO behave identically to the current implementation.

3.7 WHEN the backend receives a Razorpay webhook event THEN the system SHALL CONTINUE TO
    verify the signature and update the order payment status, with no changes to the
    webhook handler.

3.8 WHEN the backend payment verification API is called THEN the system SHALL CONTINUE TO
    return the correct `paymentStatus` for the given `orderId`, with no changes to the
    verification endpoint.

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type UpiPaymentAttempt
  OUTPUT: boolean

  // Bug is triggered whenever the hybrid deep-link path is active:
  // - constructUpiDeepLink() is called, OR
  // - Linking.openURL() is called with a upi:// URL, OR
  // - fallbackToRazorpayIntent() is invoked, OR
  // - EXPO_PUBLIC_MERCHANT_UPI_VPA is read during payment initiation
  RETURN X.usesDirectUpiDeepLink = true
      OR X.usesMerchantVpaEnvVar = true
      OR X.callsFallbackToRazorpayIntent = true
END FUNCTION
```

**Fix Checking Property**:
```pascal
// Property: Fix Checking — Razorpay-only path is used
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleUpiPayment'(X)
  ASSERT result.openedRazorpayDirectly = true
     AND result.calledLinkingOpenURL = false
     AND result.readMerchantVpaEnvVar = false
     AND result.showDefaultBlocks = true
END FOR
```

**Preservation Property**:
```pascal
// Property: Preservation Checking — non-payment flows unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleUpiPayment(X) = handleUpiPayment'(X)
END FOR
```
