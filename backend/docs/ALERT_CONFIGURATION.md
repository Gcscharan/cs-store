# Alert Configuration Guide

This document defines production-grade alerting rules for the e-commerce backend. All alerts are configured in Sentry using tagged events.

## Sentry Tags Reference

The following tags are used to categorize events for alert routing:

| Tag | Value | Description |
|-----|-------|-------------|
| `type` | `PAYMENT` | Payment processing errors |
| `type` | `INVENTORY` | Inventory/stock-related errors |
| `type` | `SECURITY` | Security events and threats |
| `component` | `payment` | Payment module |
| `component` | `inventory` | Inventory module |
| `component` | `security` | Security module |
| `component` | `auth` | Authentication module |
| `component` | `order` | Order processing module |

---

## Alert Rules

### 1. Payment Failure Alert

**Priority:** Critical

**Trigger Condition:**
- Event captured with `type: "PAYMENT"` tag
- Error level: `error`

**Threshold:**
- >5 payment errors in 5 minutes
- OR any single payment error with amount > ₹10,000

**Recommended Channel:** 
- **Primary:** Slack (`#alerts-payments`)
- **Secondary:** Email to ops team

**Sentry Query:**
```
is:unresolved type:PAYMENT level:error
```

**Response Actions:**
1. Check Razorpay dashboard for gateway status
2. Review recent webhook failures
3. Check for provider unavailability errors
4. Escalate to payment team if threshold exceeded

**Related Code Locations:**
- `@backend/src/domains/payments/services/webhookProcessor.ts`
- `@backend/src/domains/payments/services/paymentIntentService.ts`
- `@backend/src/domains/payments/services/paymentReconciliationService.ts`

---

### 2. Reconciliation Error Alert

**Priority:** High

**Trigger Condition:**
- Event captured with message containing `"reconciliation_error"`
- Tag: `type: "PAYMENT"`

**Threshold:**
- >3 reconciliation errors in 10 minutes
- OR any reconciliation error for order with `paymentStatus: "PAID"` mismatch

**Recommended Channel:**
- **Primary:** Slack (`#alerts-payments`)
- **Secondary:** Email to finance team

**Sentry Query:**
```
is:unresolved type:PAYMENT message:"reconciliation_error"
```

**Response Actions:**
1. Check Razorpay API status
2. Review orders stuck in `PENDING_PAYMENT` state
3. Run manual reconciliation if needed
4. Check for webhook delivery failures

**Related Code Locations:**
- `@backend/src/domains/payments/services/paymentReconciliationService.ts`

---

### 3. Inventory Invariant Breach Alert

**Priority:** Critical

**Trigger Condition:**
- Event captured with `type: "INVENTORY"` tag
- Error level: `error`
- Includes `InventoryReservationConflictError`

**Threshold:**
- >3 inventory errors in 5 minutes
- OR any stock reservation failure for order already paid

**Recommended Channel:**
- **Primary:** Slack (`#alerts-inventory`)
- **Secondary:** PagerDuty for critical stock issues

**Sentry Query:**
```
is:unresolved type:INVENTORY level:error
```

**Response Actions:**
1. Check for overselling scenarios
2. Review reserved stock vs available stock
3. Run inventory drift check
4. Investigate stuck reservations

**Related Code Locations:**
- `@backend/src/domains/orders/services/inventoryReservationService.ts`

---

### 4. Security Event Alert

**Priority:** High

**Trigger Condition:**
- Event captured with `type: "SECURITY"` tag
- Severity levels: `low`, `medium`, `high`

**Threshold by Severity:**

| Severity | Threshold | Channel |
|----------|-----------|---------|
| `high` | Any single event | PagerDuty + Slack (`#alerts-security`) |
| `medium` | >5 in 10 minutes | Slack (`#alerts-security`) |
| `low` | >20 in 1 hour | Email digest |

**Event Types to Monitor:**
- `rate_limit_exceeded_checkout` - Checkout abuse
- `rate_limit_exceeded_login` - Credential stuffing attempt
- `rate_limit_exceeded_signup` - Bulk account creation
- `FAILED_LOGIN_ATTEMPT` - Authentication failures
- `PAYMENT_FAILURE` - Payment-related security issues
- `ADMIN_ACTION` - Privileged operations

**Sentry Query:**
```
is:unresolved type:SECURITY
```

