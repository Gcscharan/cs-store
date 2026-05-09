# Payment Idempotency Monitoring Setup

## Overview

This guide provides instructions for setting up comprehensive monitoring for the payment idempotency fixes.

## Monitoring Stack

- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Alerting**: Prometheus Alertmanager
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana) or similar

## Metrics to Track

### 1. Order Creation Metrics

```typescript
// In backend/src/utils/metrics.ts

import { Counter, Histogram } from 'prom-client';

// Order creation attempts
export const orderCreationAttempts = new Counter({
  name: 'order_creation_attempts_total',
  help: 'Total number of order creation attempts',
  labelNames: ['status']
});

// Order creation with idempotency key
export const orderCreationWithKey = new Counter({
  name: 'order_creation_with_key_total',
  help: 'Total number of order creation attempts with idempotency key'
});

// Idempotent returns (existing order returned)
export const orderCreationIdempotentReturns = new Counter({
  name: 'order_creation_idempotent_returns_total',
  help: 'Total number of idempotent returns (existing order)',
  labelNames: ['reason'] // 'idempotency_key' or 'cart_hash'
});

// Cart hash conflicts
export const orderCreationCartHashConflicts = new Counter({
  name: 'order_creation_cart_hash_conflicts_total',
  help: 'Total number of cart hash conflicts (duplicate cart)'
});

// Order creation duration
export const orderCreationDuration = new Histogram({
  name: 'order_creation_duration_ms',
  help: 'Order creation duration in milliseconds',
  buckets: [50, 100, 200, 500, 1000, 2000, 5000]
});
```

### 2. Payment Finalization Metrics

```typescript
// Finalization attempts
export const finalizationAttempts = new Counter({
  name: 'finalization_attempts_total',
  help: 'Total number of finalization attempts',
  labelNames: ['confirmed_by'] // 'WEBHOOK', 'POLLING', 'RECONCILIATION'
});

// Finalization conflicts (already finalized)
export const finalizationConflicts = new Counter({
  name: 'finalization_conflicts_total',
  help: 'Total number of finalization conflicts (already finalized)',
  labelNames: ['confirmed_by']
});

// Finalization duration
export const finalizationDuration = new Histogram({
  name: 'finalization_duration_ms',
  help: 'Finalization duration in milliseconds',
  buckets: [10, 25, 50, 100, 200, 500, 1000]
});
```

### 3. Gateway Creation Metrics

```typescript
// Gateway creation claims
export const gatewayCreationClaims = new Counter({
  name: 'gateway_creation_claims_total',
  help: 'Total number of gateway creation claim attempts'
});

// Gateway creation claim losses
export const gatewayCreationClaimLosses = new Counter({
  name: 'gateway_creation_claim_losses_total',
  help: 'Total number of gateway creation claim losses (another worker won)'
});

// Gateway creation wait time (for losers)
export const gatewayCreationWaitTime = new Histogram({
  name: 'gateway_creation_wait_time_ms',
  help: 'Gateway creation wait time for claim losers in milliseconds',
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000]
});

// Gateway creation timeouts
export const gatewayCreationTimeouts = new Counter({
  name: 'gateway_creation_timeouts_total',
  help: 'Total number of gateway creation timeouts'
});
```

### 4. Admin Assignment Metrics

```typescript
// Admin assignment attempts
export const adminAssignmentAttempts = new Counter({
  name: 'admin_assignment_attempts_total',
  help: 'Total number of admin assignment attempts'
});

// Admin assignment conflicts (already assigned)
export const adminAssignmentConflicts = new Counter({
  name: 'admin_assignment_conflicts_total',
  help: 'Total number of admin assignment conflicts (already assigned)'
});
```

## Instrumentation

### Order Creation

```typescript
// In backend/src/domains/operations/services/orderBuilder.ts

import {
  orderCreationAttempts,
  orderCreationWithKey,
  orderCreationIdempotentReturns,
  orderCreationCartHashConflicts,
  orderCreationDuration
} from '../../../utils/metrics';

export async function createOrderFromCart(params: CreateOrderFromCartParams) {
  const startTime = Date.now();
  
  try {
    // Track attempt
    orderCreationAttempts.inc({ status: 'started' });
    
    // Track idempotency key usage
    if (params.idempotencyKey) {
      orderCreationWithKey.inc();
    }
    
    // ... order creation logic ...
    
    // Track duration
    orderCreationDuration.observe(Date.now() - startTime);
    orderCreationAttempts.inc({ status: 'success' });
    
    return result;
    
  } catch (error) {
    // Track idempotent returns
    if (error.code === 11000) {
      if (error.message.includes('idempotencyKey')) {
        orderCreationIdempotentReturns.inc({ reason: 'idempotency_key' });
      } else if (error.message.includes('cartHash')) {
        orderCreationCartHashConflicts.inc();
        orderCreationIdempotentReturns.inc({ reason: 'cart_hash' });
      }
    }
    
    orderCreationAttempts.inc({ status: 'error' });
    throw error;
  }
}
```

