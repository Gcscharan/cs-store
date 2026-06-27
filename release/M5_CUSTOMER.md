# M5 — Customer Journey

**Status: 🟡 Mostly verified; reviews fixed this pass**

## Verified
- Auth/cart/checkout/payment/orders/tracking — covered under M2 (money) + M3
  (fulfilment) with execution evidence.
- Search (text) + **voice search** (incl. FILTER intent) — wired/real.
- Order IDOR/ownership — `getOrderById`/`getUserOrders` enforce `userId`.
- Support (Customer Care / Contact Us / Help & Support) — real `POST /api/support/requests`.
- Tracking polling fallback — fixed (RF-001).

## Bug found & fixed (this pass): Product Reviews were fake + orphaned
- The reviews backend (`routes/reviews.ts`, `reviewService`, `Review` model,
  auth/validation middleware) was complete and unit-tested but **mounted only in
  its own test** — unreachable in production.
- The web `ProductDetailPage` rendered **hardcoded mock reviews** and a
  **fake-success submit** (local state + `console.log`).
- Fix: mounted the reviews router in `createApp`; added web RTK
  `getProductReviews`/`createProductReview`; rewired the page to load real
  reviews + stats and submit via the API (auth-gated, duplicate/401 handling,
  loading/empty states). Removed mock data, fake success, and the
  non-persisting image upload + name field.
- Evidence: `reviewsRouteMounted.integration` 2/2; `reviewsAPI` 11/11; web build green.

## Open findings
| ID | Item | Severity | Status |
|----|------|----------|--------|
| C-001 | `routes/personalizedSearchRoutes.ts` (POST `/personalized`) is unmounted AND referenced by no client — unreachable dead code | Low | Open — product decision: mount if personalized search ships, else remove. Not reachable today (no user impact, no attack surface). |
| C-002 | Reviews don't write back to `Product.rating` aggregate (product cards show default 4.0 while the review page shows real stats) | Low | Open — minor display inconsistency; backend stats endpoint is authoritative |

## Notes
- Web review images intentionally dropped (the old picker produced local
  blob URLs that never persisted — sending them was fake). Reviews are
  rating + comment; image-review support would need a real upload pipeline.

## Exit decision
Customer journey is engineering-complete for the critical paths; the one real
defect (fake/orphaned reviews) is fixed with evidence. C-001/C-002 are low,
documented. Remaining validation is the manual/real-environment checklist.
