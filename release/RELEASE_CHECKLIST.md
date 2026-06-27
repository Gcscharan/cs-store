# Release Checklist — Manual QA + Infrastructure

In-repo engineering audits are complete for the critical paths (see M1–M8 docs).
The items below require the **real environment** and are the final source of
truth for production readiness. They cannot be verified by repository analysis.

## A. Manual QA — Customer journey
- [ ] Register → OTP → login → logout
- [ ] Add/edit/delete address; default address
- [ ] Browse, search (text), **voice search** (search + filter intent), wishlist
- [ ] Cart add/update/remove; coupon apply/invalid/expired
- [ ] Checkout → **Razorpay payment success** (real gateway)
- [ ] **Payment failure** → retry → success
- [ ] **App killed mid-payment** → webhook arrives → order converges to PAID
- [ ] Duplicate webhook (Razorpay retry) → no double charge, stays PAID
- [ ] Order history, invoice download
- [ ] Live tracking via **socket**; kill socket → **polling fallback** shows rider + ETA
- [ ] Cancellation → **auto-refund** reflects; refund-completed notification received
- [ ] Reviews/ratings submit + display
- [ ] **Push notifications** for each status (FCM/Expo, real device)
- [ ] Offline: add to cart offline → reconnect → syncs; no dupes

## B. Manual QA — Delivery journey
- [ ] Register → **KYC upload (Cloudinary)** → admin approves → login
- [ ] Assignment appears; reassignment removes from old rider
- [ ] Pickup → navigation (maps) → arrival → **OTP** → delivered
- [ ] COD collection gate before OTP
- [ ] Failure flow → reattempt/escalation
- [ ] **Wallet/earnings** credited exactly once; history correct
- [ ] **Background GPS** updates (Android background, iOS permission prompts)
- [ ] Offline action queue → reconnect → replays in order; reassigned-order actions dropped
- [ ] Multi-device: same rider on 2 devices → no double actions

## C. Manual QA — Admin/Retailer
- [ ] Product CRUD, bulk upload, publish; category management
- [ ] Inventory edits reflect in customer stock
- [ ] Orders: confirm → pack → assign; double-tap is safe (no double transition)
- [ ] **KYC review** (verify/reject) — documents render via signed URLs
- [ ] Support inbox: list + resolve
- [ ] Refund console / cancellation
- [ ] Analytics + reports load; CSV export
- [ ] Permissions: non-admin cannot reach admin endpoints (spot-check 403s)

## D. Infrastructure / external (production go/no-go gates)
- [ ] MongoDB running as **replica set** (transactions required) — prod + staging
- [ ] Redis available (blacklist, rate-limit buckets, live-location)
- [ ] Razorpay **production** keys + **webhook secret** + webhook URL registered
- [ ] Razorpay webhook reachable from internet (signature verified)
- [ ] Cloudinary configured; **authenticated** asset signing works in prod
- [ ] FCM / Expo push credentials; delivery confirmed on real devices
- [ ] Google Maps key (navigation/ETA) with quotas
- [ ] Secrets via env (no secrets in repo); JWT_SECRET/refresh secrets set
- [ ] Background job runners enabled (outbox dispatcher, stuck-payment scanner,
      reconciliation, refund reconciliation, inventory sweeper)
- [ ] Load / soak / chaos test (payment timeout, Redis down, Mongo failover, worker crash)
- [ ] Monitoring/alerting on opsMetrics + opsAlert channels; log aggregation

## E. Open business decisions
- [ ] R-010: RETURNED / failed-delivery refund policy
- [ ] N-001: notify customer on RETURNED?
- [ ] N-002: notify customer on reassignment?

## F. Known low-severity / deferred
- [ ] RF-002: `useConnectivityState`/`useActionFeedback` tests fail under
      renderHook+fakeTimers+React19 (production logic verified by inspection) — harness fix
- [ ] R-009: replica-set transactional CI lane (prod already uses replica sets)
- [ ] S-001: exhaustive per-endpoint authorization sweep (key surfaces verified)
