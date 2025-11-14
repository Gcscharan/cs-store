# Razorpay Payment Integration

This document explains the Razorpay payment gateway integration for CS Store ecommerce platform.

## Features

✅ **Multiple Payment Methods:**
- Credit/Debit Card payments
- UPI payments (UPI ID + UPI Intent for GPay/PhonePe)
- Net Banking
- Cash on Delivery (COD)

✅ **Security:**
- Payment signature verification
- Webhook support for extra security
- No sensitive card/UPI data stored in database
- 256-bit SSL encryption

✅ **User Experience:**
- Existing UI unchanged
- Razorpay popup opens only after "Pay" button click
- Cart automatically clears after successful payment
- Success/failure notifications

## Architecture

### Backend (Node.js + Express + MongoDB)

**New Files:**
- `/backend/src/controllers/razorpayController.ts` - Razorpay payment logic
- `/backend/src/routes/razorpay.ts` - Razorpay API routes

**Modified Files:**
- `/backend/src/models/Order.ts` - Added `paymentMethod`, `razorpaySignature` fields
- `/backend/src/controllers/orderController.ts` - Added `paymentMethod` to COD orders
- `/backend/src/app.ts` - Registered Razorpay routes

**API Endpoints:**
1. `POST /api/razorpay/create-order` - Creates Razorpay order
2. `POST /api/razorpay/verify-payment` - Verifies payment signature
3. `POST /api/razorpay/webhook` - Handles Razorpay webhooks
4. `POST /api/orders/cod` - Places COD orders

### Frontend (React + TypeScript + Redux)

**New Files:**
- `/frontend/src/utils/razorpayHandler.ts` - Razorpay integration utilities

**Modified Files:**
- `/frontend/src/pages/CheckoutPage.tsx` - Added Razorpay payment handler

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
Razorpay SDK is already installed. If not, run:
```bash
cd backend
npm install razorpay
```

#### Configure Environment Variables
Create `/backend/.env` file (copy from `.env.example`):
```env
# Razorpay Credentials (Required)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Other existing variables
MONGODB_URI=mongodb://localhost:27017/csstore
JWT_SECRET=your_jwt_secret
PORT=5001
```

**Get Razorpay Credentials:**
1. Sign up at https://razorpay.com/
2. Go to Dashboard → Settings → API Keys
3. Generate Test/Live keys
4. For Webhook Secret: Dashboard → Settings → Webhooks → Generate Secret

#### Start Backend Server
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:5001`

### 2. Frontend Setup

#### No Additional Dependencies Required
Razorpay script loads dynamically from CDN.

#### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:3000`

### 3. Razorpay Dashboard Configuration

#### Setup Webhook (Recommended)
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Click "Create New Webhook"
3. Enter Webhook URL: `https://your-domain.com/api/razorpay/webhook`
4. Select events: `payment.captured`, `payment.failed`
5. Copy the webhook secret to `.env` as `RAZORPAY_WEBHOOK_SECRET`

**Note:** For local development, use ngrok or similar tool to expose localhost:
```bash
ngrok http 5001
# Use the ngrok URL for webhook: https://xxxx.ngrok.io/api/razorpay/webhook
```

## How It Works

### Payment Flow

#### For Card/UPI/Net Banking:
```
1. User selects payment method on checkout page
2. User clicks "Use this payment method" button
3. Frontend calls `/api/razorpay/create-order`
4. Backend creates Razorpay order and DB order (status: pending)
5. Frontend opens Razorpay Checkout popup with method pre-selected
6. User completes payment on Razorpay popup
7. On success, Razorpay returns payment details
8. Frontend calls `/api/razorpay/verify-payment`
9. Backend verifies signature and updates order (status: paid)
10. Cart clears and user redirects to success page
```

#### For Cash on Delivery:
```
1. User selects "Cash on Delivery" option
2. User clicks "Place Order" button
3. Frontend calls `/api/orders/cod`
4. Backend creates order (status: pending, paymentMethod: cod)
5. Cart clears and user redirects to orders page
```

### Payment Method Mapping

| UI Option | Razorpay Method | Backend Value |
|-----------|----------------|---------------|
| Credit/Debit Card | `card` | `"card"` |
| UPI | `upi` | `"upi"` |
| Net Banking | `netbanking` | `"netbanking"` |
| Cash on Delivery | N/A | `"cod"` |

