# Vyapara Setu — Mobile App Master Manual QA Roadmap

Source-derived testing roadmap for `apps/customer-app` (Expo / React Native).
This is the **roadmap only** (modules → submodules → features → checklist
dimensions → order → dependencies → time → risk → status), not individual test
cases.

## 0. Application understanding (from source)

- **Single multi-role binary.** `RootNavigator` routes by `auth.status` and
  `user.role`:
  - `LOADING` → Loading; `GOOGLE_AUTH_ONLY` → Onboarding; unauthenticated → auth
    stack (Login, Signup, OTP, Onboarding, DeliveryLogin, DeliverySignup).
  - `ACTIVE` + role: `admin` → AdminNavigator, `delivery` → DeliveryNavigator,
    else → CustomerTabs (Home, Categories, Cart, Orders, Account) + a shared
    stack (Search, ProductDetail, WriteReview, AllReviews, Checkout, Addresses,
    AddAddress, OrderSuccess, OrderDetail, OrderTracking, EditProfile,
    Notifications, Settings, NotificationPreferences, CustomerDashboard,
    ReferEarn, About, Help, Privacy, Terms, Cancellation, Contact).
- **State:** Redux + RTK Query (`store/`, `api/`, `store/api.ts`). Auth bootstrap
  via `useAuthBootstrap`.
- **Realtime:** `socketClient`, `useOrderTrackingSocket`, `useProductSocket`,
  `useDeliverySocket`.
- **Offline:** `offlineQueue`, `offlineMutationQueue`, `useOfflineQueueReplay`,
  `useConnectivityCheck`, delivery `useActionQueue`.
- **Background:** `tasks/backgroundLocationTask` (expo-task-manager + location;
  mocked-GPS defense; 422 → stop+clear route; offline-queue on failure).
- **Push:** `ExpoPushNotificationService` (permission + Expo/FCM token register/remove).
- **Voice:** `useVoiceSearch` (mic permission, intent parser: SEARCH/ADD_TO_CART/FILTER).
- **Deep links / external:** notification deep links (→ OrderTracking/OrderDetail);
  `Linking` for tel/whatsapp/mailto/maps/openSettings.
- **Permissions:** notifications (push), microphone (voice), location
  (foreground + background for delivery).
- **Hidden/non-prod:** `screens/debug/NetworkDiagnostic`, `OrderTrackingScreen.DEBUG`,
  `src/dev/`, `src/simulator/` (driver simulator), `src/scripts/`.
- **Note (resolved):** Wishlist is **NOT implemented** in the mobile customer
  app. `screens/wishlist/` is empty; there is no Wishlist screen, route, RTK
  Query hook, or UI entry point (no favorite/heart control on ProductDetail).
  The only trace is a dead `TOGGLE_WISHLIST` literal in
  `services/offlineQueue.ts`'s `SafeActionType` union that is never enqueued.
  Treat Wishlist as **out of scope** for mobile QA (do not test); it is a
  product-backlog feature, not a reachable surface.

---

## 1. Module map (by user functionality)

### Group A — Cross-cutting (test continuously, not once)
| # | Module | Notes |
|---|--------|-------|
| X1 | Permissions | notifications, mic, location (fg/bg) |
| X2 | Connectivity / Offline / Reconnect | queue replay, socket reconnect |
| X3 | Notifications (push + in-app) | delivery + tap → deep link |
| X4 | Deep Links | notification routes + tel/maps/whatsapp/mailto |
| X5 | Session / Auth-state | token refresh, logout, suspended, re-login |
| X6 | App lifecycle | background/resume, rotation, kill/restart, state persistence |

### Group B — Customer (primary)
| # | Module | Submodules |
|---|--------|-----------|
| 01 | Authentication | Login, Signup, OTP, Google Onboarding, Forgot/again, Validation, Logout |
| 02 | Home / Dashboard | HomeScreen, CustomerDashboard, banners, categories strip, featured, pull-to-refresh |
| 03 | Categories | CategoriesScreen, category → products, filters |
| 04 | Search | text search, suggestions, **voice search** (search/add-to-cart/filter), recent searches, sort, pagination, empty |
| 05 | Product Discovery | ProductsListScreen, filters/sort, pagination, stock states |
| 06 | Product Detail | media, price/MRP, stock, share, favorite, add-to-cart, similar, reviews summary |
| 07 | Reviews | AllReviews (list+stats), WriteReview (rating+comment, auth, duplicate, edit) |
| ~~08~~ | ~~Wishlist~~ | **NOT IMPLEMENTED in mobile — out of scope (see §0)** |
| 09 | Cart | view, add, remove, qty update, price calc, delivery fee, empty, sync, offline |
| 10 | Coupons | apply, invalid, expired, min-cart, remove |
| 11 | Addresses | list, add, validate (pincode/serviceability), edit, default, select |
| 12 | Checkout | address select, summary, delivery charges, coupon, terms, place order |
| 13 | Payments | Razorpay (UPI/card/netbanking), COD, failure, retry, app-killed recovery, timeout |
| 14 | Orders | list, detail, history, statuses, invoice, cancellation, refund request |
| 15 | Tracking | live socket map, ETA, rider details, polling fallback, terminal states, call rider |
| 16 | Profile / Account | view, edit, refer & earn |
| 17 | Settings | settings, notification preferences |
| 18 | Support | Help/Support, Contact (tel/whatsapp/email/maps) |
| 19 | Info / Legal | About, Privacy, Terms, Cancellation |

