# Module Testing Architecture

**Purpose**: Break down the system into independently testable modules  
**Goal**: Validate each module before production deployment  
**Approach**: Behavior-based, not file-based

---

## MODULE LIST

### 1. Authentication System 🔴 CRITICAL

**Responsibilities**:
- User login/signup via OTP
- Session management (token refresh)
- Token persistence across app restarts
- Logout and session cleanup

**Key Flows**:
1. New user signup → OTP verification → Profile completion → Session created
2. Existing user login → OTP verification → Session restored
3. App restart → Token validation → Auto-login or redirect to login
4. Token expiry → Refresh token → Continue session
5. Logout → Clear tokens → Redirect to login

**Dependencies**:
- Backend: `/auth/send-otp`, `/auth/verify-otp`, `/auth/complete-profile`, `/auth/refresh`
- Storage: AsyncStorage (mobile), localStorage (web)
- No other modules

**Failure Scenarios**:
- Network failure during OTP send → Show retry option
- Invalid OTP → Show error, allow retry (max 3 attempts)
- Token refresh fails → Force logout
- Storage unavailable → Treat as logged out

**Test Coverage Scope**:
- [ ] New user can signup and complete profile
- [ ] Existing user can login
- [ ] Session persists after app restart
- [ ] Token refresh works on 401 response
- [ ] Logout clears all session data
- [ ] Invalid OTP shows error
- [ ] Network failure handled gracefully

**Exit Criteria**: ✅ All 7 test cases pass

---

### 2. Address Management System 🔴 CRITICAL

**Responsibilities**:
- GPS location detection
- Reverse geocoding (GPS → address)
- Pincode validation (deliverability check)
- Address CRUD operations
- Default address management

**Key Flows**:
1. GPS detection → Reverse geocode → Pincode validation → Form pre-fill → Save
2. Manual entry → Pincode validation → City/state auto-fill → Save
3. Edit address → Update validation → Save
4. Delete address → Confirm → Remove
5. Set default address → Update backend → Reflect in UI

**Dependencies**:
- Backend: `/pincode/check/:pincode`, `/addresses` (CRUD)
- External: Expo Location API, Google Maps (reverse geocoding)
- Modules: Authentication (requires logged-in user)

**Failure Scenarios**:
- GPS permission denied → Show manual entry option
- GPS timeout (>30s) → Show error, fallback to manual
- Reverse geocoding fails → Show partial data, allow manual completion
- Pincode API fails → Show error, prevent submission
- Non-deliverable pincode → Block submission, show error
- Network failure during save → Show retry option

**Test Coverage Scope**:
- [ ] GPS detection works and pre-fills form
- [ ] Manual pincode entry triggers validation
- [ ] Non-deliverable pincode blocks submission
- [ ] GPS pincode validated once (not redundantly)
- [ ] Manual edit after GPS triggers new validation
- [ ] Address saves successfully
- [ ] Default address updates correctly
- [ ] Validation source tracking works (GPS vs manual)

**Exit Criteria**: ✅ All 8 test cases pass + API call volume ≤ 2 per entry

---

### 3. Product Catalog System 🟡 IMPORTANT

**Responsibilities**:
- Display product listings
- Product search and filtering
- Product detail view
- Category navigation
- Image loading and caching

**Key Flows**:
1. App launch → Fetch products → Display grid
2. Search query → Filter products → Display results
3. Select product → Fetch details → Display detail page
4. Browse categories → Filter by category → Display results

**Dependencies**:
- Backend: `/products`, `/products/:id`, `/categories`
- No other modules (works without auth)

**Failure Scenarios**:
- Network failure → Show cached products or empty state
- Image load failure → Show placeholder
- Search returns no results → Show "no results" message
- API timeout → Show retry option

**Test Coverage Scope**:
- [ ] Products load on app launch
- [ ] Search filters products correctly
- [ ] Product details display correctly
- [ ] Images load or show placeholder
- [ ] Network failure shows appropriate message

