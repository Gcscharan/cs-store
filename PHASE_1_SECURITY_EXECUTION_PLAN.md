# PHASE 1 SECURITY EXECUTION PLAN

## 1. DEBUG & TEST BACKDOORS

### /api/admin/dev-token | GET
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/routes/admin.ts`
**Allowed change type**: Delete route lines 118-147
**Explicitly forbidden changes**: No other modifications to admin routes, no middleware changes

### /api/admin/admin | GET
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/routes/admin.ts`
**Allowed change type**: Delete route lines 150-198
**Explicitly forbidden changes**: No other modifications to admin routes, no middleware changes

### /api/admin/dev-wipe-others | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/routes/admin.ts`
**Allowed change type**: Delete route lines 201-289
**Explicitly forbidden changes**: No other modifications to admin routes, no middleware changes

### /api/otp/debug/generate | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/security/routes/otpRoutes.ts`
**Allowed change type**: Delete debug route handler
**Explicitly forbidden changes**: No changes to production OTP routes, no middleware modifications

### /api/otp/debug/sms | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/security/routes/otpRoutes.ts`
**Allowed change type**: Delete debug SMS route handler
**Explicitly forbidden changes**: No changes to production OTP routes, no middleware modifications

### /api/notifications/test-all-channels | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/communication/routes/notifications.ts`
**Allowed change type**: Delete route line 24
**Explicitly forbidden changes**: No other notification route modifications, no controller changes

### /api/notification-test/dispatch | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/communication/routes/notificationTest.ts`
**Allowed change type**: Delete entire file
**Explicitly forbidden changes**: No changes to main notification routes

### /api/notification-test/test-all-channels | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/communication/routes/notificationTest.ts`
**Allowed change type**: Delete entire file
**Explicitly forbidden changes**: No changes to main notification routes

### /api/notification-test/cart-reminders | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/communication/routes/notificationTest.ts`
**Allowed change type**: Delete entire file
**Explicitly forbidden changes**: No changes to main notification routes

### /api/notification-test/payment-reminders | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/communication/routes/notificationTest.ts`
**Allowed change type**: Delete entire file
**Explicitly forbidden changes**: No changes to main notification routes

### /api/payments/test | GET
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/finance/routes/paymentRoutes.ts`
**Allowed change type**: Delete route lines 13-15
**Explicitly forbidden changes**: No other payment route modifications

### /api/products/debug/product-images/:id | GET
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/domains/catalog/routes/products.ts`
**Allowed change type**: Delete route line 48, remove debugController import line 12
**Explicitly forbidden changes**: No other product route modifications

## 2. PAYMENT & WEBHOOK RISKS

### /api/payments/verify | POST
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/domains/finance/routes/paymentRoutes.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 21
**Explicitly forbidden changes**: No controller modifications, no other route changes

### /api/payments/callback | POST
**Allowed Action**: Guard with Signature Verification
**Exact file(s) involved**: `backend/src/domains/finance/routes/paymentRoutes.ts`
**Allowed change type**: Add Razorpay signature verification middleware to route line 27
**Explicitly forbidden changes**: No controller modifications, no other route changes

### /api/webhooks/razorpay | POST
**Allowed Action**: Guard with Signature Verification
**Exact file(s) involved**: `backend/src/domains/finance/routes/webhooks.ts`
**Allowed change type**: Add Razorpay signature verification middleware to route line 8
**Explicitly forbidden changes**: No controller modifications, no other route changes

### /api/razorpay/webhook | POST
**Allowed Action**: Guard with Signature Verification
**Exact file(s) involved**: `backend/src/domains/finance/routes/razorpay.ts`
**Allowed change type**: Add Razorpay signature verification middleware to route line 16
**Explicitly forbidden changes**: No controller modifications, no other route changes

### /api/payments/details/:payment_id | GET
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/domains/finance/routes/paymentRoutes.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 24
**Explicitly forbidden changes**: No controller modifications, no other route changes

## 3. UPLOAD & FILE INJECTION RISKS

### /api/uploads/cloudinary | POST
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/domains/uploads/routes/uploads.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 9
**Explicitly forbidden changes**: No controller modifications, no file validation changes

## 4. DELIVERY & PERSONNEL RISKS

### /api/delivery-fee/calculate-fee | POST
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryFee.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 7
**Explicitly forbidden changes**: No controller modifications, no fee calculation logic changes

### /api/delivery-personnel | GET
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 15
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery-personnel | POST
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 18
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery-personnel/:id | PUT
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 21
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery-personnel/:id | DELETE
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 24
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery-personnel/:id/location | PUT
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 27
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery-personnel/:id/route | GET
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 30
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery-personnel/:id/route | DELETE
**Allowed Action**: Guard with Authentication
**Exact file(s) involved**: `backend/src/routes/deliveryPersonnel.ts`
**Allowed change type**: Add `authenticateToken` middleware to route line 33
**Explicitly forbidden changes**: No controller modifications, no personnel logic changes

### /api/delivery/calculate-fee | POST
**Allowed Action**: Remove
**Exact file(s) involved**: `backend/src/routes/deliveryRoutes.ts`
**Allowed change type**: Delete route line 10
**Explicitly forbidden changes**: No other delivery route modifications

## 5. ADMIN PRIVILEGE ESCALATION RISKS

### /api/admin/users/:id | DELETE
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/admin.ts`
**Allowed change type**: Add audit logging middleware before existing role check on route line 37
**Explicitly forbidden changes**: No business logic changes, no role modification

### /api/admin/products/:id | DELETE
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/admin.ts`
**Allowed change type**: Add audit logging middleware before existing role check on route line 76
**Explicitly forbidden changes**: No business logic changes, no role modification

### /api/products | POST
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/domains/catalog/routes/products.ts`
**Allowed change type**: Uncomment and restore `authenticateToken` and `requireRole(["admin"])` middleware on route lines 40-41
**Explicitly forbidden changes**: No controller modifications, no upload logic changes

## 6. CART PRIVILEGE ESCALATION RISKS

### /api/cart | GET
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 19
**Explicitly forbidden changes**: No controller modifications, no business logic changes

### /api/cart/add | POST
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 20
**Explicitly forbidden changes**: No controller modifications, no business logic changes

### /api/cart/update | PUT
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 21
**Explicitly forbidden changes**: No controller modifications, no business logic changes

### /api/cart/remove | DELETE
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 22
**Explicitly forbidden changes**: No controller modifications, no business logic changes

### /api/cart/clear | DELETE
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 23
**Explicitly forbidden changes**: No controller modifications, no business logic changes

### /api/cart/checkout/create-order | POST
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 26
**Explicitly forbidden changes**: No controller modifications, no business logic changes

### /api/cart/checkout/verify | POST
**Allowed Action**: Guard with Role
**Exact file(s) involved**: `backend/src/routes/cart.ts`
**Allowed change type**: Replace `customerOrAdmin` with `requireRole(["customer"])` on route line 27
**Explicitly forbidden changes**: No controller modifications, no business logic changes
