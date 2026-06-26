# ALL_BUGS.md — Code-Evidenced Issue Catalog
## VyaparSetu / Dream Project

> Companion to `MASTER_PRD.md`. Every bug below is backed by a specific file/line observation
> made during structural inspection. Issues that would require runtime reproduction to confirm
> are marked `NEEDS-RUNTIME`. This list is **not padded** — only code-evidenced items are included.
> Latent bugs certainly exist across the ~302K LOC but are excluded unless evidenced.

**Generated:** 2026-06-20

---

## P0 — Launch Blockers

### BUG-001 — Mobile API base URL hardcoded to a developer machine
- **Severity:** P0
- **Module:** Mobile / API config
- **Description:** When `EXPO_PUBLIC_API_URL` is unset, the app falls back to `http://GCSCharans-MacBook-Air.local:5002/api`.
- **Root cause:** Hardcoded developer hostname fallback in `getRawUrl()`.
- **Files:** `apps/customer-app/src/api/baseApi.ts` (`getRawUrl`, `BASE_URL`).
- **Reproduction:** Build/run a release without `EXPO_PUBLIC_API_URL` → all API calls target the laptop.
- **Impact:** Production/standalone builds cannot reach the backend. Total app failure off the dev LAN.
- **Fix:** Require `EXPO_PUBLIC_API_URL` at build time; fail fast (throw) if missing in production; remove hostname fallback.
- **Launch risk:** Critical.

### BUG-002 — Dual / overlapping payment architectures
- **Severity:** P0
- **Module:** Payments
- **Description:** Legacy payment routes (`/api/payment` → `domains/finance/routes/paymentRoutes.ts`) coexist with the new payment domain (`/api/payment-intents`, `/api/payment-status`, `/api/payments`, `/api/webhooks` → `domains/payments/*`).
- **Root cause:** Incomplete migration; both mounted in `createApp.ts`.
- **Files:** `backend/src/createApp.ts`; `backend/src/domains/finance/routes/paymentRoutes.ts`; `backend/src/domains/payments/routes/*`.
- **Evidence of fragility:** 9 dedicated CI guard scripts in `backend/package.json` (`ci:check-finalizer-authority`, `check-paymentstatus-canonical`, `check-paid-writes`, `check-reservedstock-underflow`, `check-paymentintent-transitions`, `check-legacy-payment-lock`, `check-webhook-safety`, `check-no-raw-vpa-logs`, `check-upi-verify-safety`).
- **Impact:** Risk of inconsistent finalization, double-writes, or double-charge if both paths are reachable.
- **Fix:** Pick one finalization authority; fully disable legacy; keep CI guards green.
- **Launch risk:** Critical (financial).

### BUG-003 — Push notifications not implemented (stubs)
- **Severity:** P0
- **Module:** Notifications
- **Description:** Push send paths are TODO stubs across two notification services; low-stock push send is also TODO.
- **Files / evidence:**
  - `backend/src/domains/notifications/services/notificationService.ts` — "TODO: Fetch user's FCM token from DB", "TODO: Send via firebase-admin".
  - `backend/src/domains/communication/services/notificationService.ts` — "TODO: Implement Push notification service".
  - `backend/src/controllers/lowStockNotificationController.ts` — "TODO: Phase 4 - Integrate with push notification service" (×2).
- **Impact:** Customers/riders/admins receive no push notifications even though token registration and UI exist.
- **Fix:** Implement firebase-admin / Expo push send; or disable push UI until ready.
- **Launch risk:** High.

### BUG-004 — Debug/test endpoints exposed in API and web
- **Severity:** P0 (security)
- **Module:** Cross-cutting
- **Description:** Debug and test surfaces are mounted without clear production gating.
- **Files / evidence:**
  - `backend/src/createApp.ts` mounts `/api/debug` (`debugDbTest`) and `/api/dev/notifications` (`devNotifications`).
  - `backend/src/routes/cart.ts` exposes `GET /cart/test`.
  - `frontend/src/App.tsx` routes `/debug` (DebugPage) and `/test-otp` (TestOtpPage).
- **Impact:** Potential information disclosure / abuse in production.
- **Fix:** Gate behind `NODE_ENV !== 'production'` or remove before release.
- **Launch risk:** High.

---

