# Payment Idempotency Alerting Rules

This document defines alerting rules for monitoring idempotency operations in the payment system. These rules should be configured in your monitoring system (e.g., Prometheus, DataDog, CloudWatch).

## Overview

The payment system tracks several key metrics for idempotency operations:
- Order creation attempts and idempotent returns
- Cart hash conflicts (duplicate cart detection)
- Payment finalization conflicts
- Admin assignment conflicts
- Gateway creation conflicts

## Alerting Rules

### 1. Critical: Duplicate Order Rate

**Metric**: `order_creation_cart_hash_conflicts_total / order_creation_attempts_total`

**Threshold**: > 0.1% (0.001)

**Severity**: Critical

**Description**: Detects when users are creating duplicate orders with the same cart contents. This indicates potential issues with:
- Client-side retry logic
- Idempotency key generation
- User experience (double-clicking, slow responses)

**Action**:
1. Check logs for cart hash conflicts
2. Investigate user behavior patterns
3. Review client-side idempotency key generation
4. Check for slow API responses causing user retries

**Query Example (Prometheus)**:
```promql
(
  rate(order_creation_cart_hash_conflicts_total[5m]) 
  / 
  rate(order_creation_attempts_total[5m])
) > 0.001
```

**Alert Configuration**:
```yaml
- alert: HighDuplicateOrderRate
  expr: |
    (
      rate(order_creation_cart_hash_conflicts_total[5m]) 
      / 
      rate(order_creation_attempts_total[5m])
    ) > 0.001
  for: 5m
  labels:
    severity: critical
    component: payments
  annotations:
    summary: "High duplicate order rate detected"
    description: "Duplicate order rate is {{ $value | humanizePercentage }} (threshold: 0.1%)"
```

### 2. Warning: Finalization Conflicts

**Metric**: `finalization_conflicts_total / finalization_attempts_total`

**Threshold**: > 5% (0.05)

**Severity**: Warning

**Description**: Detects when multiple workers are attempting to finalize the same payment. This is expected in some scenarios (webhook + polling race) but high rates indicate:
- Webhook delivery issues
- Excessive polling
- Reconciliation running too frequently

**Action**:
1. Check webhook delivery rate
2. Review polling configuration
3. Check reconciliation service frequency
4. Verify Razorpay webhook configuration

**Query Example (Prometheus)**:
```promql
(
  rate(finalization_conflicts_total[5m]) 
  / 
  rate(finalization_attempts_total[5m])
) > 0.05
```

**Alert Configuration**:
```yaml
- alert: HighFinalizationConflictRate
  expr: |
    (
      rate(finalization_conflicts_total[5m]) 
      / 
      rate(finalization_attempts_total[5m])
    ) > 0.05
  for: 10m
  labels:
    severity: warning
    component: payments
  annotations:
    summary: "High payment finalization conflict rate"
    description: "Finalization conflict rate is {{ $value | humanizePercentage }} (threshold: 5%)"
```

### 3. Info: Gateway Creation Conflicts

**Metric**: `gateway_creation_claim_losses_total / gateway_creation_claims_total`

**Threshold**: > 10% (0.10)

**Severity**: Info

**Description**: Tracks when multiple workers attempt to create a Razorpay order for the same payment intent. This is expected during concurrent retries and is handled gracefully by the wait loop. High rates indicate:
- Client-side retry storms
- Load balancer issues
- Network timeouts

**Action**:
1. Monitor gateway creation wait times
2. Check for client-side retry patterns
3. Review load balancer configuration
4. Verify network stability

**Query Example (Prometheus)**:
```promql
(
  rate(gateway_creation_claim_losses_total[5m]) 
  / 
  rate(gateway_creation_claims_total[5m])
) > 0.10
```

**Alert Configuration**:
```yaml
- alert: HighGatewayCreationConflictRate
  expr: |
    (
      rate(gateway_creation_claim_losses_total[5m]) 
      / 
      rate(gateway_creation_claims_total[5m])
    ) > 0.10
  for: 15m
  labels:
    severity: info
    component: payments
  annotations:
    summary: "High gateway creation conflict rate"
    description: "Gateway creation conflict rate is {{ $value | humanizePercentage }} (threshold: 10%)"
```

### 4. Warning: Admin Assignment Conflicts

**Metric**: `admin_assignment_conflicts_total / admin_assignment_attempts_total`

**Threshold**: > 5% (0.05)

**Severity**: Warning

**Description**: Detects when multiple workers attempt to assign the same order to admin. This indicates:
- Event consumer processing duplicate events
- Event bus delivery issues
- Event consumer not properly handling idempotency

**Action**:
1. Check event consumer logs
2. Review event bus configuration
3. Verify event deduplication logic
4. Check for event consumer restarts

**Query Example (Prometheus)**:
```promql
(
  rate(admin_assignment_conflicts_total[5m]) 
  / 
  rate(admin_assignment_attempts_total[5m])
) > 0.05
```

