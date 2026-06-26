# WORKFLOW CATALOG — MASTER INDEX

**Owner:** Cascade (forensic workflow extraction)
**Started:** 2026-05-18
**Methodology:** Every workflow is grounded in actual code with `@/abs/path:line` citations. Where a claim cannot be verified by direct code inspection in this session, it is marked `[NOT VERIFIED]` with the search needed.

## Codebase scope (verified 2026-05-18)

- **`apps/customer-app/`** — single React Native app with **3 role surfaces**: customer, delivery rider, admin. 89 screens grouped under `src/screens/{address,admin,auth,cart,checkout,common,debug,delivery,home,info,notifications,orders,products,profile,reviews,search,settings,wishlist}`.
- **`backend/`** — Node/TS Express + MongoDB + Socket.IO. 21 domains under `backend/src/domains/{cart,catalog,communication,delivery,events,finance,identity,invoice,media,notifications,operations,orders,payments,products,routes,search,security,tracking,upi,uploads,user}` plus legacy `controllers/`, `routes/`, `services/`, `models/`, `middleware/`.
- **`frontend/`** — separate web app (294 items). **NOT YET AUDITED** in this catalog.
- **`packages/`** — 15 shared packages. **NOT YET AUDITED**.
- **No `vendor-app` exists** — vendor workflows will be marked N/A.

## Catalog file plan (status per file)

| #  | File                                | Status      | Workflow count (est) |
|----|-------------------------------------|-------------|----------------------|
| 00 | `00_INDEX.md`                       | ✅ this file | (catalog meta)      |
| 01 | `01_AUTH.md`                        | 🔲 planned   | ~14                 |
| 02 | `02_DELIVERY_RIDER.md`              | ✅ done (33) | 33 (DEL-1 to DEL-33) |
| 03 | `03_SOCKET_AND_RECONNECT.md`        | ✅ done (24) | 24 (SOCK-1 to SOCK-24) |
| 04 | `04_OFFLINE_REPLAY.md`              | 🔲 planned   | ~12                 |
| 05 | `05_PAYMENT.md`                     | 🔲 planned   | ~28                 |
| 06 | `06_CUSTOMER_ORDER.md`              | 🔲 planned   | ~25                 |
| 07 | `07_BACKGROUND_LOCATION.md`         | 🔲 planned   | ~10                 |
| 08 | `08_PUSH_NOTIFICATIONS.md`          | 🔲 planned   | ~14                 |
| 09 | `09_RTK_CACHE.md`                   | 🔲 planned   | ~30 invalidation chains |
| 10 | `10_ORDER_STATE_MACHINE.md`         | 🔲 planned   | ~20 transitions     |
| 11 | `11_ADMIN_OPERATIONS.md`            | 🔲 planned   | ~30                 |
| 12 | `12_CUSTOMER_BROWSE.md`             | 🔲 planned   | ~25                 |
| 13 | `13_ONBOARDING.md`                  | 🔲 planned   | ~10                 |
| 14 | `14_RETURN_REFUND.md`               | 🔲 planned   | ~12                 |
| 15 | `15_VOICE_AI.md`                    | 🔲 planned   | ~10                 |
| 16 | `16_BACKGROUND_JOBS.md`             | 🔲 planned   | ~15 (cron + queues) |
| 17 | `17_GRAPHS.md`                      | 🔲 planned   | dependency graphs   |
| 18 | `18_RISK_MATRIX.md`                 | 🔲 planned   | cross-cutting       |
| 19 | `19_MISSING_LINKS.md`               | 🔲 planned   | dead/broken/legacy  |

**Total estimated workflows:** ~310. Actual count will be revised per file as I trace the code.

## Workflow ID convention

`{DOMAIN}-{NUMBER}` — e.g. `DEL-12` = delivery workflow 12. Domain prefixes:
- `AUTH` — auth/session/token
- `DEL` — delivery rider
- `SOCK` — socket
- `OFFL` — offline / replay
- `PAY` — payment
- `CUS` — customer order/browse/cart
- `LOC` — background location
- `PUSH` — push/in-app notifications
- `CACHE` — RTK cache invalidation
- `OSM` — order state machine transition
- `ADM` — admin operations
- `OB` — onboarding
- `RR` — return / refund
- `VOI` — voice / AI
- `JOB` — backend jobs / cron / queue
- `LEG` — legacy / dead workflows
- `BRK` — broken workflows (code exists, doesn't function end-to-end)

## 40-field schema per workflow

Every workflow entry below conforms to this exact schema. If a field is N/A for a workflow, it is marked `—`. If unknown, marked `[NOT VERIFIED]`.

```
1.  Workflow ID
2.  Workflow Name
3.  User Role
4.  Entry Point
5.  Trigger
6.  Screens involved
7.  Hooks involved
8.  Services involved
9.  APIs involved (RTK endpoints + HTTP routes)
10. Backend controllers involved
11. Models involved
12. Socket events involved (emit/listen)
13. RTK cache tags (provides/invalidates)
14. Offline queue involvement
15. Replay involvement
16. Notification involvement
17. Background task involvement
18. AsyncStorage / SecureStore keys
19. State transitions involved
20. Success path (step-by-step)
21. Failure path
22. Retry path
23. Reconnect path
24. App-kill recovery path
25. Polling fallback path
26. Idempotency strategy
27. Cache invalidation path
28. Optimistic update path
29. Security / auth validation
30. Final persisted state
31. Known bugs (with severity from FORENSIC_AUDIT_2026.md)
32. Broken states
33. Stale-state risks
34. Missing listeners
35. Missing invalidations
36. Runtime risks
37. Launch risk severity (P0/P1/P2/P3/none)
38. Recommended fix
39. Safe to fix pre-launch?
40. Requires backend / mobile / web coordination?
```

## Cross-references

- Forensic audit (bugs and architecture deltas): `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/FORENSIC_AUDIT_2026.md`
- Order state machine spec: `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/orders/services/orderStateService.ts:55-67`
- Delivery socket emitter (mostly dead): `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/delivery/services/deliverySocketEmitter.ts`
- Backend socket setup: `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/index.ts:268-625`

## How to consume this catalog

1. Start at the index → pick a domain.
2. Within a domain MD, workflows are listed top-to-bottom in user-flow order (entry → exit).
3. Every claim has a citation. If you see one without, it's a bug — please call it out.
4. The "Known bugs" field cross-references workflow IDs to the P0/P1/P2/P3 issues in `FORENSIC_AUDIT_2026.md`.

## Progress tracker

I will update this section after each session:

- **Session 1 (2026-05-18, this session):** Index + `02_DELIVERY_RIDER.md` + `03_SOCKET_AND_RECONNECT.md`. Other files: not yet started.
