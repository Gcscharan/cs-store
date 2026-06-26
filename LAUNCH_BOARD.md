# LAUNCH_BOARD.md — Execution Board
## VyaparSetu / Dream — sorted by Revenue Impact × User Impact ÷ Fix Time

**Generated:** 2026-06-20

---

## ✅ DONE THIS SESSION (safe stabilization — no architecture changes)

| Item | Files | Verified |
|------|-------|----------|
| Gate `/api/debug` (unauth DB writes + PII dump) to non-prod | `backend/src/createApp.ts` | diagnostics clean |
| Gate `/api/dev/notifications` to non-prod | `backend/src/createApp.ts` | diagnostics clean |
| Gate `GET /cart/test` to non-prod | `backend/src/routes/cart.ts` | diagnostics clean |
| Gate web `/debug` + `/test-otp` to non-prod | `frontend/src/App.tsx` | diagnostics clean |
| Remove address PII `console.log` | `frontend/src/store/api.ts` | diagnostics clean |
| Mobile: fail-fast if `EXPO_PUBLIC_API_URL` unset in prod (no laptop fallback) | `apps/customer-app/src/api/baseApi.ts` | diagnostics clean |
| Delete dead `.bak` pages | `frontend/src/pages/*.bak` | deleted |

> These closed parts of BUG-001, BUG-004, BUG-005 (from `ALL_BUGS.md`) without touching architecture.

---

## 🔴 P0 — MUST FIX BEFORE LAUNCH

| Rank | Item | Module | Why | Action | Owner decision needed |
|------|------|--------|-----|--------|----------------------|
| 1 | Consolidate dual payment paths | Payments | Double-charge / inconsistent finalization risk | Choose single finalizer; disable legacy `/payment`; keep 9 CI guards green | **YES — architectural, needs CTO sign-off** |
| 2 | Implement push notification send | Notifications | Customers/riders/admins get no push; ops blind | Wire firebase-admin / Expo push OR hide push UI | YES (impl vs disable) |
| 3 | Verify Razorpay webhook signature path end-to-end | Payments | Money correctness | Runtime test webhook with real signature | needs runtime |
| 4 | Certify Checkout → Order → Payment happy path | Checkout/Orders | Core revenue flow | Integration + Playwright run | needs runtime |
| 5 | Confirm `.env` secrets not in git history | Security | Credential leak | `git log`/secret scan; rotate if exposed | YES |

## 🟠 P1 — FIX THIS WEEK

| Rank | Item | Module | Action |
|------|------|--------|--------|
| 6 | Resolve socket event-name mismatches (`order:assigned`, `payment_status_updated`) | Realtime | Standardize names; confirm producers; remove dead listeners |
| 7 | Consolidate delivery-fee v1/v2 | Delivery Fee | Pick one; route all callers to it |
| 8 | Wire real alerting (Slack/PagerDuty) | Background Jobs | Replace `logger.info("Would send")` stubs |
| 9 | Offline-queue durability test (cold start, idempotency keys on queued mutations) | Offline | Add integration tests |
| 10 | Single-flight token refresh on mobile | Auth | Match web `async-mutex` behavior |
| 11 | Implement internal-tracking customer socket emit | Tracking | Fill TODO in `internalTracking.ts` |
| 12 | Authz audit of `/api/admin/*` and `/api/internal/*` | Security | Confirm role checks beyond authenticate |

## 🟡 P2 — POST LAUNCH

| Item | Module |
|------|--------|
| Implement WhatsApp channel or hide it | Notifications |
| Restock/wishlist notifications (after wishlist) | Notifications |
| Admin profile edit (web stub) | Admin |
| SearchResults add-to-cart (web stub) | Search |
| Delivery settings "coming soon" actions | Delivery |
| Reviews route-binding verification | Reviews |
| Distance/district serviceability (replace state-based) | Delivery |
| Port legacy `.js` backend files to TS | Catalog/Media |
| Archive 150+ root status docs into `docs/archive/` | Process |

## ⚪ P3 — IGNORE FOR LAUNCH (Tier 3)

Voice AI, Voice correction, Recommendations, Semantic/vector search, Experiments/A-B,
Advanced analytics, Referrals, Experiment "deploy winner", `kafkajs` removal decision,
duplicate `NotificationPreferencesPage_Flipkart`.

---

## Fix order (per brief Phase 9, adjusted for what is safe vs decision-gated)

1. Payments → **DECISION REQUIRED** (architectural). Cannot proceed unilaterally per your "no refactor" rule.
2. Checkout → blocked by #1.
3. Orders → blocked by #1.
4. Inventory → runtime verify reservation/underflow guard.
5. Delivery Assignment → runtime verify.
6. Delivery Execution → runtime verify lifecycle.
7. OTP → runtime verify provider send.
8. Earnings → runtime verify settlement job.
9. Notifications → implement push (decision: impl vs disable).
10+ Admin, Search, Tracking, Realtime, Offline, Analytics → P1/P2 as above.