### BUG-004b — Hardcoded Gmail credentials / app-passwords committed in source
- **Severity:** P0 (security)
- **Module:** Email / OTP
- **Description:** Real Gmail address + app passwords are hardcoded in source.
- **Files:** `backend/src/utils/sendEmailSMTP.ts`, `backend/src/utils/sendEmailOTP.ts`.
- **Impact:** Credential leak in the repo/history; account takeover risk; OTP/email spoofing.
- **Fix:** Rotate the Gmail app passwords immediately; move to env vars (`SMTP_USER`/`SMTP_PASS`);
  scrub from git history. Discovered during the authenticated Playwright crawl session.
- **Launch risk:** Critical.

### BUG-023 — Vite dev proxy port mismatch broke raw fetch('/api/...') pages (confirmed live)
- **Severity:** P0
- **Module:** Web build/config
- **Description:** ~13 pages use raw relative `fetch("/api/...")` which route through the Vite proxy.
  The proxy targeted `:5002` while the rest of the app + backend use `:5001`, so OrdersPage and
  AdminRoutesPage threw HTTP 500 in the browser (worked via direct curl).
- **Files:** `frontend/vite.config.ts` (proxy target); call sites incl. `OrdersPage.tsx`,
  `AdminRoutesPage.tsx`, `AdminRoutesPreviewPage.tsx`, `AdminRecentRoutesPage.tsx`, delivery tabs,
  `FileUpload.tsx`, OTP components.
- **Fix applied:** Pointed Vite proxy at `:5001`. Verified live → 0 API failures across 21 pages.
- **Follow-up:** Migrate raw `fetch("/api/...")` calls to `toApiUrl()` for consistency.

### BUG-024 — Missing `/api/admin/settings` route (confirmed live)
- **Severity:** P1
- **Module:** Admin
- **Description:** `AdminSettingsPage` calls `GET/PUT /api/admin/settings`; no route existed → 404.
- **Fix applied:** Added GET/PUT settings route to `backend/src/routes/admin.ts` (config-derived read,
  store-profile write). Verified 200 live.
- **Follow-up:** Editable store-profile fields are not yet persisted (no Settings model). Product
  decision needed on where these live.

## P1 — Major

### BUG-005 — Address PII logged to console (web)
- **Severity:** P1
- **Module:** Addresses / web data layer
- **Files:** `frontend/src/store/api.ts` — `getAddresses.transformResponse` calls `console.log("[getAddresses] Raw API response:", ...)` and logs the transformed result, including full address objects.
- **Impact:** PII leakage into browser console/log aggregators.
- **Fix:** Remove or guard logs behind a debug flag.

### BUG-006 — WhatsApp notification channel stubbed
- **Severity:** P1
- **Files:** `backend/src/domains/communication/services/notificationService.ts` — "TODO: Implement WhatsApp Business API integration".
- **Impact:** WhatsApp channel advertised in preferences but non-functional.
- **Fix:** Implement or hide channel.

### BUG-007 — Restock / wishlist notifications not implemented
- **Severity:** P1
- **Files:** `backend/src/domains/communication/services/notificationService.ts` — "Restock notifications not yet implemented - requires wishlist feature".
- **Impact:** Restock alerts silently do nothing.
- **Fix:** Implement after wishlist; until then, do not surface the option.

### BUG-008 — Wishlist module empty on mobile
- **Severity:** P1
- **Module:** Mobile / Wishlist
- **Files:** `apps/customer-app/src/screens/wishlist/` contains 0 `.tsx` files.
- **Impact:** Wishlist entry points (if any) lead nowhere; feature incomplete.
- **Fix:** Implement or remove navigation references.

### BUG-009 — Delivery serviceability is interim state-based
- **Severity:** P1
- **Files:** `backend/src/services/deliveryService.ts` — "TODO: Replace with district-based or distance-based" (currently `isDeliverableState(state)`).
- **Impact:** Coarse serviceability; may accept/reject orders incorrectly at boundaries.
- **Fix:** Implement distance/district-based serviceability.

### BUG-010 — Production alerting is a no-op
- **Severity:** P1
- **Files:** `backend/src/queues/alerts.ts` — Slack and PagerDuty handlers only `logger.info("Would send ...")`.
- **Impact:** No real paging on production incidents.
- **Fix:** Wire real Slack webhook + PagerDuty API, or remove the channels.

