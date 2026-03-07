# Database Backup & Recovery Documentation

## Overview

This document outlines the backup strategy, recovery procedures, and disaster recovery plan for the CS Store MongoDB Atlas database.

---

## 1. Backup Verification Checklist

### MongoDB Atlas Console Verification

Log into [MongoDB Atlas](https://cloud.mongodb.com) and navigate to your cluster:

#### Continuous Backups

| Setting | Expected Value | How to Verify |
|---------|----------------|---------------|
| Continuous Backup | **Enabled** | Cluster → Data Backup → Continuous Backup toggle |
| Backup Status | **Active** | Check for green status indicator |
| Oplog Retention | 24-72 hours | Advanced settings under backup configuration |

#### Snapshot Settings

| Setting | Recommended Value | How to Verify |
|---------|-------------------|---------------|
| Snapshot Frequency | Every 6 hours | Cluster → Data Backup → Snapshot Schedule |
| Retention Period | 7 days (daily), 4 weeks (weekly) | Backup policy settings |
| Point-in-Time Recovery | **Enabled** | PITR toggle in backup settings |

#### Cloud Provider Snapshots (Optional)

| Setting | Recommended Value | How to Verify |
|---------|-------------------|---------------|
| AWS/Azure/GCP Snapshots | Cross-region copy enabled | Cloud provider snapshot settings |
| Snapshot Region | Different from primary region | Region selection in backup config |

### Verification Commands

```bash
# Using MongoDB Atlas CLI
atlas backups snapshots list <clusterName> --projectId <projectId>

# Check backup status via API
curl -X GET "https://cloud.mongodb.com/api/atlas/v1.0/groups/{groupId}/clusters/{clusterName}/backup/snapshots" \
  --digest -u "{publicKey}:{privateKey}"
```

---

## 2. Recovery Objectives

### RTO (Recovery Time Objective)

| Scenario | RTO Target | Notes |
|----------|------------|-------|
| Single collection restore | 15 minutes | Using Atlas snapshot restore |
| Full database restore | 30-60 minutes | Depends on data size |
| Cross-region failover | 5-10 minutes | If using global clusters |
| Complete disaster recovery | 2-4 hours | New cluster provisioning + restore |

### RPO (Recovery Point Objective)

| Backup Type | RPO | Notes |
|-------------|-----|-------|
| Continuous Backup | 1-5 minutes | Point-in-time recovery available |
| Hourly Snapshots | Up to 1 hour | Data loss up to last hour |
| Daily Snapshots | Up to 24 hours | Worst case data loss |

**Target RPO: 5 minutes** (with continuous backup + PITR enabled)

---

## 3. Restore Process Steps

### Scenario A: Point-in-Time Recovery (PITR)

Use when: Need to restore to a specific moment (e.g., before a bad migration)

1. **Access MongoDB Atlas Console**
   ```
   https://cloud.mongodb.com → Select Project → Select Cluster
   ```

2. **Navigate to Backup**
   ```
   Cluster → Data Backup → Continuous Backup
   ```

3. **Select Restore Point**
   - Click "Restore" button
   - Choose "Point-in-Time Recovery"
   - Select target date/time
   - Choose restore method:
     - **Restore to new cluster** (recommended for verification)
     - **Restore to existing cluster** (overwrites data)

4. **Configure Target**
   - Cluster name: `cs-store-recovery-{timestamp}`
   - Region: Same as original (or DR region)
   - Instance size: Match original or smaller for verification

5. **Initiate Restore**
   - Review settings
   - Click "Restore"
   - Monitor progress in "Restore Jobs" tab

6. **Verify Restored Data**
   ```bash
   # Connect to restored cluster
   mongosh "mongodb+srv://cs-store-recovery-xxx.mongodb.net" \
     --username <admin> --password <password>

   # Verify collections
   use cs_store_prod
   db.orders.countDocuments({})
   db.users.countDocuments({})
   db.products.countDocuments({})
   ```

7. **Cutover (if verified)**
   - Update application connection string
   - Or restore from recovery cluster to original cluster

### Scenario B: Snapshot Restore

Use when: Need to restore from a known good snapshot

1. **List Available Snapshots**
   ```
   Atlas Console → Cluster → Data Backup → Snapshots
   ```

2. **Select Snapshot**
   - Choose snapshot with desired timestamp
   - Verify snapshot completeness (all shards included)

3. **Restore Options**
   - Download: Get snapshot as TAR/ZIP (for offline restore)
   - Restore to new cluster: Create new cluster from snapshot
   - Restore to existing: Overwrite current cluster

4. **Execute Restore**
   - Confirm restore operation
   - Wait for completion notification

### Scenario C: Single Collection Restore

Use when: Only one collection needs recovery

1. **Restore to New Cluster** (using PITR or Snapshot)

2. **Export Collection**
   ```bash
   mongoexport --uri="mongodb+srv://recovery-cluster.mongodb.net/cs_store_prod" \
     --collection=orders \
     --out=orders_backup.json
   ```

3. **Import to Production**
   ```bash
   mongoimport --uri="mongodb+srv://prod-cluster.mongodb.net/cs_store_prod" \
     --collection=orders \
     --file=orders_backup.json \
     --mode=merge  # or --mode=upsert
   ```

### Scenario D: Cross-Region Disaster Recovery

Use when: Primary region is completely unavailable

1. **Verify DR Region Status**
   - Check Atlas status page
   - Confirm DR region cluster is operational

2. **Promote DR Cluster** (if using global cluster)
   ```
   Atlas Console → Cluster → ... → Promote to Primary
   ```

3. **Update Application Configuration**
   ```bash
   # Update environment variables
   MONGODB_URI=mongodb+srv://cs-store-dr.mongodb.net/cs_store_prod
   ```

4. **Verify Application Connectivity**
   ```bash
   # Test connection
   mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')"
   ```

---

## 4. Disaster Recovery Checklist

### Immediate Actions (0-15 minutes)

- [ ] **Assess the situation**
  - Determine scope: single collection, full database, or region outage
  - Check MongoDB Atlas status page: https://status.mongodb.com
  - Alert team members

- [ ] **Preserve evidence**
  - Screenshot any error messages
  - Note exact time of incident
  - Document what was happening when issue occurred

- [ ] **Stop writes if necessary**
  ```javascript
  // Set cluster to read-only mode (via Atlas)
  // Or use feature flag to disable writes
  db.adminCommand({ setFeatureCompatibilityVersion: "6.0" })
  ```

### Recovery Actions (15-60 minutes)

- [ ] **Identify restore point**
  - Determine latest good backup/snapshot
  - For data corruption: time before corruption occurred
  - For outage: most recent snapshot

- [ ] **Initiate restore**
  - Follow appropriate restore scenario (A, B, C, or D)
  - Start restore job in Atlas console

- [ ] **Monitor restore progress**
  - Check "Restore Jobs" tab
  - Estimate completion time based on data size

### Verification Actions (60-90 minutes)

- [ ] **Data Integrity Checks**
  ```bash
  # Verify document counts
  db.orders.countDocuments({})
  db.users.countDocuments({})
  db.products.countDocuments({})
  db.paymentintents.countDocuments({})

  # Check indexes
  db.orders.getIndexes()
  db.users.getIndexes()

  # Verify recent orders
  db.orders.find({}).sort({ createdAt: -1 }).limit(10)
  ```

- [ ] **Application Integration Test**
  ```bash
  # Test user login
  # Test product listing
  # Test order creation (in staging mode)
  # Test payment flow (test mode)
  ```

- [ ] **Performance Verification**
  ```bash
  # Check query performance
  db.orders.find({ userId: ObjectId("...") }).explain("executionStats")
  ```

### Post-Recovery Actions (90-120 minutes)

- [ ] **Update connection strings**
  - Update application environment variables
  - Restart application servers

- [ ] **Resume normal operations**
  - Enable writes
  - Monitor for errors
  - Check Sentry for any issues

- [ ] **Document incident**
  - Record root cause
  - Document timeline
  - Note any data loss (if applicable)

- [ ] **Notify stakeholders**
  - Send incident report
  - Include RTO/RPO achieved

---

## 5. Backup Retention Policy

### Recommended Configuration

| Backup Type | Retention | Reason |
|-------------|-----------|--------|
| Hourly Snapshots | 48 hours | Short-term recovery |
| Daily Snapshots | 7 days | Weekly recovery window |
| Weekly Snapshots | 4 weeks | Monthly recovery window |
| Monthly Snapshots | 12 months | Compliance & audit |
| PITR Oplog | 72 hours | Point-in-time recovery |

### Compliance Considerations

- **Financial Records**: 7 years (payment transactions, ledger entries)
- **User Data**: Retain as per privacy policy
- **Order History**: Minimum 3 years for tax compliance

---

## 6. Testing & Validation

### Monthly Backup Validation

```bash
# 1. Create a test restore (first of each month)
# 2. Run data integrity checks
# 3. Document results

# Validation script
node scripts/validate-backup.js --cluster=recovery-test --date=2024-01-01
```

### Quarterly DR Drill

1. Simulate complete region failure
2. Execute cross-region failover
3. Measure actual RTO achieved
4. Document and improve process

### Validation Checklist

- [ ] Backup completes within expected window
- [ ] Restore completes within RTO target
- [ ] All collections present after restore
- [ ] Indexes are preserved
- [ ] Application can connect to restored database
- [ ] No data corruption detected

---

## 7. Monitoring & Alerts

### Atlas Backup Alerts

Configure alerts in Atlas:

| Alert | Condition | Notification |
|-------|-----------|--------------|
| Backup Failed | Backup job fails | PagerDuty (critical) |
| Backup Delayed | Snapshot > 2 hours old | Slack #ops-alerts |
| Storage Low | Backup storage > 80% | Email admin team |
| Restore Completed | Any restore job | Slack #ops-alerts |

### Monitoring Commands

```bash
# Check backup status via Atlas CLI
atlas backups snapshots list cs-store-prod --limit 5

# Check restore jobs
atlas backups restore-jobs list cs-store-prod
```

---

## 8. Contact Information

| Role | Contact | Responsibility |
|------|---------|----------------|
| Primary DBA | dba@company.com | Backup configuration, restore execution |
| DevOps Lead | devops@company.com | Infrastructure, DR coordination |
| Engineering Manager | eng-manager@company.com | Incident escalation |
| MongoDB Support | support.mongodb.com | Atlas-specific issues |

---

## 9. Appendix: Quick Reference Commands

### Check Last Backup

```bash
atlas backups snapshots list cs-store-prod \
  --projectId <projectId> \
  --limit 1 \
  --output json
```

### Initiate PITR Restore

```bash
atlas backups restores start pointInTime \
  --clusterName cs-store-prod \
  --targetClusterName cs-store-recovery \
  --pointInTimeUTC "2024-01-15T10:30:00Z"
```

### Check Restore Status

```bash
atlas backups restores describe <restoreJobId> \
  --clusterName cs-store-prod
```

### Export Collection for Backup

```bash
mongoexport --uri="$MONGODB_URI" \
  --collection=orders \
  --query='{"createdAt": {"$gte": {"$date": "2024-01-01T00:00:00Z"}}}' \
  --out=orders_2024.json
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | DevOps Team | Initial documentation |
| 1.1 | 2024-02-01 | DBA Team | Added PITR procedures |
| 1.2 | 2024-03-01 | Engineering | Added DR checklist |

---

**Note**: This document should be reviewed and updated quarterly or after any significant infrastructure changes.
