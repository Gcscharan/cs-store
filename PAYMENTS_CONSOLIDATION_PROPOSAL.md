# Payments Consolidation Proposal (for review before applying)
## VyaparSetu / Dream — closes BUG-002 (P0)

**Prepared:** 2026-06-20 · **Status:** AWAITING APPROVAL — no code changed yet.

---

## 1. The problem (recap)

Two payment route surfaces are mounted in `backend/src/createApp.ts`:

- **Legacy:** `/api/payment/*` → `domains/finance/routes/paymentRoutes.ts`
- **New:** `/api/payment-intents`, `/api/payment-status`, `/api/payments`, `/api/webhooks`
  → `domains/payments/routes/*`

Two finalization surfaces = risk of inconsistent payment state / double-writes. The backend
ships **9 CI guard scripts** specifically to police payment correctness, which confirms this is
a known fragility.

## 2. Evidence gathered (who calls what)

### Legacy `/api/payment/*` endpoints
```
POST /payment/create-order
POST /payment/verify
GET  /payment/details/:payment_id
GET  /payment/
GET  /payment/stats/overview
POST /payment/callback
```

### New `domains/payments` endpoints
```
POST /payment-intents/         POST /payment-intents/verify
GET  /payment-status/:orderId
GET  /payments/verify/:orderId GET /payments/metrics  POST /payments/metrics/reset
POST /webhooks/razorpay
```

### Caller analysis (grep across both clients)
| Caller | Uses | Evidence |
|--------|------|----------|
| **Mobile** `ordersApi.ts` | `GET /payments/verify/:orderId`, `POST /upi/verify`, order-based COD/UPI via `POST /orders` | verified |
| **Mobile** test | documents canonical endpoint is `/payments/verify/:orderId` | `ordersApi.test.ts` |
| **Web** | order-based checkout (`POST /orders`), `/payment` is only a **footer nav link to a page**, `/api/otp/payment/verify` is a **separate OTP route** | verified |
| **Any client → legacy `/api/payment/*` API** | **NONE FOUND** | grep returned no API callers |

**Conclusion:** The new `domains/payments/*` surface is the live one. The legacy
`/api/payment/*` API surface appears to have **no remaining client callers**.

## 3. Recommendation

**Make `domains/payments/*` the single payment authority and retire the legacy mount.**

Two-step, reversible rollout:

### Step A (safe, recommended now): deprecate-and-guard the legacy mount
Instead of deleting, gate the legacy router behind an explicit env flag so it is OFF by default
in production but can be flipped back on instantly if an unknown caller surfaces.

```ts
// createApp.ts — replace:
apiRouter.use("/payment", paymentRoutes);

// with:
if (process.env.ENABLE_LEGACY_PAYMENT_ROUTES === "true") {
  logger.warn("[createApp] LEGACY /api/payment routes are ENABLED (deprecated).");
  apiRouter.use("/payment", paymentRoutes);
}
```

- Default (flag unset) → legacy surface returns 404, eliminating the dual-finalizer risk.
- If any forgotten integration breaks, set `ENABLE_LEGACY_PAYMENT_ROUTES=true` to restore instantly.
- Keep the file in the tree for one release; delete in the next once metrics confirm zero hits.

### Step B (next release): delete `domains/finance/routes/paymentRoutes.ts` + its mount/import.

## 4. Why not just delete now?
- Payments are money. A reversible feature-flag gate is the Fortune-500-safe move: it removes the
  risk immediately while keeping a 1-line rollback. Hard deletion forgoes that safety for no real
  benefit this release.

## 5. Verification plan (must run before marking BUG-002 closed)
1. Backend CI guards must stay green:
   `npm run ci:check-finalizer-authority`, `check-paid-writes`, `check-legacy-payment-lock`,
   `check-paymentintent-transitions`, `check-webhook-safety`, `check-upi-verify-safety` (all 9).
2. Integration: full checkout → order → payment → webhook → status path (needs running stack).
3. Smoke: confirm `GET /api/payment/create-order` returns 404 with flag unset; new endpoints 2xx.

## 6. Blast radius
- **Code touched:** 1 file (`createApp.ts`), ~4 lines. No controller/service/model changes.
- **Reversible:** yes (env flag).
- **Architecture:** not restructured — only a mount is gated. Consistent with "no refactor" rule.

---

## Decision needed from you
- [ ] **Approve Step A** (gate legacy behind `ENABLE_LEGACY_PAYMENT_ROUTES`, default off) — I apply the 4-line change now.
- [ ] Approve Step A **and** want me to also add a startup `logger.warn` deprecation notice (included above).
- [ ] Hold — you want to keep legacy mounted until a runtime audit of production access logs.

Once you approve, I'll apply Step A, run the 9 CI guard scripts, and report results.