### BUG-011 — Token refresh logic duplicated across web & mobile
- **Severity:** P1 (maintainability/correctness)
- **Files:** `frontend/src/api/axiosInstance.ts` (refresh interceptor) and `apps/customer-app/src/api/baseApi.ts` (`baseQueryWithReauth`).
- **Impact:** Divergent refresh behavior; race conditions on concurrent 401s (`NEEDS-RUNTIME` to confirm mutex coverage — web uses `async-mutex`, mobile uses ad-hoc axios call).
- **Fix:** Centralize refresh semantics; ensure single-flight refresh on both platforms.

### BUG-012 — Internal tracking customer notification not emitted
- **Severity:** P1
- **Files:** `backend/src/routes/internalTracking.ts` — "TODO: Emit notification to customer via socket", "TODO: Update order status if needed".
- **Impact:** Customers may not be notified on certain tracking events.
- **Fix:** Implement socket emit + status update.

---

## P2 — Moderate

### BUG-013 — Admin profile edit is a stub (web)
- **Severity:** P2
- **Files:** `frontend/src/pages/AdminProfilePage.tsx` — `handleEditProfile` only `console.log("Edit profile clicked")`.
- **Fix:** Implement edit or hide the button.

### BUG-014 — Socket event-name mismatches (potential dead listeners)
- **Severity:** P2
- **Module:** Sockets
- **Description:** Mobile listens for `order:assigned`, `order:status:changed`, and `payment_status_updated`, but backend `socketService.ts` was only observed emitting `order_status_updated` and `payment_status_update`.
- **Files:** `apps/customer-app/src/services/socketClient.ts` vs `backend/src/services/socketService.ts`.
- **Impact:** Some client listeners may never fire (dead) OR producers exist elsewhere (`NEEDS-RUNTIME` to confirm).
- **Fix:** Standardize event names; remove dead listeners.

### BUG-015 — SearchResults add-to-cart is a stub (web)
- **Severity:** P2
- **Files:** `frontend/src/pages/SearchResultsPage.tsx` — "TODO: Implement add to cart functionality" → `console.log`.
- **Fix:** Wire to cart mutation.

### BUG-016 — Delivery settings actions are "coming soon" alerts
- **Severity:** P2
- **Files:** `frontend/src/pages/DeliverySettingsPage.tsx`, `frontend/src/pages/DeliveryProfilePage.tsx` — multiple `alert("... coming soon")`.
- **Fix:** Implement or remove menu items.

### BUG-017 — Experiment "deploy winner" not wired to prod config
- **Severity:** P2
- **Files:** `backend/src/services/experimentService.ts` — "TODO: Actually deploy winner config to production".
- **Fix:** Implement config rollout.

### BUG-018 — Two parallel delivery-fee implementations
- **Severity:** P2
- **Files:** `backend/src/routes/deliveryFee.ts` (`/delivery-fee`) and `backend/src/routes/enhancedDeliveryFeeRoutes.ts` (`/delivery-fee-v2`).
- **Impact:** Ambiguous source of truth for fees.
- **Fix:** Consolidate to one version.

### BUG-019 — `kafkajs` dependency without verified wiring
- **Severity:** P2
- **Files:** `backend/package.json` (`kafkajs`). No clear consumer/producer found in inspected files.
- **Impact:** Possible dead/aspirational dependency, bundle/footprint cost, confusion.
- **Fix:** Confirm usage or remove. `NEEDS-RUNTIME`/deeper grep.

---

## P3 — Minor

### BUG-020 — Delivery signup admin-notify TODO
- **Severity:** P3
- **Files:** `backend/src/controllers/deliveryAuthController.ts` — "TODO: Send notification to admin about new signup".

### BUG-021 — Help/Support chat is an alert
- **Severity:** P3
- **Files:** `frontend/src/pages/HelpSupportPage.tsx` — `alert(t("help.chatComingSoon"))`.

### BUG-022 — Legacy `.js` files in TypeScript backend
- **Severity:** P3
- **Files:** `backend/src/controllers/productController.js`, `backend/src/utils/normalizeProductImages.js`.
- **Impact:** Type-safety gap; inconsistent with TS codebase.
- **Fix:** Port to TypeScript.

---

## Notes
- Items marked `NEEDS-RUNTIME` require executing the app/tests to confirm severity.
- The repository already contains numerous prior audit reports (`CRITICAL_SECURITY_AUDIT_2026.md`,
  `FORENSIC_AUDIT_2026.md`, `TECHNICAL_AUDIT_2026.md`, `FINAL_PRODUCTION_AUDIT.md`, etc.).
  Cross-reference them; some listed items may already have remediation in progress.

*End of ALL_BUGS.md*
