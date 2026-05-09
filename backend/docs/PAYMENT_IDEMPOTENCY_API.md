# Payment Idempotency API Documentation

## Overview

This document describes the idempotency requirements for the payment system API. All payment-related operations now require strict idempotency keys to prevent duplicate orders, duplicate charges, and race conditions.

**Target Audience**: Mobile developers, API consumers, integration partners

## Idempotency Key Requirement

### What is an Idempotency Key?

An idempotency key is a unique identifier that you provide with each API request. It ensures that if you retry the same request multiple times (due to network issues, timeouts, or user actions), the operation will only be performed once.

### Why is it Required?

- **Prevents duplicate orders**: Users double-clicking "Place Order" won't create multiple orders
- **Safe retries**: Network failures can be safely retried without side effects
- **Consistent behavior**: Same request always produces the same result

## API Specification

### Order Creation Endpoint

**Endpoint**: `POST /api/orders/create`

**Required Header**:
```
x-idempotency-key: <UUID v4>
```

**Header Format**:
- **Type**: UUID version 4
- **Format**: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` (lowercase hexadecimal)
- **Example**: `550e8400-e29b-41d4-a716-446655440000`
- **Required**: Yes (returns 400 if missing)

### Request Example

```http
POST /api/orders/create HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>
x-idempotency-key: 550e8400-e29b-41d4-a716-446655440000

{
  "paymentMethod": "UPI",
  "upiVpa": "user@paytm"
}
```

### Response Codes

#### 201 Created
Order was successfully created (first request with this idempotency key).

```json
{
  "orderId": "64a1b2c3d4e5f6789abcdef0",
  "status": "PENDING",
  "total": 1250.00,
  "paymentIntent": {
    "paymentIntentId": "pi_abc123",
    "razorpayOrderId": "order_xyz789",
    "amount": 125000,
    "currency": "INR"
  }
}
```

#### 200 OK
Order already exists for this idempotency key (idempotent return).

```json
{
  "orderId": "64a1b2c3d4e5f6789abcdef0",
  "status": "PENDING",
  "total": 1250.00,
  "paymentIntent": {
    "paymentIntentId": "pi_abc123",
    "razorpayOrderId": "order_xyz789",
    "amount": 125000,
    "currency": "INR"
  }
}
```

**Note**: The response body is identical for 201 and 200. The status code indicates whether this was a new creation (201) or an idempotent return (200).

#### 400 Bad Request - Missing Idempotency Key

```json
{
  "error": "IDEMPOTENCY_KEY_REQUIRED",
  "message": "x-idempotency-key header is required"
}
```

#### 400 Bad Request - Invalid Format

```json
{
  "error": "INVALID_IDEMPOTENCY_KEY",
  "message": "x-idempotency-key must be a valid UUID v4"
}
```

#### 409 Conflict - Different Cart with Same Key

```json
{
  "error": "IDEMPOTENCY_KEY_CONFLICT",
  "message": "This idempotency key was used for a different order"
}
```

This occurs when you reuse an idempotency key with different cart contents. Each unique cart requires a unique idempotency key.

## Client Implementation Guide

### Generating Idempotency Keys

#### React Native / JavaScript

```javascript
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Generate a new idempotency key for each order attempt
const idempotencyKey = uuidv4();

// Example: "550e8400-e29b-41d4-a716-446655440000"
```

#### iOS / Swift

```swift
import Foundation

let idempotencyKey = UUID().uuidString.lowercased()

// Example: "550e8400-e29b-41d4-a716-446655440000"
```

#### Android / Kotlin

```kotlin
import java.util.UUID

val idempotencyKey = UUID.randomUUID().toString().lowercase()

// Example: "550e8400-e29b-41d4-a716-446655440000"
```

### When to Generate a New Key

**Generate a NEW idempotency key when**:
- User starts a new checkout flow
- User modifies their cart (add/remove items, change quantities)
- User changes delivery address
- User changes payment method

**Reuse the SAME idempotency key when**:
- Retrying after a network error
- Retrying after a timeout
- User clicks "Place Order" multiple times rapidly
- App crashes and restarts during checkout

### Recommended Implementation Pattern

```javascript
// Store idempotency key in checkout state
const [checkoutState, setCheckoutState] = useState({
  idempotencyKey: uuidv4(),
  cart: [],
  address: null,
  paymentMethod: null,
});

// Regenerate key when cart changes
const updateCart = (newCart) => {
  setCheckoutState({
    ...checkoutState,
    cart: newCart,
    idempotencyKey: uuidv4(), // New key for new cart
  });
};

