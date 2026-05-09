# UPI Payment with Hybrid Tier-1 Architecture - Requirements

## Overview

Implement a **Hybrid Tier-1 UPI payment flow** (used by Amazon, Flipkart, Zomato) where the mobile app attempts direct UPI deep links as the primary method for instant app opening, with Razorpay as a secure fallback for verification and safety net.

**CRITICAL ARCHITECTURE DECISION**: This spec uses **Hybrid Architecture**, NOT Razorpay-only. 

**Primary Flow (90-95% of users)**:
- ✅ Direct UPI deep link (`upi://pay`) - 100% instant opening
- ✅ Backend verification via Razorpay webhook + polling
- ✅ Zero intermediate UI, maximum speed

**Fallback Flow (5-10% of users)**:
- ✅ Razorpay UPI Intent when direct link fails
- ✅ Same verification mechanism
- ✅ Safety net for edge cases

**Why Hybrid?**
- ✅ Best UX: Instant app opening (< 1 second) for majority
- ✅ Secure: All payments verified via Razorpay backend
- ✅ Reliable: Fallback ensures 100% payment success
- ✅ Industry-standard: Same as top e-commerce apps

## Business Requirements

### BR-001: Hybrid UPI Flow (Direct + Fallback)
**Priority**: P0 (Critical)
**Description**: System must attempt direct UPI deep link first for instant opening, with automatic fallback to Razorpay if direct link fails.

**Acceptance Criteria**:
- User selects UPI app from checkout screen
- System attempts direct UPI deep link (`upi://pay`) first
- If successful, UPI app opens instantly (< 1 second)
- If direct link fails, system automatically falls back to Razorpay Intent
- User completes payment in UPI app
- User returns to merchant app
- No user-visible error during fallback transition

### BR-002: Real Payment Verification
**Priority**: P0 (Critical)
**Description**: Payment must be verified by backend using Razorpay API, not by frontend assumptions.

**Acceptance Criteria**:
- Order is created with `paymentStatus: PENDING`
- Backend verifies payment using Razorpay API
- Order is marked `PAID` only after backend verification
- No fake success scenarios possible

### BR-003: Polling Mechanism
**Priority**: P0 (Critical)
**Description**: App must poll backend for payment status after user returns from UPI app.

**Acceptance Criteria**:
- App polls backend every 2 seconds
- Maximum 20 polling attempts (40 seconds total)
- Shows loading state during polling
- Handles timeout gracefully

### BR-004: App Kill Recovery
**Priority**: P1 (High)
**Description**: If app is killed during payment, verification must still happen when app restarts.

**Acceptance Criteria**:
- Pending order ID is persisted to storage
- On app startup, check for pending orders
- Resume polling for pending orders
- Clear pending order after verification

### BR-005: Webhook Integration
**Priority**: P1 (High)
**Description**: Backend must handle Razorpay webhooks for automatic payment confirmation.

**Acceptance Criteria**:
- Webhook endpoint receives Razorpay events
- Signature verification for security
- Updates order status on `payment.captured` event
- Logs all webhook events

### BR-006: Security
**Priority**: P0 (Critical)
**Description**: System must be secure against fake payment attacks.

**Acceptance Criteria**:
- Frontend cannot mark order as PAID
- Only backend can update payment status
- Webhook endpoint has signature verification
- Transaction reference (`tr`) is validated

### BR-007: Direct UPI Deep Link (Primary Flow)
**Priority**: P0 (Critical)
**Description**: System must attempt direct UPI deep link as primary payment method for instant app opening.

**Acceptance Criteria**:
- Construct `upi://pay` URL with merchant VPA, amount, transaction reference
- Use Razorpay order ID as transaction reference (`tr`)
- Attempt to open URL using `Linking.openURL()`
- If successful, UPI app opens instantly
- If fails, trigger fallback to Razorpay Intent
- No intermediate UI in primary flow

### BR-008: Razorpay Fallback (Safety Net)
**Priority**: P0 (Critical)
**Description**: System must fall back to Razorpay Intent when direct UPI deep link fails.

