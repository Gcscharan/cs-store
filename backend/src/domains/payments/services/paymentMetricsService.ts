import { logger } from '../../../utils/logger';

/**
 * Payment Metrics Tracking Service
 * 
 * Tracks key metrics for UPI payment flow observability:
 * - Payment success rate
 * - Average verification time
 * - Polling attempts distribution
 * - Webhook delivery rate
 * 
 * Requirements: NFR-004 (Observability)
 * 
 * Note: This is a lightweight in-memory metrics tracker.
 * For production, consider integrating with a proper metrics system
 * like Prometheus, DataDog, or CloudWatch.
 */

interface PaymentMetrics {
  // Payment success rate
  totalPaymentAttempts: number;
  successfulPayments: number;
  failedPayments: number;
  
  // Verification time tracking
  verificationTimes: number[]; // in milliseconds
  
  // Polling attempts distribution
  pollingAttempts: number[]; // number of attempts per payment
  
  // Webhook delivery tracking
  webhooksReceived: number;
  webhooksExpected: number;
  
  // Gateway creation tracking (Task 4.3)
  gatewayCreationClaimsTotal: number;
  gatewayCreationClaimLossesTotal: number;
  gatewayCreationWaitTimes: number[]; // in milliseconds
  
  // Idempotency tracking (Task 8.1)
  orderCreationAttemptsTotal: number;
  orderCreationIdempotentReturnsTotal: number;
  orderCreationCartHashConflictsTotal: number;
  finalizationAttemptsTotal: number;
  finalizationConflictsTotal: number;
  adminAssignmentAttemptsTotal: number;
  adminAssignmentConflictsTotal: number;
}

class PaymentMetricsService {
  private metrics: PaymentMetrics = {
    totalPaymentAttempts: 0,
    successfulPayments: 0,
    failedPayments: 0,
    verificationTimes: [],
    pollingAttempts: [],
    webhooksReceived: 0,
    webhooksExpected: 0,
    gatewayCreationClaimsTotal: 0,
    gatewayCreationClaimLossesTotal: 0,
    gatewayCreationWaitTimes: [],
    orderCreationAttemptsTotal: 0,
    orderCreationIdempotentReturnsTotal: 0,
    orderCreationCartHashConflictsTotal: 0,
    finalizationAttemptsTotal: 0,
    finalizationConflictsTotal: 0,
    adminAssignmentAttemptsTotal: 0,
    adminAssignmentConflictsTotal: 0,
  };

  /**
   * Track payment confirmation latency — time from order creation to PAID.
   * Enables SLA alerting: webhook delay > 2 min, polling > 10%, reconciliation > 1%.
   */
  trackPaymentLatency(data: {
    orderId: string;
    createdAt: Date;
    confirmedAt: Date;
    source: 'WEBHOOK' | 'POLLING' | 'RECONCILIATION';
  }): void {
    const latencyMs = data.confirmedAt.getTime() - data.createdAt.getTime();

    logger.metrics('payment_latency', latencyMs, {
      orderId: data.orderId,
      latencyMs,
      latencySeconds: Math.round(latencyMs / 1000),
      source: data.source,
    });

    // SLA breach alerts
    if (data.source === 'WEBHOOK' && latencyMs > 2 * 60_000) {
      logger.warn('[PaymentMetrics][SLA_BREACH] Webhook confirmation > 2 min', {
        orderId: data.orderId,
        latencyMs,
      });
    }
    if (data.source === 'POLLING') {
      logger.info('[PaymentMetrics][POLLING_USED] Payment confirmed via polling (webhook may be delayed)', {
        orderId: data.orderId,
        latencyMs,
      });
    }
    if (data.source === 'RECONCILIATION') {
      logger.warn('[PaymentMetrics][RECONCILIATION_USED] Payment confirmed via reconciliation (webhook missed)', {
        orderId: data.orderId,
        latencyMs,
      });
    }
  }

