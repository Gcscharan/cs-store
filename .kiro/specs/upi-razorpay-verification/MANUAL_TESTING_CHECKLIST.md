# Manual Testing Checklist — UPI Payment with Razorpay Verification

> **Requirements**: NFR-001 (Performance), NFR-002 (Reliability), NFR-003 (Security)  
> **Last Updated**: See git history  
> **Environment**: Use Razorpay **test mode** keys unless explicitly testing production

---

## Prerequisites

Before running any test scenario, ensure the following are in place:

- [ ] Backend is running and accessible (local or staging)
- [ ] Mobile app is installed on a **real Android device** (UPI Intent is Android-only)
- [ ] Razorpay test mode keys are configured in both backend and mobile app `.env`
- [ ] Razorpay webhook URL is configured in the [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → Webhooks
- [ ] At least one UPI app is installed on the test device (PhonePe, Google Pay, Paytm, or BHIM)
- [ ] Test UPI credentials are available (Razorpay provides test VPAs for sandbox)
- [ ] Backend logs are accessible (terminal or log viewer)
- [ ] A valid user account exists in the app with items in the cart

---

## Test Scenario 1: Create Order with UPI Payment

**Goal**: Verify that placing an order with UPI payment method creates a Razorpay order and stores the `razorpayOrderId`.

**Steps**:
1. Open the app and log in with a test account
2. Add one or more items to the cart
3. Navigate to Checkout
4. Select **UPI** as the payment method
5. Tap **Place Order** / **Pay Now**

**Expected Results**:
- [ ] Order is created with `paymentStatus: PENDING`
- [ ] Response includes `razorpayOrderId` (format: `order_XXXXXXXXXX`)
- [ ] Backend logs show: `"UPI payment initiated"` with `orderId` and `razorpayOrderId`
- [ ] Order appears in the database with `razorpayOrderId` populated
- [ ] No order is marked `PAID` at this stage

**Verification**:
- Check backend logs for Razorpay order creation
- Query the database: `db.orders.findOne({ _id: <orderId> })` — confirm `razorpayOrderId` is set
- Check Razorpay Dashboard → Orders — the order should appear with status `Created`

---

## Test Scenario 2: Razorpay UPI Intent Opens with App List

**Goal**: Verify that the Razorpay SDK opens and displays available UPI apps on the device.

**Steps**:
1. Complete steps 1–5 from Scenario 1
2. Observe the screen after tapping **Pay Now**

**Expected Results**:
- [ ] Razorpay checkout sheet appears (bottom sheet or full screen)
- [ ] UPI Intent option is shown
- [ ] A list of installed UPI apps is displayed (PhonePe, Google Pay, Paytm, BHIM — whichever are installed)
- [ ] App icons and names are correctly displayed
- [ ] No `upi://pay` deep link is used (verify by checking that Razorpay SDK handles the flow)

**Verification**:
- Confirm the Razorpay checkout UI appears (not a raw UPI deep link prompt)
- If a specific app was pre-selected via `_[app]`, confirm that app is highlighted

---

## Test Scenario 3: Selecting PhonePe / Google Pay from the List

**Goal**: Verify that selecting a specific UPI app from the Razorpay list correctly opens that app.

**Steps**:
1. Complete steps 1–5 from Scenario 1
2. When the Razorpay UPI app list appears, tap **PhonePe**
3. Repeat the test, this time selecting **Google Pay**

**Expected Results**:
- [ ] Tapping PhonePe opens the PhonePe app with pre-filled payment details
- [ ] Tapping Google Pay opens the Google Pay app with pre-filled payment details
- [ ] Payment amount matches the order total
- [ ] Merchant name is displayed correctly (e.g., "Vyapara Setu")
- [ ] The UPI transaction reference is the Razorpay order ID

**Verification**:
- Confirm the correct app opens (not a generic UPI chooser)
- Confirm the amount shown in the UPI app matches the order total
- Confirm the merchant name is correct

---

## Test Scenario 4: Completing Payment in UPI App

**Goal**: Verify that completing a payment in the UPI app is tracked by Razorpay.

**Steps**:
1. Complete steps 1–3 from Scenario 3 (select PhonePe or Google Pay)
2. In the UPI app, enter the test UPI PIN and confirm the payment
3. Wait for the UPI app to show a success screen

**Expected Results**:
- [ ] Payment is accepted by the UPI app
- [ ] UPI app shows a success/confirmation screen
- [ ] Razorpay Dashboard → Payments shows the payment with status `Captured`
- [ ] The payment is linked to the correct Razorpay order ID

**Verification**:
- Check Razorpay Dashboard → Payments — find the payment by order ID
- Confirm `status: captured` and `method: upi`
- Note the `razorpayPaymentId` (format: `pay_XXXXXXXXXX`) for use in subsequent checks

---

## Test Scenario 5: Returning to App and Payment Verification

**Goal**: Verify that after returning from the UPI app, the merchant app polls for payment status and correctly marks the order as PAID.

**Steps**:
1. Complete Scenario 4 (payment successful in UPI app)
2. Return to the merchant app (tap back or switch apps)
3. Observe the merchant app's behavior

**Expected Results**:
- [ ] App shows a **"Verifying Payment"** loading modal immediately upon return
- [ ] Modal displays: "Please wait while we confirm your payment with the bank"
- [ ] Modal displays: "Do not close the app or press back"
- [ ] Polling starts (visible in backend logs: `"Polling attempt 1/20"`)
- [ ] Within ~40 seconds, the order status changes to `PAID`
- [ ] App navigates to the **Order Success** screen
- [ ] `pendingPaymentOrderId` is cleared from AsyncStorage after success
- [ ] Backend logs show: `"Payment verified"` with `verificationMethod: polling`

**Verification**:
- Watch backend logs for polling attempts
- Query the database: confirm `paymentStatus: PAID`, `razorpayPaymentId` is set, `paymentVerifiedAt` is set
- Confirm the Order Success screen shows the correct order details

**Performance Check (NFR-001)**:
- [ ] Verification completes within **40 seconds** of returning to the app
- [ ] API response time for `/api/payments/verify/:orderId` is **< 500ms** (check backend logs or network tab)

---

## Test Scenario 6: App Kill During Payment

**Goal**: Verify that if the app is killed while the user is in the UPI app, payment verification resumes when the app is reopened.

**Steps**:
1. Complete steps 1–3 from Scenario 3 (UPI app is open, payment not yet completed)
2. **Force-close the merchant app** (swipe away from recent apps)
3. Complete the payment in the UPI app
4. Reopen the merchant app

**Expected Results**:
- [ ] On app restart, the app detects `pendingPaymentOrderId` in AsyncStorage
- [ ] App automatically resumes polling for the pending order
- [ ] If payment was successful, app navigates to Order Success screen
- [ ] If payment is still pending, app shows verification loading state
- [ ] Stale pending orders (> 1 hour old) are automatically cleared

**Verification**:
- Before killing the app, confirm `pendingPaymentOrderId` is stored (check AsyncStorage via React Native Debugger or logs)
- After reopening, watch logs for: `"Resuming payment verification for: <orderId>"`
- Confirm the order is eventually marked `PAID`

**Reliability Check (NFR-002)**:
- [ ] App kill does **not** result in a lost payment
- [ ] Verification resumes correctly 100% of the time

---

## Test Scenario 7: Webhook Delivery

**Goal**: Verify that Razorpay webhooks are received, signature-verified, and correctly update the order status.

**Prerequisites**:
- Webhook URL is configured in Razorpay Dashboard (must be a publicly accessible URL)
- `RAZORPAY_WEBHOOK_SECRET` is set in backend `.env`

**Steps**:
1. Complete a payment (Scenarios 1–4)
2. In the Razorpay Dashboard → Webhooks, find the webhook event for `payment.captured`
3. Check the webhook delivery status
4. Optionally, use the **"Resend"** button in the Razorpay Dashboard to resend the webhook

**Expected Results**:
- [ ] Webhook is delivered to `POST /api/webhooks/razorpay`
- [ ] Backend returns `200 OK` to Razorpay
- [ ] Backend logs show: `"Payment captured via webhook"` with `orderId` and `razorpayPaymentId`
- [ ] Order `paymentStatus` is updated to `PAID` (if not already updated by polling)
- [ ] Resending the same webhook (duplicate) is handled idempotently — no duplicate updates, returns `200 OK`

**Security Check (NFR-003)**:
- [ ] Send a webhook request with an **invalid signature** — backend must return `401 Unauthorized`
- [ ] Send a webhook request with a **missing signature header** — backend must return `401 Unauthorized`

**Verification**:
- Check backend logs for webhook receipt and processing
- Query the database to confirm `paymentStatus: PAID`
- Test idempotency: resend the same webhook and confirm no errors and no duplicate state changes

---

## Test Scenario 8: Timeout Scenario (Delay Payment)

**Goal**: Verify that if payment is not completed within 40 seconds, the app handles the timeout gracefully.

**Steps**:
1. Complete steps 1–2 from Scenario 1 (order created, Razorpay opens)
2. **Do not complete the payment** in the UPI app — leave it pending
3. Return to the merchant app without completing payment
4. Wait for the polling to exhaust all 20 attempts (~40 seconds)

**Expected Results**:
- [ ] App polls for 20 attempts over ~40 seconds
- [ ] After 20 attempts, polling stops
- [ ] App shows an alert: **"Verification Taking Longer"**
- [ ] Alert message: "Payment verification is taking longer than expected. Please check your order status in 'My Orders'."
- [ ] Alert has a **"Check Orders"** button that navigates to the Orders screen
- [ ] Alert has an **"OK"** button to dismiss
- [ ] Order remains in `PENDING` state (not marked FAILED)
- [ ] Backend logs show all 20 polling attempts

**Performance Check (NFR-001)**:
- [ ] Timeout occurs at exactly 40 seconds (20 attempts × 2 seconds)

**Verification**:
- Watch backend logs to count polling attempts (should be exactly 20)
- Confirm the timeout alert appears after ~40 seconds
- Confirm the order is still `PENDING` in the database

---

## Test Scenario 9: Network Failure During Polling

**Goal**: Verify that the app handles network failures during polling gracefully and continues polling when connectivity is restored.

**Steps**:
1. Complete a payment in the UPI app (Scenario 4)
2. Return to the merchant app — polling starts
3. **Disable network connectivity** on the device (airplane mode or Wi-Fi off) after 2–3 polling attempts
4. Wait 5–10 seconds
5. **Re-enable network connectivity**
6. Observe polling behavior

**Expected Results**:
- [ ] Polling attempts that fail due to network error are logged: `"Polling attempt X failed: <network error>"`
- [ ] App does **not** crash or show an unhandled error
- [ ] Polling continues after network errors (does not stop early)
- [ ] When network is restored, polling resumes and eventually verifies the payment
- [ ] If all 20 attempts are exhausted (including failed ones), timeout message is shown

**Reliability Check (NFR-002)**:
- [ ] Network failures do **not** cause the app to crash
- [ ] Polling is resilient to intermittent connectivity

**Verification**:
- Watch backend logs — failed attempts should show network errors, not server errors
- Confirm the app remains on the verification screen during network outage
- Confirm polling resumes after connectivity is restored

---

## Security Validation Summary

> **Requirement**: NFR-003

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Frontend cannot call an endpoint to mark order as PAID | No such endpoint exists | |
| Webhook with invalid signature returns 401 | `401 Unauthorized` | |
| Webhook with missing signature returns 401 | `401 Unauthorized` | |
| Duplicate webhook is processed idempotently | `200 OK`, no duplicate DB update | |
| Order can only be marked PAID by backend verification | Confirmed via code review | |
| `razorpayOrderId` is validated against the order | Confirmed via webhook handler | |

---

## Performance Validation Summary

> **Requirement**: NFR-001

| Metric | Target | Measured | Pass/Fail |
|--------|--------|----------|-----------|
| Payment verification time (polling) | ≤ 40 seconds | | |
| `/api/payments/verify/:orderId` response time | < 500ms | | |
| `/api/webhooks/razorpay` processing time | < 5 seconds | | |
| Polling interval | 2 seconds | | |
| Maximum polling attempts | 20 | | |

---

## Reliability Validation Summary

> **Requirement**: NFR-002

| Scenario | Expected | Pass/Fail |
|----------|----------|-----------|
| App kill during payment — verification resumes on restart | ✅ Verified | |
| Network failure during polling — polling continues | ✅ Resilient | |
| Duplicate webhook — idempotent processing | ✅ No duplicates | |
| Timeout — graceful degradation with user guidance | ✅ Alert shown | |

---

## Notes for Testers

- **Test mode UPI**: Use Razorpay's test UPI credentials. In test mode, any UPI PIN works for success. Use specific test VPAs to simulate failures.
- **Webhook testing locally**: Use [ngrok](https://ngrok.com) or [Razorpay's webhook simulator](https://dashboard.razorpay.com) to test webhooks in local development.
- **iOS**: UPI Intent is Android-only. On iOS, Razorpay shows a QR code instead. Test UPI Intent exclusively on Android devices.
- **Real device required**: UPI Intent does not work on emulators. Always test on a physical Android device.
- **Razorpay test cards/VPAs**: Refer to [Razorpay Test Mode documentation](https://razorpay.com/docs/payments/payments/test-card-upi-details/) for test UPI IDs and PINs.
