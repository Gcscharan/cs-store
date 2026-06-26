# PROJECT_MODULES.md — Master Module Inventory
## VyaparSetu / Dream — Launch Command Center

> Code-backed module inventory grouped by launch criticality. Derived from `backend/domains/`,
> `routes/`, `models/`, `services/`, web `pages/`, mobile `screens/api/`. See `MASTER_PRD.md`
> for full per-module evidence.

**Generated:** 2026-06-20

---

## TIER 1 — REVENUE CRITICAL (must be 100% to launch)

| # | Module | Backend home | Web | Mobile | Status |
|---|--------|--------------|-----|--------|--------|
| 1 | Authentication | `domains/identity/routes/auth.ts` | LoginPage/SignupPage/OAuthCallback | `screens/auth` (6) | WORKING |
| 2 | Customer Registration | auth `signup`/onboarding | SignupPage/OnboardingPage | auth | WORKING |
| 3 | Login | auth `login`/`oauth`/`google-mobile` | LoginPage | auth | WORKING |
| 4 | Address Management | `domains/identity/routes/user.ts` addresses | Address(es)Page | `screens/address` (4) | WORKING (PII-log fixed) |
| 5 | Cart | `routes/cart.ts` | CartPage | `screens/cart` (1) | WORKING |
| 6 | Checkout | `routes/orders.ts` createOrder/cod | CheckoutPage | `screens/checkout` (5) | WORKING |
| 7 | Payments | `domains/payments/*` + `domains/finance/*` + `routes/upi.ts` | payments/ | razorpay | **PARTIAL (dual path)** |
| 8 | Order Creation | `routes/orders.ts` | OrderSuccess | checkout/orders | WORKING |
| 9 | Order Management | `routes/orders.ts` + `routes/admin.ts` | OrdersPage/AdminOrders | `screens/orders` (7) | WORKING |
| 10 | Inventory | `InventoryReservation`/`InventoryAdjustment`, `stockMonitorService` | admin | — | WORKING/PARTIAL |
| 11 | Product Catalog | `domains/catalog/routes/products.ts` | Products/ProductDetail | `screens/products` (3) | WORKING |
| 12 | Delivery Assignment | `orderAssignmentController`, CVRP services | AdminRoutes | admin | WORKING/PARTIAL |
| 13 | Delivery Execution | `routes/deliveryAuth.ts` lifecycle | DeliveryDashboard | `screens/delivery` (13) | WORKING |
| 14 | OTP Verification | auth OTP + delivery verify-otp | TestOtp(dev) | otp-verify | WORKING |
| 15 | Earnings | `deliveryEarningService`, `riderWalletService`, settlement job | delivery | delivery | WORKING/PARTIAL |
| 16 | Notifications | `domains/communication|notifications/*` | Notifications/Preferences | `screens/notifications` (1) | **PARTIAL (push stub)** |
| 17 | Admin Dashboard | `routes/admin.ts` | 18+ Admin pages | `screens/admin` (22) | WORKING |
| 18 | Analytics | `metricsService`, admin analytics | AdminAnalytics | admin | PARTIAL |
| 19 | Search | catalog search + semantic | SearchResults | `screens/search` (1) | PARTIAL |

## TIER 2 — OPERATIONAL (target before scale; not all launch-blocking)

| # | Module | Home | Status |
|---|--------|------|--------|
| 20 | Customer Tracking | `routes/orderTracking.ts`, `liveLocationStore` | WORKING/PARTIAL |
| 21 | Realtime Updates | `socketService.ts` | WORKING (event-name mismatches) |
| 22 | Sockets | `socketService`, `lowStockSocketService`, mobile `socketClient` | WORKING |
| 23 | Background Jobs | `jobs/*`, `queues/*`, `workers/*` | PARTIAL |
| 24 | Location Tracking | `locationService`, `geofenceService`, `kalmanFilter` | WORKING/PARTIAL |
| 25 | Offline Queue | mobile `offlineQueue`, `offlineMutationQueue` | PARTIAL |
| 26 | Cache Management | RTK Query (web+mobile) | WORKING |
| 27 | Reports | `internalFinanceReports`, metrics | PARTIAL |
| 28 | Coupons | `routes/coupons.ts` | WORKING |
| 29 | Reviews | `reviewService`, `Review` model | PARTIAL (route binding to verify) |
| 30 | Customer Support | HelpSupport/MessageCenter pages | PARTIAL (chat stub) |
| 31 | Pincode/Serviceability | `routes/pincodeRoutes.ts` | WORKING |
| 32 | Delivery Fee | `deliveryFee` + `delivery-fee-v2` | PARTIAL (dual) |
| 33 | Media/Video | `uploads`, `videoService`, `cloudinaryService` | PARTIAL |
| 34 | Invoice | `domains/invoice/*` + pdfkit | WORKING/PARTIAL |
| 35 | Feature Flags | `routes/featureFlagsApi.ts` | WORKING |

## TIER 3 — NON-LAUNCH (defer)

| # | Module | Home | Status |
|---|--------|------|--------|
| 36 | Voice AI | `voiceController`, `voiceRoutes`, queues-gated | PARTIAL (defer) |
| 37 | Voice Correction | `voiceCorrectionService` | PARTIAL (defer) |
| 38 | Recommendations / Personalized search | `personalizedSearchController`, `UserPreference` | PARTIAL (defer) |
| 39 | Semantic/Vector (Qdrant) | `vectorSearchService`, `embeddingService` | PARTIAL (defer) |
| 40 | Experiments / A-B | `experimentService`, queues-gated | PARTIAL (defer) |
| 41 | Advanced Analytics | metrics dashboards | PARTIAL (defer) |
| 42 | Referrals / Refer-and-Earn | `referralApi`, ReferAndEarnPage | PARTIAL (defer) |

---

### Module count: 42 discovered (19 Tier 1, 16 Tier 2, 7 Tier 3).

> Tier 1 launch gate: modules 1–19 must reach launch-ready. Currently blocked primarily by
> **Payments (dual path)** and **Notifications (push stub)**. See `LAUNCH_BOARD.md`.
