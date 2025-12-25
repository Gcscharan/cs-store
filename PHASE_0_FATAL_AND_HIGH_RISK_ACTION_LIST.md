# PHASE 0 FATAL AND HIGH RISK ACTION LIST

## 1. DEBUG & TEST BACKDOORS

### /api/admin/dev-token | GET
**Why this is dangerous**: Provides admin authentication tokens without credentials, bypassing all authentication controls.
**Allowed Phase-1 Action**: Remove

### /api/admin/admin | GET
**Why this is dangerous**: Direct admin access route without authentication, exposes admin dashboard to unauthorized users.
**Allowed Phase-1 Action**: Remove

### /api/admin/dev-wipe-others | POST
**Why this is dangerous**: Mass user deletion endpoint with destructive capability, even with auth checks this is extremely dangerous.
**Allowed Phase-1 Action**: Remove

### /api/otp/debug/generate | POST
**Why this is dangerous**: Debug OTP generation bypasses normal validation and rate limiting, could be exploited for spam.
**Allowed Phase-1 Action**: Remove

### /api/otp/debug/sms | POST
**Why this is dangerous**: Debug SMS endpoint allows unlimited SMS sending without authentication or rate limits.
**Allowed Phase-1 Action**: Remove

### /api/notifications/test-all-channels | POST
**Why this is dangerous**: Test notification endpoint can be used to spam users across all notification channels.
**Allowed Phase-1 Action**: Remove

### /api/notification-test/dispatch | POST
**Why this is dangerous**: Test dispatch endpoint allows arbitrary notification sending without proper controls.
**Allowed Phase-1 Action**: Remove

### /api/notification-test/test-all-channels | POST
**Why this is dangerous**: Duplicate test endpoint for multi-channel notifications without production safeguards.
**Allowed Phase-1 Action**: Remove

### /api/notification-test/cart-reminders | POST
**Why this is dangerous**: Test cart reminder endpoint can be abused to send unsolicited notifications.
**Allowed Phase-1 Action**: Remove

### /api/notification-test/payment-reminders | POST
**Why this is dangerous**: Test payment reminder endpoint allows spam of payment notifications.
**Allowed Phase-1 Action**: Remove

### /api/payments/test | GET
**Why this is dangerous**: Test payment endpoint exposes system status and could leak payment configuration.
**Allowed Phase-1 Action**: Remove

### /api/products/debug/product-images/:id | GET
**Why this is dangerous**: Debug endpoint exposes internal image processing and file system information.
**Allowed Phase-1 Action**: Remove

## 2. PAYMENT & WEBHOOK RISKS

### /api/payments/verify | POST
**Why this is dangerous**: Payment verification without authentication allows unauthorized payment status manipulation.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/payments/callback | POST
**Why this is dangerous**: Payment callback without signature verification allows fake payment confirmations.
**Allowed Phase-1 Action**: Guard with Signature Verification

### /api/webhooks/razorpay | POST
**Why this is dangerous**: Razorpay webhook without signature verification allows payment fraud and order manipulation.
**Allowed Phase-1 Action**: Guard with Signature Verification

### /api/razorpay/webhook | POST
**Why this is dangerous**: Duplicate Razorpay webhook endpoint without proper signature validation.
**Allowed Phase-1 Action**: Guard with Signature Verification

### /api/payments/details/:payment_id | GET
**Why this is dangerous**: Exposes payment details without authentication, potential payment information leakage.
**Allowed Phase-1 Action**: Guard with Authentication

## 3. UPLOAD & FILE INJECTION RISKS

### /api/uploads/cloudinary | POST
**Why this is dangerous**: Unauthenticated file upload allows arbitrary file uploads leading to code injection.
**Allowed Phase-1 Action**: Guard with Authentication

## 4. DELIVERY & PERSONNEL RISKS

### /api/delivery-fee/calculate-fee | POST
**Why this is dangerous**: Delivery fee calculation without authentication allows fee manipulation and fraud.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel | GET
**Why this is dangerous**: Exposes all delivery personnel information without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel | POST
**Why this is dangerous**: Allows creation of delivery personnel accounts without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel/:id | PUT
**Why this is dangerous**: Allows modification of delivery personnel data without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel/:id | DELETE
**Why this is dangerous**: Allows deletion of delivery personnel without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel/:id/location | PUT
**Why this is dangerous**: Allows manipulation of delivery personnel location data without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel/:id/route | GET
**Why this is dangerous**: Exposes delivery route information without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery-personnel/:id/route | DELETE
**Why this is dangerous**: Allows deletion of delivery routes without authentication.
**Allowed Phase-1 Action**: Guard with Authentication

### /api/delivery/calculate-fee | POST
**Why this is dangerous**: Duplicate delivery fee calculation endpoint without authentication.
**Allowed Phase-1 Action**: Remove

## 5. ADMIN PRIVILEGE ESCALATION RISKS

### /api/admin/users/:id | DELETE
**Why this is dangerous**: Admin user deletion endpoint with authentication but insufficient validation for destructive action.
**Allowed Phase-1 Action**: Guard with Role

### /api/admin/products/:id | DELETE
**Why this is dangerous**: Admin product deletion endpoint with authentication but lacks proper audit logging.
**Allowed Phase-1 Action**: Guard with Role

### /api/products | POST
**Why this is dangerous**: Product creation without authentication allows unauthorized product injection.
**Allowed Phase-1 Action**: Guard with Role

## 6. CART PRIVILEGE ESCALATION RISKS

### /api/cart | GET
**Why this is dangerous**: Admin access to customer carts violates data privacy and segregation of duties.
**Allowed Phase-1 Action**: Guard with Role

### /api/cart/add | POST
**Why this is dangerous**: Admin can manipulate customer cart contents, enabling fraud and data tampering.
**Allowed Phase-1 Action**: Guard with Role

### /api/cart/update | PUT
**Why this is dangerous**: Admin modification of customer cart items violates business logic integrity.
**Allowed Phase-1 Action**: Guard with Role

### /api/cart/remove | DELETE
**Why this is dangerous**: Admin removal of customer cart items constitutes unauthorized data modification.
**Allowed Phase-1 Action**: Guard with Role

### /api/cart/clear | DELETE
**Why this is dangerous**: Admin can clear customer carts, causing data loss and business disruption.
**Allowed Phase-1 Action**: Guard with Role

### /api/cart/checkout/create-order | POST
**Why this is dangerous**: Admin can create orders on behalf of customers, enabling order fraud.
**Allowed Phase-1 Action**: Guard with Role

### /api/cart/checkout/verify | POST
**Why this is dangerous**: Admin payment verification without proper authorization allows payment manipulation.
**Allowed Phase-1 Action**: Guard with Role