### Group C — Delivery role (reachable via delivery login)
| # | Module | Submodules |
|---|--------|-----------|
| D1 | Delivery Auth | DeliveryLogin, DeliverySignup, pending/suspended states |
| D2 | KYC | DeliveryKYC (doc upload), DeliverySelfie, submit, statuses (NOT_STARTED/PENDING/VERIFIED/REJECTED), re-upload |
| D3 | Dashboard / Home | DeliveryDashboard, DeliveryHomeTab, availability toggle |
| D4 | Order Flow | assignment, accept/queue, pickup, start, navigation (Route screen + maps), arrival, OTP, delivered, failure/reattempt |
| D5 | Earnings / Wallet | DeliveryEarningsTab, history |
| D6 | Background GPS | foreground+background location, mocked-GPS rejection, 422 stop, offline queue |
| D7 | Offline Action Queue | queue, replay (FIFO), reassigned-order drop, retry/backoff |
| D8 | More / Profile / Settings | DeliveryMoreTab, DeliveryProfile, DeliverySettings, Emergency, HelpCenter |

### Group D — Admin role (reachable via admin login)
| # | Module | Submodules |
|---|--------|-----------|
| A1 | Admin Auth / Dashboard | login, AdminDashboard, AdminProfile |
| A2 | Products | list, create, edit, version history, publish, bulk |
| A3 | Orders | list, detail, confirm/pack/assign/cancel, COD collection |
| A4 | Delivery Mgmt | DeliveryBoys, KYC review (verify/reject), SelectDeliveryPartner, Routes (preview/detail/map/recent), clusters |
| A5 | Users | AdminUsers |
| A6 | Finance / Payments | AdminFinance (export), AdminPayments |
| A7 | Analytics / Ops | AdminAnalytics, AdminOps |
| A8 | Settings | AdminSettings |

---

## 2. Per-feature decomposition (example depth — apply to every submodule)

Each submodule decomposes into FEATURES, e.g. **12 Checkout**:
Address selection · Address creation · Address validation/serviceability ·
Payment method choice · Coupon · Order summary · Delivery charges · Tax/fee calc ·
Terms acceptance · Place order · Loading · Error · Retry · Success → OrderSuccess ·
Failure · Timeout · Recovery (app-killed).

Each FEATURE is one testing unit and is exercised against the **standard
checklist dimensions** in §4.

---

## 3. Dependency graph (determines order)

```
X1 Permissions ─┐
X5 Session  ────┤
01 Authentication
   ↓
02 Home ── 03 Categories ── 04 Search ── 05 Product List
   ↓
06 Product Detail ── 07 Reviews
   ↓
   (08 Wishlist — not implemented in mobile, skip)
   ↓
09 Cart ── 10 Coupons
   ↓
11 Addresses
   ↓
12 Checkout
   ↓
13 Payments  ←→ (X2 Offline, X6 lifecycle: app-killed recovery)
   ↓
14 Orders ── (invoice, cancellation → refund)
   ↓
15 Tracking  ←→ (X3 Notifications, X4 Deep Links, socket/polling)
   ↓
16 Profile · 17 Settings · 18 Support · 19 Info

Delivery: D1 → D2 (KYC) → A4 admin approval → D3 → D4 (needs an assigned order
from 12/Admin) → D5/D6/D7/D8
Admin:    A1 → A2/A3/A5 → A4 (KYC approve, assign) → A6/A7/A8
```
Cross-role: a real end-to-end delivery test requires Customer order (12/13) +
Admin assignment (A4) + Delivery execution (D4) — sequence accordingly.

---

## 4. Standard checklist dimensions (apply to EVERY submodule)