**Alert Configuration**:
```yaml
- alert: HighAdminAssignmentConflictRate
  expr: |
    (
      rate(admin_assignment_conflicts_total[5m]) 
      / 
      rate(admin_assignment_attempts_total[5m])
    ) > 0.05
  for: 10m
  labels:
    severity: warning
    component: operations
  annotations:
    summary: "High admin assignment conflict rate"
    description: "Admin assignment conflict rate is {{ $value | humanizePercentage }} (threshold: 5%)"
```

### 5. Info: Idempotent Return Rate

**Metric**: `order_creation_idempotent_returns_total / order_creation_attempts_total`

**Threshold**: > 20% (0.20)

**Severity**: Info

**Description**: Tracks the overall rate of idempotent returns (both idempotency key and cart hash). High rates indicate:
- Client-side retry behavior
- User experience issues (slow responses)
- Network issues

**Action**:
1. Review client-side retry logic
2. Check API response times
3. Monitor user experience metrics
4. Verify network stability

**Query Example (Prometheus)**:
```promql
(
  rate(order_creation_idempotent_returns_total[5m]) 
  / 
  rate(order_creation_attempts_total[5m])
) > 0.20
```

**Alert Configuration**:
```yaml
- alert: HighIdempotentReturnRate
  expr: |
    (
      rate(order_creation_idempotent_returns_total[5m]) 
      / 
      rate(order_creation_attempts_total[5m])
    ) > 0.20
  for: 15m
  labels:
    severity: info
    component: payments
  annotations:
    summary: "High idempotent return rate"
    description: "Idempotent return rate is {{ $value | humanizePercentage }} (threshold: 20%)"
```

## Metric Labels

All metrics include the following labels for filtering and grouping:
- `orderId`: The order ID (for debugging specific orders)
- `userId`: The user ID (for user-specific analysis)
- `confirmedBy`: The confirmation source (WEBHOOK, POLLING, RECONCILIATION)
- `reason`: The reason for idempotent return (idempotency_key, cart_hash)

## Dashboard Recommendations

### Key Metrics Dashboard

Create a dashboard with the following panels:

1. **Order Creation Metrics**
   - Order creation attempts (rate)
   - Idempotent returns (rate)
   - Cart hash conflicts (rate)
   - Idempotent return rate (%)

2. **Finalization Metrics**
   - Finalization attempts (rate)
   - Finalization conflicts (rate)
   - Finalization conflict rate (%)
   - Finalization by source (WEBHOOK, POLLING, RECONCILIATION)

3. **Gateway Creation Metrics**
   - Gateway creation claims (rate)
   - Gateway creation claim losses (rate)
   - Gateway creation claim loss rate (%)
   - Gateway creation wait time (P50, P95, P99)

4. **Admin Assignment Metrics**
   - Admin assignment attempts (rate)
   - Admin assignment conflicts (rate)
   - Admin assignment conflict rate (%)

### Troubleshooting Dashboard

Create a troubleshooting dashboard with:

1. **Recent Conflicts**
   - Last 100 cart hash conflicts (with orderId, userId)
   - Last 100 finalization conflicts (with orderId, source)
   - Last 100 admin assignment conflicts (with orderId)

2. **Conflict Trends**
   - Conflict rates over time (1h, 6h, 24h)
   - Conflict distribution by hour of day
   - Conflict distribution by user

3. **Performance Impact**
   - Order creation latency (P50, P95, P99)
   - Finalization latency (P50, P95, P99)
   - Gateway creation wait time (P50, P95, P99)

## Integration with Monitoring Systems

### Prometheus

Add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'payment-service'
    static_configs:
      - targets: ['payment-service:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### DataDog

Use the DataDog agent to collect metrics:

```yaml
# datadog.yaml
logs_enabled: true
apm_enabled: true

# Custom metrics
dogstatsd_mapper_profiles:
  - name: payment_metrics
    prefix: "payment."
    mappings:
      - match: "payment.order_creation_attempts_total"
        name: "payment.order_creation.attempts"
        tags:
          component: payments
```

### CloudWatch

Use CloudWatch agent to collect metrics:

```json
{
  "metrics": {
    "namespace": "PaymentService",
    "metrics_collected": {
      "statsd": {
        "service_address": ":8125",
        "metrics_collection_interval": 60,
        "metrics_aggregation_interval": 60
      }
    }
  }
}
```

## Testing Alerts

To test alerts in a staging environment:

1. **Duplicate Order Alert**: Create multiple orders with the same cart contents
2. **Finalization Conflict Alert**: Trigger webhook and polling simultaneously
3. **Gateway Creation Conflict Alert**: Create concurrent payment intents
4. **Admin Assignment Conflict Alert**: Process duplicate ORDER_CREATED events

## Maintenance

Review and update these alerting rules:
- Monthly: Review threshold values based on actual metrics
- Quarterly: Review alert severity levels
- After incidents: Update rules based on lessons learned
- After major changes: Verify alerts still work correctly

## Related Documentation

- [Design Document](../../../.kiro/specs/payment-idempotency-fixes/design.md)
- [Metrics Service](../services/paymentMetricsService.ts)
- [Runbook](../../../.kiro/specs/payment-idempotency-fixes/runbook.md) (to be created in Task 9.3)
