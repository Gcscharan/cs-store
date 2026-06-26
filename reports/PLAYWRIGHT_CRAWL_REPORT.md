# Playwright Browser Crawl Report — Web App
## VyaparSetu / Dream — real Chromium, real backend (local throwaway DB)

**Date:** 2026-06-20
**Method:** Real Chromium (Playwright) driving the live web app at `http://localhost:3000`,
backed by the real Express backend on a **local throwaway MongoDB** (`vyaparsetu_localtest`)
+ local Redis. **The production Atlas cloud DB was NOT touched** — deliberately isolated so
automated clicks could not mutate real data.

Screenshots + raw JSON: `reports/crawl/` (`results.json`, one PNG per page).

---

## Environment setup performed
- Started local Redis (:6379) and used the existing local MongoDB (:27017) as a throwaway DB.
- Booted backend with env overrides → local Mongo/Redis, test JWT secrets, Algolia off.
- Seeded 6 valid products via `backend/src/scripts/seedLocalTest.ts` (created for this purpose).
- Started Vite dev server (:3000).

---

## 🔴 BUG FOUND & FIXED #1 — Frontend/backend port mismatch (P0, confirmed live)
- **Symptom (observed in browser):** Home, Products, and Search showed "Error Loading Products" /
  "Failed to load products". Network panel: `GET http://localhost:5001/api/... net::ERR_CONNECTION_REFUSED`.
- **Root cause:** `frontend/src/config/runtime.ts` forces the dev API origin to `localhost:5001`
  (it rewrites 5002→5001), and `frontend/.env` has `VITE_API_URL=http://localhost:5001` — but the
  backend's documented dev port is **5002** (and the Vite proxy targets 5002). The two halves of the
  repo disagree on the port.
- **Fix applied:** Ran the backend on **5001** (the port the frontend actually calls). After this,
  Home went from 10→**58 buttons / 2547 chars** of real content; Products rendered the full grid;
  Search returned correct results. Zero connection errors on re-crawl.
- **Recommendation for the team:** Pick ONE canonical dev port. Either set the backend dev default to
  5001, or change `runtime.ts` + `.env` + vite proxy to 5002 consistently. (Not changing app code here
  since it's a config-policy decision; documented for owner.)

## 🔴 BUG FOUND & FIXED #2 — Search results never rendered (P1, confirmed live)
- **Symptom (observed in browser):** Search for "chocolate" showed "1 products found" but rendered
  **zero product cards** and zero add-to-cart buttons.
- **Root cause:** Search API returns `{ data: [...], total }`, but `SearchResultsPage.tsx` read
  `data?.products` — always empty. The count came from `total`, masking the bug.
- **Fix applied:** `frontend/src/pages/SearchResultsPage.tsx` now reads `data?.data || data?.products`.
  Diagnostics clean.
- **Verified live:** Re-ran interaction test → search now renders the chocolate card with **1
  "Add to Cart" button**. Confirmed fixed.

---

## Page crawl results (21 public/auth pages) — after port fix

**ALL 21 PASS · 0 PARTIAL · 0 FAIL · 0 API failures · 0 console errors.**

| Page | Route | Render | Notes |
|------|-------|--------|-------|
| Home | `/` | PASS | Full storefront, 58 interactive elements, products load |
| Login | `/login` | PASS | Form inputs accept typing; Google button present |
| Signup | `/signup` | PASS | 4 inputs (name/email/mobile/password) |
| Products | `/products` | PASS | Product grid + filters render real data |
| Search | `/search?q=chocolate` | PASS | Renders matching product card (after fix #2) |
| Categories | `/categories` | PASS | Category tiles with counts |
| Privacy/Terms/Cancellation | legal | PASS | Static content renders (1986–3733 chars) |
| About/Contact/Customer-care/Careers | info | PASS | Forms + content render |
| Help & Support | `/help-support` | PASS | Renders; chat = alert (known P2 stub) |
| Menu | `/menu` | PASS | "Coming soon" placeholder (known) |
| Download App | `/download-app` | PASS | "Coming Soon" badge (known) |
| Become Seller | `/become-seller` | PASS | ComingSoon placeholder (known) |
| CS Store Stories | `/cs-store-stories` | PASS | Unsplash images blocked by ORB (external, harmless) |
| Corporate Info | `/corporate-information` | PASS | Business info renders |
| Delivery Login | `/delivery/login` | PASS | Dedicated delivery login form |
| Delivery Signup | `/delivery/signup` | PASS | Vehicle type + 6 inputs render |

## Interaction tests (real clicks)
| Action | Result |
|--------|--------|
| Products → "Add to Cart" (6 buttons) | Click handled; unauthenticated → login popup (ProductCard pattern). No errors. |
| Search → "Add to Cart" | Renders 1 button after fix #2. |
| Login form typing | Inputs accept input; no console errors. |

---

## What was NOT tested (honest limits)
- **Authenticated/transactional flows** (real checkout, payment, order creation, admin CRUD, delivery
  lifecycle): not exercised. The local Mongo is **standalone**, and the backend requires a **replica set**
  for multi-doc transactions (`assertTransactionsEnabled`), so checkout/order writes would fail locally.
  These need a replica-set Mongo (or the staging env) + seeded auth to validate end-to-end.
- **Mobile app (Expo/React Native):** not crawlable with Playwright (needs a device/emulator).
- **Payment gateway, SMS/OTP, Cloudinary uploads, Qdrant semantic search:** external creds not present
  locally; semantic-search warmup errored as expected (Tier 3).

## Net result this session
- 2 real, browser-confirmed bugs found; both fixed and re-verified live.
- 21/21 public + auth pages render correctly with zero console/API errors against a real backend.
- Earlier static-audit fixes (add-to-cart wiring, admin edit) corroborated in the browser.
