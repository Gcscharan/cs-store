# UPI Payment Verification Flow Audit

## Executive Summary

**VERDICT**: ⚠️ **PAYMENT IS NOT TRULY VERIFIED - HIGH RISK OF UNPAID ORDERS**

The system has **NO REAL PAYMENT VERIFICATION**. It only checks the database `paymentStatus` field, which is never updated after UPI payment. This creates a **critical security vulnerability**.

---

## Critical Findings

### 🚨 **CRITICAL ISSUE: No Payment Gateway Integration**

**The system does NOT verify actual UPI transactions with any payment gateway.**

---

## Detailed Analysis

### 1. After Returning from UPI App ✅ (Listener Exists)

**App State Listener** (Line 356-365):
```typescript
useEffect(() => {
  if (!pendingPaymentOrderId || !selectedUpiApp) return;
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      checkPaymentStatusOnce(pendingPaymentOrderId, selectedUpiApp);
    }
  });
  return () => sub.remove();
}, [pendingPaymentOrderId, selectedUpiApp]);
```

**Analysis**:
- ✅ **Listener exists** - Detects when user returns from UPI app
- ✅ **Triggers verification** - Calls `checkPaymentStatusOnce()`
- ✅ **Proper cleanup** - Removes listener on unmount

**Status**: ✅ **CORRECT**

---

### 2. Payment Verification ❌ (NO REAL VERIFICATION)

#### Mobile App Verification (Line 282-354)

**What it does**:
```typescript
const checkPaymentStatusOnce = async (orderId: string, selectedApp) => {
  // Calls backend API
  const res = await getPaymentStatus(orderId).unwrap();
  const verdict = resolvePaymentStatus(res?.paymentStatus);
  
  if (verdict === 'SUCCESS') {
    // Navigate to success screen
    navigation.replace('OrderSuccess', { orderId });
  }
}
```

**What it checks**:
- ❌ **Only checks database field** - `order.paymentStatus`
- ❌ **No gateway verification** - Doesn't call UPI gateway API
- ❌ **No transaction ID check** - Doesn't verify `tr` parameter
- ❌ **No amount verification** - Doesn't verify payment amount

#### Backend Verification (orderController.ts Line 350-365)

**What it does**:
```typescript
export const getPaymentStatus = async (req: Request, res: Response) => {
  const order = await Order.findById(orderId);
  
  // Return the payment status from database
  return res.json({
    orderId: order._id,
    paymentStatus: order.paymentStatus,  // ❌ Just reads DB field
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
  });
}
```

**What it checks**:
- ❌ **Only reads database** - No external verification
- ❌ **No UPI gateway call** - Doesn't check with payment provider
- ❌ **No webhook processing** - Doesn't wait for payment confirmation

**Status**: ❌ **CRITICAL VULNERABILITY**

---

### 3. Payment Callback/Webhook ⚠️ (EXISTS BUT NOT USED)

#### Callback Route (orders.ts Line 80-113)

**What exists**:
```typescript
router.post("/:orderId/payment-callback", async (req, res) => {
  const { status, transactionId } = req.body;
  
  if (status === 'SUCCESS') {
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'PAID',
      'paymentIntent.status': 'completed',
    });
  }
  
  res.json({ success: true });
});
```

**Analysis**:
- ⚠️ **Route exists** - Callback endpoint is defined
- ❌ **No authentication** - Anyone can call this endpoint
- ❌ **No signature verification** - No way to verify it's from UPI gateway
- ❌ **Not connected to UPI apps** - PhonePe/GPay don't call this
- ❌ **No gateway integration** - No actual UPI provider configured

**Status**: ⚠️ **EXISTS BUT USELESS**

---

### 4. Failure Scenarios ❌ (POOR HANDLING)

#### User Cancels Payment

**What happens**:
1. User opens PhonePe/GPay
2. User cancels payment
3. User returns to app
4. App checks `paymentStatus` → Still `PENDING`
5. App shows: "Payment is still pending"
6. **Order remains in system as PENDING**

**Risk**: ✅ **Handled correctly** - Order not marked as paid

#### Payment Fails

**What happens**:
1. User completes payment in UPI app
2. Payment fails (insufficient balance, etc.)
3. User returns to app
4. App checks `paymentStatus` → Still `PENDING`
5. App shows: "Payment is still pending"
6. **Order remains in system as PENDING**