**Exit Criteria**: ✅ All 5 test cases pass

---

### 4. Shopping Cart System 🔴 CRITICAL

**Responsibilities**:
- Add/remove items from cart
- Update item quantities
- Cart persistence (local + backend sync)
- Price calculation (subtotal, GST, delivery fee)
- Cart validation before checkout

**Key Flows**:
1. Add to cart → Update local state → Sync to backend (if logged in)
2. Update quantity → Recalculate prices → Sync to backend
3. Remove item → Update cart → Sync to backend
4. App restart → Load cart from backend (if logged in) or local storage
5. Checkout → Validate cart → Navigate to checkout

**Dependencies**:
- Backend: `/cart` (CRUD)
- Modules: Authentication (for backend sync), Product Catalog
- Storage: Redux + AsyncStorage/localStorage

**Failure Scenarios**:
- Backend sync fails → Continue with local cart, retry later
- Product out of stock → Show error, remove from cart
- Price mismatch → Show warning, update prices
- Empty cart checkout → Block navigation, show message

**Test Coverage Scope**:
- [ ] Add to cart works (local + backend)
- [ ] Update quantity recalculates prices
- [ ] Remove item updates cart
- [ ] Cart persists after app restart
- [ ] Backend sync works when logged in
- [ ] Backend sync failure doesn't break cart
- [ ] Price calculation is correct (subtotal + GST + delivery)
- [ ] Empty cart blocks checkout

**Exit Criteria**: ✅ All 8 test cases pass

---

### 5. Checkout System 🔴 CRITICAL

**Responsibilities**:
- Address selection/validation
- Payment method selection
- Order summary display
- Price breakdown (items, GST, delivery, total)
- Order creation (pre-payment)

**Key Flows**:
1. Navigate to checkout → Validate address → Display summary
2. Select/change address → Recalculate delivery fee → Update total
3. Select payment method → Validate selection → Enable checkout button
4. Place order → Create order in backend → Proceed to payment

**Dependencies**:
- Backend: `/orders` (POST), `/pincode/check/:pincode`
- Modules: Authentication, Address Management, Shopping Cart
- External: None (payment is separate module)

**Failure Scenarios**:
- No address selected → Block checkout, show message
- Invalid address (missing GPS) → Block checkout, show error
- Non-deliverable pincode → Block checkout, show error
- Cart empty → Redirect to cart
- Order creation fails → Show error, allow retry

**Test Coverage Scope**:
- [ ] Checkout loads with correct address
- [ ] Address change recalculates delivery fee
- [ ] Invalid address blocks checkout
- [ ] Payment method selection works
- [ ] Order creation succeeds
- [ ] Order creation failure shows error
- [ ] Price breakdown is accurate

**Exit Criteria**: ✅ All 7 test cases pass

---

### 6. Payment System 🔴 CRITICAL

**Responsibilities**:
- Payment gateway integration (Razorpay/UPI)
- Payment initiation
- Payment status polling (backend verification)
- Payment success/failure handling
- Order confirmation after payment

**Key Flows**:
1. **Web**: Order created → Razorpay SDK → Payment success → Backend polling → Navigate to success
2. **Mobile**: Order created → UPI deep link → App switch → Return to app → Backend polling → Navigate to success
3. **COD**: Order created → Mark as COD → Navigate to success (no payment needed)
4. Payment failure → Show error → Allow retry (max 3 attempts)
5. Payment pending → Poll backend → Show status → Navigate when confirmed

**Dependencies**:
- Backend: `/orders/:id/payment-intent`, `/orders/:id` (GET for status)
- External: Razorpay API (web), UPI apps (mobile)
- Modules: Authentication, Checkout System

