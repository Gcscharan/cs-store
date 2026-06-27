# M8 — Security & Release Readiness

**Status: 🚧 Audited at key surfaces; no critical findings open**

## Authentication / Authorization (verified)
- `authenticateToken`: JWT verify → Redis access-token blacklist check → user
  lookup → `suspended` account block → sets `req.user`/`userId`. Expired/invalid
  tokens → 401 with codes.
- `requireRole([...])`: case-normalized role check → 403 on mismatch.
- `requireDeliveryRole`: delivery-only gate.
- Webhook auth: HMAC signature verified with `crypto.timingSafeEqual`
  (constant-time), raw body preserved before `express.json()` (M2).

## IDOR / ownership (verified)
- Orders: `getUserOrders` queries `{ userId }`; `getOrderById` adds
  `query.userId = userId` for non-admins → customers can only read their own
  orders. Delivery-access handler requires `isDeliveryBoy || isOrderOwner`.
  Customer-facing rider details exposed only during out-for-delivery.
- Customer tracking: `GET /orders/:id/tracking` authorizes by `userId`
  (fixed RF-001 — previously read a non-existent field).
- Delivery actions: `orderStateService` re-validates the delivery partner is the
  order's CURRENTLY assigned rider (ownership) on every transition.
- Tracking ingest: rider may only publish GPS for an order they currently own
  (403 `ownership_mismatch`) — reassigned rider rejected.
- Admin / internal routes: `requireRole(["admin"])` + `auditLog` (verified on
  admin.ts, internalPaymentsRecovery, internalPaymentsReconciliation).

## Anti-fraud / abuse (verified)
- Payment amount validated against order total in webhook (anti-tamper).
- Active-payment-intent guard prevents a stale attempt marking an order PAID.
- Rate limiting present on tracking ingest (`ingestRateLimit`, token bucket) and
  checkout; GPS anti-spoof (impossible-speed + accuracy gates) on ingest.
- WalletTransaction immutable (pre-update hook throws); earnings exactly-once
  via unique partial index.

## Open items (not in-repo critical defects)
| ID | Item | Severity | Status |
|----|------|----------|--------|
| S-001 | Full per-endpoint authz sweep (every route file) | Medium | Partial — key surfaces (orders, admin, internal, tracking, payments) verified; exhaustive sweep recommended pre-launch |
| S-002 | Upload validation (KYC/selfie/product images) hardening review | Medium | Open — size/type checks exist; full content-type/AV review is a hardening task |
| S-003 | Secrets management / env hygiene review | Medium | Open — deployment/infra task |
| S-004 | Load/soak/chaos (M6 production hardening) | Medium | Open — staging/infra task |

## Milestone roll-up
| Milestone | State | Evidence |
|-----------|-------|----------|
| M1 Build | ✅ | 3 projects compile; web build green |
| M2 Money | ❄️ Frozen | 306 tests; convergence verified |
| M3 Fulfilment | ✅ | journey nodes verified + execution tests; RF-001 fixed |
| M7 Notifications | ✅ in-repo | exactly-once pipeline; REFUND_COMPLETED gap fixed |
| M4 Admin/Ops | 🟡 Partial | dead-end sweep clean (prior); KYC review + support inbox built; authz verified; deeper bulk/export/pagination audit recommended |
| M5 Customer | 🟡 Partial | dead-end sweep clean; auth/cart/checkout/orders/tracking verified across M2/M3 |
| M6 Delivery | 🟡 Partial | assignment→delivery→earnings + offline replay verified (M3) |
| M5 Offline/Sync | 🟡 Partial | offline action queue convergence verified (RF-003); connectivity UI logic verified (RF-002 harness-only) |
| M6 Hardening | ⏳ | load/chaos/observability — staging/infra |

## Release recommendation
The **money, fulfilment, and notification** journeys — the highest-risk
production surfaces — are engineering-complete and evidence-backed, with no open
in-repo correctness or security defects at the audited surfaces. Remaining work
is (a) breadth audits (exhaustive per-endpoint authz, admin bulk/export edge
cases) and (b) staging validations requiring real infrastructure (live gateway,
push devices, load/chaos). 

**I would approve a STAGING deployment now** for end-to-end manual validation.
**Production go/no-go** should follow: the live-gateway payment validation
(R-011), push-to-device validation (N-003), and an exhaustive authz sweep (S-001).
