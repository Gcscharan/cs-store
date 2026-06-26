# MASTER PRD — VyaparSetu / Dream Project
## Source-of-Truth Product Requirements Document (Code-Backed)

> **Document type:** Reverse-engineered, code-backed PRD. Every claim is grounded in
> files that exist in this repository. Where a claim could not be verified from code,
> it is explicitly marked `UNVERIFIED`.
>
> **Generated:** 2026-06-20
> **Repo root:** `/Users/.../Desktop/Dream`
> **Method:** Structural traversal of `backend/`, `frontend/`, `apps/customer-app/`,
> `packages/`, route/controller/service/model inventories, RTK Query + socket layers.

---

### ⚠️ Honesty & Methodology Statement (read first)

This codebase is **~302,622 lines across ~1,944 source files** (measured via `find` + `wc -l`,
excluding `node_modules`/`dist`). Distribution:

| Area | Source files (.ts/.tsx/.js/.jsx) |
|------|----------------------------------|
| `backend/` | ~1,248 |
| `apps/customer-app/` (mobile) | ~331 |
| `frontend/` (web) | ~319 |
| `packages/` (shared) | ~21 |
| **Total** | **~1,944** |

No human or tool can read 302K lines at perfect fidelity in one pass and honestly claim
total recall. This document is therefore built from **systematic inspection of the files that
define behavior** — route registrations, controllers, services, Mongoose models, RTK Query
definitions, navigation/routers, socket layers, queues, and jobs — cross-referenced against
the repo's own (numerous) audit/status markdown files.

**Status vocabulary used throughout:**

| Marker | Meaning |
|--------|---------|
| `WORKING` | Implementation present end-to-end (UI/caller → API → service → model) and wired. |
| `PARTIAL` | Core path implemented; gaps, stubs, or TODOs reduce completeness. |
| `BROKEN` | UI/caller exists but backend missing, disabled, or returns error/410. |
| `INCOMPLETE` | Backend exists but no/limited UI or caller to reach it. |
| `DEAD CODE` | Present but unreachable / superseded / `.bak`. |
| `MISSING` | Referenced or expected but not found in code. |
| `UNVERIFIED` | Could not confirm from static inspection alone (needs runtime check). |

Confidence levels (`High/Med/Low`) are attached to scored estimates. Percentages are
**engineering judgment from structural evidence**, not measured test coverage.

---

## Table of Contents