  /**
   * Track a payment attempt initiated
   */
  trackPaymentAttempt(data: {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
  }): void {
    this.metrics.totalPaymentAttempts++;
    
    logger.metrics('payment_attempt', this.metrics.totalPaymentAttempts, {
      orderId: data.orderId,
      razorpayOrderId: data.razorpayOrderId,
      amount: data.amount,
    });
  }

  /**
   * Track a successful payment verification
   */
  trackPaymentSuccess(data: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    verificationTimeMs: number;
    verificationMethod: 'polling' | 'webhook';
    pollingAttempts?: number;
  }): void {
    this.metrics.successfulPayments++;
    this.metrics.verificationTimes.push(data.verificationTimeMs);
    
    if (data.pollingAttempts !== undefined) {
      this.metrics.pollingAttempts.push(data.pollingAttempts);
    }
    
    // Keep only last 1000 entries to prevent memory bloat
    if (this.metrics.verificationTimes.length > 1000) {
      this.metrics.verificationTimes = this.metrics.verificationTimes.slice(-1000);
    }
    if (this.metrics.pollingAttempts.length > 1000) {
      this.metrics.pollingAttempts = this.metrics.pollingAttempts.slice(-1000);
    }
    
    logger.metrics('payment_success', this.metrics.successfulPayments, {
      orderId: data.orderId,
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      verificationTimeMs: data.verificationTimeMs,
      verificationMethod: data.verificationMethod,
      pollingAttempts: data.pollingAttempts,
      successRate: this.getPaymentSuccessRate(),
    });
  }

  /**
   * Track a failed payment
   */
  trackPaymentFailure(data: {
    orderId: string;
    razorpayOrderId?: string;
    reason: string;
  }): void {
    this.metrics.failedPayments++;
    
    logger.metrics('payment_failure', this.metrics.failedPayments, {
      orderId: data.orderId,
      razorpayOrderId: data.razorpayOrderId,
      reason: data.reason,
      successRate: this.getPaymentSuccessRate(),
    });
  }

  /**
   * Track webhook received
   */
  trackWebhookReceived(data: {
    eventType: string;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
  }): void {
    this.metrics.webhooksReceived++;
    
    logger.metrics('webhook_received', this.metrics.webhooksReceived, {
      eventType: data.eventType,
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      deliveryRate: this.getWebhookDeliveryRate(),
    });
  }

  /**
   * Track expected webhook (when payment is captured)
   */
  trackWebhookExpected(data: {
    orderId: string;
    razorpayOrderId: string;
  }): void {
    this.metrics.webhooksExpected++;
    
    logger.metrics('webhook_expected', this.metrics.webhooksExpected, {
      orderId: data.orderId,
      razorpayOrderId: data.razorpayOrderId,
      deliveryRate: this.getWebhookDeliveryRate(),
    });
  }

  /**
   * Get payment success rate (0-100)
   */
  getPaymentSuccessRate(): number {
    if (this.metrics.totalPaymentAttempts === 0) return 0;
    return (this.metrics.successfulPayments / this.metrics.totalPaymentAttempts) * 100;
  }

  /**
   * Get average verification time in milliseconds
   */
  getAverageVerificationTime(): number {
    if (this.metrics.verificationTimes.length === 0) return 0;
    const sum = this.metrics.verificationTimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.verificationTimes.length;
  }

  /**
   * Get verification time percentiles (P50, P95, P99)
   */
  getVerificationTimePercentiles(): {
    p50: number;
    p95: number;
    p99: number;
  } {
    if (this.metrics.verificationTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...this.metrics.verificationTimes].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
    };
  }

  /**
   * Get average polling attempts
   */
  getAveragePollingAttempts(): number {
    if (this.metrics.pollingAttempts.length === 0) return 0;
    const sum = this.metrics.pollingAttempts.reduce((a, b) => a + b, 0);
    return sum / this.metrics.pollingAttempts.length;
  }

  /**
   * Get polling attempts distribution
   */
  getPollingAttemptsDistribution(): Record<number, number> {
    const distribution: Record<number, number> = {};
    
    for (const attempts of this.metrics.pollingAttempts) {
      distribution[attempts] = (distribution[attempts] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Get webhook delivery rate (0-100)
   */
  getWebhookDeliveryRate(): number {
    if (this.metrics.webhooksExpected === 0) return 0;
    return (this.metrics.webhooksReceived / this.metrics.webhooksExpected) * 100;
  }

  /**
   * Get all metrics summary
   */
  getMetricsSummary(): {
    paymentSuccessRate: number;
    totalPaymentAttempts: number;
    successfulPayments: number;
    failedPayments: number;
    averageVerificationTimeMs: number;
    verificationTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    averagePollingAttempts: number;
    pollingAttemptsDistribution: Record<number, number>;
    webhookDeliveryRate: number;
    webhooksReceived: number;
    webhooksExpected: number;
    gatewayCreationClaimsTotal: number;
    gatewayCreationClaimLossesTotal: number;
    gatewayCreationClaimLossRate: number;
    averageGatewayCreationWaitTimeMs: number;
    gatewayCreationWaitTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    orderCreationAttemptsTotal: number;
    orderCreationIdempotentReturnsTotal: number;
    orderCreationIdempotentReturnRate: number;
    orderCreationCartHashConflictsTotal: number;
    orderCreationCartHashConflictRate: number;
    finalizationAttemptsTotal: number;
    finalizationConflictsTotal: number;
    finalizationConflictRate: number;
    adminAssignmentAttemptsTotal: number;
    adminAssignmentConflictsTotal: number;
    adminAssignmentConflictRate: number;
  } {
    return {
      paymentSuccessRate: this.getPaymentSuccessRate(),
      totalPaymentAttempts: this.metrics.totalPaymentAttempts,
      successfulPayments: this.metrics.successfulPayments,
      failedPayments: this.metrics.failedPayments,
      averageVerificationTimeMs: this.getAverageVerificationTime(),
      verificationTimePercentiles: this.getVerificationTimePercentiles(),
      averagePollingAttempts: this.getAveragePollingAttempts(),
      pollingAttemptsDistribution: this.getPollingAttemptsDistribution(),
      webhookDeliveryRate: this.getWebhookDeliveryRate(),
      webhooksReceived: this.metrics.webhooksReceived,
      webhooksExpected: this.metrics.webhooksExpected,
      gatewayCreationClaimsTotal: this.metrics.gatewayCreationClaimsTotal,
      gatewayCreationClaimLossesTotal: this.metrics.gatewayCreationClaimLossesTotal,
      gatewayCreationClaimLossRate: this.getGatewayCreationClaimLossRate(),
      averageGatewayCreationWaitTimeMs: this.getAverageGatewayCreationWaitTime(),
      gatewayCreationWaitTimePercentiles: this.getGatewayCreationWaitTimePercentiles(),
      orderCreationAttemptsTotal: this.metrics.orderCreationAttemptsTotal,
      orderCreationIdempotentReturnsTotal: this.metrics.orderCreationIdempotentReturnsTotal,
      orderCreationIdempotentReturnRate: this.getOrderCreationIdempotentReturnRate(),
      orderCreationCartHashConflictsTotal: this.metrics.orderCreationCartHashConflictsTotal,
      orderCreationCartHashConflictRate: this.getOrderCreationCartHashConflictRate(),
      finalizationAttemptsTotal: this.metrics.finalizationAttemptsTotal,
      finalizationConflictsTotal: this.metrics.finalizationConflictsTotal,
      finalizationConflictRate: this.getFinalizationConflictRate(),
      adminAssignmentAttemptsTotal: this.metrics.adminAssignmentAttemptsTotal,
      adminAssignmentConflictsTotal: this.metrics.adminAssignmentConflictsTotal,
      adminAssignmentConflictRate: this.getAdminAssignmentConflictRate(),
    };
  }

  /**
   * Log metrics summary (call periodically)
   */
  logMetricsSummary(): void {
    const summary = this.getMetricsSummary();
    
    logger.info('[PaymentMetrics] Summary', {
      paymentSuccessRate: `${summary.paymentSuccessRate.toFixed(2)}%`,
      totalAttempts: summary.totalPaymentAttempts,
      successful: summary.successfulPayments,
      failed: summary.failedPayments,
      avgVerificationTime: `${summary.averageVerificationTimeMs.toFixed(0)}ms`,
      verificationP50: `${summary.verificationTimePercentiles.p50.toFixed(0)}ms`,
      verificationP95: `${summary.verificationTimePercentiles.p95.toFixed(0)}ms`,
      verificationP99: `${summary.verificationTimePercentiles.p99.toFixed(0)}ms`,
      avgPollingAttempts: summary.averagePollingAttempts.toFixed(2),
      pollingDistribution: summary.pollingAttemptsDistribution,
      webhookDeliveryRate: `${summary.webhookDeliveryRate.toFixed(2)}%`,
      webhooksReceived: summary.webhooksReceived,
      webhooksExpected: summary.webhooksExpected,
      gatewayCreationClaimsTotal: summary.gatewayCreationClaimsTotal,
      gatewayCreationClaimLossesTotal: summary.gatewayCreationClaimLossesTotal,
      gatewayCreationClaimLossRate: `${summary.gatewayCreationClaimLossRate.toFixed(2)}%`,
      avgGatewayCreationWaitTime: `${summary.averageGatewayCreationWaitTimeMs.toFixed(0)}ms`,
      gatewayCreationWaitP50: `${summary.gatewayCreationWaitTimePercentiles.p50.toFixed(0)}ms`,
      gatewayCreationWaitP95: `${summary.gatewayCreationWaitTimePercentiles.p95.toFixed(0)}ms`,
      gatewayCreationWaitP99: `${summary.gatewayCreationWaitTimePercentiles.p99.toFixed(0)}ms`,
      orderCreationAttemptsTotal: summary.orderCreationAttemptsTotal,
      orderCreationIdempotentReturnsTotal: summary.orderCreationIdempotentReturnsTotal,
      orderCreationIdempotentReturnRate: `${summary.orderCreationIdempotentReturnRate.toFixed(2)}%`,
      orderCreationCartHashConflictsTotal: summary.orderCreationCartHashConflictsTotal,
      orderCreationCartHashConflictRate: `${summary.orderCreationCartHashConflictRate.toFixed(2)}%`,
      finalizationAttemptsTotal: summary.finalizationAttemptsTotal,
      finalizationConflictsTotal: summary.finalizationConflictsTotal,
      finalizationConflictRate: `${summary.finalizationConflictRate.toFixed(2)}%`,
      adminAssignmentAttemptsTotal: summary.adminAssignmentAttemptsTotal,
      adminAssignmentConflictsTotal: summary.adminAssignmentConflictsTotal,
      adminAssignmentConflictRate: `${summary.adminAssignmentConflictRate.toFixed(2)}%`,
    });
  }

  /**
   * Track gateway creation claim attempt (Task 4.3)
   */
  trackGatewayCreationClaim(data: {
    orderId: string;
    intentId: string;
    won: boolean;
  }): void {
    this.metrics.gatewayCreationClaimsTotal++;
    
    if (!data.won) {
      this.metrics.gatewayCreationClaimLossesTotal++;
    }
    
    logger.metrics('gateway_creation_claim', this.metrics.gatewayCreationClaimsTotal, {
      orderId: data.orderId,
      intentId: data.intentId,
      won: data.won,
      claimsTotal: this.metrics.gatewayCreationClaimsTotal,
      claimLossesTotal: this.metrics.gatewayCreationClaimLossesTotal,
      claimLossRate: this.getGatewayCreationClaimLossRate(),
    });
  }

  /**
   * Track gateway creation wait time (Task 4.3)
   */
  trackGatewayCreationWaitTime(data: {
    orderId: string;
    intentId: string;
    waitTimeMs: number;
    outcome: 'success' | 'winner_failed' | 'timeout';
  }): void {
    this.metrics.gatewayCreationWaitTimes.push(data.waitTimeMs);
    
    // Keep only last 1000 entries to prevent memory bloat
    if (this.metrics.gatewayCreationWaitTimes.length > 1000) {
      this.metrics.gatewayCreationWaitTimes = this.metrics.gatewayCreationWaitTimes.slice(-1000);
    }
    
    logger.metrics('gateway_creation_wait_time', data.waitTimeMs, {
      orderId: data.orderId,
      intentId: data.intentId,
      waitTimeMs: data.waitTimeMs,
      outcome: data.outcome,
      avgWaitTimeMs: this.getAverageGatewayCreationWaitTime(),
    });
  }

  /**
   * Get gateway creation claim loss rate (0-100)
   */
  getGatewayCreationClaimLossRate(): number {
    if (this.metrics.gatewayCreationClaimsTotal === 0) return 0;
    return (this.metrics.gatewayCreationClaimLossesTotal / this.metrics.gatewayCreationClaimsTotal) * 100;
  }

  /**
   * Get average gateway creation wait time in milliseconds
   */
  getAverageGatewayCreationWaitTime(): number {
    if (this.metrics.gatewayCreationWaitTimes.length === 0) return 0;
    const sum = this.metrics.gatewayCreationWaitTimes.reduce((a, b) => a + b, 0);
    return sum / this.metrics.gatewayCreationWaitTimes.length;
  }

  /**
   * Get gateway creation wait time percentiles (P50, P95, P99)
   */
  getGatewayCreationWaitTimePercentiles(): {
    p50: number;
    p95: number;
    p99: number;
  } {
    if (this.metrics.gatewayCreationWaitTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...this.metrics.gatewayCreationWaitTimes].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      totalPaymentAttempts: 0,
      successfulPayments: 0,
      failedPayments: 0,
      verificationTimes: [],
      pollingAttempts: [],
      webhooksReceived: 0,
      webhooksExpected: 0,
      gatewayCreationClaimsTotal: 0,
      gatewayCreationClaimLossesTotal: 0,
      gatewayCreationWaitTimes: [],
      orderCreationAttemptsTotal: 0,
      orderCreationIdempotentReturnsTotal: 0,
      orderCreationCartHashConflictsTotal: 0,
      finalizationAttemptsTotal: 0,
      finalizationConflictsTotal: 0,
      adminAssignmentAttemptsTotal: 0,
      adminAssignmentConflictsTotal: 0,
    };
  }

  /**
   * Track order creation attempt (Task 8.1)
   */
  trackOrderCreationAttempt(data: {
    orderId?: string;
    userId: string;
    idempotencyKey: string;
  }): void {
    this.metrics.orderCreationAttemptsTotal++;
    
    logger.metrics('order_creation_attempt', this.metrics.orderCreationAttemptsTotal, {
      orderId: data.orderId,
      userId: data.userId,
      idempotencyKey: data.idempotencyKey,
      attemptsTotal: this.metrics.orderCreationAttemptsTotal,
    });
  }

  /**
   * Track order creation idempotent return (Task 8.1)
   */
  trackOrderCreationIdempotentReturn(data: {
    orderId: string;
    userId: string;
    idempotencyKey: string;
    reason: 'idempotency_key' | 'cart_hash';
  }): void {
    this.metrics.orderCreationIdempotentReturnsTotal++;
    
    if (data.reason === 'cart_hash') {
      this.metrics.orderCreationCartHashConflictsTotal++;
    }
    
    logger.metrics('order_creation_idempotent_return', this.metrics.orderCreationIdempotentReturnsTotal, {
      orderId: data.orderId,
      userId: data.userId,
      idempotencyKey: data.idempotencyKey,
      reason: data.reason,
      idempotentReturnsTotal: this.metrics.orderCreationIdempotentReturnsTotal,
      cartHashConflictsTotal: this.metrics.orderCreationCartHashConflictsTotal,
      idempotentReturnRate: this.getOrderCreationIdempotentReturnRate(),
    });
  }

  /**
   * Track finalization attempt (Task 8.1)
   */
  trackFinalizationAttempt(data: {
    orderId: string;
    confirmedBy: 'WEBHOOK' | 'POLLING' | 'RECONCILIATION';
  }): void {
    this.metrics.finalizationAttemptsTotal++;
    
    logger.metrics('finalization_attempt', this.metrics.finalizationAttemptsTotal, {
      orderId: data.orderId,
      confirmedBy: data.confirmedBy,
      attemptsTotal: this.metrics.finalizationAttemptsTotal,
    });
  }

  /**
   * Track finalization conflict (Task 8.1)
   */
  trackFinalizationConflict(data: {
    orderId: string;
    confirmedBy: 'WEBHOOK' | 'POLLING' | 'RECONCILIATION';
  }): void {
    this.metrics.finalizationConflictsTotal++;
    
    logger.metrics('finalization_conflict', this.metrics.finalizationConflictsTotal, {
      orderId: data.orderId,
      confirmedBy: data.confirmedBy,
      conflictsTotal: this.metrics.finalizationConflictsTotal,
      conflictRate: this.getFinalizationConflictRate(),
    });
  }

  /**
   * Track admin assignment attempt (Task 8.1)
   */
  trackAdminAssignmentAttempt(data: {
    orderId: string;
    adminId?: string;
  }): void {
    this.metrics.adminAssignmentAttemptsTotal++;
    
    logger.metrics('admin_assignment_attempt', this.metrics.adminAssignmentAttemptsTotal, {
      orderId: data.orderId,
      adminId: data.adminId,
      attemptsTotal: this.metrics.adminAssignmentAttemptsTotal,
    });
  }

  /**
   * Track admin assignment conflict (Task 8.1)
   */
  trackAdminAssignmentConflict(data: {
    orderId: string;
    adminId?: string;
  }): void {
    this.metrics.adminAssignmentConflictsTotal++;
    
    logger.metrics('admin_assignment_conflict', this.metrics.adminAssignmentConflictsTotal, {
      orderId: data.orderId,
      adminId: data.adminId,
      conflictsTotal: this.metrics.adminAssignmentConflictsTotal,
      conflictRate: this.getAdminAssignmentConflictRate(),
    });
  }

  /**
   * Get order creation idempotent return rate (0-100)
   */
  getOrderCreationIdempotentReturnRate(): number {
    if (this.metrics.orderCreationAttemptsTotal === 0) return 0;
    return (this.metrics.orderCreationIdempotentReturnsTotal / this.metrics.orderCreationAttemptsTotal) * 100;
  }

  /**
   * Get order creation cart hash conflict rate (0-100)
   */
  getOrderCreationCartHashConflictRate(): number {
    if (this.metrics.orderCreationAttemptsTotal === 0) return 0;
    return (this.metrics.orderCreationCartHashConflictsTotal / this.metrics.orderCreationAttemptsTotal) * 100;
  }

  /**
   * Get finalization conflict rate (0-100)
   */
  getFinalizationConflictRate(): number {
    if (this.metrics.finalizationAttemptsTotal === 0) return 0;
    return (this.metrics.finalizationConflictsTotal / this.metrics.finalizationAttemptsTotal) * 100;
  }

  /**
   * Get admin assignment conflict rate (0-100)
   */
  getAdminAssignmentConflictRate(): number {
    if (this.metrics.adminAssignmentAttemptsTotal === 0) return 0;
    return (this.metrics.adminAssignmentConflictsTotal / this.metrics.adminAssignmentAttemptsTotal) * 100;
  }
}

// Export singleton instance
export const paymentMetricsService = new PaymentMetricsService();

// Log metrics summary every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    paymentMetricsService.logMetricsSummary();
  }, 5 * 60 * 1000); // 5 minutes
}
