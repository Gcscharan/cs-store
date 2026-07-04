# Vyapara Setu — QA Workbook Execution Report

This documents an **actual execution pass** against the 521-case workbook
(`VYAPARA_SETU_QA_WORKBOOK.xlsx`). Results are split honestly into what an
automated agent **can** run (the repo's existing Jest suites) and what
**cannot** be run without a real device and live external services.

## What was actually executed (automated suites, real runs)

| Suite | Passed | Failed | Total | Pass Rate |
|-------|-------:|-------:|------:|----------:|
| Mobile (`apps/customer-app`) Jest | 1108 | 76 | 1184 | 93.6% |
| Backend Security | 130 | 0 | 130 | 100% |
| Backend Unit | 703 | 15 | 718 | 97.9% |
| Backend Integration | 312 | 38 | 350 | 89.1% |
| **TOTAL** | **2253** | **129** | **2382** | **94.6%** |

## Workbook case classification (all 521 rows)

The workbook `Status` column has been updated based on this run:

| Classification | Count |
|----------------|------:|
| Blocked — MANUAL (real device / live service required) | 136 |
| Pass — backed by a passing automated suite (Security) | 8 |
| Fail — backed by a failing automated suite | 31 |
| Not Executed — partial automated coverage, needs manual pass | 346 |

The 136 Blocked cases involve Razorpay payments, FCM/Expo push delivery,
GPS/background location, camera/mic, real-device UI gestures, maps, and
multi-device flows. These are **inherently manual** and are the point of the
manual QA effort — no agent can honestly mark them Pass.

## Failures found (real, actionable)

### Mobile (28 failing suites)
- `realTimeSynchronization` (unit / integration / property) — socket sync
- `mobileAssignWebSync` (test / integration / simple)
- `mobileClusterOrderFlow` (bugCondition / preservation)
- `upiPaymentFlow.integration`
- `userSessionDataLeakage.preservation`
- `androidPhysicalDeviceNetwork` (bugCondition / preservation)
- `useConnectivityCheck` / `useConnectivityState` (RN19 + fakeTimers harness)
- `GlobalConnectivityBanner` / `AttemptBadge`
- `AddAddressScreen` / `LocationStress`
- `voiceCorrection` (test / stress) — **accuracy 68% vs 85% target**, avg
  confidence 0.55 vs 0.7 target
- `orderStateUtils` / `safeTranslate` / `categoriesConfig` / `deliveryConfig`
- `idleAndOfflineState` / `concurrentActionsEdgeCases` / `fullLifecycle`
- `task8.1` / `task8.2` mobile-pack-web-updates

### Backend Unit (15 failing)
- `POST /internal/payments/recovery-execute (STEP 4)` — 7 tests (feature-flag,
  kill-switch, FSM transition, confirmation, CAPTURED/PAID guards, audit-once)
- `stuckPaymentScanner` — 3 tests (paid untouched, PROCESSING→VERIFYING, locked skip)
- `OrderEventBroadcaster` — 4 tests (room emit, null id handling, previousStatus)
- `financeHealthService` — 1 test (duplicate ledger dedupeKey)

### Backend Integration (38 failing)
- Spread across audit-log and other integration specs (many are known
  harness/replica-set-timing issues per RELEASE_CHECKLIST §F, but the
  payment-recovery and broadcaster failures above are real logic/regression
  signals worth triage).

## Honest verdict

- **Automated health is strong (94.6%)** but not green. There is a cluster of
  real failures around **payment recovery / stuck-payment scanner /
  order-event broadcasting** and **realtime sync** that should be triaged
  before release — these are not pure harness noise.
- **The 136 manual/real-environment cases remain unverified here.** They are
  the actual gate for production and require a human tester with devices +
  live Razorpay/FCM/GPS/Cloudinary (see `RELEASE_CHECKLIST.md` §A–D).
- **Production readiness: NO-GO for blind production** until (a) the failing
  payment-recovery/broadcaster/realtime suites are triaged and fixed or
  confirmed as harness-only, and (b) the manual real-environment pass is
  completed. **GO for staging** validation.

## Reproduce
```bash
# Mobile
cd apps/customer-app && npx jest --ci
# Backend
cd backend && npx jest tests/security --runInBand --forceExit
cd backend && npx jest tests/unit --runInBand --forceExit
cd backend && NODE_ENV=test npx jest tests/integration --runInBand --forceExit
# Re-apply results to workbook
node release/apply-execution-results.js
```