1. [Section 1 — Executive Summary](#section-1--executive-summary)
2. [Section 2 — Platform Breakdown](#section-2--platform-breakdown)
3. [Section 3 — Complete Module Inventory](#section-3--complete-module-inventory)
4. [Section 4 — Web Application](#section-4--web-application)
5. [Section 5 — Mobile Application](#section-5--mobile-application)
6. [Section 6 — Workflow Catalog](#section-6--workflow-catalog)
7. [Section 7 — API Inventory](#section-7--api-inventory)
8. [Section 8 — Database Inventory](#section-8--database-inventory)
9. [Section 9 — Socket Inventory](#section-9--socket-inventory)
10. [Section 10 — Cache Inventory (RTK Query)](#section-10--cache-inventory-rtk-query)
11. [Section 11 — Offline System Inventory](#section-11--offline-system-inventory)
12. [Section 12 — Security Inventory](#section-12--security-inventory)
13. [Section 13 — Background Jobs & Queues](#section-13--background-jobs--queues)
14. [Section 14 — Final Scorecard](#section-14--final-scorecard)

> Companion documents (generated alongside this file):
> - `ALL_BUGS.md` — discovered issues / risks
> - `DEAD_CODE.md` — unused / superseded code inventory

---

## Section 1 — Executive Summary

### Project Identity

| Field | Value | Source |
|-------|-------|--------|
| **Project Name** | VyaparSetu (monorepo `vyaparsetu-monorepo`); backend pkg `cps-store-backend`, web pkg `cps-store-frontend` | `package.json`, `backend/package.json`, `frontend/package.json` |
| **Description** | "VyaparSetu - Complete E-commerce Platform (Web + Mobile)" | root `package.json` → `description` |
| **Repository** | `https://github.com/Gcscharan/cs-store.git` | root `package.json` → `repository` |
| **Vision (inferred)** | Full-stack quick-commerce / e-commerce platform for the Indian market with customer web + mobile, a delivery-partner app, an admin console, UPI/Razorpay payments, real-time order tracking, route optimization, and voice-driven shopping. | inferred from modules: `upi`, `razorpay`, `cvrpRouteAssignmentService`, `voiceController`, `Pincode` model (India), `serviceablePincodes.ts` |
| **Target Market** | India (Pincode-based serviceability, UPI/VPA payments, Razorpay, Fast2SMS) | `config/serviceablePincodes.ts`, `models/Pincode.ts`, `utils/maskUpiVpa.ts`, `backend/SMS_SETUP.md` |

### Target Users (three personas, code-backed by role handling & navigators)

1. **Customers** — web (`frontend/`) + mobile (`apps/customer-app/`). Browse, cart, checkout, track orders.
2. **Delivery partners** — web (`DeliveryDashboard.tsx`, `DeliveryNavigator.tsx`) + mobile (`screens/delivery/`, 13 screens). Accept routes, collect COD/UPI, OTP delivery, earnings.
3. **Admins / Ops** — web admin pages (`pages/Admin*`, 18+ admin pages) + mobile admin (`screens/admin/`, 22 screens). Manage products, orders, routes, finance, tracking, users.

Role separation evidenced by `middleware/auth.ts`, `middleware/reviewAuth.ts`, `deliveryAuthController.ts`, dedicated `DeliveryBoy` model vs `User` model, and `RootNavigator.tsx` branching.

### Primary Revenue Model (inferred from code)

- **Product sales** with **delivery fees** (`deliveryFeeService.ts`, `enhancedDeliveryFeeController.ts`, two versions: `/delivery-fee` and `/delivery-fee-v2`).
- **Payments** via **COD**, **UPI**, and **Razorpay** (`routes/orders.ts` `placeOrderCOD`, `routes/upi.ts`, `domains/payments/`, `razorpay` dep).
- **Coupons / discounts** (`models/Coupon.ts`, `routes/coupons.ts`).
- GST/price calculation present (`utils/priceCalculator.ts`).

### Architecture Overview (verified)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                               │
│  ┌────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │ Web (Vite +     │  │ Mobile (Expo /     │  │ Admin (web pages + │  │
│  │ React 19 +      │  │ RN 0.83, React 19) │  │ mobile admin nav)  │  │
│  │ RTK Query)      │  │ RTK Query+persist  │  │                    │  │
│  └───────┬────────┘  └─────────┬──────────┘  └─────────┬──────────┘  │
└──────────┼─────────────────────┼───────────────────────┼─────────────┘
           │ HTTPS (axios)        │ HTTPS + socket.io      │
           ▼                      ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express 4 + TypeScript, createApp.ts)                        │
│  /api router → ~40 route groups → controllers → ~50 services → models  │
│  socket.io (socketService.ts) · BullMQ queues · workers · cron jobs    │
└───────┬───────────────┬───────────────┬───────────────┬──────────────┘
        ▼               ▼               ▼               ▼
   MongoDB         Redis/ioredis    Qdrant (vector)  External APIs
   (Mongoose 8)    (cache+BullMQ)   (semantic search) Razorpay, Google
   40 models                                          Maps, Cloudinary,
                                                       Fast2SMS, Resend,
                                                       Algolia, Sentry
```

**Verified infrastructure dependencies** (from `backend/package.json`):
- DB: `mongoose@8`, `mongodb@6`
- Cache/Queue: `ioredis`, `redis`, `bullmq`, `@bull-board/*`
- Payments: `razorpay`
- Maps/geo: `@googlemaps/google-maps-services-js`, `@mapbox/polyline`
- Media: `cloudinary`, `sharp`
- Search: `@qdrant/js-client-rest`, `algoliasearch`
- Messaging/email: `nodemailer`, `resend`, SMS via `utils/sms.ts` (Fast2SMS per docs)
- Auth: `jsonwebtoken`, `passport` (`-jwt`, `-google-oauth20`, `-facebook`), `google-auth-library`
- Realtime: `socket.io`
- Observability: `@sentry/node`
- Events: `kafkajs` (present — usage `UNVERIFIED`, see ALL_BUGS)
- Docs/validation: `swagger-jsdoc`, `swagger-ui-express`, `express-openapi-validator`, `express-validator`

### Deployment Overview (verified from config files)

- **Docker:** `docker-compose.yml`, `.dev.yml`, `.prod.yml`, `.railway.yml`, `.override.yml`; `backend/Dockerfile`, `frontend/Dockerfile`, `nginx/`.
- **Railway:** `backend/railway.toml`, `frontend/railway.toml`, `docker-compose.railway.yml`.
- **Vercel:** `vercel.json` (web).
- **Mobile:** Expo / EAS (`eas.json`, `apps/customer-app/eas.json`, `android/`, `ios/`).
- **CI:** `.github/workflows/test.yml`, `tests.yml`; backend `ci:*` guard scripts (payment-safety invariants enforced at build, see below).

### Tech Stack Overview

| Layer | Stack | Version evidence |
|-------|-------|------------------|
| Web | React 19, Vite 6, Redux Toolkit + RTK Query, react-router-dom 6, Tailwind 3, framer-motion, recharts, socket.io-client | `frontend/package.json` |
| Mobile | Expo ~55, React Native 0.83, React 19, RTK Query, redux-persist, react-navigation 7, react-native-maps, expo-notifications, expo-location, react-native-razorpay | `apps/customer-app/package.json` |
| Backend | Node + Express 4, TypeScript 5, Mongoose 8, socket.io, BullMQ | `backend/package.json` |
| Shared | `packages/*` workspaces: `@vyaparsetu/shared-utils`, `@vyaparsetu/i18n`, `@vyaparsetu/types` | root `workspaces`, mobile deps |

### Current Completion % (engineering estimate — see Section 14 for derivation)

| Dimension | Estimate | Confidence |
|-----------|----------|------------|
| Backend feature completion | **~80%** | Med |
| Web app completion | **~75%** | Med |
| Mobile app completion | **~70%** | Low–Med |
| Overall feature completion | **~75%** | Med |
| **Launch readiness** | **~62%** | Low–Med |
| Production readiness (infra/security) | **~65%** | Low–Med |
| Technical debt level | **High** (large volume of overlapping "FINAL/COMPLETE" docs, duplicated payment paths, `.bak` files, TODO clusters) | Med |

> These are structural estimates. They are **not** measured by passing tests. The repo
> contains extensive test infra (jest, playwright, fast-check, k6, schemathesis) but actual
> current pass/fail state is `UNVERIFIED` in this document (not executed here).

### Critical Risks (top, code-backed)

1. **Duplicated / overlapping payment architectures.** Both legacy (`domains/finance/routes/paymentRoutes.ts` mounted at `/payment`) and new (`domains/payments/*` at `/payment-intents`, `/payment-status`, `/payments`, `/webhooks`) coexist. CI guard scripts (`ci:check-legacy-payment-lock`, `ci:check-finalizer-authority`) exist precisely to police this — indicating known fragility. **Risk: double-charge / inconsistent finalization.**
2. **Mobile API base URL hardcoded to a developer's machine.** `apps/customer-app/src/api/baseApi.ts` falls back to `http://GCSCharans-MacBook-Air.local:5002/api`. **BROKEN for production** unless `EXPO_PUBLIC_API_URL` is always set. (See ALL_BUGS BUG-001.)
3. **Push notifications are stubbed.** Multiple `notificationService.ts` TODOs ("Implement Push notification service", "Fetch user's FCM token", "Implement WhatsApp Business API"). Customer push delivery `PARTIAL/INCOMPLETE`.
4. **Alerting integrations stubbed.** `queues/alerts.ts` Slack/PagerDuty are `logger.info("Would send...")` placeholders → no real production paging.
5. **Debug routes exposed.** `/api/debug` (`debugDbTestRoutes`) and web `/debug`, `/test-otp` routes present. **Security risk if shipped.**
6. **`kafkajs` dependency** with unclear wiring — possible dead/aspirational infra.
7. **Verbose PII-adjacent logging.** `getAddresses` in `frontend/src/store/api.ts` logs full address payloads to console. UPI masking utility exists (`maskUpiVpa.ts`) implying past raw-VPA leakage concerns (CI guard `ci:check-no-raw-vpa-logs`).
8. **`.bak` page files** in `frontend/src/pages` (`CheckoutPage.tsx.bak`, `ProductDetailPageOld.tsx.bak`) — dead code in the source tree.

### Top Launch Blockers (representative — full list in ALL_BUGS.md)

The user requested "Top 50". Below are the **highest-impact, code-evidenced** blockers (P0/P1). Lower-priority items continue in `ALL_BUGS.md`.

| # | Blocker | Sev | Evidence |
|---|---------|-----|----------|
| 1 | Mobile base URL hardcoded to dev laptop hostname | P0 | `apps/customer-app/src/api/baseApi.ts` |
| 2 | Dual payment paths (legacy + new) risk inconsistent finalization | P0 | `createApp.ts` mounts `/payment` + `/payment-intents`+`/payments` |
| 3 | Push notifications not implemented (TODOs) | P0 | `domains/communication/services/notificationService.ts`, `domains/notifications/services/notificationService.ts` |
| 4 | Debug/test endpoints exposed in API + web | P0 | `routes/debugDbTest.ts`, web `/debug`, `/test-otp` |
| 5 | Production alerting stubbed (Slack/PagerDuty no-op) | P1 | `queues/alerts.ts` |
| 6 | WhatsApp notification channel stubbed | P1 | `domains/communication/services/notificationService.ts` |
| 7 | Restock/wishlist notifications not implemented | P1 | `notificationService.ts` ("not yet implemented - requires wishlist feature") |
| 8 | Wishlist module empty on mobile (0 screens) | P1 | `apps/customer-app/src/screens/wishlist` (0 .tsx) |
| 9 | Address logging leaks full payload to console | P1 | `frontend/src/store/api.ts` `getAddresses.transformResponse` |
| 10 | `.bak` legacy pages in source tree | P2 | `frontend/src/pages/*.bak` |
| 11 | Delivery serviceability is interim state-based (TODO) | P1 | `services/deliveryService.ts` |
| 12 | Experiment "deploy winner" not wired to prod config (TODO) | P2 | `services/experimentService.ts` |
| 13 | Admin profile edit is a console.log stub (web) | P2 | `pages/AdminProfilePage.tsx` |
| 14 | SearchResults "add to cart" is a console.log stub (web) | P2 | `pages/SearchResultsPage.tsx` |
| 15 | Delivery settings actions are `alert("coming soon")` | P2 | `pages/DeliverySettingsPage.tsx`, `DeliveryProfilePage.tsx` |
| 16 | `kafkajs` present without verified wiring | P2 | `backend/package.json` |
| 17 | Internal tracking customer socket emit TODO | P2 | `routes/internalTracking.ts` |
| 18 | Delivery signup admin-notify TODO | P3 | `controllers/deliveryAuthController.ts` |

> **Note on "Top 50":** Producing 50 distinct *verified* P0 blockers would require fabricating
> items beyond what code evidence supports. The honest set of code-backed blockers is the list
> above plus the broader issue catalog in `ALL_BUGS.md`. Padding to exactly 50 would violate the
> "never assume / accuracy over optimism" rule you set.

### Top Quick Wins (code-backed, low effort / high cleanliness)

1. Delete `frontend/src/pages/CheckoutPage.tsx.bak` and `ProductDetailPageOld.tsx.bak`.
2. Remove/guard `console.log` of addresses in `frontend/src/store/api.ts`.
3. Gate `/api/debug`, web `/debug`, `/test-otp` behind `NODE_ENV !== 'production'`.
4. Replace mobile hardcoded hostname fallback with a build-time required env + clear failure.
5. Wire the `alerts.ts` Slack/PagerDuty stubs or remove the channels from health claims.
6. Consolidate the dozens of root-level `*_COMPLETE.md`/`*_FINAL_*.md` status docs into `docs/`.
7. Remove the now-410 legacy payment-callback route entirely if no legacy clients remain.

---

## Section 2 — Platform Breakdown

### 2A. WEB APPLICATION (`frontend/`)

| Field | Value |
|-------|-------|
| **Purpose** | Customer storefront + delivery-partner console + admin console, all in one React SPA. |
| **Target Users** | Customers, delivery partners, admins (role-routed via `AuthRouter`/`RootNavigator` logic in `App.tsx`). |
| **Stack** | React 19, Vite 6, RTK Query (`src/store/api.ts`), react-router-dom 6, Tailwind, framer-motion, recharts, socket.io-client, Sentry. |
| **Entry** | `frontend/src/main.tsx` → `App.tsx` (lazy-loaded routes, `Suspense`, `AuthInitializer`, `AuthRouter`). |
| **Pages** | 66 page components in `src/pages/` (incl. 18+ `Admin*`, delivery pages, storefront pages). |
| **State** | Redux store `src/store/index.ts`; slices: `authSlice`, `cartSlice`, `adminSlice`, `uiSlice`; RTK Query `api` reducer. |

**Status estimate:**

| Metric | Estimate | Notes |
|--------|----------|-------|
| Working | ~75% | Core storefront, auth, cart, checkout, orders, admin CRUD largely wired via RTK Query. |
| Broken | ~5% | Stub handlers (AdminProfile edit, SearchResults add-to-cart), `.bak` pages. |
| Missing | ~10% | "Coming soon" features (become-seller, several delivery settings). |
| Technical debt | ~High | Duplicate notification-preferences pages (`NotificationPreferencesPage.tsx` + `_Flipkart`), `.bak` files, console logging. |

**Major web modules:** Storefront (Home/Products/ProductDetail/Categories/Search), Cart, Checkout, Orders + Tracking, Account/Profile/Addresses, Notifications + Preferences, Auth/OAuth/Onboarding, Delivery console (Dashboard/Login/Signup/Profile/Settings/Selfie/Emergency/HelpCenter), Admin (Dashboard/Orders/Products/Users/DeliveryBoys/Finance/Analytics/Routes(+Map/Detail/Preview/Recent)/Settings/Profile/Ops), Informational/legal pages.

### 2B. MOBILE APPLICATION (`apps/customer-app/`)

| Field | Value |
|-------|-------|
| **Purpose** | Despite the name `customer-app`, this single Expo app contains **customer, delivery, AND admin** screens (see `src/screens/` subfolders). |
| **Target Users** | Customers (primary), delivery partners (`screens/delivery`, 13), admins (`screens/admin`, 22). |
| **Stack** | Expo ~55, RN 0.83, React 19, RTK Query (`src/api/baseApi.ts` + 21 injected api slices), redux-persist, react-navigation 7, react-native-maps, expo-location/notifications/secure-store, react-native-razorpay, socket.io-client, Firebase messaging + analytics, Sentry RN. |
| **Entry** | `apps/customer-app/App.tsx` → `src/navigation/RootNavigator.tsx`. |
| **Navigators** | Root, Auth, Main, Home, Cart, Categories, Orders, Profile, Delivery, Admin (10 navigators in `src/navigation/`). |

**Screens per module (counted):**

| Module | Screens (.tsx) |
|--------|----------------|
| admin | 22 |
| delivery | 13 |
| info | 7 |
| orders | 7 |
| auth | 6 |
| checkout | 5 |
| address | 4 |
| products | 3 |
| home | 2 |
| profile | 2 |
| reviews | 2 |
| settings | 2 |
| cart | 1 |
| common | 1 |
| debug | 1 |
| notifications | 1 |
| search | 1 |
| **wishlist** | **0 (empty — INCOMPLETE/MISSING)** |

**Status estimate:**

| Metric | Estimate | Notes |
|--------|----------|-------|
| Working | ~70% | RTK Query api slices for all major domains; offline queue + socket client present. |
| Broken | ~8% | Hardcoded base URL fallback (BUG-001); push token wiring depends on stubbed backend. |
| Missing | ~12% | Wishlist screens empty; some delivery settings parity gaps. |
| Technical debt | ~Med–High | Large `scripts/` test-harness sprawl, task-numbered test files (`task8.x`), debug screen shipped. |

**Shared mobile infra:** `src/services/socketClient.ts`, `offlineQueue.ts`, `offlineMutationQueue.ts`, `locationService.ts`; `@vyaparsetu/shared-utils`, `@vyaparsetu/i18n`, `@vyaparsetu/types` workspace packages.

---

## Section 3 — Complete Module Inventory

Modules were discovered from backend `domains/` (20 domains), `routes/` (40 route files),
`models/` (40 models), `services/` (~50 services), web `pages/` + `store`, and mobile
`screens/` + `api/`. Each module below lists code-backed entry points and an honest status.

**Discovered modules:** Authentication/Identity · Users/Profile · Addresses · Products/Catalog ·
Categories · Search (keyword + semantic/vector) · Cart · Checkout/Orders · Payments (UPI/Razorpay/COD) ·
Coupons · Notifications · Reviews · Delivery (auth + operations) · Delivery Fee (v1 + v2) ·
Routes/Route Optimization (CVRP) · Order Tracking (live + projection) · Admin · Admin Ops ·
Admin Tracking (+ Learning/Oncall/Escalations) · Analytics/Metrics · Voice AI (+ correction) ·
Experiments/A-B · Location/Geocoding · Pincode/Serviceability · Media/Uploads/Video ·
Earnings/Rider Wallet · Low-Stock / Inventory · Offline Queue (mobile) · Socket System ·
Background Jobs/Queues · Feature Flags · Invoice.

---

### 3.1 Authentication & Identity

- **Purpose:** Account creation, login, OAuth (Google/Facebook + Google mobile), JWT issuance/refresh, onboarding, account deletion.
- **Routes:** `/api/auth/*` (`domains/identity/routes/auth.ts`).
- **Endpoints (verified):** `POST /signup`, `POST /login`, `POST /oauth`, `POST /refresh`, `POST /logout`, `POST /change-password`, `POST /complete-onboarding`, `POST /verify-onboarding-otp`, `POST|PUT /complete-profile`, `GET /me`, `DELETE /delete-account`, `POST /send-otp`, `POST /verify-otp`, `POST /check-phone`, `GET /google`, `GET /google/callback`, `POST /google-mobile`.
- **Controllers/middleware:** auth controller(s) in identity domain; `middleware/auth.ts` (`authenticateToken`, `authenticateGoogleAuthOnly`), `config/oauth.ts`, `passport`.
- **Rate limiting:** `signupRateLimit`, `loginRateLimit` (`middleware/security.ts`/`rateLimiter.ts`).
- **Models:** `User.ts`, `PendingUser.ts`, `UserSession.ts`, `Otp.ts`, `PendingDeletion.ts`.
- **Web:** `LoginPage`, `SignupPage`, `OnboardingPage`, `OAuthCallbackPage`, `authSlice.ts`; RTK Query `login/signup/refreshToken/logout` (`store/api.ts`).
- **Mobile:** `screens/auth/` (6), `api/authApi.ts`, `authSlice.ts`, refresh-on-401 in `baseApi.ts`.
- **Status:** `WORKING` (rich auth surface; OTP, OAuth, refresh all present). Confidence: Med.
- **Risk:** Med — token refresh logic duplicated across web (`axiosInstance`) and mobile (`baseApi`); OTP delivery depends on SMS/email providers.
- **Completion:** ~85% · **Launch readiness:** ~80%.

### 3.2 Users / Profile

- **Routes:** `/api/user/*` (`domains/identity/routes/user.ts`), `/api/users/*` (mobile verify).
- **Endpoints:** `GET|PUT /profile`, `POST /push-token`, `GET /referral`, `GET /referral/stats`, `POST /verify-mobile`, `GET|POST /addresses`, `PUT|DELETE /addresses/:addressId`, `DELETE /delete-account`, notification-preferences (`/user/notification-preferences` via web api).
- **Service:** `domains/user/services/UserProfileService.ts` (handles Expo vs generic push token storage).
- **Models:** `User.ts`, `DeviceToken.ts`, `UserPreference.ts`, `UserCategoryPreference.ts`.
- **Web:** `ProfilePage`, `EditProfilePage`, `AccountPage`, `NotificationPreferencesPage(+_Flipkart)`.
- **Mobile:** `screens/profile/` (2), `api/profileApi.ts`.
- **Status:** `WORKING`. Confidence: Med. Note duplicate web preference pages (debt).
- **Completion:** ~85%.

### 3.3 Addresses

- **Endpoints:** under `/api/user/addresses` (CRUD + default).
- **Web:** `AddressPage`, `AddressesPage`, RTK Query `getAddresses/addAddress/updateAddress/deleteAddress/setDefaultAddress`.
- **Mobile:** `screens/address/` (4), `api/addressesApi.ts`.
- **Geocoding:** `utils/geocoding.ts`, `scripts/regeocode_missing_addresses.ts`.
- **Status:** `WORKING`, with a `P1` logging leak: `getAddresses.transformResponse` console-logs full address payloads (`frontend/src/store/api.ts`). Confidence: High.
- **Completion:** ~90% (minus logging hygiene).

### 3.4 Products / Catalog

- **Routes:** `/api/products/*` (`domains/catalog/routes/products.ts`).
- **Endpoints:** `GET /`, `GET /:id`, `GET /:id/similar`, `GET /categories`, `GET /search/suggestions`, `PUT /:id`, `DELETE /:id`. Upload-url + create via admin/uploads.
- **Controllers:** `productController.js` (**note: JS file in a TS backend — legacy signal**), `videoController.ts`.
- **Services:** `imageService.ts`, `videoService.ts`, `cloudinaryService.ts`, `productReadCache.ts`, `popularityService.ts`.
- **Models:** `Product.ts`, `ProductVersion.ts`, `ProductClick.ts`, `VideoRegistry.ts`, `TemporaryUpload.ts`, `InventoryAdjustment.ts`, `InventoryReservation.ts`.
- **Web:** `ProductsPage`, `ProductDetailPage` (+ `ProductDetailPageOld.tsx.bak` DEAD), `CategoriesPage`, admin `AdminProductsPage`, `Admin/ProductCreatePage`. `features/products/productsApi.ts` (injected endpoints).
- **Mobile:** `screens/products/` (3), `api/productsApi.ts`.
- **Status:** `WORKING` core; media/video pipeline heavily iterated (many `VIDEO_*` docs) → `PARTIAL` polish. Versioning + click tracking present.
- **Risk:** Med (legacy `.js` controller; video stability churn). **Completion:** ~80%.

### 3.5 Search (Keyword + Semantic/Vector + Personalized)

- **Routes:** `/api/products/search/*` (catalog), `/api/search/*` (semantic, queues-gated), personalized search controller/routes.
- **Services:** `searchService.ts`, `searchFallbackService.ts`, `semanticSearchController.ts`, `vectorSearchService.ts`, `embeddingService.ts`, `embeddingCache.ts`, `qdrantClient.ts`, `hybridRankingService.ts`, `queryRewriteService.ts`, `personalizedSearchController.ts`.
- **Infra:** Qdrant (`@qdrant/js-client-rest`), Algolia dep present.
- **Jobs:** `generateEmbeddings.ts`, `uploadToQdrant.ts`, `createQdrantCollection.ts`, `rankingJob.ts`.
- **Status:** `PARTIAL` → advanced (semantic + hybrid ranking) but **gated behind `enableQueues`** in `createApp.ts`; falls back to keyword via `searchFallbackService`. Web `SearchResultsPage` has a **stubbed add-to-cart** (`console.log`) — `BROKEN` sub-feature.
- **Risk:** Med-High (external Qdrant dependency, gating). **Completion:** ~70%.

### 3.6 Cart

- **Routes:** `/api/cart/*` (`routes/cart.ts`).
- **Endpoints:** `GET /`, `POST /`, `PUT /`, `POST /add`, `PUT /update`, `DELETE /remove`, `DELETE /clear`, `DELETE /:productId`, `GET /test` (**test endpoint — should be removed**).
- **Controller/service:** `cartController.ts`, cart domain service (`backend/test-cart-service*.js` harnesses exist).
- **Model:** `Cart.ts`.
- **Web:** `CartPage`, `cartSlice.ts`, RTK Query cart endpoints (tag `Cart`).
- **Mobile:** `screens/cart/` (1), `api/cartApi.ts`, `cartSlice.ts`.
- **Status:** `WORKING`. Minor: `GET /cart/test` debug endpoint present (`P3`). **Completion:** ~90%.

### 3.7 Checkout & Orders

- **Routes:** `/api/orders/*` (`routes/orders.ts`) + tracking + invoice mounted on same base.
- **Endpoints:** `GET /`, `GET /:id`, `POST /` (createOrder, checkout rate-limited), `POST /create` + `POST /cod` (placeOrderCOD), `PUT /:id/cancel`, `GET /:id/tracking`, `GET|PUT /:orderId/payment-status`, `POST /:orderId/payment-intent`, `POST /:orderId/assign` + `DELETE`, `GET /:orderId/optimal-delivery-boy`. Legacy `POST /:orderId/payment-callback` → **returns 410 `LEGACY_PAYMENT_PATH_DISABLED`** (intentionally disabled).
- **Controllers:** `cartController`/order controllers, `orderAssignmentController.ts`.
- **Services:** order/checkout via domains/orders; `priceCalculator.ts` (GST), `deliveryFeeService.ts`.
- **Models:** `Order.ts`, `OrderEvent.ts`, `ProcessedEvent.ts`, `OutboxEvent.ts`, `InvoiceCounter.ts`, `InventoryReservation.ts`.
- **Idempotency:** `middleware/idempotency.ts` (Idempotency-Key header supported in CORS allowlist).
- **Web:** `CheckoutPage` (+ `.bak` DEAD), `OrderSuccessPage`, `OrdersPage`, `OrderDetailsPage`, `OrderTrackingPage`. RTK Query `getOrders/createOrder`.
- **Mobile:** `screens/checkout/` (5), `screens/orders/` (7), `api/ordersApi.ts`.
- **Status:** `WORKING` core checkout/order lifecycle; **reliability scaffolding strong** (outbox, processed-event dedupe, inventory reservation, idempotency). **Completion:** ~80%. **Launch readiness:** ~75%.
- **Risk:** High — interacts with the dual payment architecture (see 3.8).

### 3.8 Payments (UPI / Razorpay / COD) — HIGHEST RISK MODULE

- **Two architectures coexist (verified in `createApp.ts`):**
  - **Legacy:** `/api/payment/*` → `domains/finance/routes/paymentRoutes.ts`.
  - **New:** `/api/payment-intents`, `/api/payment-status`, `/api/payments`, `/api/webhooks` → `domains/payments/routes/*`.
  - **UPI:** `/api/upi` → `routes/upi.ts` (`POST /verify`).
  - **COD:** via `routes/orders.ts` `placeOrderCOD` + delivery `cod-collection` endpoints + `CodCollection.ts` model.
- **Webhook safety:** raw-body handler registered before `express.json()` for `/api/webhooks/razorpay` (`createApp.ts`); `middleware/razorpayWebhook.ts`.
- **CI invariants (build-time guards in `backend/package.json`):** `check-finalizer-authority`, `check-paymentstatus-canonical`, `check-paid-writes`, `check-reservedstock-underflow`, `check-paymentintent-transitions`, `check-legacy-payment-lock`, `check-webhook-safety`, `check-no-raw-vpa-logs`, `check-upi-verify-safety`. **The existence of 9 payment-safety lint gates is strong evidence of historically fragile payment correctness.**
- **Reconciliation/recovery:** `routes/internalPaymentsReconciliation.ts`, `internalPaymentsRecovery.ts`, `internalPaymentRecoverySuggestion.ts`, `internalPaymentRecoveryExecute.ts`, `internalRefunds.ts`, `domains/payments/services/reconciliation/`.
- **Models:** `Payment.ts`, `CodCollection.ts`, `SettlementHistory.ts`, `WalletTransaction.ts`.
- **PII:** `utils/maskUpiVpa.ts` (VPA masking) — guarded by CI `check-no-raw-vpa-logs`.
- **Status:** `PARTIAL` — functionally rich but architecturally duplicated. Mark **dual-path consolidation as a launch blocker**. Confidence: Med.
- **Risk:** **P0**. **Completion:** ~75%. **Launch readiness:** ~60%.

### 3.9 Coupons

- **Routes:** `/api/coupons` (`GET /`, `GET /smart`, `POST /validate`).
- **Model:** `Coupon.ts`. **Mobile:** `api/couponsApi.ts`.
- **Status:** `WORKING` (validate + smart suggestions). **Completion:** ~80%.

### 3.10 Notifications

- **Routes:** `/api/notifications/*` (`domains/communication/routes/notifications.ts`), `/api/dev/notifications` (dev).
- **Web endpoints (RTK Query):** `getNotifications`, `getNotificationsV2` (cursor/category), `getUnreadNotificationCount`, `markAsRead`, `markAllAsRead`, `deleteNotification` — all with **optimistic cache updates + rollback** (well-engineered).
- **Services:** `notificationService.ts` (two copies: `domains/communication/` and `domains/notifications/`), `utils/PushNotificationService.ts`, `notificationSerializer.ts`, `notificationParser.ts`.
- **Models:** `Notification.ts`, `DeviceToken.ts`.
- **Channels status:**
  - In-app notifications: `WORKING`.
  - Push (FCM/Expo): `PARTIAL/INCOMPLETE` — `domains/notifications/services/notificationService.ts` has TODOs ("Fetch user's FCM token", "Send via firebase-admin"); `domains/communication/services/notificationService.ts` has TODO "Implement Push notification service".
  - WhatsApp: `MISSING` (TODO "Implement WhatsApp Business API integration").
  - Restock/wishlist: `MISSING` ("not yet implemented - requires wishlist feature").
- **Low-stock push:** `lowStockNotificationController.ts` registers device tokens but **push send is TODO ("Phase 4 - Integrate with push notification service")**.
- **Risk:** P0 for push. **Completion:** ~60%. **Launch readiness:** ~55%.

### 3.11 Reviews

- **Routes:** `/api/...reviews` (`routes/reviews.ts` — note: grep found no `router.X` lines, likely uses a different router pattern/controller binding; **verify wiring**).
- **Service:** `reviewService.ts`; middleware `reviewAuth.ts`, `reviewValidation.ts`; utils `reviewHelpers.ts`, `reviewValidation.ts`.
- **Model:** `Review.ts`. **Mobile:** `screens/reviews/` (2), `api/reviewsApi.ts`.
- **Status:** `PARTIAL` → backend service/model/middleware present; **route method bindings UNVERIFIED** (potential `INCOMPLETE` wiring). **Completion:** ~70%.

### 3.12 Delivery — Auth + Operations (delivery-partner app/console)

- **Routes:** `/api/delivery/*` (`routes/deliveryAuth.ts`), `/api/delivery-personnel/*` (`routes/deliveryPersonnel.ts`).
- **Delivery lifecycle endpoints (verified):** `auth/signup`, `auth/login`, `auth/profile`, `GET|PUT /profile`, `selfie-url`, `update-selfie`, `referral`, `messages`, `info`, `routes/current`, `GET /orders`, and per-order: `accept`, `reject`, `pickup`, `start-delivery`, `arrived`, `GET|POST cod-collection`, `deliver`, `resend-otp`, `verify-otp`, `complete`, `fail`, `attempt`.
- **Controllers/services:** `deliveryAuthController.ts`, `deliveryController.ts`, `deliveryPersonnelController.ts`, `deliveryService.ts`, `deliveryEarningService.ts`, `deliveryFailureService.ts`.
- **Models:** `DeliveryBoy.ts`, `DeliveryAttempt.ts`, `DeliveryEarning.ts`, `DeliverySocketEvent.ts`.
- **Web:** `DeliveryDashboard`, `DeliveryLogin`, `DeliverySignup`, `DeliveryProfilePage`, `DeliverySettingsPage`, `DeliverySelfiePage`, `DeliveryEmergencyPage`, `DeliveryHelpCenterPage`.
- **Mobile:** `screens/delivery/` (13), `api/deliveryApi.ts`, `api/deliveryAuthApi.ts`.
- **Status:** `WORKING` — the most complete operational lifecycle in the app (full state machine: accept→pickup→start→arrive→deliver/verify-otp→complete/fail/attempt).
- **Gaps:** `deliveryService.ts` serviceability is **interim state-based (TODO)**; web delivery settings have `alert("coming soon")` stubs. **Completion:** ~80%.

### 3.13 Delivery Fee (v1 + v2)

- **Routes:** `/api/delivery-fee` (`routes/deliveryFee.ts`) and `/api/delivery-fee-v2` (`routes/enhancedDeliveryFeeRoutes.ts`).
- **Controllers/services:** `enhancedDeliveryFeeController.ts` (`calculate-for-address`), `deliveryFeeService.ts`, `utils/deliveryFeeCalculator.ts`, `config/deliveryFeeConfig.ts`.
- **Status:** `PARTIAL` — **two parallel versions** (v1 + enhanced v2) is a consolidation risk. **Completion:** ~80%. (Docs: `ENHANCED_DELIVERY_FEE_SYSTEM.md`, `DELIVERY_FEE_FIX_*`.)

### 3.14 Routes / Route Optimization (CVRP)

- **Services:** `cvrpRouteAssignmentService.ts`, `routeAssignmentService.ts`, `smartAssignmentService.ts`, `batchAssignmentService.ts`, `hubAssignmentService.ts`, `routeOptimizer.ts`, `routeAutoScheduler.ts`, `routeCancellationHandler.ts`, `routePlaybackService.ts`, `geofenceService.ts`, `utils/routeUtils.ts`, `utils/distanceCalculator.ts`, `utils/kalmanFilter.ts`, `utils/locationSmoothing.ts`.
- **Model:** `Route.ts`. **Domain:** `domains/routes/routeLifecycleService.ts`.
- **Web admin:** `AdminRoutesPage`, `AdminRouteDetailPage`, `AdminRouteMapPage`, `AdminRoutesPreviewPage`, `AdminRecentRoutesPage`.
- **Status:** `WORKING/PARTIAL` — sophisticated (CVRP, Kalman smoothing, geofencing, auto-scheduler). Confidence Med (complex, hard to verify statically). **Completion:** ~75%.
- **Docs:** `backend/CVRP_ROUTE_ASSIGNMENT_README.md`, `CVRP_EXAMPLE.md`.

### 3.15 Order Tracking (Live + Projection)

- **Routes:** `/api/orders/:id/tracking` (orders.ts inline), `/api/admin/tracking/*` (+ learning/oncall/escalations), `/api/internal/tracking`.
- **Services:** `liveLocationStore.ts`, `locationService` (mobile), tracking projection worker (`workers/trackingProjectionWorker.ts`), `domains/tracking/phase5/incidents/playbooks.ts`.
- **Sockets:** `delivery_location_updated`, `order_status_updated` (socketService).
- **Web:** `OrderTrackingPage`; admin tracking pages.
- **Status:** `WORKING/PARTIAL` — projection pipeline + incident playbooks present; `internalTracking.ts` has TODOs (customer socket emit, order status update). **Completion:** ~70%.

### 3.16 Admin & Admin Ops

- **Routes:** `/api/admin/*` (`routes/admin.ts`), `/api/admin/ops/*` (`routes/adminOps.ts`).
- **Endpoints (verified admin.ts):** `stats`, `dashboard`, `analytics`, `users`, `DELETE users/:id`, `products/:id/versions`, `PATCH orders/:orderId`, `orders/:orderId/accept|decline`, `delivery-boys/:id/suspend`, `assign-deliveries`.
- **Web:** 18+ admin pages (Dashboard, Orders, OrderDetails, Products, Users, DeliveryBoys, Finance, Analytics, Routes(+variants), Settings, Profile). `adminSlice.ts`, `admin/ops`.
- **Mobile:** `screens/admin/` (22), `api/adminApi.ts`.
- **Status:** `WORKING` core CRUD; **AdminProfilePage edit is a stub** (`console.log`). **Completion:** ~80%.

### 3.17 Analytics / Metrics

- **Routes:** `/api/metrics/*` (system + queue), `/api/internal` (metricsApi), `/api/admin/ops/metrics`.
- **Services:** `metricsService.ts`, `controllers/metricsController.ts`, `queues/metrics.ts`, `queues/dashboard.ts`.
- **Web:** `AdminAnalyticsPage`, recharts.
- **Status:** `WORKING/PARTIAL`. **Completion:** ~70%. (Docs: `METRICS_GAPS_FIXED.md`.)

### 3.18 Voice AI (+ Correction)

- **Routes (queues-gated):** `/api/voice/*` (`voiceRoutes.ts`, `voiceCorrectionRoutes.ts`, `voiceMetricsLog.ts`).
- **Controllers/services:** `voiceController.ts`, `voiceCorrectionController.ts`, `voiceCorrectionService.ts`, `autoTranslateService.ts`, `utils/voiceCorrectionBackend.ts`.
- **Models:** `VoiceCorrection.ts`, `VoiceMetrics.ts`.
- **Mobile:** `api/voiceApi.ts`, `expo-speech-recognition` dep; extensive root docs (`VOICE_CART_*`, `VOICE_AI_*`).
- **Status:** `PARTIAL` — feature-rich but **gated behind `enableQueues`**; correctness/runtime `UNVERIFIED`. **Completion:** ~65%.

### 3.19 Experiments / A-B Testing

- **Routes:** `/api/admin/experiments`, `/api/experiments` (public) — queues-gated.
- **Services:** `experimentService.ts`, `experimentHardeningService.ts`, `controllers/experimentController.ts`, `jobs/experimentMonitorJob.ts`, `utils/experiment.ts`.
- **Model:** `Experiment.ts`. **Mobile:** `api/experimentApi.ts`.
- **Status:** `PARTIAL` — **"deploy winner config to production" is a TODO** (`experimentService.ts`); assignment/monitoring present. **Completion:** ~65%.

### 3.20 Location / Geocoding / Pincode / Serviceability

- **Routes:** `/api/location` (`reverse-geocode`, `current`), `/api/pincode` (`validate`, `validate-bulk`, `ranges`, `check/:pincode`).
- **Services/utils:** `utils/geocoding.ts`, `utils/pincodeResolver.ts`, `authoritativePincodeResolver.ts`, `services/pincodeValidator.ts`, `config/serviceablePincodes.ts`.
- **Model:** `Pincode.ts`. Scripts: `importPincodes.ts`, `seedPincodes.ts`.
- **Mobile:** `api/pincodeApi.ts`, `locationService.ts`, `expo-location`.
- **Status:** `WORKING`. **Completion:** ~85%. (Docs: `PINCODE_SYSTEM_*`.)

### 3.21 Media / Uploads / Video

- **Routes:** `/api/uploads` (`domains/uploads/routes/uploads.ts`); product video via `videoController.ts`.
- **Services:** `cloudinaryService.ts`, `imageService.ts`, `videoService.ts`; utils `imageUtils.ts`, `productImageValidation.ts`, `normalizeProductImages.js` (**legacy .js**).
- **Models:** `VideoRegistry.ts`, `TemporaryUpload.ts`. Job: `videoCleanupJob.ts`.
- **Status:** `PARTIAL` — heavily iterated video pipeline (atomic lock upgrades per docs); image working. **Completion:** ~75%.

### 3.22 Earnings / Rider Wallet

- **Routes:** rider wallet via `controllers/riderWalletController.ts`, `services/riderWalletService.ts`, `deliveryEarningService.ts`; settlement `jobs/dailySettlementJob.ts`.
- **Models:** `RiderWallet.ts`, `WalletTransaction.ts`, `DeliveryEarning.ts`, `SettlementHistory.ts`.
- **Mobile:** `Earnings` RTK tag; delivery screens.
- **Status:** `WORKING/PARTIAL` — earnings + daily settlement job present. **Completion:** ~75%.

### 3.23 Low-Stock / Inventory

- **Controller/service:** `lowStockNotificationController.ts`, `stockMonitorService.ts`, `lowStockSocketService.ts`.
- **Models:** `LowStockNotification.ts`, `InventoryAdjustment.ts`, `InventoryReservation.ts`.
- **Socket:** `low_stock_alert` → `admin_room`.
- **Status:** `PARTIAL` — monitoring + socket alert WORKING, but **device-token push send is TODO**. **Completion:** ~65%.

### 3.24 Feature Flags

- **Route:** mounted at `/` under apiRouter (`routes/featureFlagsApi.ts`).
- **Status:** `WORKING` (present + mounted). **Completion:** ~80%. (Doc: `FEATURE_FLAG_PROMPT.md`.)

### 3.25 Invoice

- **Route:** `/api/orders` (invoice routes; `domains/invoice/routes/invoice.routes.ts`), `pdfkit` dep, `InvoiceCounter.ts` model.
- **Status:** `WORKING/PARTIAL`. **Completion:** ~75%.

### 3.26 Offline Queue (Mobile)

- **Files:** `apps/customer-app/src/services/offlineQueue.ts`, `offlineMutationQueue.ts`, `@react-native-community/netinfo`, `redux-persist`.
- **Status:** `WORKING/PARTIAL` — see Section 11. **Completion:** ~70%.

### 3.27 Socket System

- **Backend:** `services/socketService.ts`, `lowStockSocketService.ts`; `socket.io`. **Mobile:** `services/socketClient.ts`; **Web:** `socket.io-client`.
- **Status:** `WORKING` — see Section 9. **Completion:** ~80%.

---

## Section 4 — Web Application

**Router:** `frontend/src/App.tsx` (react-router-dom 6) with `<Layout>`, `<AuthGate>`
(props `requireAuth`, `requiredRole`, `allowOnboarding`), `<AuthInitializer>`, `<AuthRouter>`,
lazy `Suspense` page loading.

### 4.1 Route Table (verified from `App.tsx`)

**Public routes (no auth):**

| Path | Page | Status |
|------|------|--------|
| `/` | HomePage | WORKING |
| `/login` | LoginPage | WORKING |
| `/signup` | SignupPage | WORKING |
| `/privacy`, `/terms`, `/cancellation` | legal pages | WORKING (static) |
| `/products` | ProductsPage | WORKING |
| `/search` | SearchResultsPage | PARTIAL (add-to-cart stub) |
| `/product/:id` | ProductDetailPage | WORKING |
| `/menu` | MenuPage | PARTIAL ("comingSoon" content) |
| `/download-app` | DownloadAppPage | PARTIAL ("Coming Soon" badge) |
| `/contact-us`, `/customer-care`, `/about-us`, `/careers`, `/cs-store-stories`, `/corporate-information` | info pages | WORKING (static) |
| `/categories` | CategoriesPage | WORKING |
| `/help-support` | HelpSupportPage | PARTIAL (chat = alert) |
| `/become-seller` | ComingSoonPage | MISSING (placeholder) |
| `/auth/callback` | OAuthCallbackPage | WORKING |
| `/admin-login`, `/admin/login` | redirect → `/login` | WORKING (legacy redirect) |
| `/test-otp`, `/debug` | TestOtpPage, DebugPage | **DEBUG — must gate in prod (P0)** |

**Customer protected (`requiredRole="customer"`):** `/dashboard`, `/cart`, `/checkout`,
`/order-success/:orderId`, `/orders`, `/orders/:orderId`, `/order/:id`, `/profile`,
`/addresses`, `/notification-preferences`, `/settings`, `/account`, `/account/profile`,
`/account/profile/edit`, `/account/settings`, `/account/notifications`. — **All WORKING** (RTK Query wired); checkout interacts with payment risk module.

**Admin protected (`requiredRole="admin"`):** `/admin`, `/admin/products`, `/admin/products/new`,
`/admin/users`, `/admin/orders`, `/admin/orders/:orderId`, `/admin/routes`, `/admin/routes/recent`,
`/admin/routes/preview`, `/admin/routes/:routeId`, `/admin/routes/:routeId/map`,
`/admin/delivery-boys`, `/admin/analytics`, `/admin/finance`, `/admin/payments`,
`/admin/ops/payments/recovery`, `/admin/ops/finance`, `/admin/settings`, `/admin-profile`.
— **WORKING** except `/admin-profile` edit (stub) and analytics depth (PARTIAL).

**Delivery protected (`requiredRole="delivery"`):** `/delivery/signup`, `/delivery/login` (public),
`/delivery`, `/delivery/dashboard`, `/delivery/profile`, `/delivery/earnings-info`, `/delivery/refer`,
`/delivery/support`, `/delivery/messages`, `/delivery/settings`, `/delivery-selfie`, `/delivery-profile`,
`/delivery/emergency`, `/delivery/help-center`, `/delivery-settings`. — **WORKING** core;
settings sub-actions = "coming soon" alerts (PARTIAL). Note **duplicate routes** (`/delivery/settings`
+ `/delivery-settings`, `/delivery/profile` + `/delivery-profile`) — debt.

**Shared auth:** `/ways-to-earn`, `/refer-and-earn`, `/message-center`, `/onboarding/complete-profile`.

### 4.2 RBAC / Permissions (web)

- Enforced client-side by `<AuthGate requiredRole=...>` in `App.tsx`.
- Server-side enforcement via `middleware/auth.ts` (`authenticateToken`) + role checks in controllers + dedicated delivery auth.
- **Risk:** client-side route guards are UX-only; **authoritative enforcement must be server-side** (appears present for most endpoints — `authenticateToken` is applied broadly; per-role admin checks `UNVERIFIED` for every endpoint).

### 4.3 Web Data Layer (RTK Query — `frontend/src/store/api.ts`)

- Single `createApi` (`reducerPath: "api"`), axios baseQuery (`axiosBaseQuery`) delegating to `axiosInstance.ts` (which owns 401 refresh).
- `keepUnusedDataFor: 60`, `refetchOnFocus/Reconnect: false`.
- **Tag types:** `User, Product, Order, Payment, Cart, Address, Notification, NotificationUnreadCount, DeliveryProfile`.
- Public (unauthenticated) product reads use a separate `publicApi` axios instance with `queryFn` (bypasses auth).
- Additional injected endpoints: `features/products/productsApi.ts`.
- **Notable quality:** notification mutations implement optimistic updates with rollback (`markAsRead`, `markAllAsRead`, `deleteNotification`).
- **Notable debt:** `getAddresses` logs full payloads (P1); heavy use of `any`.

### 4.4 Web Components / Forms / Modals / Tables

- `src/components/` (shared UI), `src/features/`, `src/contexts/`, `src/payments/` (Razorpay integration UI), `src/admin/ops/`.
- Charts via `recharts` (analytics/finance). Tables in admin pages. Toasts via `react-hot-toast`. Animations via `framer-motion`.
- (Component-by-component enumeration not exhaustively listed — would require reading all 319 files; structural presence verified.)

### 4.5 Web Dead Code / Orphans (see DEAD_CODE.md)

- `src/pages/CheckoutPage.tsx.bak`, `src/pages/ProductDetailPageOld.tsx.bak` — **DEAD CODE**.
- `NotificationPreferencesPage_Flipkart.tsx` vs `NotificationPreferencesPage.tsx` — likely one orphan (only one is routed). Routed page = `NotificationPreferencesPage`; `_Flipkart` variant appears **orphaned**.
- `ComingSoonPage` reused for `/become-seller` — placeholder, not dead.

---

## Section 5 — Mobile Application (`apps/customer-app/`)

**Entry:** `App.tsx` → `RootNavigator.tsx`. Single Expo app for **all three roles**.

### 5.1 Navigation Structure (verified `src/navigation/`)

`RootNavigator` (role/auth branch) → `AuthNavigator` | `MainNavigator` | `DeliveryNavigator` | `AdminNavigator`.
`MainNavigator` composes `HomeNavigator`, `CartNavigator`, `CategoriesNavigator`,
`OrdersNavigator`, `ProfileNavigator` (bottom tabs via `@react-navigation/bottom-tabs`).
Types in `navigation/types.ts`.

### 5.2 Mobile Data Layer (RTK Query — `src/api/baseApi.ts` + 21 slices)

- `createApi` (`reducerPath: 'api'`) with `baseQueryWithReauth` (custom 401 refresh using a clean axios instance; dispatches `auth/setTokens` or `auth/logout`).
- `keepUnusedDataFor: 60`, all refetch triggers off (incl. `refetchOnMountOrArgChange: false`).
- **Tag types (22):** `Products, Product, Categories, Cart, Orders, Order, Addresses, Profile, Notifications, DeliveryOrders, DeliveryBoys, DeliveryPartners, Reviews, Coupons, Users, Clusters, RecentRoutes, AdminRoutes, AdminSettings, Pincode, Earnings`.
- **API slices (21):** `authApi, adminApi, addressesApi, cartApi, couponsApi, deliveryApi, deliveryAuthApi, experimentApi, notificationsApi, ordersApi, pincodeApi, productsApi, profileApi, referralApi, reviewsApi, settingsApi, voiceApi` + `axiosBaseQuery`, `baseApi`.
- **Persistence:** `redux-persist` + `@react-native-async-storage/async-storage`; tokens via `expo-secure-store` (`utils/storage`).
- **🔴 BUG-001 (P0):** `getRawUrl()` fallback hardcodes `http://GCSCharans-MacBook-Air.local:5002/api`. If `EXPO_PUBLIC_API_URL` unset → app targets a developer laptop. **BROKEN for production builds.**

### 5.3 Mobile Screens by Module (counted)

Customer: home (2), products (3), search (1), cart (1), checkout (5), orders (7), address (4),
profile (2), notifications (1), reviews (2), settings (2), info (7), common (1), debug (1, **ships debug screen**), **wishlist (0 — MISSING)**.
Delivery: delivery (13). Admin: admin (22).

### 5.4 Mobile Cross-Cutting Infra

- **Sockets:** `src/services/socketClient.ts` (socket.io-client 4.8) — live order/location/OTP/payment events.
- **Offline:** `offlineQueue.ts`, `offlineMutationQueue.ts`, `@react-native-community/netinfo` (Section 11).
- **Location:** `locationService.ts`, `expo-location`, `expo-task-manager` (background location), `react-native-maps`, `react-native-maps-directions`.
- **Push:** `expo-notifications`, `@react-native-firebase/messaging` — **backend send path is stubbed (see 3.10).** Token registration (`POST /user/push-token`) WORKING; delivery `INCOMPLETE`.
- **Payments:** `react-native-razorpay`.
- **OTP autofill:** `react-native-otp-verify`.
- **Auth:** `@react-native-google-signin/google-signin`, `expo-auth-session`.
- **i18n:** `i18next` + `react-i18next` + `@vyaparsetu/i18n`.
- **Voice:** `expo-speech-recognition` + `api/voiceApi.ts`.
- **Analytics/crash:** `@react-native-firebase/analytics`, `@sentry/react-native`.

### 5.5 Mobile Status Summary

| Area | Status |
|------|--------|
| Auth (login/OAuth/refresh) | WORKING |
| Browse/Search/Product | WORKING (semantic search backend-gated) |
| Cart/Checkout | WORKING |
| Orders/Tracking | WORKING |
| Delivery lifecycle | WORKING (most complete) |
| Admin (mobile) | WORKING/PARTIAL (22 screens) |
| Notifications (in-app) | WORKING |
| Push (delivery) | INCOMPLETE (backend stub) |
| Wishlist | MISSING (0 screens) |
| Offline queue | PARTIAL |
| Base URL config | **BROKEN in prod fallback (P0)** |

---

## Section 6 — Workflow Catalog

> The brief requested "300–500 workflows." Enumerating 300–500 *distinct, verified* workflows
> would require fabrication beyond code evidence. Below are the **major code-backed workflows**
> (the ones that define the product), each traced UI→API→service→model. This is the honest set;
> finer-grained variations are derivable from the endpoint tables in Section 7.

Status legend per workflow: **W**=Working, **P**=Partial, **B**=Broken, **I**=Incomplete.

### Authentication & Onboarding
| ID | Workflow | Role | Entry | Backend flow | Status | Crit |
|----|----------|------|-------|--------------|--------|------|
| WF-AUTH-01 | Email/phone signup | Guest | `/signup` | `POST /auth/signup` (signupRateLimit) → create `PendingUser`/`User` | W | P0 |
| WF-AUTH-02 | Login (identifier+password) | Guest | `/login` | `POST /auth/login` (loginRateLimit) → JWT + refresh | W | P0 |
| WF-AUTH-03 | OTP send/verify | Guest | login/signup | `POST /auth/send-otp`,`verify-otp`; `Otp` model; SMS/email | P (provider-dependent) | P0 |
| WF-AUTH-04 | Google OAuth (web) | Guest | `/auth/callback` | `GET /auth/google`→`/google/callback`; passport | W | P1 |
| WF-AUTH-05 | Google mobile auth | Guest | mobile auth | `POST /auth/google-mobile` | W | P1 |
| WF-AUTH-06 | Token refresh | Auth | 401 interceptor | `POST /auth/refresh` (web axiosInstance + mobile baseApi) | W | P0 |
| WF-AUTH-07 | Complete onboarding/profile | New | `/onboarding/complete-profile` | `POST /auth/complete-onboarding`,`verify-onboarding-otp`,`complete-profile` | W | P1 |
| WF-AUTH-08 | Change password | Auth | settings | `POST /auth/change-password` | W | P2 |
| WF-AUTH-09 | Delete account | Auth | settings | `DELETE /auth/delete-account`; `PendingDeletion` | W | P1 |
| WF-AUTH-10 | Logout | Auth | menu | `POST /auth/logout` + local state clear | W | P2 |

### Catalog / Search
| ID | Workflow | Role | Backend | Status | Crit |
|----|----------|------|---------|--------|------|
| WF-CAT-01 | Browse products (paginated) | Any | `GET /products` (publicApi) | W | P0 |
| WF-CAT-02 | Product detail + similar | Any | `GET /products/:id`, `/:id/similar` | W | P1 |
| WF-CAT-03 | Categories list | Any | `GET /products/categories` | W | P1 |
| WF-CAT-04 | Search suggestions | Any | `GET /products/search/suggestions` | W | P1 |
| WF-CAT-05 | Keyword search | Any | `GET /products/search` | W | P0 |
| WF-CAT-06 | Semantic/vector search | Any | `/search/*` (Qdrant, queues-gated) → fallback keyword | P | P2 |
| WF-CAT-07 | Personalized ranking | Auth | personalizedSearch + `UserPreference`/`ProductClick` | P | P2 |
| WF-CAT-08 | Web add-to-cart from search results | Customer | SearchResultsPage handler | **B (console.log stub)** | P2 |

### Cart & Checkout
| ID | Workflow | Backend | Status | Crit |
|----|----------|---------|--------|------|
| WF-CART-01..06 | Get/add/update/remove/clear cart | `/cart` CRUD | W | P0 |
| WF-CHK-01 | Create order (online) | `POST /orders` (checkoutRateLimit) → reservation+outbox | W | P0 |
| WF-CHK-02 | Place COD order | `POST /orders/cod` (`placeOrderCOD`) | W | P0 |
| WF-CHK-03 | Apply coupon | `POST /coupons/validate` | W | P1 |
| WF-CHK-04 | Compute delivery fee | `/delivery-fee` or `/delivery-fee-v2` | P (dual) | P1 |
| WF-CHK-05 | Compute GST/price | `priceCalculator.ts`; Order GST fields (cgst/sgst/igst/hsn) | W | P1 |
| WF-CHK-06 | Idempotent order submit | `Idempotency-Key` + `middleware/idempotency.ts` + `ProcessedEvent` | W | P0 |
| WF-CHK-07 | Cancel order | `PUT /orders/:id/cancel` | W | P1 |

### Payments
| ID | Workflow | Backend | Status | Crit |
|----|----------|---------|--------|------|
| WF-PAY-01 | Create payment intent | `POST /orders/:orderId/payment-intent`, `/payment-intents` | P | P0 |
| WF-PAY-02 | Razorpay webhook | `POST /webhooks/razorpay` (raw body + signature) | P | P0 |
| WF-PAY-03 | Poll payment status | `GET /orders/:orderId/payment-status`, `/payment-status` | P | P0 |
| WF-PAY-04 | UPI verify | `POST /upi/verify` (CI-guarded) | P | P0 |
| WF-PAY-05 | COD collection (rider) | `GET|POST /delivery/orders/:orderId/cod-collection`; `CodCollection` | W | P0 |
| WF-PAY-06 | Reconciliation (internal) | `/internal/payments/*` | P | P1 |
| WF-PAY-07 | Recovery suggest+execute | `/internal/payments/...recovery...` | P | P1 |
| WF-PAY-08 | Refund (internal) | `/internal` refunds | P | P1 |
| WF-PAY-09 | Legacy payment callback | `POST /orders/:orderId/payment-callback` | **Disabled → 410** (intentional) | — |
| WF-PAY-10 | Atomic finalization | CI guard `check-finalizer-authority`; outbox/processed-event | P | P0 |

### Delivery Lifecycle (rider) — most complete state machine
| ID | Workflow | Backend | Status |
|----|----------|---------|--------|
| WF-DEL-01 | Rider signup/login | `POST /delivery/auth/signup|login` | W |
| WF-DEL-02 | View current route + orders | `GET /delivery/routes/current`, `/delivery/orders` | W |
| WF-DEL-03 | Accept/Reject order | `POST /delivery/orders/:id/accept|reject` | W |
| WF-DEL-04 | Pickup | `POST .../pickup` | W |
| WF-DEL-05 | Start delivery | `POST .../start-delivery` | W |
| WF-DEL-06 | Arrived | `POST .../arrived` | W |
| WF-DEL-07 | OTP deliver (send/resend/verify) | `POST .../resend-otp`,`verify-otp`; socket `otp_delivered`/`otp_verification_result` | W |
| WF-DEL-08 | Deliver / Complete | `POST .../deliver`,`complete` | W |
| WF-DEL-09 | Fail / Record attempt | `POST .../fail`,`attempt`; `DeliveryAttempt`,`deliveryFailureService` | W |
| WF-DEL-10 | Selfie verification | `GET selfie-url`,`PUT update-selfie` | W |
| WF-DEL-11 | Live location push | `PUT /delivery-personnel/:id/location` → socket `delivery_location_updated` | W |
| WF-DEL-12 | Earnings + daily settlement | `deliveryEarningService`, `dailySettlementJob` (cron 18:30 UTC ≈ 00:00 IST) | W/P |

### Order Tracking (customer)
| ID | Workflow | Backend | Status |
|----|----------|---------|--------|
| WF-TRK-01 | Live tracking subscribe | mobile `emit subscribe_delivery_tracking` → `delivery_location_updated` | W |
| WF-TRK-02 | Order status updates | socket `order_status_updated` / `order:status:changed` | W |
| WF-TRK-03 | Tracking projection (ops) | `workers/trackingProjectionWorker`, `/admin/tracking/*` | P |
| WF-TRK-04 | Notify customer on tracking event | `routes/internalTracking.ts` | **P (TODO emit)** |

### Admin / Ops
| ID | Workflow | Backend | Status |
|----|----------|---------|--------|
| WF-ADM-01 | Dashboard stats/analytics | `GET /admin/stats`,`/dashboard`,`/analytics` | W |
| WF-ADM-02 | Manage users + delete | `GET /admin/users`, `DELETE /admin/users/:id` | W |
| WF-ADM-03 | Product CRUD + versions | `/products` CRUD, `GET /admin/products/:id/versions` | W |
| WF-ADM-04 | Order management | `PATCH /admin/orders/:orderId`, accept/decline | W |
| WF-ADM-05 | Assign deliveries | `POST /admin/assign-deliveries`, `/orders/:orderId/assign` | W |
| WF-ADM-06 | Route preview/detail/map/recent | admin routes pages + route services | W/P |
| WF-ADM-07 | Suspend delivery boy | `PUT /admin/delivery-boys/:id/suspend` | W |
| WF-ADM-08 | Finance/payments recovery | `/admin/ops/finance`, `/admin/ops/payments/recovery` | P |
| WF-ADM-09 | Tracking ops (risk/incidents/oncall/escalations) | `/admin/tracking/*` | P |
| WF-ADM-10 | Admin profile edit | AdminProfilePage | **B (stub)** |

### Notifications
| ID | Workflow | Backend | Status |
|----|----------|---------|--------|
| WF-NOT-01 | List notifications (v1/v2 cursor) | `/notifications`,`/notifications/v2` | W |
| WF-NOT-02 | Unread count | `/notifications/unread/count` | W |
| WF-NOT-03 | Mark read / read-all / delete (optimistic) | `/notifications/:id/read`, `/read-all`, DELETE | W |
| WF-NOT-04 | Register push token | `POST /user/push-token` | W |
| WF-NOT-05 | Send push (FCM/Expo) | notificationService | **I (TODO)** |
| WF-NOT-06 | WhatsApp notify | notificationService | **MISSING (TODO)** |
| WF-NOT-07 | Low-stock admin alert | socket `low_stock_alert`→`admin_room` | W (socket) / I (push) |
| WF-NOT-08 | Restock notify | notificationService | **MISSING** |

### Reviews / Coupons / Misc
| ID | Workflow | Backend | Status |
|----|----------|---------|--------|
| WF-REV-01 | Create/list reviews | reviewService + reviewAuth | P (route binding UNVERIFIED) |
| WF-CPN-01 | Smart coupon suggest | `GET /coupons/smart` | W |
| WF-LOC-01 | Reverse geocode / current | `/location/*` | W |
| WF-PIN-01 | Pincode validate/check/ranges | `/pincode/*` | W |
| WF-VOICE-01 | Voice-to-cart | `/voice/*` (queues-gated) + mobile speech | P |
| WF-EXP-01 | A/B assign + monitor | `/experiments`, experimentMonitorJob | P |
| WF-EXP-02 | Deploy winning variant | experimentService | **I (TODO)** |
| WF-INV-01 | Generate invoice PDF | invoice routes + pdfkit + InvoiceCounter | W/P |

---

## Section 7 — API Inventory

**Base:** all under `/api` (`createApp.ts` → `apiRouter`). Auth via `authenticateToken` unless noted.
Voice/search/experiment/metrics groups are **only mounted when `enableQueues=true`**.

### Mount map (verified `createApp.ts`)

| Mount | Router file | Auth | Status |
|-------|-------------|------|--------|
| `GET /health`, `/api/health` | inline | none | W |
| `GET /openapi.json` | `autoOpenApi.ts` | none | W |
| `/api/auth` | identity/auth | mixed | W |
| `/api/user` | identity/user | token | W |
| `/api/users` | security/mobileVerify | token | W |
| `/api/products` | catalog/products | mixed (public reads) | W |
| `/api/cart` | routes/cart | token | W (has `/test`) |
| `/api/orders` | routes/orders (+tracking+invoice) | token | W |
| `/api/delivery-fee` | routes/deliveryFee | token | P (v1) |
| `/api/delivery-fee-v2` | enhancedDeliveryFee | token | P (v2) |
| `/api/delivery-personnel` | deliveryPersonnel | token | W |
| `/api/delivery` | deliveryAuth | mixed | W |
| `/api/pincode` | pincodeRoutes | mixed | W |
| `/api/location` | locationRoutes | token | W |
| `/api/admin` | routes/admin | admin | W |
| `/api/admin/ops` | adminOps | admin | P |
| `/api/admin/tracking[/learning|/oncall|/escalations]` | adminTracking* | admin | P |
| `/api/otp` | security/otpRoutes | none/limited | W |
| `/api/notifications` | communication/notifications | token | W |
| `/api/dev/notifications` | communication/devNotifications | dev | **DEBUG** |
| `/api/uploads` | uploads | token | W |
| `/api/upi` | routes/upi | token | P (CI-guarded) |
| `/api/payment` | finance/paymentRoutes | token | **P (legacy)** |
| `/api/payment-intents` | payments/paymentIntents | token | P |
| `/api/payment-status` | payments/paymentStatus | token | P |
| `/api/payments` | payments/payments | token | P |
| `/api/webhooks` | payments/webhooks | signature | P |
| `/api/internal/tracking` | internalTracking | internal | P |
| `/api/internal/payments` (×5 routers) | reconciliation/recovery/verification/suggestion/execute | internal | P |
| `/api/internal/finance` | internalFinanceReports | internal | P |
| `/api/internal` | internalRefunds, metricsApi | internal | P |
| `/api/debug` | debugDbTest | **none?** | **DEBUG (P0 to gate)** |
| `/api/coupons` | routes/coupons | mixed | W |
| `/api/` | featureFlagsApi | mixed | W |
| `/api/voice` (×3) | voice* | token | P (gated) |
| `/api/search` | semanticSearch | mixed | P (gated) |
| `/api/admin/queues` | queueAdmin (+ bull-board) | admin | P (gated) |
| `/api/metrics` (×2) | metrics/queueMetrics | admin | P (gated) |
| `/api/admin/experiments`, `/api/experiments` | experiment* | mixed | P (gated) |

### Sample endpoint detail (verified method bindings)

- **Auth:** see WF-AUTH; 18 endpoints in `auth.ts`.
- **Orders:** `GET /`, `GET /:id`, `POST /`, `POST /create`, `POST /cod`, `PUT /:id/cancel`, `GET /:id/tracking`, `GET|PUT /:orderId/payment-status`, `POST /:orderId/payment-intent`, `POST /:orderId/assign`, `DELETE /:orderId/assign`, `GET /:orderId/optimal-delivery-boy`, `POST /:orderId/payment-callback` (410).
- **User:** `GET|PUT /profile`, `POST /push-token`, `GET /referral`, `GET /referral/stats`, `POST /verify-mobile`, `GET|POST /addresses`, `PUT|DELETE /addresses/:addressId`, `DELETE /delete-account`.
- **Products:** `GET /`, `GET /:id`, `GET /:id/similar`, `GET /categories`, `GET /search/suggestions`, `PUT /:id`, `DELETE /:id`.
- **Cart:** `GET /`, `POST /`, `PUT /`, `POST /add`, `PUT /update`, `DELETE /remove`, `DELETE /clear`, `DELETE /:productId`, `GET /test`.
- **Delivery (rider):** ~25 endpoints (full lifecycle, see WF-DEL).
- **Admin:** stats/dashboard/analytics/users(+delete)/products versions/orders(patch/accept/decline)/delivery-boys suspend/assign-deliveries.
- **Pincode:** `POST /validate`, `POST /validate-bulk`, `GET /ranges`, `GET /check/:pincode`.
- **Coupons:** `GET /`, `GET /smart`, `POST /validate`.
- **UPI:** `POST /verify`.
- **Location:** `GET /reverse-geocode`, `GET /current`.

> Full per-endpoint request/response schemas are exposed at runtime via `GET /openapi.json`
> (`generateOpenApiSpec`). For exhaustive contract docs, generate from that live spec.

### API issues
- `GET /cart/test`, `/api/debug`, `/api/dev/notifications` are **debug/test surfaces** that should be production-gated.
- Two delivery-fee API versions, four payment route groups + one legacy → **consolidation needed**.

---

## Section 8 — Database Inventory

**ORM:** Mongoose 8 (MongoDB). **40 model files** in `backend/src/models/` (+ domain-local schemas).

### Model catalog (verified file list)

| Model | Domain | Purpose (inferred from name/usage) |
|-------|--------|-----------------------------------|
| `User` | identity | Customer/admin accounts, auth, push tokens, preferences |
| `PendingUser` | identity | Pre-verification signups |
| `UserSession` | identity | Session/refresh tracking |
| `Otp` | security | OTP codes (auth + delivery) |
| `PendingDeletion` | identity | Scheduled account deletions |
| `DeviceToken` | notifications | FCM/Expo push tokens |
| `UserPreference` | user | General preferences |
| `UserCategoryPreference` | search | Personalization signals |
| `Product` | catalog | Catalog items (price, stock, media, GST/HSN) |
| `ProductVersion` | catalog | Product version history |
| `ProductClick` | search | Click tracking for ranking |
| `VideoRegistry` | media | Product video registry (atomic lock) |
| `TemporaryUpload` | uploads | Pre-attach media staging |
| `InventoryAdjustment` | inventory | Stock adjustments/audit |
| `InventoryReservation` | orders | Stock held during checkout |
| `Cart` | cart | User carts |
| `Coupon` | coupons | Discount codes |
| `Order` | orders | Orders (items, address, GST breakdown, rider, fees) |
| `OrderEvent` | orders | Order event log |
| `ProcessedEvent` | orders | Idempotency/dedupe ledger |
| `OutboxEvent` | orders | Transactional outbox for reliable dispatch |
| `InvoiceCounter` | invoice | Sequential invoice numbering |
| `Payment` | payments | Payment records |
| `CodCollection` | payments | COD collection by rider |
| `SettlementHistory` | finance | Settlement audit |
| `RiderWallet` | finance | Rider balance |
| `WalletTransaction` | finance | Wallet ledger entries |
| `DeliveryBoy` | delivery | Delivery partner accounts |
| `DeliveryAttempt` | delivery | Delivery attempt records |
| `DeliveryEarning` | delivery | Per-delivery earnings |
| `DeliverySocketEvent` | delivery | Delivery socket event log |
| `Route` | routes | Optimized delivery routes (CVRP) |
| `Pincode` | location | Serviceable pincodes/ranges |
| `Notification` | notifications | In-app notifications |
| `LowStockNotification` | inventory | Low-stock admin alerts |
| `Review` | reviews | Product reviews |
| `Experiment` | experiments | A/B experiment config/results |
| `VoiceCorrection` | voice | Voice transcript corrections |
| `VoiceMetrics` | voice | Voice usage metrics |
| `AuditLog` | security | Audit trail |

### Order model (sampled fields, verified)
Items (`productId,name,price,qty`), shipping address (`label,addressLine,city,state,pincode,lat,lng`),
totals (`amount,deliveryFee,tip,commission,totalGst`), rider block (`riderId,offeredAt,status,type,lat,lng,updatedAt`),
ETA window (`start,end,confidence`), GST line items (`productName,hsnCode,quantity,unitPrice,taxableValue,gstRate,cgstAmount,sgstAmount,igstAmount,totalAmount,legalName`).

### Reliability primitives (notable, verified)
- **Transactional outbox:** `OutboxEvent` + dispatcher (env `OUTBOX_DISPATCHER_ENABLED_IN_TEST`).
- **Idempotency ledger:** `ProcessedEvent` + `middleware/idempotency.ts`.
- **Inventory reservation:** `InventoryReservation` (prevents oversell during checkout; CI guard `check-reservedstock-underflow`).
- **Event sourcing-ish:** `OrderEvent` for order history.

### Risk areas
- Index/constraint definitions not exhaustively audited here (`UNVERIFIED` per-field). Recommend a dedicated index review for `Order`, `Payment`, `InventoryReservation` (hot paths).
- Orphaned/unused fields: not exhaustively determined (would require usage cross-ref across 1,248 backend files). Flagged `UNVERIFIED`.
- GST fields duplicated at order + line-item level — verify single source of truth.

---

## Section 9 — Socket Inventory

**Backend:** `services/socketService.ts` (primary), `lowStockSocketService.ts`.
**Web:** `socket.io-client`. **Mobile:** `services/socketClient.ts`.

### Connection / rooms (verified)
- On `connection`, server joins `user_${userId}` room (`socketService.ts:76`).
- Admin alerts use `admin_room` (`lowStockSocketService`).
- Targeted emits via `io.to(socketId)` and `io.to(user_${userId})`.

### Server listeners (inbound, verified)
| Event | Handler | Purpose |
|-------|---------|---------|
| `connection` | join user room | session bind |
| `disconnect` | cleanup | — |
| `get_payment_status` | payment status reply | client poll-over-socket |
| `verify_otp` | OTP verify | delivery OTP |

### Server emits (outbound, verified)
| Event | Target | Consumer |
|-------|--------|----------|
| `otp_delivered` | socketId | rider/customer |
| `otp_verification_result` | socketId | rider |
| `payment_status_update` | socketId | customer |
| `order_status_updated` | socketId + `user_${userId}` | customer/mobile |
| `delivery_location_updated` | socketId + `user_${userId}` | customer tracking |
| `low_stock_alert` | `admin_room` | admin dashboard |
| `notification:status:update` | (notification socket) | clients |

### Mobile client (verified `socketClient.ts`)
- Emits: `subscribe_delivery_tracking`, `unsubscribe_delivery_tracking`.
- Listens: `connect`, `connect_error`, `disconnect`, `delivery_location_updated`, `order_status_updated`, `order:assigned`, `order:status:changed`, `payment_status_update`, `payment_status_updated`.

### ⚠️ Event-name mismatches (potential BROKEN bindings)
- Mobile listens for **`order:assigned`** and **`order:status:changed`** (colon style) AND **`order_status_updated`** (underscore). Backend `socketService` was only observed emitting **`order_status_updated`**. The colon-style events may be emitted elsewhere or be **dead listeners** — **verify producer** (see ALL_BUGS BUG-014).
- Mobile listens for both `payment_status_update` and `payment_status_updated` (singular/plural) — backend emits `payment_status_update`. The `_updated` variant may be a **dead listener**.

### Status: `WORKING` for the verified core (location/order/OTP/payment); `PARTIAL` due to naming inconsistencies.

---

## Section 10 — Cache Inventory (RTK Query)

### Web (`frontend/src/store/api.ts`)
- **Tags:** `User, Product, Order, Payment, Cart, Address, Notification, NotificationUnreadCount, DeliveryProfile`.
- **Config:** `keepUnusedDataFor: 60`, `refetchOnFocus:false`, `refetchOnReconnect:false`.
- **Providers/invalidators (examples):**
  - `getProfile` provides `User`; `updateProfile`/`deleteAccount` invalidate `User` (delete also resets entire API state).
  - `getCart` provides `Cart`; all cart mutations invalidate `Cart`.
  - `getProducts` provides per-id `Product` + `LIST`; product mutations invalidate `Product`.
  - `getAddresses` provides `Address`; address mutations invalidate `Address`.
  - `createOrder` invalidates `Cart, Order, Notification, NotificationUnreadCount`.
  - Notification mutations: **optimistic** updates across v1 + v2 caches + unread count, with `.undo()` rollback on failure.
- **Known issues:** `refetchOnReconnect:false` means stale data after offline→online unless manually invalidated; address payload logging (P1).

### Mobile (`apps/customer-app/src/api/baseApi.ts`)
- **Tags (22):** `Products, Product, Categories, Cart, Orders, Order, Addresses, Profile, Notifications, DeliveryOrders, DeliveryBoys, DeliveryPartners, Reviews, Coupons, Users, Clusters, RecentRoutes, AdminRoutes, AdminSettings, Pincode, Earnings`.
- **Config:** `keepUnusedDataFor: 60`, all refetch triggers off incl. `refetchOnMountOrArgChange:false` — **aggressive caching; stale-data risk** unless invalidation is thorough.
- Endpoints injected across 17 api slices.

### Stale-data risks
- Both clients disable `refetchOnReconnect` — combined with mobile offline queue, **cache can lag real state** after reconnection. Mitigated only by explicit tag invalidation + socket-driven updates.
- Frontend CI has `check-frontend-polling-discipline.mjs` — indicates deliberate anti-polling policy (rely on sockets + invalidation).

---

## Section 11 — Offline System Inventory (Mobile)

**Files:** `apps/customer-app/src/services/offlineQueue.ts`, `offlineMutationQueue.ts`;
connectivity via `@react-native-community/netinfo`; persistence via `redux-persist` + AsyncStorage;
secure tokens via `expo-secure-store`.

| Aspect | Finding | Status |
|--------|---------|--------|
| Queue | Dedicated offline mutation queue exists | W/P |
| Persistence | redux-persist (state) + AsyncStorage; queue persistence `UNVERIFIED` for all mutation types | P |
| Replay | Queue replays on reconnect (NetInfo-driven) | P (logic not fully audited) |
| Recovery | Token refresh integrated in baseApi; logout on refresh failure | W |
| Failure modes | RTK Query `refetchOnReconnect:false` → must rely on queue + manual invalidation | Risk |
| Data-loss risk | If app is killed mid-queue before persistence flush → possible loss | UNVERIFIED (P1 to verify) |

**Recommendation:** Add explicit integration tests for queue persistence across cold start and
verify idempotency keys are attached to all queued mutations (especially orders/payments).

---

## Section 12 — Security Inventory

| Control | Implementation | Status |
|---------|----------------|--------|
| AuthN (JWT) | `jsonwebtoken`, `middleware/auth.ts` (`authenticateToken`) | W |
| Refresh tokens | `/auth/refresh`; web `axiosInstance` + mobile `baseApi` interceptors | W |
| OAuth | passport google/facebook + `google-auth-library`; mobile google-signin | W |
| OTP | `Otp` model, send/verify endpoints, SMS (Fast2SMS)/email | P (provider dependent) |
| RBAC | client `AuthGate requiredRole`; server role checks in controllers | P (server completeness UNVERIFIED per-endpoint) |
| Rate limiting | `express-rate-limit`, `middleware/rateLimiter.ts`/`security.ts`; `loginRateLimit`, `signupRateLimit`, `checkoutRateLimit`, `apiLimiter` on `/api` | W |
| Input validation | `express-validator`, `express-openapi-validator`, `sanitizeInput` middleware | W/P |
| Security headers | `helmet` via `securityHeaders` middleware | W |
| CORS | explicit allowlist + dev localhost/private-IP bypass (`createApp.ts`) | W (dev bypass is intentional) |
| Webhook security | Razorpay raw-body + signature (`razorpayWebhook.ts`); CI `check-webhook-safety` | P |
| PII protection | `maskUpiVpa.ts`; CI `check-no-raw-vpa-logs`; `sanitizeUser.ts`, `getSafeEmail.ts` | P |
| Audit logging | `AuditLog` model, `middleware/auditLog.ts` | W |
| Secrets | `.env` files present in repo tree (`backend/.env`, `frontend/.env`, `apps/customer-app/.env`) | **Risk if committed — verify .gitignore** |
| Observability | Sentry (node/react/RN), `middleware/observability.ts`, request IDs | W |

### Known vulnerabilities / gaps (code-backed)
1. **Debug endpoints exposed** (`/api/debug`, `/api/dev/notifications`, `/cart/test`, web `/debug`,`/test-otp`). **P0** to gate/remove in prod.
2. **Address PII logged to console** (web `getAddresses`). **P1**.
3. **CORS dev bypass** allows any `localhost`/`192.168.`/`10.` origin when `NODE_ENV!=='production'` — fine for dev, ensure prod sets `NODE_ENV=production`.
4. **`.env` files in working tree** — confirm they are gitignored and not in history (`ENVIRONMENT_SECURITY.md` exists, suggesting awareness).
5. **9 payment CI guards** exist because payment correctness is historically fragile — treat as a standing security/financial risk until dual-path is consolidated.
6. Per-endpoint authorization (not just authentication) completeness is **UNVERIFIED** — recommend an authz audit of all `/api/admin/*` and `/api/internal/*` routes.

> Repo contains many security audit docs (`CRITICAL_SECURITY_AUDIT_2026.md`, `SECURITY_*`,
> `FORENSIC_AUDIT_2026.md`) — cross-reference for prior findings before launch.

---

## Section 13 — Background Jobs & Queues

**Queue infra:** BullMQ (`queues/queueManager.ts`, `workerManager.ts`, `processors/`, `utils/`,
`fallbackBuffer.ts`), Redis (`config/queueRedis.ts`), Bull-Board admin UI (`/api/admin/queues`).
Gated by `enableQueues` + `enableRedis` in `createApp.ts`. Health endpoint reports queue/worker health.

### Scheduled jobs (verified)
| Job | Schedule | Status |
|-----|----------|--------|
| `dailySettlementJob.ts` | `cron 30 18 * * *` (≈00:00 IST) — rider settlement | W |
| `videoCleanupJob.ts` | `cron 0 0 * * *` (daily) — orphan video cleanup | W |
| `rankingJob.ts` | `setInterval` every 10 min — search ranking refresh | W/P |
| `experimentMonitorJob.ts` | interval monitor — A/B monitoring | P |
| `generateEmbeddings.ts` | on-demand/job — embeddings for Qdrant | P |
| `uploadToQdrant.ts`, `createQdrantCollection.ts` | setup/ingest | P |
| `workers/trackingProjectionWorker.ts` | worker — tracking projections | P |
| Outbox dispatcher | interval (retry) — reliable event dispatch | W/P |

### Alerting (verified gap)
- `queues/alerts.ts`: Slack + PagerDuty are **`logger.info("Would send...")` stubs** → **no real paging (P1)**.

### Status: `PARTIAL` — robust queue framework + real cron jobs, but several jobs depend on external infra (Qdrant/Redis) and alerting is stubbed.

---

## Section 14 — Final Scorecard

> **Derivation:** Percentages are engineering judgment from structural evidence (presence and
> wiring of routes/controllers/services/models/UI), NOT measured test coverage. Test suites
> exist (jest/playwright/fast-check/k6/schemathesis) but were **not executed** for this report.

### Completion by area

| Area | Completion | Launch readiness | Confidence |
|------|-----------|------------------|------------|
| Authentication/Identity | 85% | 80% | Med |
| Users/Profile/Addresses | 87% | 82% | Med |
| Products/Catalog | 80% | 75% | Med |
| Search (keyword) | 85% | 80% | Med |
| Search (semantic/vector) | 70% | 55% | Low |
| Cart | 90% | 85% | High |
| Checkout/Orders | 80% | 72% | Med |
| **Payments (UPI/Razorpay/COD)** | **75%** | **60%** | Med |
| Coupons | 80% | 78% | Med |
| Notifications (in-app) | 85% | 80% | Med |
| Notifications (push/WhatsApp/restock) | 40% | 35% | High (stubs verified) |
| Reviews | 70% | 65% | Low |
| Delivery (auth+ops) | 80% | 75% | Med |
| Delivery Fee (v1+v2) | 80% | 70% | Med |
| Routes/CVRP | 75% | 65% | Low |
| Order Tracking | 70% | 62% | Low–Med |
| Admin/Ops | 80% | 72% | Med |
| Analytics/Metrics | 70% | 62% | Low |
| Voice AI | 65% | 50% | Low |
| Experiments/A-B | 65% | 55% | Low |
| Location/Pincode | 85% | 82% | Med |
| Media/Video | 75% | 68% | Low–Med |
| Earnings/Wallet | 75% | 70% | Med |
| Low-stock/Inventory | 65% | 58% | Med |
| Offline (mobile) | 70% | 60% | Low |
| Sockets | 80% | 75% | Med |
| Jobs/Queues | 75% | 65% | Med |

### Rolled-up scores

| Metric | Score |
|--------|-------|
| **Feature completion (overall)** | **~75%** |
| **Module completion (avg)** | **~76%** |
| **Web completion** | **~75%** |
| **Mobile completion** | **~70%** |
| **Backend completion** | **~80%** |
| **Launch readiness** | **~62%** |
| **Production readiness (infra/security)** | **~65%** |
| **Technical debt** | **High** |

### Bug count (see ALL_BUGS.md for full detail)

| Severity | Count (code-evidenced) |
|----------|------------------------|
| P0 | 4 |
| P1 | 8 |
| P2 | 7 |
| P3 | 3 |
| **Total catalogued** | **22** |

> Additional latent issues almost certainly exist across 302K LOC but are not listed unless
> code-evidenced (per "never assume" rule).

### Top risks (ranked)

1. **Dual payment architecture** (legacy `/payment` + new `/payments|/payment-intents`) — financial correctness risk. P0.
2. **Mobile prod base URL** hardcoded to a dev laptop. P0.
3. **Push notifications stubbed** — core engagement/ops channel non-functional. P0.
4. **Debug surfaces exposed** in API + web. P0.
5. **External-infra coupling** (Qdrant, Redis, Razorpay, Maps, Fast2SMS) with feature gating — fragile if any is unconfigured. P1.
6. **Stubbed alerting** (no real Slack/PagerDuty paging). P1.
7. **High documentation entropy** — 150+ root-level `*_COMPLETE/*_FINAL/*_AUDIT` docs create confusion about true state. P2 (process risk).

### Go / No-Go Recommendation

**NO-GO for full production launch as-is.** **CONDITIONAL-GO for a limited/pilot launch** after
closing the four P0 items.

**Minimum bar to launch (P0 closure):**
1. Consolidate payments to a single finalization path; keep CI guards green; remove or fully disable legacy `/payment`.
2. Make mobile `EXPO_PUBLIC_API_URL` a hard build-time requirement; remove laptop-hostname fallback.
3. Implement (or explicitly disable + hide UI for) push notifications; do not ship UI that promises non-functional push.
4. Gate/remove all debug/test endpoints (`/api/debug`, `/api/dev/notifications`, `/cart/test`, web `/debug`, `/test-otp`).

**Strongly recommended before scale:** authz audit of admin/internal routes, offline-queue durability tests, consolidate delivery-fee versions, wire real alerting, clean dead code (`.bak`, `_Flipkart`, legacy `.js` controllers), and archive the root-level status-doc sprawl into `docs/`.

---

## Appendix A — Verification Method & Limits

- **Measured:** file counts (`find`), LOC (`wc -l`), route mounts (`createApp.ts`), route method bindings (grep on router files), model file list, RTK Query tags/endpoints (read), socket events (grep on socket files), job schedules (grep), TODO/stub clusters (grep).
- **Not measured (UNVERIFIED):** runtime behavior, actual test pass/fail, DB indexes per field, exhaustive per-endpoint authorization, full component-by-component web/mobile enumeration (319 web + 331 mobile files), complete dead-code reachability analysis across 1,944 files.
- **Honesty note:** Where the brief asked for fixed large counts (50 blockers, 50 quick wins, 300–500 workflows), this document provides the **complete code-evidenced set** rather than padding to hit a number. That is a deliberate accuracy choice consistent with the brief's own "Never assume / Accuracy over optimism" rule.

*End of MASTER_PRD.md*
