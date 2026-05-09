# Manual Route Testing Guide

This guide provides manual testing steps to verify that the payment verification and webhook routes are properly wired and accessible.

## Prerequisites

- Backend server running (e.g., `npm run dev`)
- Valid authentication token (for payment verification endpoint)
- Razorpay webhook secret configured in `.env`

## Test 1: Payment Verification Route

### Endpoint
```
GET /api/payments/verify/:orderId
```

### Test Without Authentication (Should Return 401)
```bash
curl -X GET http://localhost:5001/api/payments/verify/test-order-id
```

**Expected Response:**
```json
{
  "message": "Unauthorized"
}
```
**Expected Status Code:** 401

### Test With Authentication (Should Return 404 for non-existent order)
```bash
curl -X GET http://localhost:5001/api/payments/verify/test-order-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Order not found"
}
```
**Expected Status Code:** 404

## Test 2: Webhook Route

### Endpoint
```
POST /api/webhooks/razorpay
```

### Test Without Signature (Should Return 401)
```bash
curl -X POST http://localhost:5001/api/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "event",
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test123",
          "order_id": "order_test123",
          "amount": 50000,
          "status": "captured"
        }
      }
    }
  }'
```

**Expected Response:**
```json
{
  "error": "Missing signature"
}
```
**Expected Status Code:** 401

### Test With Invalid Signature (Should Return 401)
```bash
curl -X POST http://localhost:5001/api/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: invalid_signature" \
  -d '{
    "entity": "event",
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test123",
          "order_id": "order_test123",
          "amount": 50000,
          "status": "captured"
        }
      }
    }
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid signature"
}
```
**Expected Status Code:** 401

## Test 3: Non-Existent Routes (Should Return 404)

### Test Non-Existent Payment Route
```bash
curl -X GET http://localhost:5001/api/payments/nonexistent
```

**Expected Status Code:** 404

### Test Non-Existent Webhook Route
```bash
curl -X POST http://localhost:5001/api/webhooks/nonexistent
```

**Expected Status Code:** 404

## Verification Checklist

- [x] Payment verification route is registered at `/api/payments/verify/:orderId`
- [x] Payment verification route requires authentication (returns 401 without token)
- [x] Webhook route is registered at `/api/webhooks/razorpay`
- [x] Webhook route requires valid signature (returns 401 without signature)
- [x] Non-existent routes return 404
- [x] Routes are accessible through the main Express app

## Integration Test Results

All automated integration tests pass:
- ✓ Payment verification route registered
- ✓ Payment verification requires authentication
- ✓ Webhook route registered
- ✓ Webhook requires valid signature
- ✓ Non-existent payment routes return 404
- ✓ Non-existent webhook routes return 404

## Conclusion

Both routes are properly wired to the main Express app and are accessible:
1. **Payment Verification Route**: `GET /api/payments/verify/:orderId` - Registered via `/api/payments` router
2. **Webhook Route**: `POST /api/webhooks/razorpay` - Registered via `/api/webhooks` router

The routes are protected by appropriate middleware:
- Payment verification requires JWT authentication
- Webhook requires Razorpay signature verification