// Reuse key when retrying
const placeOrder = async () => {
  try {
    const response = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-idempotency-key': checkoutState.idempotencyKey, // Reuse on retry
      },
      body: JSON.stringify({
        paymentMethod: checkoutState.paymentMethod,
      }),
    });
    
    if (response.status === 201 || response.status === 200) {
      // Both are success - order created or already exists
      const order = await response.json();
      return order;
    }
    
    if (response.status === 400) {
      const error = await response.json();
      // Handle validation errors
      throw new Error(error.message);
    }
    
    // Network error - safe to retry with same key
    throw new Error('Network error');
    
  } catch (error) {
    // Retry with SAME idempotency key
    console.log('Retrying with same idempotency key:', checkoutState.idempotencyKey);
    throw error;
  }
};
```

### Error Handling Best Practices

#### Network Errors (Safe to Retry)
```javascript
// Retry with SAME idempotency key
if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
  await retryWithSameKey();
}
```

#### Validation Errors (Do NOT Retry)
```javascript
// Fix the issue, generate NEW key
if (error.code === 'INVALID_IDEMPOTENCY_KEY') {
  idempotencyKey = uuidv4(); // Generate new key
  await placeOrder();
}
```

#### Conflict Errors (User Action Required)
```javascript
// User tried to reuse key with different cart
if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
  // Show error to user
  alert('Please try again');
  idempotencyKey = uuidv4(); // Generate new key
}
```

## Content-Based Deduplication

In addition to idempotency keys, the system implements content-based deduplication to prevent duplicate orders with identical cart contents.

### How It Works

The system generates a hash of your cart contents (items, quantities, prices, address, total) and prevents creating duplicate orders with the same cart within a 5-minute window.

### What This Means for You

If a user:
1. Creates an order with cart A and idempotency key K1
2. Immediately tries to create another order with cart A and idempotency key K2

The system will return the existing order from step 1 (with status 200), even though K2 is different.

### Why This Matters

This prevents scenarios like:
- User clicks "Place Order" twice rapidly with different keys
- App generates new key on each retry, bypassing idempotency
- Malicious attempts to create duplicate orders

### Response Behavior

```javascript
// First request
POST /api/orders/create
x-idempotency-key: key-1
{ cart: [item-A, item-B] }
→ 201 Created, orderId: order-123

// Second request (different key, same cart, within 5 minutes)
POST /api/orders/create
x-idempotency-key: key-2
{ cart: [item-A, item-B] }
→ 200 OK, orderId: order-123 (same order returned)
```

## Testing

### Test Cases

#### Test 1: Basic Idempotency
```javascript
// Create order
const key = uuidv4();
const order1 = await createOrder({ idempotencyKey: key });

// Retry with same key
const order2 = await createOrder({ idempotencyKey: key });

// Assert: Same order returned
assert(order1.orderId === order2.orderId);
```

#### Test 2: Different Keys, Same Cart
```javascript
// Create order
const order1 = await createOrder({ 
  idempotencyKey: uuidv4(),
  cart: [{ productId: 'A', qty: 1 }]
});

// Try again with different key, same cart
const order2 = await createOrder({ 
  idempotencyKey: uuidv4(), // Different key
  cart: [{ productId: 'A', qty: 1 }] // Same cart
});

// Assert: Same order returned (content deduplication)
assert(order1.orderId === order2.orderId);
```

#### Test 3: Different Keys, Different Carts
```javascript
// Create order 1
const order1 = await createOrder({ 
  idempotencyKey: uuidv4(),
  cart: [{ productId: 'A', qty: 1 }]
});

// Create order 2 with different cart
const order2 = await createOrder({ 
  idempotencyKey: uuidv4(),
  cart: [{ productId: 'B', qty: 1 }] // Different cart
});

// Assert: Different orders created
assert(order1.orderId !== order2.orderId);
```

### Test Mode

Use Razorpay test mode for testing:
- Test API keys: Available in Razorpay dashboard
- Test UPI VPAs: `success@razorpay`, `failure@razorpay`
- Test cards: See [Razorpay test documentation](https://razorpay.com/docs/payments/payments/test-card-upi-details/)

## Migration Timeline

### Phase 1: Soft Enforcement (Current)
- Idempotency key is validated if provided
- Missing keys are logged but allowed
- **Action Required**: Start including idempotency keys in all requests

### Phase 2: Hard Enforcement (Target: 2 weeks)
- Idempotency key becomes mandatory
- Missing keys return 400 error
- **Action Required**: Ensure all clients send idempotency keys

### Phase 3: Monitoring (Ongoing)
- Duplicate order rate monitored
- Idempotency conflicts logged
- **Action Required**: Monitor error rates, report issues

## FAQ

### Q: Can I reuse an idempotency key across different users?
**A**: No. Idempotency keys are scoped to the user. Each user can have their own order with the same idempotency key.

### Q: What happens if I use the same key for different carts?
**A**: You'll receive a 409 Conflict error. Each unique cart requires a unique idempotency key.

### Q: How long are idempotency keys valid?
**A**: Idempotency keys are valid indefinitely. Once used, they're permanently associated with that order.

### Q: Can I use the same key for order creation and payment verification?
**A**: No. Use different keys for different operations. Order creation and payment verification are separate operations.

### Q: What if my app crashes during checkout?
**A**: Store the idempotency key in persistent storage (AsyncStorage, SharedPreferences, UserDefaults). On restart, reuse the same key to safely retry.

### Q: Do I need to validate the UUID format client-side?
**A**: Recommended but not required. The server validates the format and returns 400 if invalid.

### Q: What about cart hash conflicts?
**A**: Cart hash conflicts are handled automatically. If you try to create an order with identical cart contents within 5 minutes, the system returns the existing order. This is expected behavior and not an error.

## Support

For issues or questions:
- **API Issues**: Check server logs for detailed error messages
- **Integration Help**: Contact backend team
- **Razorpay Issues**: Check [Razorpay documentation](https://razorpay.com/docs/)

## References

- [Amazon Idempotency Best Practices](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [Stripe Idempotency](https://stripe.com/docs/api/idempotent_requests)
- [RFC 4122 (UUID)](https://tools.ietf.org/html/rfc4122)