**Acceptance Criteria**:
- Detect direct link failure (app not installed, intent failed)
- Automatically trigger Razorpay Intent without user action
- Use same Razorpay order ID for verification
- Maintain payment state across fallback transition
- User should not perceive failure (seamless transition)

## User Stories

### US-001: Customer Pays with PhonePe (Direct Flow)
**As a** customer  
**I want to** pay using PhonePe with instant app opening  
**So that** I can complete my order quickly without intermediate screens

**Acceptance Criteria**:
1. I select PhonePe from payment options
2. PhonePe app opens instantly (< 1 second)
3. I complete payment in PhonePe
4. I return to merchant app
5. App shows "Verifying payment..."
6. After verification, I see order success screen

### US-001b: Customer Pays with Fallback (Edge Case)
**As a** customer  
**I want to** have a fallback payment method if direct opening fails  
**So that** I can still complete my payment successfully

**Acceptance Criteria**:
1. I select UPI app from payment options
2. Direct opening fails (app not installed/intent fails)
3. Razorpay opens automatically (seamless transition)
4. I select available UPI app from Razorpay
5. I complete payment
6. I see order success screen

### US-002: Customer's Payment is Verified
**As a** customer  
**I want to** see my payment verified in real-time  
**So that** I know my order is confirmed

**Acceptance Criteria**:
1. After payment, app shows verification status
2. Verification completes within 40 seconds
3. If verified, I see success screen
4. If failed, I see error with retry option
5. If timeout, I see "Check order status" message

### US-003: Customer's App is Killed During Payment
**As a** customer  
**I want to** have my payment verified even if app crashes  
**So that** I don't lose my payment

**Acceptance Criteria**:
1. I complete payment in UPI app
2. My merchant app crashes/is killed
3. I reopen merchant app
4. App automatically checks payment status
5. I see order success if payment was successful

## Technical Requirements

### TR-001: Razorpay Integration
**Description**: Integrate Razorpay for UPI payment verification

**Requirements**:
- Create Razorpay order when user initiates payment
- Store `razorpay_order_id` in database
- Use Razorpay order ID as transaction reference (`tr`)
- Verify payment using Razorpay API

### TR-002: Direct UPI Deep Link Implementation
**Description**: Implement direct UPI deep link as primary payment method

**Requirements**:
- Construct `upi://pay` URL with parameters:
  - `pa`: Merchant UPI VPA
  - `pn`: Merchant name
  - `am`: Amount
  - `cu`: Currency (INR)
  - `tr`: Transaction reference (Razorpay order ID)
  - `tn`: Transaction note
- Use `Linking.openURL()` to open UPI app
- Handle success (app opens) and failure (app not installed)
- No Razorpay SDK involvement in primary flow

### TR-003: Fallback Mechanism
**Description**: Implement automatic fallback to Razorpay Intent when direct link fails

**Requirements**:
- Detect direct link failure (timeout, error, app not installed)
- Trigger Razorpay Intent automatically
- Use same Razorpay order ID for verification
- Maintain payment state across transition
- Log fallback events for analytics

### TR-004: Backend Verification Endpoint (UNCHANGED)
**Description**: Create endpoint to verify payment status

**Endpoint**: `GET /api/payments/verify/:orderId`

**Response**:
```json
{
  "orderId": "string",
  "paymentStatus": "PAID" | "PENDING" | "FAILED",
  "razorpayOrderId": "string",
  "razorpayPaymentId": "string | null",
  "verifiedAt": "ISO8601 | null"
}
```

**Logic**:
1. Fetch order from database
2. If `paymentStatus === 'PAID'`, return immediately
3. If Razorpay order ID exists, fetch payment from Razorpay API
4. If payment is captured, update order and return PAID
5. Otherwise, return current status

**Note**: This endpoint works for BOTH direct UPI and Razorpay fallback flows, as both use Razorpay order ID for verification.

### TR-005: Webhook Handler (UNCHANGED)
**Description**: Handle Razorpay webhooks for automatic verification

**Endpoint**: `POST /api/webhooks/razorpay`

**Events to Handle**:
- `payment.captured`: Mark order as PAID
- `payment.failed`: Mark order as FAILED

