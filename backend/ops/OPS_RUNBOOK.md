---
description: Ops Runbook - Outbox, Inventory Reservations, Assignments
---

# Ops Runbook

This runbook covers operational response for:
- Outbox dispatch failures
- Inventory reservation drift/stuck reservations
- Delivery assignment conflict spikes

## Quick links (Admin-only)

- `GET /api/admin/ops/metrics`
- `GET /api/admin/ops/outbox/failures?limit=50`
- `GET /api/admin/ops/reservations/stuck?limit=50`
- `GET /api/admin/ops/inventory/drift`

## Outbox incidents

### Symptom: `ops_outbox_failed_events > 0`

1. Check failures:
   - `GET /api/admin/ops/outbox/failures`
2. Validate if failures are transient (e.g. DB connection) or data-related (bad payload).
3. If transient, restart instances (dispatcher will retry pending; FAILED requires manual handling).
4. If failures persist, capture:
   - `eventId`, `eventType`, `attempts`, `lastError`

**Mitigation:**
- For transient DB outage, restore DB connectivity and restart app.
- If a single poisoned event, manually inspect payload and decide whether to replay, fix data, or mark as ignored.

## Inventory incidents

### Symptom: drift detected
- `ops_inventory_reserved_stock_drift_products > 0`

1. View drift:
   - `GET /api/admin/ops/inventory/drift`
2. Typical causes:
   - Crash between reservation row insert and product reservedStock update (should be rare)
   - Manual DB edits
3. Mitigation:
   - Short term: restart app so sweeper runs; verify if drift shrinks.
   - Medium term: run a reconciliation job to recompute reservedStock from ACTIVE reservations.

### Symptom: stuck ACTIVE reservations
- `GET /api/admin/ops/reservations/stuck`

1. If many stuck reservations, check sweeper logs and DB transaction health.
2. Restart app to re-run sweeper.

## Assignment incidents

### Symptom: conflict spike
- `ops_assignment_conflicts_total` increasing rapidly

1. Confirm multiple assigners are running (auto assign + manual assign + route assign).
2. This should still be safe, but indicates contention.
3. Mitigation:
   - Reduce parallel workers
   - Increase batching and reduce duplicate triggers

## Post-incident checklist

- Confirm invariants:
  - Product `stock >= 0`
  - Product `reservedStock >= 0`
  - Outbox backlog stabilizes
  - No duplicate notifications
- Capture and store:
  - metrics snapshot
  - last 50 outbox failures
  - drift report
