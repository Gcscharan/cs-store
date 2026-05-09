# 📊 MONITORING & ALERTS PROMPT: Email → Phone Migration

## Context
You have deployed the email-to-phone migration. Now set up comprehensive monitoring and alerting to detect issues early.

---

## 🎯 MONITORING STRATEGY

### Three-Layer Approach:
1. **Application Metrics** - User flows, API calls
2. **Infrastructure Metrics** - Servers, databases, networks
3. **Business Metrics** - Conversions, revenue, satisfaction

---

## 📈 APPLICATION METRICS

### Critical User Flows:

**1. Customer Signup (Phone-Only)**

```javascript
// Metric: signup_success_rate
// Formula: (successful_signups / total_signup_attempts) * 100
// Threshold: ≥95%
// Alert: < 95% for 5 minutes

monitor.track('signup_attempt', { method: 'phone' });
monitor.track('signup_success', { method: 'phone' });
monitor.track('signup_failure', { method: 'phone', reason });
```

**2. Customer Login (OTP)**

```javascript
// Metric: login_success_rate
// Formula: (successful_logins / total_login_attempts) * 100
// Threshold: ≥98%
// Alert: < 98% for 5 minutes

monitor.track('login_attempt', { method: 'otp' });
monitor.track('login_success', { method: 'otp' });
monitor.track('login_failure', { method: 'otp', reason });
```

**3. Payment (Razorpay with Generated Email)**

```javascript
// Metric: payment_success_rate
// Formula: (successful_payments / total_payment_attempts) * 100
// Threshold: ≥95%
// Alert: < 95% for 5 minutes

monitor.track('payment_attempt', { gateway: 'razorpay', email_type });
monitor.track('payment_success', { gateway: 'razorpay', email_type });
monitor.track('payment_failure', { gateway: 'razorpay', email_type, reason });
```

**4. Email Generation**

```javascript
// Metric: email_generation_success_rate
// Formula: (successful_generations / total_attempts) * 100
// Threshold: 100%
// Alert: < 100% immediately

monitor.track('email_generation', { 
  has_real_email: !!user.email,
  generated: !user.email,
  phone: user.phone 
});
```

---

## 🚨 ERROR TRACKING

### Error Categories:

**1. Frontend Errors**

```javascript
// Track all frontend errors
window.addEventListener('error', (event) => {
  monitor.error('frontend_error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

// Track unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  monitor.error('unhandled_rejection', {
    reason: event.reason,
    promise: event.promise
  });
});
```

**2. Backend Errors**

```javascript
// Track API errors
app.use((err, req, res, next) => {
  monitor.error('backend_error', {
    message: err.message,
    stack: err.stack,
    endpoint: req.path,
    method: req.method,
    statusCode: res.statusCode,
    userId: req.user?._id
  });
  next(err);
});
```

**3. Payment Gateway Errors**

```javascript
// Track Razorpay errors
razorpay.on('payment.failed', (event) => {
  monitor.error('payment_gateway_error', {
    gateway: 'razorpay',
    orderId: event.payload.payment.entity.order_id,
    reason: event.payload.payment.entity.error_reason,
    email: event.payload.payment.entity.email,
    isGeneratedEmail: event.payload.payment.entity.email.endsWith('@customer.internal')
  });
});
```

---

## 📊 INFRASTRUCTURE METRICS

### Server Health:

```javascript
// CPU usage
monitor.gauge('server.cpu_usage', process.cpuUsage());
// Alert: > 80% for 5 minutes

// Memory usage
monitor.gauge('server.memory_usage', process.memoryUsage());
// Alert: > 85% for 5 minutes

// Event loop lag
monitor.gauge('server.event_loop_lag', eventLoopLag);
// Alert: > 100ms for 5 minutes
```

### Database Performance:

```javascript
// Query response time
monitor.histogram('db.query_time', queryDuration);
// Alert: p95 > 500ms for 5 minutes

// Connection pool
monitor.gauge('db.connections_active', activeConnections);
monitor.gauge('db.connections_idle', idleConnections);
// Alert: active > 80% of pool for 5 minutes

// Slow queries
monitor.track('db.slow_query', { query, duration });
// Alert: > 10 slow queries per minute
```

### API Performance:

```javascript
// Response time by endpoint
monitor.histogram('api.response_time', {
  endpoint: req.path,
  method: req.method,
  statusCode: res.statusCode,
  duration: Date.now() - req.startTime
});
// Alert: p95 > 1000ms for 5 minutes

// Request rate
monitor.counter('api.requests', { endpoint, method });
// Alert: sudden spike or drop (>50% change)

// Error rate
monitor.counter('api.errors', { endpoint, method, statusCode });
// Alert: > 5% error rate for 5 minutes
```

---

## 💼 BUSINESS METRICS

### Conversion Funnel:

```javascript
// Signup funnel
monitor.funnel('signup', [
  'page_view',      // User lands on signup page
  'form_start',     // User starts filling form
  'otp_sent',       // OTP sent to phone
  'otp_verified',   // OTP verified
  'signup_complete' // Signup successful
]);
// Alert: Drop-off > 20% at any stage

// Payment funnel
monitor.funnel('payment', [
  'checkout_start',
  'payment_initiated',
  'payment_processing',
  'payment_success'
]);
// Alert: Drop-off > 15% at any stage
```