**Security**:
- Verify Razorpay signature
- Validate webhook payload
- Idempotent processing

**Note**: Webhook works for BOTH direct UPI and Razorpay fallback flows, as both create Razorpay orders.

### TR-006: Polling Implementation (UNCHANGED)
**Description**: Implement polling in mobile app

**Requirements**:
- Poll every 2 seconds
- Maximum 20 attempts (40 seconds)
- Exponential backoff after 10 attempts
- Cancel polling on success/failure
- Resume polling on app foreground

**Note**: Polling works for BOTH direct UPI and Razorpay fallback flows.

### TR-007: Persistent Storage (UNCHANGED)
**Description**: Store pending order ID for recovery

**Storage**:
- Use AsyncStorage (React Native)
- Key: `pendingPaymentOrderId`
- Clear after verification

**Note**: Works for BOTH direct UPI and Razorpay fallback flows.

## Non-Functional Requirements

### NFR-001: Performance
- Payment verification must complete within 40 seconds
- Webhook processing must complete within 5 seconds
- API response time < 500ms

### NFR-002: Reliability
- Webhook must be idempotent (handle duplicates)
- Polling must handle network failures
- System must recover from app kills

### NFR-003: Security
- Webhook signature verification required
- No frontend payment status updates
- Transaction reference validation

### NFR-004: Observability
- Log all payment attempts
- Log all verification attempts
- Log all webhook events
- Track payment success rate

## Out of Scope

### OS-001: Manual Verification
Manual payment verification by admin is out of scope for this implementation.

### OS-002: Refunds
Payment refunds are out of scope for this implementation.

### OS-003: Multiple Payment Gateways
Only Razorpay integration is in scope. Other gateways (PhonePe Business, Paytm Business) are out of scope.

## Success Criteria

### SC-001: Zero Fake Payments
No orders should be marked as PAID without actual payment verification.

### SC-002: High Success Rate
95% of successful payments should be verified within 40 seconds.

### SC-003: App Kill Recovery
100% of payments should be verified even if app is killed during payment.

### SC-004: Security
Zero successful fake payment attacks.

## Risks and Mitigations

### Risk 1: Razorpay API Downtime
**Impact**: High  
**Probability**: Low  
**Mitigation**: 
- Implement retry logic with exponential backoff
- Show user-friendly error message
- Allow manual verification as fallback

### Risk 2: Webhook Delivery Failure
**Impact**: Medium  
**Probability**: Medium  
**Mitigation**:
- Implement polling as primary verification
- Use webhook as optimization
- Reconciliation job for missed webhooks

### Risk 3: Network Failure During Polling
**Impact**: Medium  
**Probability**: Medium  
**Mitigation**:
- Retry failed requests
- Resume polling on app foreground
- Persist pending order ID

### Risk 4: User Closes App Before Verification
**Impact**: Low  
**Probability**: High  
**Mitigation**:
- Persist pending order ID
- Resume verification on app restart
- Show notification when verified

## Dependencies

### External Dependencies
- Razorpay account and API keys
- Razorpay webhook endpoint (public URL)
- Merchant UPI VPA

### Internal Dependencies
- Order creation flow
- Payment status field in Order model
- Mobile app deep linking capability

## Assumptions

### A-001: Razorpay Account
Assume Razorpay account is already created and API keys are available.

### A-002: Merchant UPI VPA
Assume merchant has a valid UPI VPA for receiving payments.

### A-003: Webhook URL
Assume backend has a public URL for receiving webhooks.

### A-004: UPI Apps Installed
Assume users have at least one UPI app installed on their device.

## Constraints

### C-001: Razorpay Limitations
- Razorpay charges ~2% transaction fee
- Razorpay UPI has daily transaction limits
- Webhook delivery is not guaranteed

### C-002: UPI Limitations
- UPI Intent is Android-only (iOS shows QR code)
- UPI apps must be installed for direct deep link flow
- UPI transaction limits apply
- **Hybrid architecture**: Direct UPI primary (90-95%), Razorpay fallback (5-10%)

### C-003: Technical Limitations
- Polling increases server load
- Network failures can delay verification
- App kill scenarios require recovery logic
