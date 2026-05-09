# Payment Idempotency Verification Scripts

This directory contains verification scripts for the payment idempotency fixes.

## Overview

The verification scripts ensure that the payment idempotency fixes are working correctly in production. They check for:

1. **No Duplicate Orders** - Verifies no duplicate orders exist (by idempotency key or cart hash)
2. **Atomic Finalization** - Verifies payment finalization is atomic with no race conditions
3. **Gateway Creation** - Verifies no duplicate Razorpay orders are created
4. **Admin Assignment** - Verifies admin assignment is idempotent
5. **Performance** - Verifies performance has not degraded significantly

## Quick Start

### Run All Verification Checks

```bash
# Run all checks (recommended)
npm run verify:idempotency

# Or directly
node scripts/verify-idempotency-deployment.js
```

### Run Individual Checks

```bash
# Check for duplicate orders
npm run verify:duplicates
# Or: node scripts/verify-no-duplicate-orders.js

# Check atomic finalization
npm run verify:finalization
# Or: node scripts/verify-atomic-finalization.js

# Check gateway creation
npm run verify:gateway
# Or: node scripts/verify-gateway-creation.js

# Check admin assignment
npm run verify:admin
# Or: node scripts/verify-admin-assignment.js

# Check performance (requires baseline file)
npm run verify:performance
# Or: node scripts/verify-performance.js --baseline-file=baseline.json
```

## Baseline Metrics

Before deploying the idempotency fixes, collect baseline metrics:

```bash
# Collect baseline
npm run collect:baseline
# Or: node scripts/collect-baseline-metrics.js --output=baseline-metrics.json

# After deployment, verify performance
npm run verify:performance
# Or: node scripts/verify-performance.js --baseline-file=baseline-metrics.json
```

## Daily Verification

Set up daily verification as a cron job:

```bash
# Add to crontab
0 9 * * * cd /path/to/backend && npm run verify:daily

# Or directly
0 9 * * * cd /path/to/backend && node scripts/daily-verification.js --slack-webhook=$SLACK_WEBHOOK_URL
```

## Script Details

### verify-no-duplicate-orders.js

Checks for duplicate orders in the database.

**Usage:**
```bash
node scripts/verify-no-duplicate-orders.js [--days=7] [--verbose]
```

**Options:**
- `--days=N` - Check orders from last N days (default: 7)
- `--verbose` - Show detailed output

**Checks:**
- Duplicate orders by idempotency key
- Duplicate orders by cart hash (within 5 minutes)
- Index health (idempotency key and cart hash indexes)

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

### verify-atomic-finalization.js

Checks that payment finalization is atomic.

**Usage:**
```bash
node scripts/verify-atomic-finalization.js [--days=7] [--verbose]
```

**Options:**
- `--days=N` - Check orders from last N days (default: 7)
- `--verbose` - Show detailed output

**Checks:**
- No duplicate PAID writes
- Finalization conflict rate (<5% acceptable)
- Finalization integrity (all PAID orders have finalizedAt)

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

### verify-gateway-creation.js

Checks that gateway order creation is working correctly.

**Usage:**
```bash
node scripts/verify-gateway-creation.js [--days=7] [--verbose]
```

**Options:**
- `--days=N` - Check payment intents from last N days (default: 7)
- `--verbose` - Show detailed output

**Checks:**
- No duplicate Razorpay orders
- No stuck payment intents (>10 is a failure)
- Gateway creation conflict handling (claim losers wait successfully)

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

### verify-admin-assignment.js

Checks that admin assignment is idempotent.

**Usage:**
```bash
node scripts/verify-admin-assignment.js [--days=7] [--verbose]
```

**Options:**
- `--days=N` - Check orders from last N days (default: 7)
- `--verbose` - Show detailed output

**Checks:**
- No duplicate admin assignments
- Assignment integrity (all assigned orders have timestamp)
- Assignment conflict rate (<10% acceptable)
- Event consumer idempotency

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

### verify-performance.js