### Revenue Impact:

```javascript
// Track revenue by user type
monitor.track('revenue', {
  amount,
  userId,
  hasEmail: !!user.email,
  authMethod: user.email ? 'email' : 'phone'
});
// Alert: Revenue drop > 10% compared to baseline
```

---

## 🔔 ALERT CONFIGURATION

### Alert Levels:

**CRITICAL (Immediate Action)**
- Signup success rate < 90%
- Login success rate < 95%
- Payment success rate < 90%
- Error rate > 5%
- Database down
- Server down

**WARNING (Investigate Soon)**
- Signup success rate < 95%
- Login success rate < 98%
- Payment success rate < 95%
- Error rate > 2%
- Slow queries increasing
- Memory usage > 80%

**INFO (Monitor)**
- New error types
- Unusual traffic patterns
- Performance degradation
- User feedback

---

## 📱 ALERT CHANNELS

### Setup:

```javascript
// Slack alerts
monitor.alert.slack({
  webhook: process.env.SLACK_WEBHOOK,
  channel: '#engineering-alerts',
  critical: '@channel',
  warning: '@here'
});

// Email alerts
monitor.alert.email({
  to: ['oncall@company.com', 'engineering@company.com'],
  critical: true,
  warning: true
});

// PagerDuty (critical only)
monitor.alert.pagerduty({
  apiKey: process.env.PAGERDUTY_API_KEY,
  serviceKey: process.env.PAGERDUTY_SERVICE_KEY,
  critical: true
});

// SMS (critical only)
monitor.alert.sms({
  to: ['+1234567890'],
  critical: true
});
```

---

## 📊 DASHBOARD SETUP

### Real-Time Dashboard:

```javascript
// Create monitoring dashboard
const dashboard = monitor.createDashboard('email-migration', {
  metrics: [
    // User flows
    'signup_success_rate',
    'login_success_rate',
    'payment_success_rate',
    
    // Errors
    'error_rate',
    'frontend_errors',
    'backend_errors',
    'payment_errors',
    
    // Performance
    'api_response_time_p95',
    'db_query_time_p95',
    
    // Infrastructure
    'server_cpu_usage',
    'server_memory_usage',
    'db_connections_active',
    
    // Business
    'signup_funnel',
    'payment_funnel',
    'revenue'
  ],
  
  refresh: 30, // seconds
  
  layout: 'grid',
  
  alerts: true
});

// Access dashboard
console.log(`Dashboard: ${dashboard.url}`);
```

---

## 🔍 LOG AGGREGATION

### Centralized Logging:

```javascript
// Log all migration-related events
logger.info('email_migration_event', {
  event: 'signup_attempt',
  userId,
  phone,
  hasEmail: !!email,
  timestamp: new Date(),
  metadata: {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    referrer: req.headers.referer
  }
});

// Query logs
// Example: Find all signup failures in last hour
logs.query({
  event: 'signup_failure',
  timestamp: { $gte: Date.now() - 3600000 }
});
```

---

## 📈 CUSTOM METRICS

### Migration-Specific:

```javascript
// Track email vs phone auth ratio
monitor.gauge('auth.phone_only_ratio', 
  phoneOnlyUsers / totalUsers * 100
);
// Target: Increasing over time

// Track generated email usage
monitor.gauge('email.generated_ratio',
  generatedEmails / totalEmails * 100
);
// Target: Increasing over time

// Track payment gateway acceptance
monitor.gauge('payment.razorpay_acceptance_rate',
  acceptedPayments / totalPayments * 100
);
// Target: ≥95%
```

---

## 🎯 MONITORING CHECKLIST

Setup checklist:

```
Application Metrics:
[ ] Signup success rate
[ ] Login success rate
[ ] Payment success rate
[ ] Email generation rate
[ ] Error rate

Infrastructure Metrics:
[ ] Server CPU/memory
[ ] Database performance
[ ] API response time
[ ] Connection pools

Business Metrics:
[ ] Conversion funnels
[ ] Revenue tracking
[ ] User satisfaction

Alerts:
[ ] Critical alerts configured
[ ] Warning alerts configured
[ ] Alert channels setup
[ ] On-call rotation defined

Dashboards:
[ ] Real-time dashboard created
[ ] Historical trends visible
[ ] Team has access
[ ] Mobile-friendly

Logging:
[ ] Centralized logging setup
[ ] Log retention configured
[ ] Query tools available
[ ] Team trained
```

---

## 📞 INCIDENT RESPONSE

### When Alert Fires:

1. **Acknowledge** alert immediately
2. **Check** dashboard for context
3. **Investigate** logs and metrics
4. **Diagnose** root cause
5. **Fix** or rollback
6. **Verify** fix worked
7. **Document** incident
8. **Post-mortem** within 24 hours

---

## 🔄 CONTINUOUS IMPROVEMENT

### Weekly Review:

- Review all alerts (false positives?)
- Adjust thresholds if needed
- Add new metrics if gaps found
- Remove noisy metrics
- Update documentation

### Monthly Review:

- Analyze trends
- Identify patterns
- Optimize performance
- Update baselines
- Share learnings

---

**Created:** April 5, 2026  
**Version:** 1.0  
**Status:** Production-Ready  
**Coverage:** Comprehensive  
**Confidence:** HIGH
