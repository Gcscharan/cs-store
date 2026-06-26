# DEAD_CODE.md — Unused / Superseded Code Inventory
## VyaparSetu / Dream Project

> Companion to `MASTER_PRD.md`. Lists code that is unreachable, superseded, or strongly
> suspected unused based on structural inspection. Items not 100% provable from static
> analysis are marked `SUSPECTED` and need a usage cross-reference or runtime check before deletion.

**Generated:** 2026-06-20

---

## Confirmed dead / backup files

| File | Reason | Action |
|------|--------|--------|
| `frontend/src/pages/CheckoutPage.tsx.bak` | `.bak` backup of active `CheckoutPage.tsx` | Delete |
| `frontend/src/pages/ProductDetailPageOld.tsx.bak` | `.bak` + "Old" superseded by `ProductDetailPage.tsx` | Delete |

## Superseded / duplicate components (SUSPECTED)

| File | Reason | Action |
|------|--------|--------|
| `frontend/src/pages/NotificationPreferencesPage_Flipkart.tsx` | Variant; only `NotificationPreferencesPage.tsx` is routed in `App.tsx` (`/notification-preferences`, `/account/notifications`). The `_Flipkart` variant has no observed route. | Confirm no import; delete or merge |
| `frontend/src/pages/DashboardPage.tsx` | `/dashboard` routes to it, but customer home is `/`; verify it is not an orphan placeholder | Verify usage |

## Legacy JavaScript in a TypeScript backend (SUSPECTED legacy)

| File | Reason | Action |
|------|--------|--------|
| `backend/src/controllers/productController.js` | Lone `.js` controller among `.ts` controllers; product routes may use TS handlers instead | Confirm references; port to TS or remove |
| `backend/src/utils/normalizeProductImages.js` | Lone `.js` util | Confirm references; port to TS or remove |

## Intentionally disabled (NOT dead — keep, documents intent)

| File / route | Status |
|--------------|--------|
| `POST /api/orders/:orderId/payment-callback` | Returns 410 `LEGACY_PAYMENT_PATH_DISABLED` by design (`backend/src/routes/orders.ts`). Keep as a tombstone or remove if no legacy clients remain. |

## Debug / test surfaces (remove or gate, treated as dead in prod)

| File / route | Reason |
|--------------|--------|
| `backend/src/routes/debugDbTest.ts` (`/api/debug`) | Debug DB testing route |
| `backend/src/domains/communication/routes/devNotifications.ts` (`/api/dev/notifications`) | Dev-only notifications |
| `GET /api/cart/test` (`backend/src/routes/cart.ts`) | Test endpoint |
| `frontend/src/pages/DebugPage.tsx` (`/debug`) | Debug page shipped to web |
| `frontend/src/pages/TestOtpPage.tsx` (`/test-otp`) | OTP test page shipped to web |
| `apps/customer-app/src/screens/debug/*` (1 screen) | Debug screen shipped to mobile |

## Potential dead dependency

| Dependency | Reason |
|------------|--------|
| `kafkajs` (`backend/package.json`) | No verified producer/consumer found in inspected files. Confirm via full grep before removal. `SUSPECTED`. |

## Suspected dead socket listeners (mobile)

| Listener | Reason |
|----------|--------|
| `order:assigned` (`socketClient.ts`) | No matching backend emit observed (backend emits `order_status_updated`). Verify producer. |
| `order:status:changed` (`socketClient.ts`) | Same as above |
| `payment_status_updated` (`socketClient.ts`) | Backend emits `payment_status_update` (no `_updated`). Likely dead. |

## Documentation entropy (not code, but process debt)

The repository root contains **150+** status/audit markdown files (`*_COMPLETE.md`, `*_FINAL_*.md`,
`PHASE*_*.md`, `*_AUDIT*.md`, `VIDEO_*`, `VOICE_*`, `I18N_*`, `EMAIL_*`, etc.). Many are superseded
snapshots of the same work. These are not executable dead code but create significant confusion
about the project's true state.

**Recommendation:** Move historical status docs into `docs/archive/`, keep only the current
canonical docs (`MASTER_PRD.md`, `ARCHITECTURE_OVERVIEW.md`, `DEPLOYMENT_GUIDE.md`, this file,
and `ALL_BUGS.md`) at the root.

---

## Verification note
Full dead-code reachability across 1,944 source files was **not** exhaustively computed. Items
marked `SUSPECTED` require an import/usage cross-reference (e.g., `grep` for each symbol) before
deletion. Confirmed items (`.bak` files, 410 tombstone, debug routes) are safe to act on with
normal review.

*End of DEAD_CODE.md*
