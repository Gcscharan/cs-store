# Rollback Scripts

This directory contains rollback scripts for the payment idempotency fixes deployment.

## Overview

The payment idempotency fixes are deployed in 4 phases, each with different rollback procedures:

1. **Phase 1**: Schema changes (indexes)
2. **Phase 2**: Code changes (atomic operations)
3. **Phase 3**: Enforcement (mandatory idempotency keys)
4. **Phase 4**: Cleanup (backfill data)

## Scripts

### Phase Rollbacks

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `rollback-phase1-schema.js` | Rollback schema changes | Index errors, order creation failures |
| `rollback-phase2-code.sh` | Rollback code changes | Duplicate orders, performance issues |
| `rollback-phase3-enforcement.js` | Rollback enforcement | High client error rate, compatibility issues |

### Component Rollbacks

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `rollback-atomic-finalization.js` | Fix finalization issues | Finalization conflicts >10% |
| `rollback-gateway-creation.js` | Fix gateway issues | Gateway timeouts >5% |
| `rollback-admin-assignment.js` | Fix assignment issues | Assignment rate <95% |

### Testing

| Script | Purpose |
|--------|---------|
| `test-rollback-procedures.sh` | Test all rollback procedures in staging |

## Quick Start

### 1. Phase 1 Rollback (Schema)

```bash
# Rollback schema changes
node backend/scripts/rollback/rollback-phase1-schema.js

# Restart backend
pm2 restart backend

# Verify
curl -X POST http://localhost:3000/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI"}'
```

### 2. Phase 2 Rollback (Code)

```bash
# Rollback code changes
bash backend/scripts/rollback/rollback-phase2-code.sh

# Verify
node backend/scripts/verify-no-duplicate-orders.js
```

### 3. Phase 3 Rollback (Enforcement)

```bash
# Rollback enforcement
node backend/scripts/rollback/rollback-phase3-enforcement.js

# Verify (should succeed without idempotency key)
curl -X POST http://localhost:3000/api/orders/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"UPI"}'
```

### 4. Component Rollbacks

```bash
# Analyze finalization issues
node backend/scripts/rollback/rollback-atomic-finalization.js

# Fix finalization issues
node backend/scripts/rollback/rollback-atomic-finalization.js --fix

# Analyze gateway issues
node backend/scripts/rollback/rollback-gateway-creation.js

# Fix gateway issues
node backend/scripts/rollback/rollback-gateway-creation.js --fix

# Analyze assignment issues
node backend/scripts/rollback/rollback-admin-assignment.js

# Fix assignment issues
node backend/scripts/rollback/rollback-admin-assignment.js --fix
```

## Testing Rollback Procedures

Before production deployment, test all rollback procedures in staging:

```bash
# Set environment
export ENVIRONMENT=staging
export BACKEND_URL=https://staging-api.example.com
export TEST_TOKEN=<staging_token>

# Run tests
bash backend/scripts/rollback/test-rollback-procedures.sh
```

## Rollback Decision Tree

```
Issue Detected
    |
    ├─ Duplicate orders? ──────────────────> Phase 2 Rollback
    |
    ├─ Order creation errors? ─────────────> Phase 1 Rollback
    |
    ├─ High client error rate (>5%)? ─────> Phase 3 Rollback
    |
    ├─ Finalization conflicts (>10%)? ────> Atomic Finalization Rollback
    |
    ├─ Gateway timeouts (>5%)? ───────────> Gateway Creation Rollback
    |
    └─ Assignment issues? ─────────────────> Admin Assignment Rollback
```

## Safety Checks

All rollback scripts include:

- ✅ User confirmation before making changes
- ✅ Backup creation (where applicable)
- ✅ Idempotent operations (safe to run multiple times)
- ✅ Verification steps
- ✅ Detailed logging

## Monitoring After Rollback

After any rollback, monitor these metrics for 24 hours:

```promql
# Duplicate order rate (should be 0%)
(rate(order_creation_cart_hash_conflicts_total[5m]) + rate(order_creation_idempotent_returns_total[5m])) / rate(order_creation_attempts_total[5m]) * 100

# Finalization conflict rate (should be <5%)
rate(finalization_conflicts_total[5m]) / rate(finalization_attempts_total[5m]) * 100

# Gateway creation wait time (should be <2s P95)
histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[5m]))

# Admin assignment rate (should be >95%)
rate(admin_assignment_attempts_total[5m]) / rate(order_creation_attempts_total[5m]) * 100
```

## Emergency Rollback

For critical incidents, rollback all phases:

```bash
# 1. Rollback code
bash backend/scripts/rollback/rollback-phase2-code.sh

# 2. Rollback schema
node backend/scripts/rollback/rollback-phase1-schema.js

# 3. Disable enforcement
node backend/scripts/rollback/rollback-phase3-enforcement.js

# 4. Verify system
node backend/scripts/verify-no-duplicate-orders.js
tail -f /var/log/backend.log | grep -i error
```

## Documentation

- **Rollback Procedures**: `backend/docs/PAYMENT_IDEMPOTENCY_ROLLBACK.md`
- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`

## Support

For issues or questions:

1. Check the rollback documentation
2. Review the runbook for troubleshooting
3. Contact the backend team lead
4. Escalate to CTO if critical

## Rollback Drill

Conduct quarterly rollback drills:

1. **Simulate incident** (e.g., duplicate orders in staging)
2. **Execute rollback** (follow procedures)
3. **Verify system** (run verification scripts)
4. **Document lessons** (update procedures)
5. **Share findings** (team meeting)

## Version History

- **v1.0.0** (2024-XX-XX): Initial rollback scripts
  - Phase 1, 2, 3 rollback scripts
  - Component-specific rollback scripts
  - Test suite
  - Documentation

## License

Internal use only - Company confidential