**Failure Scenarios**:
- Payment gateway down → Show error, suggest COD
- User cancels payment → Return to checkout, preserve order
- Payment success but backend not updated → Poll until confirmed (120s timeout)
- Polling timeout → Show "pending" status, allow manual check
- Network failure during polling → Retry with exponential backoff
- Duplicate payment attempt → Idempotency key prevents duplicate order

**Test Coverage Scope**:
- [ ] **Web**: Razorpay payment flow completes
- [ ] **Mobile**: UPI payment flow completes
- [ ] COD order creation works
- [ ] Payment success triggers backend polling
- [ ] Backend polling confirms payment before navigation
- [ ] Payment failure shows error and allows retry
- [ ] Payment cancellation preserves order
- [ ] Polling timeout handled gracefully
- [ ] Idempotency prevents duplicate orders
- [ ] No direct navigation on client-side success

**Exit Criteria**: ✅ All 10 test cases pass + Payment success rate ≥ 95%

---

### 7. Order Management System 🔴 CRITICAL

**Responsibilities**:
- Order history display
- Order detail view
- Order status tracking
- Order cancellation
- Refund requests

**Key Flows**:
1. Navigate to orders → Fetch order list → Display with status
2. Select order → Fetch details → Display full order info
3. Track order → Display status timeline → Show delivery partner info
4. Cancel order → Confirm → Send cancellation request → Update status
5. Request refund → Submit request → Show confirmation

**Dependencies**:
- Backend: `/orders`, `/orders/:id`, `/orders/:id/cancel`, `/orders/:id/refund`
- Modules: Authentication, Payment System

**Failure Scenarios**:
- Network failure → Show cached orders or empty state
- Order not found → Show error message
- Cancellation fails → Show error, allow retry
- Refund request fails → Show error, allow retry

**Test Coverage Scope**:
- [ ] Order list loads correctly
- [ ] Order details display correctly
- [ ] Order status updates in real-time
- [ ] Order cancellation works
- [ ] Refund request works
- [ ] Network failure handled gracefully

**Exit Criteria**: ✅ All 6 test cases pass

---

### 8. Delivery Tracking System 🟡 IMPORTANT

**Responsibilities**:
- Real-time order tracking
- Delivery partner information
- Estimated delivery time
- Order status timeline
- Live location tracking (if available)

**Key Flows**:
1. Order placed → Show initial status → Update as order progresses
2. Order assigned to partner → Show partner details
3. Out for delivery → Show live tracking (if available)
4. Delivered → Show confirmation → Request feedback

**Dependencies**:
- Backend: `/orders/:id`, `/orders/:id/tracking`
- Modules: Authentication, Order Management System

**Failure Scenarios**:
- Tracking data unavailable → Show last known status
- Network failure → Show cached status
- Partner not assigned → Show "preparing order" status

**Test Coverage Scope**:
- [ ] Order status displays correctly
- [ ] Status updates in real-time
- [ ] Delivery partner info shows when available
- [ ] Timeline displays correctly
- [ ] Network failure handled gracefully

**Exit Criteria**: ✅ All 5 test cases pass

---

### 9. Notification System 🟡 IMPORTANT

**Responsibilities**:
- Push notification handling
- In-app notification display
- Notification list with pagination
- Mark as read functionality
- Notification preferences

**Key Flows**:
1. Receive push notification → Display alert → Navigate to relevant screen
2. Open notifications → Fetch list → Display with pagination
3. Tap notification → Mark as read → Navigate to detail
4. Load more → Fetch next page → Append to list

**Dependencies**:
- Backend: `/notifications`, `/notifications/:id/read`
- External: Firebase Cloud Messaging (FCM) or APNs
- Modules: Authentication

**Failure Scenarios**:
- Push notification permission denied → Disable push, show in-app only
- Network failure → Show cached notifications
- Pagination fails → Show error, allow retry

**Test Coverage Scope**:
- [ ] Push notifications received
- [ ] In-app notifications display
- [ ] Pagination works correctly
- [ ] Mark as read works
- [ ] Navigation from notification works