## Database Schema

### Order Model Updates
```typescript
{
  paymentMethod: "card" | "upi" | "netbanking" | "cod", // New field
  paymentStatus: "pending" | "paid" | "failed" | "refunded",
  razorpayOrderId: string, // Razorpay order_id
  razorpayPaymentId: string, // Razorpay payment_id
  razorpaySignature: string, // New field - payment signature
  // ... other fields
}
```

### What's NOT Stored:
- Card numbers
- CVV
- Expiry dates
- UPI IDs
- Bank account details

Only Razorpay-generated IDs and signatures are stored for verification.

## Testing

### Test Cards (Razorpay Test Mode)
```
Successful Payment:
Card: 4111 1111 1111 1111
CVV: Any 3 digits
Expiry: Any future date

Failed Payment:
Card: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
```

### Test UPI
```
Success: success@razorpay
Failure: failure@razorpay
```

### Test Flow:
1. Add products to cart
2. Go to checkout
3. Select address
4. Choose payment method:
   - **Card:** Select "Credit or debit card" → Click "Use this payment method"
   - **UPI:** Select "UPI" → Click "Use this payment method"
   - **Net Banking:** Select "Net Banking" → Click "Use this payment method"
   - **COD:** Select "Cash on Delivery" → Click "Place Order"
5. Complete payment on Razorpay popup
6. Verify order status in `/orders` page
7. Verify cart is empty

## Security Best Practices

✅ **Implemented:**
- Payment signature verification on backend
- Webhook signature verification
- HTTPS required for production
- Razorpay handles sensitive data (not stored in DB)
- Auto-capture enabled for immediate payment confirmation

⚠️ **Important for Production:**
1. Use Razorpay Live keys (not Test keys)
2. Enable HTTPS on your domain
3. Configure webhook with production URL
4. Set strong JWT secrets
5. Implement rate limiting on payment endpoints
6. Add order amount validation
7. Log all payment attempts for audit

## Troubleshooting

### Issue: Razorpay popup doesn't open
**Solution:** Check browser console for errors. Ensure Razorpay script is loaded:
```javascript
console.log(window.Razorpay); // Should not be undefined
```

### Issue: Payment verification fails
**Solution:** Check backend logs. Ensure `RAZORPAY_KEY_SECRET` is correct in `.env`

### Issue: Cart doesn't clear after payment
**Solution:** Check if `/api/razorpay/verify-payment` returns success. Verify Redux clearCart action.

### Issue: Webhook not receiving events
**Solution:**
1. Verify webhook URL is accessible from internet
2. Check webhook secret matches `.env`
3. Verify events are selected in Razorpay dashboard

## API Documentation

### POST /api/razorpay/create-order
**Request:**
```json
{
  "amount": 1500.50,
  "items": [
    {
      "productId": "product_id",
      "name": "Product Name",
      "price": 1000,
      "qty": 1
    }
  ],
  "address": {
    "label": "Home",
    "addressLine": "123 Street",
    "city": "Hyderabad",
    "state": "Telangana",
    "pincode": "500001",
    "lat": 17.385,
    "lng": 78.4867
  },
  "paymentMethod": "card"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "order_xxxxxxxxxxxxx",
  "amount": 150050,
  "currency": "INR",
  "dbOrderId": "mongodb_order_id",
  "key": "rzp_test_xxxxxxxxxxxxx"
}
```

### POST /api/razorpay/verify-payment
**Request:**
```json
{
  "razorpay_order_id": "order_xxxxxxxxxxxxx",
  "razorpay_payment_id": "pay_xxxxxxxxxxxxx",
  "razorpay_signature": "signature_xxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "orderId": "mongodb_order_id"
}
```

### POST /api/razorpay/webhook
**Headers:**
```
x-razorpay-signature: webhook_signature
```

**Body:** (Razorpay sends this automatically)
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_xxxxxxxxxxxxx",
        "order_id": "order_xxxxxxxxxxxxx",
        // ... other fields
      }
    }
  }
}
```

## Support

For Razorpay-specific issues, refer to:
- [Razorpay Documentation](https://razorpay.com/docs/)
- [Razorpay Support](https://razorpay.com/support/)

For integration issues, check:
- Backend logs: `backend/logs/`
- Browser console
- Network tab for API responses
