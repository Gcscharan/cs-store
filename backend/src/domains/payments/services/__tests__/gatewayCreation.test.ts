/**
 * Gateway Creation Tests - Task 4 Verification
 * 
 * Tests for strict gateway order creation with wait loop and metrics
 */

import { paymentMetricsService } from '../paymentMetricsService';

describe('Gateway Creation Metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    paymentMetricsService.reset();
  });

  describe('trackGatewayCreationClaim', () => {
    it('should track claim won', () => {
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_123',
        intentId: 'intent_123',
        won: true,
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.gatewayCreationClaimsTotal).toBe(1);
      expect(summary.gatewayCreationClaimLossesTotal).toBe(0);
      expect(summary.gatewayCreationClaimLossRate).toBe(0);
    });

    it('should track claim lost', () => {
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_123',
        intentId: 'intent_123',
        won: false,
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.gatewayCreationClaimsTotal).toBe(1);
      expect(summary.gatewayCreationClaimLossesTotal).toBe(1);
      expect(summary.gatewayCreationClaimLossRate).toBe(100);
    });

    it('should calculate claim loss rate correctly', () => {
      // 3 wins, 1 loss = 25% loss rate
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_1',
        intentId: 'intent_1',
        won: true,
      });
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_2',
        intentId: 'intent_2',
        won: true,
      });
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_3',
        intentId: 'intent_3',
        won: true,
      });
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_4',
        intentId: 'intent_4',
        won: false,
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.gatewayCreationClaimsTotal).toBe(4);
      expect(summary.gatewayCreationClaimLossesTotal).toBe(1);
      expect(summary.gatewayCreationClaimLossRate).toBe(25);
    });
  });

  describe('trackGatewayCreationWaitTime', () => {
    it('should track successful wait time', () => {
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_123',
        intentId: 'intent_123',
        waitTimeMs: 1500,
        outcome: 'success',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.averageGatewayCreationWaitTimeMs).toBe(1500);
    });

    it('should track multiple wait times and calculate average', () => {
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_1',
        intentId: 'intent_1',
        waitTimeMs: 1000,
        outcome: 'success',
      });
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_2',
        intentId: 'intent_2',
        waitTimeMs: 2000,
        outcome: 'success',
      });
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_3',
        intentId: 'intent_3',
        waitTimeMs: 3000,
        outcome: 'success',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.averageGatewayCreationWaitTimeMs).toBe(2000);
    });

    it('should calculate wait time percentiles', () => {
      // Add 100 wait times from 100ms to 10000ms
      for (let i = 1; i <= 100; i++) {
        paymentMetricsService.trackGatewayCreationWaitTime({
          orderId: `order_${i}`,
          intentId: `intent_${i}`,
          waitTimeMs: i * 100,
          outcome: 'success',
        });
      }

      const summary = paymentMetricsService.getMetricsSummary();
      const percentiles = summary.gatewayCreationWaitTimePercentiles;
      
      // P50 should be around 5000ms (50th percentile)
      expect(percentiles.p50).toBeGreaterThanOrEqual(4900);
      expect(percentiles.p50).toBeLessThanOrEqual(5100);
      
      // P95 should be around 9500ms (95th percentile)
      expect(percentiles.p95).toBeGreaterThanOrEqual(9400);
      expect(percentiles.p95).toBeLessThanOrEqual(9600);
      
      // P99 should be around 9900ms (99th percentile)
      expect(percentiles.p99).toBeGreaterThanOrEqual(9800);
      expect(percentiles.p99).toBeLessThanOrEqual(10000);
    });

    it('should track different wait outcomes', () => {
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_1',
        intentId: 'intent_1',
        waitTimeMs: 1000,
        outcome: 'success',
      });
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_2',
        intentId: 'intent_2',
        waitTimeMs: 5000,
        outcome: 'winner_failed',
      });
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_3',
        intentId: 'intent_3',
        waitTimeMs: 30000,
        outcome: 'timeout',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.averageGatewayCreationWaitTimeMs).toBe(12000);
    });
  });

  describe('getMetricsSummary', () => {
    it('should include gateway creation metrics in summary', () => {
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_1',
        intentId: 'intent_1',
        won: true,
      });
      paymentMetricsService.trackGatewayCreationClaim({
        orderId: 'order_2',
        intentId: 'intent_2',
        won: false,
      });
      paymentMetricsService.trackGatewayCreationWaitTime({
        orderId: 'order_2',
        intentId: 'intent_2',
        waitTimeMs: 2500,
        outcome: 'success',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      
      expect(summary).toHaveProperty('gatewayCreationClaimsTotal');
      expect(summary).toHaveProperty('gatewayCreationClaimLossesTotal');
      expect(summary).toHaveProperty('gatewayCreationClaimLossRate');
      expect(summary).toHaveProperty('averageGatewayCreationWaitTimeMs');
      expect(summary).toHaveProperty('gatewayCreationWaitTimePercentiles');
      
      expect(summary.gatewayCreationClaimsTotal).toBe(2);
      expect(summary.gatewayCreationClaimLossesTotal).toBe(1);
      expect(summary.gatewayCreationClaimLossRate).toBe(50);
      expect(summary.averageGatewayCreationWaitTimeMs).toBe(2500);
    });
  });
});