**Exit Criteria**: ✅ All 5 test cases pass

---

### 10. User Profile System 🟢 OPTIONAL

**Responsibilities**:
- Display user profile
- Edit profile information
- Change password/phone
- Logout

**Key Flows**:
1. View profile → Display user info
2. Edit profile → Update fields → Save → Refresh display
3. Change phone → Send OTP → Verify → Update
4. Logout → Clear session → Navigate to login

**Dependencies**:
- Backend: `/users/me`, `/users/me` (PUT), `/auth/change-phone`
- Modules: Authentication

**Failure Scenarios**:
- Network failure → Show cached profile
- Update fails → Show error, allow retry
- Phone change OTP fails → Show error, allow retry

**Test Coverage Scope**:
- [ ] Profile displays correctly
- [ ] Profile update works
- [ ] Phone change works
- [ ] Logout works

**Exit Criteria**: ✅ All 4 test cases pass

---

## TEST EXECUTION ORDER

### Phase 1: Foundation (Must Pass First)
1. **Authentication System** 🔴
   - Everything depends on this
   - Test first, fix completely before proceeding

### Phase 2: Core Commerce (Test in Order)
2. **Product Catalog System** 🟡
   - Independent, can test in parallel with auth
3. **Shopping Cart System** 🔴
   - Depends on: Auth, Product Catalog
4. **Address Management System** 🔴
   - Depends on: Auth
   - Critical for checkout

### Phase 3: Transaction Flow (Test in Order)
5. **Checkout System** 🔴
   - Depends on: Auth, Cart, Address
6. **Payment System** 🔴
   - Depends on: Auth, Checkout
   - Most critical - test thoroughly

### Phase 4: Post-Purchase (Can Test in Parallel)
7. **Order Management System** 🔴
   - Depends on: Auth, Payment
8. **Delivery Tracking System** 🟡
   - Depends on: Auth, Orders

### Phase 5: Supporting Features (Test Last)
9. **Notification System** 🟡
   - Depends on: Auth
10. **User Profile System** 🟢
    - Depends on: Auth

---

## MODULE TESTING TRACKER

| Module | Criticality | Status | Blocker | Notes |
|--------|-------------|--------|---------|-------|
| Authentication | 🔴 | ⏳ | - | Foundation - test first |
| Address Management | 🔴 | ⏳ | Auth | Recent fixes - verify thoroughly |
| Product Catalog | 🟡 | ⏳ | - | Can test in parallel |
| Shopping Cart | 🔴 | ⏳ | Auth, Products | Test sync logic |
| Checkout | 🔴 | ⏳ | Auth, Cart, Address | Validate price calculations |
| Payment | 🔴 | ⏳ | Auth, Checkout | Most critical - test all flows |
| Order Management | 🔴 | ⏳ | Auth, Payment | Test status updates |
| Delivery Tracking | 🟡 | ⏳ | Auth, Orders | Test real-time updates |
| Notifications | 🟡 | ⏳ | Auth | Test pagination |
| User Profile | 🟢 | ⏳ | Auth | Test last |

**Legend**:
- ⏳ Not Started
- 🔄 In Progress
- ✅ Pass
- ❌ Fail
- ⚠️ Pass with Issues

---

## FINAL SYSTEM READINESS CRITERIA

### Condition 1: All Critical Modules Pass ✅
- [ ] Authentication System: ✅ PASS
- [ ] Address Management System: ✅ PASS
- [ ] Shopping Cart System: ✅ PASS
- [ ] Checkout System: ✅ PASS
- [ ] Payment System: ✅ PASS
- [ ] Order Management System: ✅ PASS

**Rationale**: System cannot function if any critical module fails

---

### Condition 2: Key Metrics Meet Targets ✅
- [ ] Payment success rate ≥ 95%
- [ ] Address validation failure < 5%
- [ ] API call volume ≤ 2 per address entry
- [ ] Order completion rate ≥ 85%
- [ ] Cart sync success rate ≥ 98%

