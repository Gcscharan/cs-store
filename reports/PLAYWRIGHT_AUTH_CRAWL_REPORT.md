# Authenticated Playwright Crawl Report — Admin + Customer
## VyaparSetu / Dream — real Chromium, real backend, replica-set Mongo

**Date:** 2026-06-20
**Method:** Real Chromium driving the live web app, backed by the real Express backend on a
**local single-node replica-set MongoDB** (`rs0` @ 27018) + local Redis. Auth obtained via the
real OTP login flow (`MOCK_OTP=true` returns the OTP in dev), tokens injected into localStorage.
**Production Atlas DB never touched.**

Screenshots + JSON: `reports/crawl-auth/`.

---

## Infrastructure set up this session
- Started a **single-node replica-set mongod** on :27018 (`rs0`) so multi-doc transactions work
  (the backend asserts transactions are available for checkout/orders).
- Restarted local Redis (:6379).
- Seeded 6 products + a test customer (`9000000000`) into the replica-set DB.
- Backend booted on :5001 against the replica set; dev admin (`9391795162`) auto-bootstrapped.

## Auth verified working (real flow)
- **OTP login works end-to-end** for both admin and customer (send-otp → verify-otp → tokens).
- **Password login is intentionally disabled** (`PASSWORD_LOGIN_DISABLED`) — app uses OTP/Google OAuth.

---

## 🔴 BUG FOUND & FIXED #3 — `/api/admin/settings` returned 404 (P1, confirmed live)
- **Symptom:** Admin Settings page called `GET/PUT /api/admin/settings` → **404 "Route not found"**.
  Settings could not load or save.
- **Root cause:** No settings route was ever registered in `backend/src/routes/admin.ts`, though the
  page (`AdminSettingsPage.tsx`) depends on it.
- **Fix applied:** Added `GET /api/admin/settings` (returns config/env-derived warehouse, hubs,
  capacities, razorpay status, store profile) and `PUT /api/admin/settings` (accepts editable store
  fields). Env-controlled values are read-only (UI already labels them "from environment").
- **Verified live:** endpoint now returns 200 with real config; page loads its data.

## 🔴 BUG FOUND & FIXED #4 — Customer `/orders` and admin `/routes` 500 in browser (P0/P1, confirmed live)
- **Symptom:** `/orders` (customer) and `/admin/routes` showed **HTTP 500** in the browser, even
  though calling the same endpoints directly via curl returned **200**.
- **Root cause (systemic):** The app has **two API-calling styles**:
  - Most code uses `toApiUrl()`/`authFetch`/`publicApi` → resolves to the configured origin (**:5001** in dev).
  - ~13 places use **raw relative `fetch("/api/...")`** (OrdersPage, AdminRoutesPage, delivery tabs,
    uploads, OTP components) → these go through the **Vite dev proxy**, which was hardcoded to **:5002**.
  - Backend runs on :5001, so the proxy-dependent calls hit a dead :5002 → 500. **No single port made
    the whole app work** — the two halves disagreed.
- **Fix applied:** Pointed the Vite proxy at **:5001** (`frontend/vite.config.ts`) to match the rest
  of the app's API origin. One-line config change, no refactor.
- **Verified live:** Re-crawl → **0 API failures across all 21 authenticated pages**; `/orders` and
  `/admin/routes` now 200.
- **Team note:** This is the same port-mismatch family as the earlier public-crawl finding. The repo
  should standardize on ONE dev port across `.env`, `runtime.ts`, and the Vite proxy. Long-term, the
  ~13 raw `fetch("/api/...")` call sites should migrate to `toApiUrl()` for consistency (tracked, not
  done here to avoid broad churn).

---

## Results — 21 protected pages (after fixes): 21 PASS, 0 FAIL, 0 API errors

### Admin (12 pages) — all PASS, render real data
| Page | Notes |
|------|-------|
| `/admin` dashboard | Shows "Total Products 6 / Total Users 2" (real seeded data) |
| `/admin/products` | Product catalog + category filters render |
| `/admin/products/new` | Create-product form renders |
| `/admin/orders` | Orders management renders (0 orders) |
| `/admin/users` | Users list renders (admin + customer) |
| `/admin/delivery-boys` | Partner management renders |
| `/admin/analytics` | Sales analytics renders (₹0) |
| `/admin/finance` | Finance ledger renders |
| `/admin/payments` | Payment logs render |
| `/admin/routes` | Renders (500 fixed via proxy) |
| `/admin/settings` | Renders + loads data (404 fixed) |
| `/admin-profile` | Profile + working Edit form (fixed earlier session) |

### Customer (9 pages) — all PASS, render real data
| Page | Notes |
|------|-------|
| `/dashboard` | Full storefront, 40 interactive elements |
| `/cart` | Empty-cart state renders |
| `/checkout` | Renders (empty cart guard) |
| `/orders` | Renders (500 fixed via proxy) |
| `/profile` | Shows "Test User / test.user@example.com" |
| `/addresses` | Address management renders |
| `/account` | Account hub renders |
| `/notification-preferences` | Preferences render |
| `/settings` | Settings render |

---

## Cumulative bugs found via live browser testing (this + prior crawl)
| # | Bug | Sev | Status |
|---|-----|-----|--------|
| 1 | Frontend↔backend port mismatch (toApiUrl forces 5001, backend default 5002) | P0 | Fixed (run on 5001) + documented |
| 2 | Search results never rendered (`data` vs `products` key) | P1 | Fixed in `SearchResultsPage.tsx` |
| 3 | `/api/admin/settings` 404 (route never registered) | P1 | Fixed (added route) |
| 4 | Raw `fetch("/api/")` calls broke via Vite proxy→5002 (orders/routes 500) | P0 | Fixed (proxy→5001) |

## 🔒 Security issue found (NOT auto-fixed — flagging)
- **Hardcoded Gmail credentials / app-passwords committed in source:**
  `backend/src/utils/sendEmailSMTP.ts` and `sendEmailOTP.ts` contain a real Gmail address and app
  passwords in plaintext. **Rotate these immediately and move to env vars.** (Added to ALL_BUGS as P0 security.)

## Still NOT tested (honest limits)
- **Full checkout→payment→order-creation write path:** cart was empty; exercising real order creation
  needs add-to-cart→checkout→payment with a (test) Razorpay key. The replica set now supports the
  transactions, so this is doable next with a seeded cart + Razorpay test creds.
- **Delivery partner app flows** (mobile) and **delivery web dashboard** authenticated actions.
- **Payment gateway, real SMS, Cloudinary uploads, Qdrant** — external creds absent locally.