Navigation · UI/layout (light) · Input validation · Loading state ·
Success state · Failure/error state · Retry · Offline behavior · Network-loss
mid-action · Permissions (grant/deny/revoke) · Deep link entry · State
persistence (Redux/AsyncStorage) · Rotation · Background → resume ·
Kill → restart · Logout → re-login · Data consistency (web/mobile/backend) ·
Edge cases (empty, max, special chars, large qty, slow 3G) · Recovery (what
reconciles after crash/timeout).

---

## 5. Testing order + metadata

| # | Module | Prereqs | Risk | Criticality | Est |
|---|--------|---------|------|-------------|-----|
| X1 | Permissions | — | Med | High | 30m |
| 01 | Authentication | X1 | High | Critical | 1.5h |
| X5 | Session/Auth-state | 01 | High | Critical | 45m |
| 02 | Home/Dashboard | 01 | Low | High | 30m |
| 03 | Categories | 02 | Low | Med | 20m |
| 04 | Search (+voice) | 02, X1 mic | Med | High | 1h |
| 05 | Product List | 03/04 | Low | Med | 30m |
| 06 | Product Detail | 05 | Med | High | 45m |
| 07 | Reviews | 06, 01 | Med | Med | 45m |
| ~~08~~ | ~~Wishlist~~ | — | n/a | **SKIP — not implemented (see §0)** | — |
| 09 | Cart | 06 | High | Critical | 1h |
| 10 | Coupons | 09 | Med | High | 30m |
| 11 | Addresses | 01 | Med | High | 45m |
| 12 | Checkout | 09,10,11 | High | Critical | 1.5h |
| 13 | Payments | 12 | **Critical** | **Critical** | 2h |
| 14 | Orders | 13 | High | Critical | 1h |
| 15 | Tracking | 14, D4, X3 | High | Critical | 1h |
| 16 | Profile | 01 | Low | Med | 30m |
| 17 | Settings | 01 | Low | Med | 30m |
| 18 | Support | 01 | Low | Med | 20m |
| 19 | Info/Legal | — | Low | Low | 15m |
| X3 | Notifications | 01, X1 push | High | High | 1h |
| X4 | Deep Links | X3 | Med | High | 45m |
| X2 | Offline/Reconnect | 09,13 | High | High | 1h |
| X6 | App lifecycle | most | Med | High | 1h |
| D1 | Delivery Auth | — | Med | High | 30m |
| D2 | KYC | D1 | Med | High | 45m |
| D3 | Delivery Dashboard | D2,A4 | Med | High | 30m |
| D4 | Delivery Order Flow | D3, order assigned | **Critical** | Critical | 2h |
| D5 | Earnings/Wallet | D4 | High | Critical | 30m |
| D6 | Background GPS | D4 | High | High | 1h |
| D7 | Delivery Offline Queue | D4 | High | High | 45m |
| D8 | Delivery More/Settings | D1 | Low | Med | 30m |
| A1 | Admin Dashboard | — | Med | High | 30m |
| A2 | Admin Products | A1 | Med | High | 1h |
| A3 | Admin Orders | A1, order exists | High | Critical | 1h |
| A4 | Admin Delivery/KYC/Routes | A1 | High | Critical | 1.5h |
| A5 | Admin Users | A1 | Med | Med | 30m |
| A6 | Admin Finance/Payments | A1 | High | High | 45m |
| A7 | Admin Analytics/Ops | A1 | Low | Med | 30m |
| A8 | Admin Settings | A1 | Low | Med | 20m |

---

## 6. Cross-module business journeys (each = one end-to-end manual test)

1. **Guest → Login → Browse → Search → Product → Cart → Coupon → Checkout →
   Pay (UPI success) → Order → Track → Delivered.**
2. **Payment failure → retry → success** (and **app-killed mid-payment → reopen
   → order converges**).
3. **COD order → Admin confirm → pack → assign → Delivery pickup → navigate →
   arrive → OTP → delivered → rider earning credited.**
4. **Cancellation → auto-refund → refund-completed notification.**
5. **Reassignment:** Admin assigns A → reassigns B → customer tracking shows B,
   not A; rider A's queued offline actions are dropped.
6. **Offline cart/checkout:** go offline → add to cart → reconnect → syncs (no dupes).
7. **Delivery KYC:** rider signup → KYC upload → admin verify → rider can go online.
8. **Write review** after a delivered order → appears in AllReviews + stats.
9. **Notification tap deep link** → correct screen (OrderTracking/OrderDetail).
10. **Multi-device rider** same account on 2 devices → no double actions.

---

## 7. Release testing dashboard (initialize all NOT STARTED)