Checks that performance has not degraded significantly.

**Usage:**
```bash
node scripts/verify-performance.js --baseline-file=baseline.json [--verbose]
```

**Options:**
- `--baseline-file=PATH` - Path to baseline metrics file (required)
- `--verbose` - Show detailed output

**Checks:**
- Order creation latency (P50, P95, P99)
- Finalization latency (P50, P95, P99)
- Gateway creation latency (P50, P95, P99)

**Thresholds:**
- Order creation: <10% increase
- Finalization: <10% increase
- Gateway creation: <15% increase

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

### verify-idempotency-deployment.js

Master script that runs all verification checks.

**Usage:**
```bash
node scripts/verify-idempotency-deployment.js [--days=7] [--baseline-file=baseline.json] [--verbose]
```

**Options:**
- `--days=N` - Check data from last N days (default: 7)
- `--baseline-file=PATH` - Path to baseline metrics file (optional)
- `--verbose` - Show detailed output

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

### collect-baseline-metrics.js

Collects current performance metrics to establish a baseline.

**Usage:**
```bash
node scripts/collect-baseline-metrics.js --output=baseline.json [--verbose]
```

**Options:**
- `--output=PATH` - Path to save baseline metrics (required)
- `--verbose` - Show detailed output

**Exit Codes:**
- `0` - Baseline collected successfully
- `1` - Error collecting baseline

### daily-verification.js

Runs daily verification checks and sends a summary report.

**Usage:**
```bash
node scripts/daily-verification.js [--email=admin@example.com] [--slack-webhook=URL] [--baseline-file=PATH]
```

**Options:**
- `--email=EMAIL` - Send report to email (requires email service configured)
- `--slack-webhook=URL` - Send report to Slack webhook
- `--baseline-file=PATH` - Path to baseline metrics file (optional)

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

## Environment Variables

### Required

- `MONGODB_URI` - MongoDB connection string

### Optional

- `LOG_FILE` - Path to backend log file (default: `/var/log/backend.log`)
- `PROMETHEUS_URL` - Prometheus server URL (default: `http://localhost:9090`)
- `SLACK_WEBHOOK_URL` - Slack webhook URL for notifications

## Troubleshooting

### Connection Errors

If you get connection errors:

```bash
# Check MongoDB connection
echo $MONGODB_URI
mongo $MONGODB_URI --eval "db.adminCommand('ping')"

# Check Prometheus connection
curl $PROMETHEUS_URL/api/v1/query?query=up
```

### Log File Not Found

If log analysis is skipped:

```bash
# Set LOG_FILE environment variable
export LOG_FILE=/path/to/backend.log

# Or run on production server where logs are available
ssh production-server
cd /path/to/backend
node scripts/verify-atomic-finalization.js
```

### Prometheus Not Available

If performance verification is skipped:

```bash
# Set PROMETHEUS_URL environment variable
export PROMETHEUS_URL=http://prometheus:9090

# Or skip performance check
node scripts/verify-idempotency-deployment.js
# (performance check will be skipped if no baseline file provided)
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Verify Idempotency

on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: cd backend && npm install
      - name: Run verification
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          PROMETHEUS_URL: ${{ secrets.PROMETHEUS_URL }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: cd backend && npm run verify:daily
```

### Jenkins

```groovy
pipeline {
  agent any
  
  triggers {
    cron('0 9 * * *')  // Daily at 9 AM
  }
  
  stages {
    stage('Verify Idempotency') {
      steps {
        sh '''
          cd backend
          npm install
          npm run verify:daily
        '''
      }
    }
  }
  
  post {
    failure {
      slackSend(
        color: 'danger',
        message: "Payment Idempotency Verification Failed: ${env.BUILD_URL}"
      )
    }
  }
}
```

## References

- **Verification Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_VERIFICATION.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
- **Design Document**: `.kiro/specs/payment-idempotency-fixes/design.md`
- **Bugfix Document**: `.kiro/specs/payment-idempotency-fixes/bugfix.md`
