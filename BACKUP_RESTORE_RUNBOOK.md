# Backup & Restore Runbook

## Scope

This runbook defines the **minimum** backup/restore procedure required before onboarding real users.

Systems:
- MongoDB (orders, payments, users)
- Redis (cache/ephemeral state)

## Targets

- **RPO (Recovery Point Objective)**: 24 hours (max data loss)
- **RTO (Recovery Time Objective)**: 2 hours (time to restore service)

If you need better RPO/RTO, tighten schedules and automate/verify restores.

## MongoDB — Backup

### Option A: MongoDB Atlas (recommended)

1. Enable Atlas backups for the production cluster.
2. Configure a daily snapshot schedule.
3. Retain snapshots for at least 7–30 days.
4. Restrict who can perform restores (least privilege).

Verification:
- Perform a restore to a **staging** cluster at least once per week.

### Option B: Docker Compose / self-hosted Mongo

If using `docker-compose.prod.yml`, persist Mongo data with `mongodb_data` volume.

Daily backup command (run from the host where Docker runs):

- `mongodump --archive=/backups/mongodump-$(date +%F).archive --gzip --uri "$MONGODB_URI"`

Retention:
- Keep at least 7 daily archives.

Verification:
- Weekly, restore into an empty staging database and validate counts for:
  - Orders
  - PaymentIntents
  - LedgerEntry

## MongoDB — Restore

### Atlas restore

1. Restore the most recent known-good snapshot to a new cluster.
2. Point the application `MONGODB_URI` to the restored cluster.
3. Run internal verification checks:
   - `/internal/payments/reconciliation`
   - `/internal/payments/verify?orderId=<sample>`

### Self-hosted restore

- `mongorestore --gzip --archive=/backups/mongodump-YYYY-MM-DD.archive --uri "$MONGODB_URI" --drop`

Notes:
- `--drop` is destructive; only use on a clean target DB.

## Redis — Backup/Restore policy

Redis is treated as **non-authoritative**.

- On restore, Redis can be flushed/recreated.
- Validate that any features depending on Redis have a safe fallback.

## Incident checklist (DB corruption / bad deploy)

1. Stop writes (scale API to 0 or enable kill switches where available).
2. Identify the last known-good DB snapshot.
3. Restore MongoDB.
4. Restart API pointing to restored DB.
5. Re-run payment reconciliation checks.

## Evidence to collect before declaring done

- Timestamp of last backup
- Timestamp of last successful restore test
- RPO/RTO achieved in the last restore test
