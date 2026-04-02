# Week 1 Post-Launch Monitoring Guide

**Purpose**: Track critical metrics to ensure production stability  
**Duration**: 7 days after deployment  
**Review Frequency**: Daily

---

## 📊 Critical Metrics to Track

### 1. Payment Success Rate

**Target**: ≥ 95%  
**Alert Threshold**: < 90%

**How to Monitor**:
```bash
# Search logs for PAYMENT_STATUS
grep "PAYMENT_STATUS" app.log | jq -r 'select(.success == true)' | wc -l
grep "PAYMENT_STATUS" app.log | jq -r 'select(.success == false)' | wc -l
```

**What to Look For**:
- ✅ Success rate above 95%
- ⚠️ Spike in failures (investigate immediately)
- 🔍 Specific UPI apps with lower success rates
- 🔍 Time-of-day patterns (peak hours vs off-peak)

**Sample Log**:
```json
{
  "type": "PAYMENT_STATUS",
  "orderId": "abc123",
  "status": "PAID",
  "verdict": "SUCCESS",
  "method": "upi",
  "app": "Google Pay",
  "timestamp": 1711929600000,
  "success": true
}
```

---

### 2. Address Validation Failures

**Target**: < 5% failure rate  
**Alert Threshold**: > 10%

**How to Monitor**:
```bash
# Search logs for PINCODE_VALIDATION
grep "PINCODE_VALIDATION" app.log | jq -r 'select(.success == false)' | wc -l
grep "PINCODE_VALIDATION" app.log | jq -r 'select(.deliverable == false)' | wc -l
```

**What to Look For**:
- ✅ Most pincodes resolve successfully
- ⚠️ High rate of non-deliverable pincodes (business decision needed)
- 🔍 API timeout errors (infrastructure issue)
- 🔍 GPS vs manual validation success rates

**Sample Log**:
```json
{
  "type": "PINCODE_VALIDATION",
  "source": "gps",
  "pincode": "560001",
  "deliverable": true,
  "state": "Karnataka",
  "timestamp": 1711929600000,
  "success": true
}
```

---

### 3. API Call Volume (Pincode)

**Target**: 1-2 calls per address entry  
**Alert Threshold**: > 3 calls per address entry

**How to Monitor**:
```bash
# Count pincode validation calls per unique pincode
grep "PINCODE_VALIDATION" app.log | jq -r '.pincode' | sort | uniq -c
```

**What to Look For**:
- ✅ GPS pincodes validated once
- ✅ Manual edits trigger 1 additional call
- ⚠️ Multiple calls for same pincode (debounce not working)
- 🔍 Validation source distribution (GPS vs manual)

**Expected Pattern**:
```
GPS flow:     1 call  (initial validation)
Manual edit:  2 calls (GPS + 1 manual)
Pure manual:  1 call  (debounced)
```

---

### 4. Order Completion Rate

**Target**: ≥ 85%  
**Alert Threshold**: < 75%

**How to Monitor**:
```bash
# Track orders created vs orders completed
grep "ORDER_CREATED" app.log | wc -l
grep "ORDER_COMPLETED" app.log | wc -l
```

**What to Look For**:
- ✅ High completion rate (users successfully checking out)
- ⚠️ Drop-off at payment stage (UX issue)
- ⚠️ Drop-off at address validation (pincode issues)
- 🔍 Time between order creation and completion

**Funnel Analysis**:
```
Address Entry → Pincode Validation → Payment → Order Success
     100%              95%              90%         85%
```

---

## 🚨 Alert Conditions

### Immediate Action Required

**Payment Success Rate < 85%**
- Check payment gateway status
- Review recent code deployments
- Check for network issues

**Address Validation Failure > 20%**
- Check pincode API availability
- Review API rate limits
- Check for data quality issues

**API Call Volume > 5x Expected**
- Debounce not working
- Infinite loop in validation logic
- Check for client-side bugs

---

## 🔍 Daily Review Checklist

### Morning Review (9 AM)
- [ ] Check overnight payment success rate
- [ ] Review any failed transactions
- [ ] Check API error logs
- [ ] Verify no alerts triggered

