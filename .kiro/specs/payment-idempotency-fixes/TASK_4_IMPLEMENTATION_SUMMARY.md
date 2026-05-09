# Task 4: Strict Gateway Order Creation - Implementation Summary

## Overview
Successfully implemented Task 4 with all three sub-tasks to fix the Razorpay gateway order creation race condition. The implementation ensures that when multiple workers try to create a gateway order for the same PaymentIntent, only ONE calls Razorpay, and losers wait for the winner to complete.

## Sub-tasks Completed

### 4.1 ✅ Implement wait loop for claim losers
**File**: `backend/src/domains/payments/services/paymentIntentService.ts`

**Changes**:
- Added comprehensive wait loop after claim loss (modifiedCount=0)
- Poll for gatewayOrderId with 500ms intervals
- Maximum wait time: 30 seconds
- Returns existing gateway order if winner succeeds
- Checks for FAILED/EXPIRED status and throws error if winner crashed
- Throws timeout error if max wait exceeded (DO NOT call Razorpay)

**Key Implementation Details**:
```typescript
if (Number((claim as any).modifiedCount) === 0) {
  // Claim lost - MUST wait for winner
  const maxWaitMs = 30_000; // 30 seconds
  const startWaitMs = Date.now();
  
  while (Date.now() - startWaitMs < maxWaitMs) {
    const existing = await PaymentIntent.findById(intent._id)
      .select("gatewayOrderId checkoutPayload amount currency expiresAt status")
      .lean();
    
    if (existing && String((existing as any).gatewayOrderId || "").trim()) {
      // Winner succeeded - return existing gateway order
      return { /* existing gateway order */ };
    }
    
    // Check if winner failed
    const status = String((existing as any)?.status || "").toUpperCase();
    if (status === "FAILED" || status === "EXPIRED") {
      throw new Error("Gateway order creation failed by another worker");
    }
    
    // Wait 500ms before next check
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Timeout - DO NOT call Razorpay
  throw new Error("Gateway order creation timeout - winner did not complete");
}
```

### 4.2 ✅ Add logging for gateway creation conflicts
**File**: `backend/src/domains/payments/services/paymentIntentService.ts`

**Logging Added**:
1. **Claim Won**: `[PI][GATEWAY_CLAIM_WON]` - This worker will create gateway order
2. **Claim Lost**: `[PI][GATEWAY_CLAIM_LOST]` - Another worker claimed gateway creation
3. **Wait Start**: `[PI][GATEWAY_CLAIM_WAIT_START]` - Waiting for winner to complete
4. **Wait Success**: `[PI][GATEWAY_CLAIM_WAIT_SUCCESS]` - Winner completed gateway creation
5. **Wait Failed**: `[PI][GATEWAY_CLAIM_WAIT_FAILED]` - Winner failed to create gateway order
6. **Wait Timeout**: `[PI][GATEWAY_CLAIM_WAIT_TIMEOUT]` - Winner did not complete gateway creation

**Log Context Includes**:
- orderId
- intentId (paymentIntentId)
- waitTimeMs (for wait events)
- gatewayOrderId (for success)
- status (for failure)
- maxWaitMs (for wait start)

### 4.3 ✅ Add metrics for gateway creation
**File**: `backend/src/domains/payments/services/paymentMetricsService.ts`

**Metrics Added**:

1. **Counter: gateway_creation_claims_total**
   - Tracks total number of gateway creation claim attempts
   - Incremented on every claim attempt (win or lose)

2. **Counter: gateway_creation_claim_losses_total**
   - Tracks number of claim losses (concurrent conflicts)
   - Incremented when modifiedCount=0

3. **Histogram: gateway_creation_wait_time_ms**
   - Tracks wait time for claim losers
   - Records P50, P95, P99 percentiles
   - Tracks outcome: 'success', 'winner_failed', 'timeout'

**New Methods**:
- `trackGatewayCreationClaim({ orderId, intentId, won })` - Track claim attempt
- `trackGatewayCreationWaitTime({ orderId, intentId, waitTimeMs, outcome })` - Track wait time
- `getGatewayCreationClaimLossRate()` - Calculate claim loss rate (0-100%)
- `getAverageGatewayCreationWaitTime()` - Calculate average wait time
- `getGatewayCreationWaitTimePercentiles()` - Get P50, P95, P99 percentiles

**Metrics Summary Updated**:
The `getMetricsSummary()` and `logMetricsSummary()` methods now include:
- `gatewayCreationClaimsTotal`
- `gatewayCreationClaimLossesTotal`
- `gatewayCreationClaimLossRate`
- `averageGatewayCreationWaitTimeMs`
- `gatewayCreationWaitTimePercentiles` (P50, P95, P99)

## Critical Requirements Met

✅ **NEVER call Razorpay twice for the same PaymentIntent**
- Atomic claim ensures only one winner
- Losers wait for winner, never proceed to call Razorpay
- Timeout throws error instead of calling Razorpay

✅ **Claim losers MUST wait for winner (max 30 seconds)**
- Implemented polling loop with 500ms intervals
- Maximum wait time: 30 seconds
- Returns existing gateway order when winner succeeds

✅ **Check for FAILED/EXPIRED status during wait**
- Checks status on every poll iteration
- Throws error if winner crashed (status = FAILED/EXPIRED)
- Prevents indefinite waiting on crashed winner

✅ **Comprehensive logging for debugging production issues**
- 6 distinct log events covering all scenarios
- Rich context in every log (orderId, intentId, waitTimeMs, etc.)
- Enables easy debugging of production conflicts

✅ **Metrics for monitoring conflict rates**
- Tracks claim attempts, losses, and loss rate
- Tracks wait times with percentiles
- Enables alerting on high conflict rates

## Testing

Created comprehensive unit tests in:
`backend/src/domains/payments/services/__tests__/gatewayCreation.test.ts`

**Test Coverage**:
- ✅ Track claim won
- ✅ Track claim lost
- ✅ Calculate claim loss rate correctly
- ✅ Track successful wait time
- ✅ Track multiple wait times and calculate average
- ✅ Calculate wait time percentiles (P50, P95, P99)
- ✅ Track different wait outcomes (success, winner_failed, timeout)
- ✅ Include gateway creation metrics in summary

## Design Reference

Implementation follows the design specified in:
- `.kiro/specs/payment-idempotency-fixes/design.md` - Section 5.4 (Gateway Order Creation Flow)
- `.kiro/specs/payment-idempotency-fixes/bugfix.md` - RC-4 (Razorpay Gateway Creation Race)

## Verification

✅ TypeScript compilation: No errors
✅ Code diagnostics: No issues
✅ Implementation matches design specification
✅ All sub-tasks completed
✅ Comprehensive logging added
✅ Metrics tracking implemented
✅ Unit tests created

## Next Steps

The orchestrator should:
1. Mark Task 4 and all sub-tasks as completed
2. Proceed to Task 5 (Idempotent Admin Assignment) or other remaining tasks
3. Run integration tests to verify end-to-end behavior
4. Monitor metrics in production to track conflict rates

## Production Monitoring

Once deployed, monitor these metrics:
- **gateway_creation_claim_loss_rate**: Should be low (<5%) under normal load
- **gateway_creation_wait_time_p95**: Should be <5 seconds under normal conditions
- **gateway_creation_wait_time_p99**: Should be <10 seconds

Alert if:
- Claim loss rate >10% (indicates high concurrency/retries)
- Wait time P95 >10 seconds (indicates slow gateway creation)
- Wait time P99 >20 seconds (indicates potential timeouts)