**Risk**: ✅ **Handled correctly** - Order not marked as paid

#### App is Killed

**What happens**:
1. User opens PhonePe/GPay
2. User completes payment successfully
3. **App is killed** (user force-closes, OS kills, etc.)
4. User reopens app
5. **No verification happens** - AppState listener is gone
6. **Order remains PENDING forever**

**Risk**: ❌ **CRITICAL** - Paid orders stuck as PENDING

---

### 5. Order State ⚠️ (CORRECT BUT VULNERABLE)

#### Order Creation (orderBuilder.ts Line 466)

**Initial state**:
```typescript
const orderStatus = OrderStatus.CREATED;
const paymentStatus = "PENDING";
```

**Analysis**:
- ✅ **Correct** - Order created with `PENDING` status
- ✅ **Not marked PAID before payment** - Good practice
- ❌ **Never updated after payment** - No mechanism to mark as PAID

#### Payment Status Update

**How it should work**:
1. Order created → `paymentStatus: PENDING`
2. User pays in UPI app → UPI gateway confirms
3. **Gateway webhook calls backend** → `paymentStatus: PAID`
4. App checks status → Shows success

**How it actually works**:
1. Order created → `paymentStatus: PENDING`
2. User pays in UPI app → ❌ **No gateway integration**
3. ❌ **No webhook** → Status never updated
4. App checks status → Still `PENDING`
5. **Order stuck as PENDING forever**

**Status**: ❌ **BROKEN FLOW**

---

## Risk Assessment

### 🚨 **HIGH RISK: Unpaid Orders**

**Scenario 1: User Claims Payment**
1. User places order (status: PENDING)
2. User doesn't pay
3. User calls support: "I paid but order is pending"
4. Support has no way to verify
5. **Risk**: False claims, revenue loss

**Scenario 2: User Actually Pays**
1. User places order (status: PENDING)
2. User pays in PhonePe
3. Payment succeeds
4. App is killed
5. Order stuck as PENDING
6. **Risk**: Paid orders not fulfilled, customer complaints

**Scenario 3: Fake Success**
1. Malicious user places order
2. User doesn't pay
3. User manually calls callback endpoint: `POST /orders/:orderId/payment-callback` with `status: SUCCESS`
4. Order marked as PAID
5. **Risk**: Free orders, revenue loss

---

## Root Cause

### Missing Components

1. ❌ **No UPI Payment Gateway Integration**
   - No Razorpay UPI
   - No PhonePe Business API
   - No Paytm Business API
   - No direct UPI integration

2. ❌ **No Webhook Handler**
   - Callback route exists but not connected
   - No signature verification
   - No gateway to call it

3. ❌ **No Transaction Verification**
   - Doesn't verify `tr` (transaction reference)
   - Doesn't check payment amount
   - Doesn't validate with gateway

4. ❌ **No Polling Mechanism**
   - Only checks once when app returns
   - No retry if app is killed
   - No background verification

---

## Minimal Fix (Production-Ready)

### Option 1: Integrate Razorpay UPI (Recommended)

**Why Razorpay**:
- ✅ Supports UPI payments
- ✅ Has webhook system
- ✅ Provides transaction verification API
- ✅ Already partially integrated (code exists)

**Implementation**:

#### Step 1: Backend - Create Razorpay Order
```typescript
// In orderBuilder.ts
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// When creating UPI order
const razorpayOrder = await razorpay.orders.create({
  amount: totalAmount * 100, // Amount in paise
  currency: 'INR',
  receipt: orderId,
  payment_capture: 1,
});

// Save razorpay_order_id to order
order.paymentIntent = {
  id: razorpayOrder.id,
  status: 'pending',
  amount: totalAmount,
  currency: 'INR',
};
```

#### Step 2: Mobile - Use Razorpay UPI Intent
```typescript
// In CheckoutScreen.tsx
const upiUrl = `upi://pay?pa=${merchantVpa}` + 
  `&pn=${merchantName}` + 
  `&am=${amount}` + 
  `&cu=INR` + 
  `&tn=${razorpayOrderId}` +  // ✅ Use Razorpay order ID
  `&tr=${razorpayOrderId}`;    // ✅ Transaction reference
```

#### Step 3: Backend - Webhook Handler
```typescript
// Already exists at: backend/src/domains/payments/routes/webhooks.routes.ts
// Just needs to be configured

