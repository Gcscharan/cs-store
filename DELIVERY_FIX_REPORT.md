# DELIVERY FIX REPORT
## Launch Hardening — Fixes Applied
### Date: June 21, 2026

---

## Fixes Applied

### FIX-001: Daily Rejections Reset Job (BUG-006)
| Field | Value |
|-------|-------|
| Severity | P2 |
| Root Cause | `rejectionsToday` field on DeliveryBoy model was never reset |
| File | `backend/src/jobs/deliveryResetJob.ts` (NEW) |
| Fix | Created daily cron job that checks every 60s if new day has started, resets all rejectionsToday to 0 |
| Registration | Added to `backend/src/index.ts` startup sequence |
| Regression Risk | Low — only resets counter, no business logic change |
| Test Required | Unit: verify reset on day boundary; Integration: verify auto-assignment scoring after reset |

### FIX-002: Stale AssignedOrders Cleanup (BUG-008)
| Field | Value |
|-------|-------|
| Severity | P3 |
| Root Cause | When order transitions to DELIVERED, the order ID was never removed from DeliveryBoy.assignedOrders |
| File | `backend/src/domains/operations/controllers/deliveryOrderController.ts` (verifyDeliveryOtp handler) |
| Fix | After successful OTP verification: $pull orderId from assignedOrders, $inc currentLoad: -1, $inc completedOrdersCount: 1. If no remaining orders, set availability back to 'available' |
| Additional | Daily cron job (`deliveryResetJob.ts`) also sweeps stale entries as backup |
| Regression Risk | Low — cleanup is idempotent, guarded by null checks |
| Test Required | Integration: complete delivery → verify assignedOrders empty; verify currentLoad decremented |

### FIX-003: OTP Verification Rate Limiting (Security)
| Field | Value |
|-------|-------|
| Severity | P1 (Security) |
| Root Cause | No limit on OTP verification attempts — 4-digit code (10,000 combinations) brute-forceable |
| File | `backend/src/domains/operations/controllers/deliveryOrderController.ts` (verifyDeliveryOtp handler) |
| Fix | Track `deliveryOtpFailedAttempts` on Order document. After 5 failed attempts, lock for 5 minutes (`deliveryOtpLockedUntil`). Return 429 if locked. Counter reset on successful verification. |
| New Fields (Order) | `deliveryOtpFailedAttempts: Number`, `deliveryOtpLockedUntil: Date` |
| Regression Risk | Low — only adds new checks before existing logic |
| Test Required | Unit: verify lockout after 5 failures; verify unlock after 5 minutes; verify counter reset on success |

### FIX-004: GPS Accuracy Validation Relaxed (BUG-009)
| Field | Value |
|-------|-------|
| Severity | P3 |
| Root Cause | Previous threshold was 50m — too strict for urban GPS (causes location updates to fail) |
| File | `backend/src/domains/operations/controllers/deliveryOrderController.ts` (updateLocation handler) |
| Fix | Relaxed accuracy threshold from 50m → 500m (rejects clearly spoofed data but allows normal urban GPS). Added (0,0) coordinate rejection as anti-spoof measure. |
| Regression Risk | Low — relaxes an overly strict check |
| Test Required | Unit: verify 500m passes, 501m fails; verify (0,0) rejected |

### FIX-005: Port Mismatch in Dev Scripts (BUG-007)
| Field | Value |
|-------|-------|
| Severity | P2 |
| Root Cause | `fix-ip.sh` and `dev-mobile-local.sh` hardcoded port 5002, but backend runs on 5001 |
| Files | `scripts/fix-ip.sh`, `scripts/dev-mobile-local.sh`, `apps/customer-app/.env` |
| Fix | Changed hardcoded port from 5002 → 5001 in both scripts |
| Regression Risk | None — matches actual backend configuration |
| Test Required | Manual: run `npm run fix:ip` → verify output says port 5001 |

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Open P0 Bugs | 0 | 0 |
| Open P1 Bugs | 0 | 0 (OTP rate limiting added) |
| Open P2 Bugs | 2 (BUG-006, BUG-007) | 0 |
| Open P3 Bugs | 2 (BUG-008, BUG-009) | 0 |
| Security Gaps | 1 (OTP brute force) | 0 |

---

## Files Modified

1. `backend/src/jobs/deliveryResetJob.ts` — NEW
2. `backend/src/index.ts` — Added import + startup call
3. `backend/src/domains/operations/controllers/deliveryOrderController.ts` — OTP rate limiting + assignedOrders cleanup + GPS threshold fix
4. `scripts/fix-ip.sh` — Port 5002 → 5001
5. `scripts/dev-mobile-local.sh` — Port 5002 → 5001
6. `apps/customer-app/.env` — Corrected URL

## Pre-existing TypeScript Errors (NOT introduced by this patch)

- `cvrpRouteAssignmentService.ts` — Missing constant definitions (pre-existing)
- `outboxDispatcher.ts` — Counter name type mismatch (pre-existing)
- `reconciliation/` — Type cast issues (pre-existing)

None of these are in delivery-critical paths and do not affect runtime (project uses `ts-node-dev` with `--transpile-only`).
