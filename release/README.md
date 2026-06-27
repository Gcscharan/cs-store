# Release Evidence

Auditable, per-milestone record of why each area was considered release-ready.
Each milestone doc contains: Journey map · Risks · Bugs found · Fixes · Test
evidence · Remaining open risks · Exit decision.

| Milestone | Area | Status |
|-----------|------|--------|
| M1 | Platform Stability | ✅ Complete |
| M2 | Money Integrity | ❄️ Frozen (staging payment validation pending before public release) |
| M3 | Fulfilment Integrity | ✅ Complete (staging validation pending for live socket/GPS) |
| M7 | Notification Integrity | ✅ Complete in-repo (push-to-device is a staging validation) |
| M4 | Operations (Admin/Retailer) | 🟡 Partial (dead-ends clean, authz verified; bulk/export/pagination breadth audit pending) |
| M5 | Offline & Synchronization | 🟡 Partial (offline queue convergence verified) |
| M6 | Production Hardening / Security | 🟡 Partial (authz/IDOR/anti-fraud verified; load/chaos = staging) |
| M8 | Security & Release Readiness | 🚧 See M8_SECURITY.md — no critical findings open |

## Freeze policy
A frozen milestone is not modified unless: a bug is discovered, a security
issue appears, or business requirements change. This prevents regressions from
constantly revisiting settled subsystems (especially payments).

## Node audit questions (applied to every journey node)
1. Can this happen twice?
2. Can it be skipped?
3. Can it happen out of order?
4. Can it happen concurrently?
5. Can it be replayed?
6. Can it be spoofed?
7. Can it get stuck?
8. If the process crashes here, what reconciles it?