### Afternoon Review (3 PM)
- [ ] Check peak hour performance
- [ ] Review address validation patterns
- [ ] Check API call volume trends
- [ ] Monitor order completion funnel

### Evening Review (9 PM)
- [ ] Daily summary metrics
- [ ] Identify any patterns or anomalies
- [ ] Plan fixes for next day if needed
- [ ] Update stakeholders

---

## 📈 Sample Queries

### Payment Success Rate by UPI App
```bash
grep "PAYMENT_STATUS" app.log | \
  jq -r 'select(.method == "upi") | "\(.app),\(.success)"' | \
  sort | uniq -c
```

### Pincode Validation by Source
```bash
grep "PINCODE_VALIDATION" app.log | \
  jq -r '"\(.source),\(.success)"' | \
  sort | uniq -c
```

### Average Time to Payment Verification
```bash
grep "PAYMENT_STATUS" app.log | \
  jq -r 'select(.status == "checking" or .verdict == "SUCCESS") | "\(.orderId),\(.timestamp)"' | \
  # Calculate time difference per orderId
```

---

## 🛠 Troubleshooting Guide

### Issue: Payment Success Rate Drops

**Symptoms**:
- Success rate < 90%
- Increased "PENDING" status
- Users reporting payment failures

**Investigation Steps**:
1. Check payment gateway status page
2. Review backend webhook logs
3. Check network latency to payment API
4. Verify polling timeout settings (120s)

**Quick Fix**:
- Increase polling timeout if needed
- Add retry logic for failed polls
- Contact payment gateway support

---

### Issue: High API Call Volume

**Symptoms**:
- > 3 calls per address entry
- Increased API costs
- Slow address validation

**Investigation Steps**:
1. Check debounce timing (should be 500ms)
2. Verify validation source tracking
3. Check for infinite loops in useEffect
4. Review user behavior patterns

**Quick Fix**:
- Increase debounce to 800ms if needed
- Add request deduplication
- Cache validation results

---

### Issue: Address Validation Failures

**Symptoms**:
- > 10% failure rate
- Users unable to submit addresses
- API timeout errors

**Investigation Steps**:
1. Check pincode API availability
2. Review API rate limits
3. Check network connectivity
4. Verify pincode data quality

**Quick Fix**:
- Add fallback validation logic
- Implement retry with exponential backoff
- Cache known-good pincodes

---

## 📊 Week 1 Success Criteria

### Green (All Good) ✅
- Payment success rate ≥ 95%
- Address validation failure < 5%
- API call volume 1-2 per entry
- Order completion rate ≥ 85%
- No critical alerts

### Yellow (Monitor Closely) ⚠️
- Payment success rate 90-95%
- Address validation failure 5-10%
- API call volume 2-3 per entry
- Order completion rate 75-85%
- Minor alerts resolved quickly

### Red (Action Required) 🔴
- Payment success rate < 90%
- Address validation failure > 10%
- API call volume > 3 per entry
- Order completion rate < 75%
- Critical alerts unresolved

---

## 🎯 End of Week 1 Review

### Questions to Answer
1. Are the optimizations working as expected?
2. Are there any unexpected edge cases?
3. Do we need to adjust any thresholds?
4. Are users experiencing any friction?
5. What improvements should we prioritize?

### Deliverables
- [ ] Week 1 metrics summary report
- [ ] List of identified issues and fixes
- [ ] Recommendations for Week 2
- [ ] Updated monitoring thresholds
- [ ] Stakeholder communication

---

## 🚀 Next Steps After Week 1

If all metrics are green:
- ✅ Increase rollout to 50% of users
- ✅ Reduce monitoring frequency to weekly
- ✅ Focus on feature improvements

If metrics are yellow:
- ⚠️ Continue 100% monitoring
- ⚠️ Implement identified fixes
- ⚠️ Delay further rollout

If metrics are red:
- 🔴 Rollback to previous version
- 🔴 Root cause analysis
- 🔴 Fix critical issues before re-deploy

---

**Remember**: The goal of Week 1 is not perfection, it's learning. Use the data to make informed decisions, not to panic. Production is where you learn what really matters.
