# MODULE_SCORECARD.md
## VyaparSetu / Dream — Launch Readiness Scorecard

> Percentages are engineering estimates from structural code evidence, not measured test
> coverage. Fix-time estimates assume one experienced engineer and exclude the runtime
> verification (Playwright/integration) that this session could not execute.

**Generated:** 2026-06-20 · **Updated after P0 stabilization fixes (this session).**

Legend: Crit = launch criticality (P0=blocks launch). Blocks = blocks other modules.

| Module | Compl% | Work% | Broken% | Miss% | Crit | Depends on | Blocks | Launch-Ready | Fix (hrs) | Risk(1-10) |
|--------|--------|-------|---------|-------|------|-----------|--------|--------------|-----------|------------|
| Authentication | 85 | 85 | 5 | 10 | P0 | — | All | YES* | 8 | 4 |
| Customer Registration | 85 | 85 | 5 | 10 | P0 | Auth, OTP | Checkout | YES* | 6 | 4 |
| Login | 90 | 90 | 5 | 5 | P0 | Auth | All | YES | 4 | 3 |
| Address Management | 90 | 90 | 0 | 10 | P0 | Auth | Checkout, Delivery | YES | 4 | 3 |
| Cart | 90 | 90 | 5 | 5 | P0 | Auth, Catalog | Checkout | YES | 4 | 3 |
| Checkout | 80 | 80 | 5 | 15 | P0 | Cart, Pay, Addr, Fee | Orders | NO | 24 | 7 |
| **Payments** | 75 | 70 | 15 | 15 | **P0** | Orders | Checkout, Earnings | **NO** | **40** | **9** |
| Order Creation | 82 | 82 | 5 | 13 | P0 | Checkout, Pay | Order Mgmt | NO | 16 | 6 |
| Order Management | 82 | 82 | 5 | 13 | P0 | Orders | Delivery, Admin | YES* | 12 | 5 |
| Inventory | 70 | 70 | 10 | 20 | P0 | Catalog, Orders | Checkout | YES* | 16 | 6 |
| Product Catalog | 80 | 80 | 5 | 15 | P0 | — | Cart, Search | YES | 12 | 4 |
| Delivery Assignment | 75 | 75 | 10 | 15 | P0 | Orders, Routes | Delivery Exec | YES* | 20 | 6 |
| Delivery Execution | 80 | 80 | 5 | 15 | P0 | Assignment, OTP | Earnings | YES* | 16 | 5 |
| OTP Verification | 80 | 80 | 10 | 10 | P0 | SMS/email provider | Auth, Delivery | YES* | 10 | 6 |
| Earnings | 75 | 75 | 10 | 15 | P0 | Delivery Exec, Pay | — | YES* | 16 | 6 |
| **Notifications** | 60 | 55 | 10 | 35 | **P0** | DeviceToken, push svc | Ops visibility | **NO** | **24** | **7** |
| Admin Dashboard | 80 | 80 | 5 | 15 | P0 | All | Ops | YES* | 16 | 5 |
| Analytics | 70 | 70 | 5 | 25 | P1 | Metrics | — | YES* | 16 | 4 |
| Search (keyword) | 85 | 85 | 5 | 10 | P0 | Catalog | — | YES | 8 | 4 |
| Search (semantic) | 70 | 60 | 10 | 30 | P2 | Qdrant, queues | — | DEFER | 24 | 5 |
| Customer Tracking | 70 | 70 | 10 | 20 | P1 | Sockets, Location | — | YES* | 16 | 5 |
| Realtime/Sockets | 80 | 80 | 10 | 10 | P1 | — | Tracking | YES* | 8 | 5 |
| Background Jobs | 75 | 70 | 5 | 25 | P1 | Redis | Settlement, search | YES* | 16 | 5 |
| Location Tracking | 75 | 75 | 5 | 20 | P1 | Maps API | Tracking | YES* | 12 | 5 |
| Offline Queue | 70 | 65 | 10 | 25 | P1 | NetInfo, persist | — | NO | 20 | 6 |
| Cache Management | 80 | 80 | 5 | 15 | P1 | RTK Query | — | YES | 8 | 4 |
| Reports | 70 | 70 | 5 | 25 | P2 | Metrics | — | DEFER | 16 | 3 |
| Coupons | 80 | 80 | 5 | 15 | P1 | Catalog | Checkout | YES | 6 | 3 |
| Reviews | 70 | 65 | 10 | 25 | P2 | Orders | — | DEFER | 12 | 4 |
| Customer Support | 50 | 45 | 15 | 40 | P2 | — | — | DEFER | 16 | 3 |
| Delivery Fee | 80 | 75 | 5 | 20 | P1 | Pincode, Address | Checkout | YES* | 12 | 5 |
| Media/Video | 75 | 70 | 10 | 20 | P1 | Cloudinary | Catalog | YES* | 16 | 5 |
| Invoice | 75 | 75 | 5 | 20 | P1 | Orders | — | YES* | 10 | 4 |
| Feature Flags | 80 | 80 | 5 | 15 | P1 | — | — | YES | 4 | 3 |
| Voice AI | 65 | 55 | 10 | 35 | P3 | queues | — | DEFER | 40 | 4 |
| Recommendations | 65 | 55 | 10 | 35 | P3 | Qdrant | — | DEFER | 24 | 3 |
| Experiments/A-B | 65 | 55 | 10 | 35 | P3 | queues | — | DEFER | 24 | 4 |
| Referrals | 60 | 55 | 10 | 35 | P3 | Auth | — | DEFER | 16 | 3 |

`YES*` = launch-ready pending **runtime verification** (Playwright/integration not run this session).

### Tier 1 blockers (must close to launch)
1. **Payments** — dual-architecture consolidation (decision required, see LAUNCH_BOARD).
2. **Notifications** — push send implementation or UI disable.
3. **Checkout/Order Creation** — depend on Payments; cannot certify until Payments closed.

### Aggregate
- Tier 1 average completion: **~80%**
- Launch readiness (Tier 1 gate): **~64%** (was ~62% pre-fixes; P0 security surfaces now gated)
- Estimated engineering days to Tier-1 launch-ready: **~18–25 dev-days** (+ runtime QA).
