| Route Path | HTTP Method | Module | Auth Required (Yes/No) | Role Required | Risk Level | Notes |
|------------|-------------|--------|----------------------|---------------|------------|-------|
| /api/delivery-fee/calculate-fee | POST | Delivery Fee | No | None | Fatal | |
| /api/delivery-personnel | GET | Delivery Personnel | No | None | Fatal | |
| /api/delivery-personnel | POST | Delivery Personnel | No | None | Fatal | |
| /api/delivery-personnel/:id | PUT | Delivery Personnel | No | None | Fatal | |
| /api/delivery-personnel/:id | DELETE | Delivery Personnel | No | None | Fatal | |
| /api/delivery-personnel/:id/location | PUT | Delivery Personnel | No | None | Fatal | |
| /api/delivery-personnel/:id/route | GET | Delivery Personnel | No | None | Fatal | |
| /api/delivery-personnel/:id/route | DELETE | Delivery Personnel | No | None | Fatal | |
| /api/cart | GET | Cart | Yes | Mixed | High | |
| /api/cart/add | POST | Cart | Yes | Mixed | High | |
| /api/cart/update | PUT | Cart | Yes | Mixed | High | |
| /api/cart/remove | DELETE | Cart | Yes | Mixed | High | |
| /api/cart/clear | DELETE | Cart | Yes | Mixed | High | |
| /api/cart/checkout/create-order | POST | Cart | Yes | Mixed | High | |
| /api/cart/checkout/verify | POST | Cart | Yes | Mixed | High | |
| /api/orders | GET | Orders | Yes | Customer | Low | |
| /api/orders/:id | GET | Orders | Yes | Customer | Low | |
| /api/orders/create | POST | Orders | Yes | Customer | Medium | |
| /api/orders/cod | POST | Orders | Yes | Customer | Medium | |
| /api/orders/:id/cancel | PUT | Orders | Yes | Customer | Medium | |
| /api/orders/:id/tracking | GET | Orders | Yes | Customer | Medium | |
| /api/orders/:id/status | PUT | Orders | Yes | Admin | Medium | |
| /api/orders/:orderId/payment-status | GET | Orders | Yes | Customer | Medium | |
| /api/orders/:orderId/payment-status | PUT | Orders | Yes | Customer | Medium | |
| /api/orders/:orderId/assign | POST | Orders | Yes | None | Medium | |
| /api/orders/:orderId/assign | DELETE | Orders | Yes | None | Medium | |
| /api/orders/:orderId/optimal-delivery-boy | GET | Orders | Yes | None | Medium | |
| /api/admin/stats | GET | Admin | Yes | Admin | Low | |
| /api/admin/dashboard | GET | Admin | Yes | Admin | Low | |
| /api/admin/analytics | GET | Admin | Yes | Admin | Low | |
| /api/admin/dashboard-stats | GET | Admin | Yes | Admin | Low | |
| /api/admin/profile | GET | Admin | Yes | Admin | Low | |
| /api/admin/users | GET | Admin | Yes | Admin | Low | |
| /api/admin/users/:id | DELETE | Admin | Yes | Admin | High | |
| /api/admin/users/:id/make-delivery | PUT | Admin | Yes | Admin | Medium | |
| /api/admin/products | GET | Admin | Yes | Admin | Low | |
| /api/admin/products/:id | PUT | Admin | Yes | Admin | Low | |
| /api/admin/products/:id | DELETE | Admin | Yes | Admin | High | |
| /api/admin/orders | GET | Admin | Yes | Admin | Low | |
| /api/admin/delivery-boys | GET | Admin | Yes | Admin | Low | |
| /api/admin/delivery-boys-list | GET | Admin | Yes | Admin | Low | |
| /api/admin/orders/export | GET | Admin | Yes | Admin | Medium | |
| /api/admin/dev-token | GET | Admin | No | None | Fatal | |
| /api/admin/admin | GET | Admin | No | None | Fatal | |
| /api/admin/dev-wipe-others | POST | Admin | Yes | Admin | Fatal | |
| /api/delivery/auth/signup | POST | Delivery Auth | No | None | Medium | |
| /api/delivery/auth/login | POST | Delivery Auth | No | None | Medium | |
| /api/delivery/auth/profile | GET | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/profile | GET | Delivery Auth | Yes | Delivery | Low | Duplicate route family |
| /api/delivery/profile | PUT | Delivery Auth | Yes | Delivery | Low | Duplicate route family |
| /api/delivery/selfie-url | GET | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/update-selfie | PUT | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/info | GET | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders | GET | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders/:orderId/accept | POST | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders/:orderId/reject | POST | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders/:orderId/pickup | POST | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders/:orderId/start-delivery | POST | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders/:orderId/arrived | POST | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/orders/:orderId/complete | POST | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/location | PUT | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/status | PUT | Delivery Auth | Yes | Delivery | Low | |
| /api/delivery/earnings | GET | Delivery Auth | Yes | Delivery | Low | |
| /api/location/reverse-geocode | GET | Location | No | None | Medium | |
| /api/location/current | GET | Location | No | None | Medium | |
| /api/enhanced-delivery-fee/calculate | GET | Enhanced Delivery Fee | Yes | Customer | Low | |
| /api/enhanced-delivery-fee/calculate-for-address | POST | Enhanced Delivery Fee | Yes | Customer | Low | |
| /api/enhanced-delivery-fee/config | GET | Enhanced Delivery Fee | No | None | Medium | |
| /api/enhanced-delivery-fee/estimate | POST | Enhanced Delivery Fee | No | None | Medium | |
| /api/enhanced-delivery-fee/clear-cache | POST | Enhanced Delivery Fee | Yes | None | Medium | |
| /api/pincode/validate | POST | Pincode | No | None | Medium | |
| /api/pincode/validate-bulk | POST | Pincode | No | None | Medium | |
| /api/pincode/ranges | GET | Pincode | No | None | Medium | |
| /api/pincode/check/:pincode | GET | Pincode | No | None | Medium | |
| /api/pincodes/validate | POST | Pincode Routes | No | None | Medium | Duplicate route family |
| /api/pincodes/validate-bulk | POST | Pincode Routes | No | None | Medium | Duplicate route family |
| /api/pincodes/ranges | GET | Pincode Routes | No | None | Medium | Duplicate route family |
| /api/pincodes/check/:pincode | GET | Pincode Routes | No | None | Medium | Duplicate route family |
| /api/delivery/calculate-fee | POST | Delivery Routes | No | None | Fatal | Duplicate route family |
| /api/delivery/fee-tiers | GET | Delivery Routes | No | None | Medium | |
| /api/notifications | GET | Notifications | Yes | Customer | Low | |
| /api/notifications/unread/count | GET | Notifications | Yes | Customer | Low | |
| /api/notifications/test-all-channels | POST | Notifications | Yes | Customer | High | |
| /api/notifications/read-all | PUT | Notifications | Yes | Customer | Low | |
| /api/notifications/:notificationId/read | PUT | Notifications | Yes | Customer | Low | |
| /api/notifications/:notificationId | DELETE | Notifications | Yes | Customer | Low | |
| /api/notification-test/dispatch | POST | Notification Test | Yes | Customer | High | |
| /api/notification-test/test-all-channels | POST | Notification Test | Yes | Customer | High | Duplicate route family |
| /api/notification-test/cart-reminders | POST | Notification Test | Yes | Customer | High | |
| /api/notification-test/payment-reminders | POST | Notification Test | Yes | Customer | High | |
| /api/notification-test/events | GET | Notification Test | No | None | Medium | |
| /api/payments/test | GET | Payments | No | None | High | |
| /api/payments/create-order | POST | Payments | Yes | Customer | Low | |
| /api/payments/verify | POST | Payments | No | None | Fatal | |
| /api/payments/details/:payment_id | GET | Payments | No | None | High | |
| /api/payments/callback | POST | Payments | No | None | Fatal | |
| /api/webhooks/razorpay | POST | Webhooks | No | None | Fatal | |
| /api/razorpay/create-order | POST | Razorpay | Yes | Customer | Low | Duplicate route family |
| /api/razorpay/verify-payment | POST | Razorpay | Yes | Customer | Low | Duplicate route family |
| /api/razorpay/webhook | POST | Razorpay | No | None | Fatal | Duplicate route family |
| /api/products/search/suggestions | GET | Products | No | None | Low | |
| /api/products/:id | GET | Products | No | None | Low | |
| /api/products/:id | PUT | Products | Yes | Admin | Low | |
| /api/products/:id | DELETE | Products | Yes | Admin | Low | |
| /api/products | POST | Products | No | None | Fatal | |
| /api/products | GET | Products | No | None | Low | |
| /api/products/categories | GET | Products | No | None | Low | |
| /api/products/:id/similar | GET | Products | No | None | Low | |
| /api/products/debug/product-images/:id | GET | Products | No | None | Fatal | |
| /api/search | GET | Search | No | None | Low | |
| /api/search/suggestions | GET | Search | No | None | Medium | Duplicate route family |
| /api/otp/verification/generate | POST | OTP | No | None | Medium | |
| /api/otp/debug/generate | POST | OTP | No | None | Fatal | |
| /api/otp/debug/sms | POST | OTP | No | None | Fatal | |
| /api/otp/payment/generate | POST | OTP | Yes | Customer | Medium | |
| /api/otp/payment/verify | POST | OTP | Yes | Customer | Medium | |
| /api/otp/payment/resend | POST | OTP | Yes | Customer | Medium | |
| /api/uploads/cloudinary | POST | Uploads | No | None | Fatal | |
| /api/verify-mobile | POST | Mobile Verify | No | None | Medium | |
| /api/auth/signup | POST | Auth | No | None | Medium | |
| /api/auth/login | POST | Auth | No | None | Medium | |
| /api/auth/oauth | POST | Auth | No | None | Medium | |
| /api/auth/refresh | POST | Auth | No | None | Medium | |
| /api/auth/logout | POST | Auth | Yes | Customer | Low | |
| /api/auth/change-password | POST | Auth | Yes | Customer | Low | |
| /api/auth/complete-profile | POST | Auth | Yes | Customer | Low | |
| /api/auth/complete-profile | PUT | Auth | Yes | Customer | Low | |
| /api/auth/me | GET | Auth | Yes | Customer | Low | |
| /api/auth/delete-account | DELETE | Auth | Yes | Customer | Low | |
| /api/auth/send-otp | POST | Auth | No | None | Medium | |
| /api/auth/verify-otp | POST | Auth | No | None | Medium | |
| /api/auth/check-phone | POST | Auth | No | None | Medium | |
| /api/auth/google | GET | Auth | No | None | Medium | |
| /api/auth/google/callback | GET | Auth | No | None | Medium | |
| /api/user/profile | GET | User | Yes | Customer | Low | |
| /api/user/profile | PUT | User | Yes | Customer | Low | |
| /api/user/verify-mobile | POST | User | No | None | Medium | |
| /api/user/addresses | GET | User | Yes | Customer | Low | |
| /api/user/addresses | POST | User | Yes | Customer | Low | |
| /api/user/addresses/:addressId | PUT | User | Yes | Customer | Low | |
| /api/user/addresses/:addressId | DELETE | User | Yes | Customer | Low | |
| /api/user/addresses/:addressId/default | PATCH | User | Yes | Customer | Low | |
| /api/user/notification-preferences | GET | User | Yes | Customer | Low | |
| /api/user/notification-preferences | PUT | User | Yes | Customer | Low | |
| /api/user/delete-account | DELETE | User | Yes | Customer | Low | |