**Rationale**: Metrics prove system reliability under real conditions

---

### Condition 3: End-to-End Flows Complete ✅
- [ ] **Happy Path**: Login → Browse → Add to Cart → Checkout → Pay → Order Success
- [ ] **GPS Flow**: Login → GPS Address → Checkout → Pay → Order Success
- [ ] **Manual Flow**: Login → Manual Address → Checkout → Pay → Order Success
- [ ] **COD Flow**: Login → Address → Checkout → COD → Order Success
- [ ] **Failure Recovery**: Payment Fail → Retry → Success

**Rationale**: Real users follow complete flows, not isolated modules

---

### Condition 4: Failure Scenarios Handled ✅
- [ ] Network failure during checkout → Graceful error, retry option
- [ ] Payment gateway down → Show error, suggest COD
- [ ] GPS timeout → Fallback to manual entry
- [ ] Non-deliverable pincode → Block submission, clear message
- [ ] Token expiry → Auto-refresh or force logout

**Rationale**: Production will have failures - system must handle them

---

### Condition 5: Monitoring and Rollback Ready ✅
- [ ] Production logs implemented (PINCODE_VALIDATION, PAYMENT_STATUS)
- [ ] Monitoring dashboard configured
- [ ] Alert thresholds defined
- [ ] Rollback plan documented and tested
- [ ] Incident response team briefed

**Rationale**: Can't fix what you can't see - monitoring is critical

---

## PRODUCTION READINESS DECISION MATRIX

| Scenario | Decision |
|----------|----------|
| All 5 conditions met | ✅ **DEPLOY TO PRODUCTION** |
| Conditions 1-3 met, 4-5 partial | ⚠️ **DEPLOY WITH CAUTION** (10% rollout) |
| Condition 1 has failures | 🔴 **DO NOT DEPLOY** (fix critical modules first) |
| Condition 2 metrics below target | 🔴 **DO NOT DEPLOY** (investigate and fix) |
| Condition 3 flows incomplete | 🔴 **DO NOT DEPLOY** (complete E2E testing) |

---

## TESTING EXECUTION PLAN

### Week 1: Foundation Testing
- **Day 1-2**: Authentication System
- **Day 3**: Product Catalog System (parallel)
- **Day 4**: Shopping Cart System
- **Day 5**: Address Management System

### Week 2: Transaction Testing
- **Day 1-2**: Checkout System
- **Day 3-4**: Payment System (all flows)
- **Day 5**: End-to-end happy path

### Week 3: Post-Purchase & Polish
- **Day 1**: Order Management System
- **Day 2**: Delivery Tracking System
- **Day 3**: Notification System
- **Day 4**: User Profile System
- **Day 5**: Failure scenario testing

### Week 4: Final Validation
- **Day 1-2**: All end-to-end flows
- **Day 3**: Performance and load testing
- **Day 4**: Security review
- **Day 5**: Final sign-off and deployment prep

---

## SUCCESS CRITERIA SUMMARY

**System is PRODUCTION READY when**:
1. ✅ All 6 critical modules pass all test cases
2. ✅ Key metrics meet or exceed targets
3. ✅ All 5 end-to-end flows complete successfully
4. ✅ All failure scenarios handled gracefully
5. ✅ Monitoring and rollback infrastructure ready

**Confidence Level**: 95%+ (based on test coverage and metrics)

**Final Approval Required From**:
- [ ] Engineering Lead (code quality)
- [ ] QA Lead (test coverage)
- [ ] Product Manager (feature completeness)
- [ ] DevOps (infrastructure readiness)

---

**Remember**: Testing is not about finding zero bugs. It's about understanding the system's behavior under all conditions and having confidence that failures are handled gracefully. A well-tested system with known limitations is better than an untested system with unknown risks.