router.post('/razorpay', verifyRazorpaySignature, async (req, res) => {
  const { event, payload } = req.body;
  
  if (event === 'payment.captured') {
    const orderId = payload.order.receipt;
    
    // Verify payment with Razorpay API
    const payment = await razorpay.payments.fetch(payload.payment.id);
    
    if (payment.status === 'captured') {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'PAID',
        'paymentIntent.status': 'completed',
        'paymentIntent.gatewayPaymentId': payment.id,
      });
    }
  }
  
  res.json({ success: true });
});
```

#### Step 4: Mobile - Poll for Status
```typescript
// In CheckoutScreen.tsx
const pollPaymentStatus = async (orderId: string, maxAttempts = 30) => {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    
    const res = await getPaymentStatus(orderId).unwrap();
    
    if (res.paymentStatus === 'PAID') {
      return 'SUCCESS';
    }
    
    if (res.paymentStatus === 'FAILED') {
      return 'FAILED';
    }
  }
  
  return 'TIMEOUT';
};

// After opening UPI app
await Linking.openURL(finalUrl);
const result = await pollPaymentStatus(orderId);

if (result === 'SUCCESS') {
  navigation.replace('OrderSuccess', { orderId });
} else {
  Alert.alert('Payment Verification', 'Unable to verify payment. Please check your order status.');
}
```

**Cost**: ~2% transaction fee

---

### Option 2: Manual Verification (Temporary)

**For immediate deployment without gateway**:

#### Step 1: Admin Dashboard - Manual Verification
```typescript
// Add admin endpoint to manually verify payments
router.post('/admin/orders/:orderId/verify-payment', authenticateToken, requireAdmin, async (req, res) => {
  const { orderId } = req.params;
  const { transactionId, screenshot } = req.body;
  
  // Admin uploads payment screenshot
  // Admin enters UPI transaction ID
  // Admin manually marks as PAID
  
  await Order.findByIdAndUpdate(orderId, {
    paymentStatus: 'PAID',
    'paymentIntent.manualVerification': {
      transactionId,
      screenshot,
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
    },
  });
  
  res.json({ success: true });
});
```

#### Step 2: Customer - Submit Payment Proof
```typescript
// In mobile app - after payment
<Button onPress={() => {
  navigation.navigate('SubmitPaymentProof', { orderId });
}}>
  I've Paid - Submit Proof
</Button>

// SubmitPaymentProofScreen.tsx
const handleSubmit = async () => {
  await submitPaymentProof({
    orderId,
    transactionId: upiTransactionId,
    screenshot: paymentScreenshot,
  });
  
  Alert.alert('Submitted', 'Your payment proof has been submitted. We will verify and update your order within 24 hours.');
};
```

**Cost**: Free, but requires manual work

---

## Recommended Solution

### Phase 1: Immediate (Manual Verification)
1. Add "Submit Payment Proof" feature
2. Add admin verification dashboard
3. Notify customers about 24-hour verification

### Phase 2: Production (Razorpay Integration)
1. Integrate Razorpay UPI
2. Implement webhook handler
3. Add polling mechanism
4. Remove manual verification

---

## Conclusion

**Current Status**: ❌ **BROKEN**

**Risks**:
- 🚨 **HIGH**: Unpaid orders marked as paid (if callback is exploited)
- 🚨 **HIGH**: Paid orders stuck as pending (if app is killed)
- 🚨 **MEDIUM**: No way to verify actual payments
- 🚨 **MEDIUM**: Customer support nightmare

**Action Required**: **IMMEDIATE**

**Priority**: **P0 - CRITICAL**

**Recommendation**: Integrate Razorpay UPI within 1 week, use manual verification as temporary solution.

---

## Summary Table

| Component | Status | Risk | Fix Required |
|-----------|--------|------|--------------|
| App State Listener | ✅ Works | Low | None |
| Payment Verification | ❌ Broken | **CRITICAL** | Add gateway integration |
| Webhook Handler | ⚠️ Exists but unused | **HIGH** | Connect to gateway |
| Transaction Verification | ❌ Missing | **CRITICAL** | Implement verification |
| Polling Mechanism | ❌ Missing | **HIGH** | Add retry logic |
| Order State | ⚠️ Correct but vulnerable | **MEDIUM** | Add update mechanism |

**Overall Status**: ⚠️ **NOT PRODUCTION READY**