| Module | Submodules | Features (≈) | Manual Tests (≈) | Status |
|--------|-----------:|------:|------:|--------|
| 01 Authentication | 7 | 25 | 40 | NOT STARTED |
| 04 Search | 6 | 18 | 30 | NOT STARTED |
| 09 Cart | 12 | 30 | 45 | NOT STARTED |
| 12 Checkout | 10 | 28 | 45 | NOT STARTED |
| 13 Payments | 8 | 26 | 50 | NOT STARTED |
| 14 Orders | 6 | 18 | 30 | NOT STARTED |
| 15 Tracking | 7 | 18 | 30 | NOT STARTED |
| D4 Delivery Order Flow | 9 | 28 | 50 | NOT STARTED |
| A4 Admin Delivery/KYC/Routes | 8 | 24 | 40 | NOT STARTED |
| …(all other modules in §5)… | — | — | — | NOT STARTED |

(Full row-per-module sheet to be maintained in the team tracker; every module in
§5 starts NOT STARTED.)

---

## 8. Execution batches (~1–2h each)

- **Batch 1:** X1 Permissions, 01 Authentication, X5 Session, Onboarding.
- **Batch 2:** 02 Home, 03 Categories, 04 Search (+voice), 05 Product List, 06 Product Detail.
- **Batch 3:** 07 Reviews, 08 Wishlist, 09 Cart, 10 Coupons.
- **Batch 4:** 11 Addresses, 12 Checkout, 13 Payments.
- **Batch 5:** 14 Orders, 15 Tracking, X3 Notifications, X4 Deep Links.
- **Batch 6:** 16 Profile, 17 Settings, 18 Support, 19 Info, X2 Offline, X6 Lifecycle.
- **Batch 7:** D1 Delivery Auth, D2 KYC, D8 More/Settings.
- **Batch 8:** D3 Dashboard, D4 Order Flow, D5 Earnings.
- **Batch 9:** D6 Background GPS, D7 Offline Queue (multi-device).
- **Batch 10:** A1 Dashboard, A2 Products, A3 Orders.
- **Batch 11:** A4 Delivery/KYC/Routes, A5 Users.
- **Batch 12:** A6 Finance/Payments, A7 Analytics/Ops, A8 Settings.
- **Batch 13:** Cross-module journeys (§6) — full end-to-end.

---

## 9. Effort estimate

- Modules: **~42** (19 customer + 6 cross-cutting + 8 delivery + 8 admin, minus overlaps).
- Submodules: **~150**.
- Features: **~450**.
- Estimated manual test cases: **~700–800**.
- Estimated hours: **~32–38h** of focused execution.
- Estimated days: **~5–6 working days** (1 tester); ~3 days with 2 testers split
  by role group.
- **Critical path (must pass before launch):** 01 → 09 → 12 → 13 → 14 → 15 + D4 + A3/A4 + journeys §6 (1–4).
- **High-risk modules:** 13 Payments, D4 Delivery Order Flow, 15 Tracking, A4 Admin Delivery/KYC, X2 Offline.
- **Medium-risk:** Auth, Cart, Checkout, Addresses, KYC, Background GPS, Notifications.
- **Low-risk:** Info/Legal, Settings, Categories, Home.

---

## 10. Hidden / non-obvious surfaces to also test (or confirm disabled in prod)

- `screens/debug/NetworkDiagnostic` — debug screen (confirm not reachable in prod build).
- `screens/orders/OrderTrackingScreen.DEBUG.tsx` — debug variant (confirm unused).
- `src/dev/` and `src/simulator/` (driver simulator) — must be **disabled** in
  production builds; verify no simulator UI/toggles ship.
- `CustomerDashboard` — reachable via stack route; confirm entry points.
- Onboarding (GOOGLE_AUTH_ONLY) complete-profile flow — only after Google sign-in.
- Suspended-account flow (auth 403 "Account suspended") — needs a suspended user.
- Background location task — only active for delivery during an active route.
- Push permission denied path + token removal on logout.
- Deep links: notification payloads → `/orders/{id}` and `/orders/{id}/tracking`.
- ReferEarn — referral code generation/sharing.

---

## 11. Notes for the tester
- The same build serves Customer/Delivery/Admin by role — use **three test
  accounts**. A full fulfilment journey needs all three coordinated.
- Real-environment dependencies (live Razorpay, FCM/Expo push, GPS, Cloudinary,
  maps) are the point of manual testing — see `release/RELEASE_CHECKLIST.md` §D.
- Re-verify against current source if screens change; this roadmap was derived
  from `RootNavigator`, the per-role navigators, `services/`, `hooks/`, `tasks/`,
  and `utils/` as of this commit.