### Payment Finalization

```typescript
// In backend/src/domains/payments/services/orderPaymentFinalizer.ts

import {
  finalizationAttempts,
  finalizationConflicts,
  finalizationDuration
} from '../../../utils/metrics';

export async function finalizeOrderOnCapturedPayment(args: FinalizeArgs) {
  const startTime = Date.now();
  const confirmedBy = args.confirmedBy || 'WEBHOOK';
  
  try {
    finalizationAttempts.inc({ confirmed_by: confirmedBy });
    
    // ... finalization logic ...
    
    if (result.modifiedCount === 0) {
      // Already finalized
      finalizationConflicts.inc({ confirmed_by: confirmedBy });
      return { updated: false };
    }
    
    finalizationDuration.observe(Date.now() - startTime);
    return { updated: true };
    
  } catch (error) {
    throw error;
  }
}
```

### Gateway Creation

```typescript
// In backend/src/domains/payments/services/paymentIntentService.ts

import {
  gatewayCreationClaims,
  gatewayCreationClaimLosses,
  gatewayCreationWaitTime,
  gatewayCreationTimeouts
} from '../../../utils/metrics';

// Atomic claim
gatewayCreationClaims.inc();

if (claim.modifiedCount === 0) {
  // Lost claim
  gatewayCreationClaimLosses.inc();
  
  const waitStartTime = Date.now();
  
  // Wait for winner
  while (Date.now() - waitStartTime < maxWaitMs) {
    // ... wait logic ...
  }
  
  if (Date.now() - waitStartTime >= maxWaitMs) {
    // Timeout
    gatewayCreationTimeouts.inc();
    throw new Error('Gateway creation timeout');
  }
  
  gatewayCreationWaitTime.observe(Date.now() - waitStartTime);
}
```

### Admin Assignment

```typescript
// In backend/src/domains/admin/services/adminAssignmentService.ts

import {
  adminAssignmentAttempts,
  adminAssignmentConflicts
} from '../../../utils/metrics';

export async function assignOrderToAdmin(args: AssignArgs) {
  adminAssignmentAttempts.inc();
  
  const result = await Order.findOneAndUpdate(
    { _id: args.orderId, adminAssigned: { $ne: true } },
    { $set: { adminAssigned: true, /* ... */ } }
  );
  
  if (!result) {
    // Already assigned
    adminAssignmentConflicts.inc();
    return { assigned: false };
  }
  
  return { assigned: true };
}
```

## Grafana Dashboard Setup

### 1. Import Dashboard

```bash
# Copy dashboard JSON to Grafana
cp backend/monitoring/grafana-dashboards/payment-idempotency-dashboard.json \
   /var/lib/grafana/dashboards/

# Or import via Grafana UI:
# 1. Go to Grafana UI
# 2. Click "+" → "Import"
# 3. Upload payment-idempotency-dashboard.json
# 4. Select Prometheus data source
# 5. Click "Import"
```

### 2. Configure Data Source

```yaml
# In Grafana data sources configuration
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### 3. Dashboard Panels

The dashboard includes:

1. **Duplicate Order Detection**
   - Cart hash conflicts (per minute)
   - Idempotent returns (per minute)
   - Alert: >0.1 conflicts per minute

2. **Duplicate Order Rate**
   - Percentage of duplicate orders
   - Thresholds: 0.1% (warning), 1% (critical)

3. **Finalization Conflicts**
   - Conflicts per minute
   - Attempts per minute
   - Alert: >10% conflict rate

4. **Gateway Creation Wait Time**
   - P50, P95, P99 wait times
   - Alert: P95 >10 seconds

5. **Admin Assignment Conflicts**
   - Conflicts per minute
   - Attempts per minute

6. **Order Creation Latency**
   - P50, P95, P99 latencies

7. **Client Idempotency Key Adoption**
   - Percentage of requests with key
   - Threshold: 95%

## Alerting Rules

### Prometheus Alerting Rules

```yaml
# In prometheus/alerts/payment-idempotency.yml