**Response Actions:**
1. Review source IP addresses
2. Check for pattern of abuse
3. Consider IP blocking if warranted
4. Review authentication logs
5. Check for account takeover attempts

**Related Code Locations:**
- `@backend/src/middleware/security.ts`
- `@backend/src/utils/logger.ts` (`captureSecurityEvent`)

---

### 5. Rate Limit Breach Alert

**Priority:** Medium

**Trigger Condition:**
- Event captured with `type: "SECURITY"` tag
- Event name starts with `rate_limit_exceeded_`

**Threshold:**
- >10 rate limit events from same IP in 5 minutes
- OR >50 total rate limit events across all IPs in 10 minutes

**Recommended Channel:**
- **Primary:** Slack (`#alerts-security`)
- **Secondary:** Email for persistent offenders

**Sentry Query:**
```
is:unresolved type:SECURITY message:"rate_limit_exceeded"
```

**Rate Limit Types:**

| Endpoint | Default Limit | Window |
|----------|---------------|--------|
| `/auth/login` | 5 requests | 15 min |
| `/auth/signup` | 3 requests | 60 min |
| `/checkout` | 10 requests | 1 min |
| `/payment/verify` | 10 requests | 1 min |
| Global API | 100 requests | 1 min |

**Response Actions:**
1. Identify attacking IP addresses
2. Check if legitimate traffic spike
3. Consider temporary IP blocks
4. Review if limits need adjustment

**Related Code Locations:**
- `@backend/src/middleware/security.ts`

---

## Sentry Alert Configuration

### Step-by-Step Setup

1. **Navigate to Sentry Project Settings**
   - Go to Settings → Projects → [Your Project] → Alerts

2. **Create Alert Rules**
   - Click "New Alert Rule"
   - Select "Issues" as the alert type
   - Configure conditions based on rules above

3. **Example Alert Rule (Payment Failures):**
   ```
   Name: Payment Failure Alert
   Conditions:
     - The event matches: type:PAYMENT
     - The event's level equals: error
     - An event is captured more than 5 times in 5m
   Actions:
     - Send notification to Slack: #alerts-payments
     - Send email to: ops-team@example.com
   ```

4. **Set Up Slack Integration:**
   - Settings → Integrations → Slack
   - Configure webhook for alert channels

5. **Set Up PagerDuty Integration (Critical Alerts):**
   - Settings → Integrations → PagerDuty
   - Link to high-severity security and inventory alerts

---

## Monitoring Dashboard Queries

Use these queries in Sentry Discover for real-time monitoring:

### Payment Health
```sql
event.type:PAYMENT | count() by message, level | time(-1h)
```

### Inventory Health
```sql
event.type:INVENTORY | count() by message | time(-1h)
```

### Security Overview
```sql
event.type:SECURITY | count() by severity, event | time(-24h)
```

### Error Rate by Component
```sql
level:error | count() by component | time(-1h)
```

---

## Escalation Matrix

| Alert Type | First Response | Escalation (15 min) | Escalation (1 hr) |
|------------|----------------|---------------------|-------------------|
| Payment Failure | Ops Team | Payment Lead | CTO |
| Reconciliation Error | Ops Team | Finance Lead | CTO |
| Inventory Breach | Ops Team | Inventory Lead | COO |
| Security (High) | Security Team | Security Lead | CTO/CEO |
| Security (Medium) | Ops Team | Security Team | Security Lead |
| Rate Limit | Ops Team | Security Team | Security Lead |

---

## Related Documentation

- [FAILURE_SIMULATIONS.md](./FAILURE_SIMULATIONS.md) - Controlled failure testing
- [README.md](./README.md) - Project overview

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2024-01-15 | Initial alert configuration | System |

---

## Notes

1. **Tag Consistency:** All critical captures must use the appropriate `type` tag. See `@backend/src/utils/logger.ts` for helper functions.

2. **No Silent Failures:** Every error path in payment, inventory, and security flows must either:
   - Call `capturePaymentError()`
   - Call `captureInventoryError()`
   - Call `captureSecurityEvent()`
   - Or use `logger.error()` with appropriate context

3. **Testing Alerts:** Use Sentry's "Send Test Alert" feature after configuration. Test alerts monthly.

4. **Alert Fatigue Prevention:** 
   - Tune thresholds based on baseline traffic
   - Use Sentry's issue grouping to deduplicate
   - Set up quiet hours for non-critical alerts