groups:
  - name: payment_idempotency
    interval: 30s
    rules:
      # Critical: Duplicate orders detected
      - alert: DuplicateOrdersDetected
        expr: |
          (
            rate(order_creation_cart_hash_conflicts_total[5m]) +
            rate(order_creation_idempotent_returns_total[5m])
          ) / rate(order_creation_attempts_total[5m]) * 100 > 0.1
        for: 15m
        labels:
          severity: critical
          component: payment
        annotations:
          summary: "Duplicate orders detected"
          description: "Duplicate order rate is {{ $value }}% (threshold: 0.1%)"
          runbook: "https://docs.example.com/runbooks/duplicate-orders"
      
      # Critical: High finalization conflicts
      - alert: HighFinalizationConflicts
        expr: |
          rate(finalization_conflicts_total[5m]) /
          rate(finalization_attempts_total[5m]) * 100 > 10
        for: 30m
        labels:
          severity: warning
          component: payment
        annotations:
          summary: "High finalization conflict rate"
          description: "Finalization conflict rate is {{ $value }}% (threshold: 10%)"
          runbook: "https://docs.example.com/runbooks/finalization-conflicts"
      
      # Warning: High gateway creation wait time
      - alert: HighGatewayCreationWaitTime
        expr: |
          histogram_quantile(0.95,
            rate(gateway_creation_wait_time_ms_bucket[5m])
          ) > 10000
        for: 1h
        labels:
          severity: warning
          component: payment
        annotations:
          summary: "High gateway creation wait time"
          description: "Gateway creation wait time P95 is {{ $value }}ms (threshold: 10000ms)"
          runbook: "https://docs.example.com/runbooks/gateway-creation"
      
      # Warning: Low client adoption
      - alert: LowClientIdempotencyKeyAdoption
        expr: |
          rate(order_creation_with_key_total[5m]) /
          rate(order_creation_attempts_total[5m]) * 100 < 95
        for: 1h
        labels:
          severity: warning
          component: payment
        annotations:
          summary: "Low client idempotency key adoption"
          description: "Client adoption rate is {{ $value }}% (threshold: 95%)"
          runbook: "https://docs.example.com/runbooks/client-adoption"
```

### Alertmanager Configuration

```yaml
# In alertmanager/config.yml

global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    # Critical alerts - page immediately
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true
    
    # Warning alerts - notify Slack
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'default'
    email_configs:
      - to: 'backend-team@example.com'
  
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<pagerduty_service_key>'
  
  - name: 'slack'
    slack_configs:
      - api_url: '<slack_webhook_url>'
        channel: '#backend-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

## Log Monitoring

### Log Queries

#### Duplicate Order Detection

```
# Elasticsearch query
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "DUPLICATE_CART" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

#### Finalization Conflicts

```
# Elasticsearch query
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "FINALIZATION_GUARD" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  },
  "aggs": {
    "conflicts_per_minute": {
      "date_histogram": {
        "field": "@timestamp",
        "interval": "1m"
      }
    }
  }
}
```

#### Gateway Creation Issues

```
# Elasticsearch query
{
  "query": {
    "bool": {
      "should": [
        { "match": { "message": "GATEWAY_CLAIM_LOST" } },
        { "match": { "message": "GATEWAY_CLAIM_WAIT_TIMEOUT" } }
      ],
      "minimum_should_match": 1,
      "must": [
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

## Monitoring Checklist

### Daily Checks

- [ ] Check duplicate order rate (should be 0%)
- [ ] Check finalization conflict rate (should be <5%)
- [ ] Check gateway creation wait time (should be <2s P95)
- [ ] Check admin assignment rate (should be >95%)
- [ ] Review error logs

### Weekly Checks

- [ ] Review client idempotency key adoption
- [ ] Analyze performance trends
- [ ] Check for anomalies
- [ ] Update alerting thresholds if needed

### Monthly Checks

- [ ] Review all metrics
- [ ] Conduct rollback drill
- [ ] Update documentation
- [ ] Share findings with team

## Troubleshooting

### High Duplicate Order Rate

1. Check logs for duplicate orders
2. Run verification script: `node backend/scripts/verify-no-duplicate-orders.js`
3. Check indexes: `db.orders.getIndexes()`
4. If issues persist, rollback Phase 2

### High Finalization Conflict Rate

1. Check Razorpay webhook health
2. Check polling frequency
3. Run analysis: `node backend/scripts/rollback/rollback-atomic-finalization.js`
4. If >10% for >30 minutes, investigate

### High Gateway Creation Wait Time

1. Check Razorpay API latency
2. Check claim loss rate
3. Run analysis: `node backend/scripts/rollback/rollback-gateway-creation.js`
4. Consider increasing timeout

## References

- **Rollback Procedures**: `backend/docs/PAYMENT_IDEMPOTENCY_ROLLBACK.md`
- **Runbook**: `backend/docs/PAYMENT_IDEMPOTENCY_RUNBOOK.md`
- **Deployment Guide**: `backend/docs/PAYMENT_IDEMPOTENCY_DEPLOYMENT.md`
