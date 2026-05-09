import { paymentMetricsService } from '../paymentMetricsService';

describe('PaymentMetricsService', () => {
  beforeEach(() => {
    // Reset metrics before each test
    paymentMetricsService.reset();
  });

  describe('trackPaymentAttempt', () => {
    it('should increment total payment attempts', () => {
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        amount: 500,
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.totalPaymentAttempts).toBe(1);
    });

    it('should track multiple payment attempts', () => {
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        amount: 500,
      });
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_124',
        razorpayOrderId: 'rzp_order_124',
        amount: 600,
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.totalPaymentAttempts).toBe(2);
    });
  });

  describe('trackPaymentSuccess', () => {
    it('should track successful payment with polling', () => {
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
        verificationTimeMs: 5000,
        verificationMethod: 'polling',
        pollingAttempts: 3,
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.successfulPayments).toBe(1);
      expect(summary.averageVerificationTimeMs).toBe(5000);
      expect(summary.averagePollingAttempts).toBe(3);
    });

    it('should track successful payment with webhook', () => {
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
        verificationTimeMs: 2000,
        verificationMethod: 'webhook',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.successfulPayments).toBe(1);
      expect(summary.averageVerificationTimeMs).toBe(2000);
    });

    it('should calculate average verification time correctly', () => {
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
        verificationTimeMs: 4000,
        verificationMethod: 'polling',
      });
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_124',
        razorpayOrderId: 'rzp_order_124',
        razorpayPaymentId: 'pay_124',
        verificationTimeMs: 6000,
        verificationMethod: 'webhook',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.averageVerificationTimeMs).toBe(5000);
    });
  });

  describe('trackPaymentFailure', () => {
    it('should track failed payment', () => {
      paymentMetricsService.trackPaymentFailure({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        reason: 'payment_failed_in_razorpay',
      });

      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.failedPayments).toBe(1);
    });
  });

  describe('getPaymentSuccessRate', () => {
    it('should return 0 when no attempts', () => {
      const rate = paymentMetricsService.getPaymentSuccessRate();
      expect(rate).toBe(0);
    });

    it('should calculate success rate correctly', () => {
      // Track 3 attempts
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        amount: 500,
      });
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_124',
        razorpayOrderId: 'rzp_order_124',
        amount: 600,
      });
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_125',
        razorpayOrderId: 'rzp_order_125',
        amount: 700,
      });

      // Track 2 successes
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
        verificationTimeMs: 5000,
        verificationMethod: 'polling',
      });
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_124',
        razorpayOrderId: 'rzp_order_124',
        razorpayPaymentId: 'pay_124',
        verificationTimeMs: 6000,
        verificationMethod: 'webhook',
      });

      // Track 1 failure
      paymentMetricsService.trackPaymentFailure({
        orderId: 'order_125',
        razorpayOrderId: 'rzp_order_125',
        reason: 'payment_failed',
      });

      const rate = paymentMetricsService.getPaymentSuccessRate();
      expect(rate).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });
  });

  describe('getVerificationTimePercentiles', () => {
    it('should return zeros when no data', () => {
      const percentiles = paymentMetricsService.getVerificationTimePercentiles();
      expect(percentiles.p50).toBe(0);
      expect(percentiles.p95).toBe(0);
      expect(percentiles.p99).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      // Add 100 verification times
      for (let i = 1; i <= 100; i++) {
        paymentMetricsService.trackPaymentSuccess({
          orderId: `order_${i}`,
          razorpayOrderId: `rzp_order_${i}`,
          razorpayPaymentId: `pay_${i}`,
          verificationTimeMs: i * 100, // 100ms, 200ms, ..., 10000ms
          verificationMethod: 'polling',
        });
      }

      const percentiles = paymentMetricsService.getVerificationTimePercentiles();
      // P50 = 50th percentile = index 50 (0-indexed) = 5100ms
      // P95 = 95th percentile = index 95 (0-indexed) = 9600ms
      // P99 = 99th percentile = index 99 (0-indexed) = 10000ms
      expect(percentiles.p50).toBe(5100);
      expect(percentiles.p95).toBe(9600);
      expect(percentiles.p99).toBe(10000);
    });
  });

  describe('getPollingAttemptsDistribution', () => {
    it('should return empty distribution when no data', () => {
      const distribution = paymentMetricsService.getPollingAttemptsDistribution();
      expect(distribution).toEqual({});
    });

    it('should calculate distribution correctly', () => {
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_1',
        razorpayOrderId: 'rzp_order_1',
        razorpayPaymentId: 'pay_1',
        verificationTimeMs: 5000,
        verificationMethod: 'polling',
        pollingAttempts: 3,
      });
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_2',
        razorpayOrderId: 'rzp_order_2',
        razorpayPaymentId: 'pay_2',
        verificationTimeMs: 6000,
        verificationMethod: 'polling',
        pollingAttempts: 3,
      });
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_3',
        razorpayOrderId: 'rzp_order_3',
        razorpayPaymentId: 'pay_3',
        verificationTimeMs: 10000,
        verificationMethod: 'polling',
        pollingAttempts: 5,
      });

      const distribution = paymentMetricsService.getPollingAttemptsDistribution();
      expect(distribution).toEqual({
        3: 2,
        5: 1,
      });
    });
  });

  describe('trackWebhookReceived and trackWebhookExpected', () => {
    it('should track webhook delivery rate', () => {
      // Track 3 expected webhooks
      paymentMetricsService.trackWebhookExpected({
        orderId: 'order_1',
        razorpayOrderId: 'rzp_order_1',
      });
      paymentMetricsService.trackWebhookExpected({
        orderId: 'order_2',
        razorpayOrderId: 'rzp_order_2',
      });
      paymentMetricsService.trackWebhookExpected({
        orderId: 'order_3',
        razorpayOrderId: 'rzp_order_3',
      });

      // Track 2 received webhooks
      paymentMetricsService.trackWebhookReceived({
        eventType: 'PAYMENT_CAPTURED',
        razorpayOrderId: 'rzp_order_1',
        razorpayPaymentId: 'pay_1',
      });
      paymentMetricsService.trackWebhookReceived({
        eventType: 'PAYMENT_CAPTURED',
        razorpayOrderId: 'rzp_order_2',
        razorpayPaymentId: 'pay_2',
      });

      const rate = paymentMetricsService.getWebhookDeliveryRate();
      expect(rate).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });

    it('should return 0 when no webhooks expected', () => {
      const rate = paymentMetricsService.getWebhookDeliveryRate();
      expect(rate).toBe(0);
    });
  });

  describe('getMetricsSummary', () => {
    it('should return complete metrics summary', () => {
      // Track some data
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        amount: 500,
      });
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
        verificationTimeMs: 5000,
        verificationMethod: 'polling',
        pollingAttempts: 3,
      });
      paymentMetricsService.trackWebhookExpected({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
      });
      paymentMetricsService.trackWebhookReceived({
        eventType: 'PAYMENT_CAPTURED',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
      });

      const summary = paymentMetricsService.getMetricsSummary();

      expect(summary).toHaveProperty('paymentSuccessRate');
      expect(summary).toHaveProperty('totalPaymentAttempts');
      expect(summary).toHaveProperty('successfulPayments');
      expect(summary).toHaveProperty('failedPayments');
      expect(summary).toHaveProperty('averageVerificationTimeMs');
      expect(summary).toHaveProperty('verificationTimePercentiles');
      expect(summary).toHaveProperty('averagePollingAttempts');
      expect(summary).toHaveProperty('pollingAttemptsDistribution');
      expect(summary).toHaveProperty('webhookDeliveryRate');
      expect(summary).toHaveProperty('webhooksReceived');
      expect(summary).toHaveProperty('webhooksExpected');

      expect(summary.paymentSuccessRate).toBe(100);
      expect(summary.totalPaymentAttempts).toBe(1);
      expect(summary.successfulPayments).toBe(1);
      expect(summary.webhookDeliveryRate).toBe(100);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      // Track some data
      paymentMetricsService.trackPaymentAttempt({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        amount: 500,
      });
      paymentMetricsService.trackPaymentSuccess({
        orderId: 'order_123',
        razorpayOrderId: 'rzp_order_123',
        razorpayPaymentId: 'pay_123',
        verificationTimeMs: 5000,
        verificationMethod: 'polling',
      });

      // Reset
      paymentMetricsService.reset();

      // Verify all metrics are reset
      const summary = paymentMetricsService.getMetricsSummary();
      expect(summary.totalPaymentAttempts).toBe(0);
      expect(summary.successfulPayments).toBe(0);
      expect(summary.failedPayments).toBe(0);
      expect(summary.averageVerificationTimeMs).toBe(0);
      expect(summary.webhooksReceived).toBe(0);
      expect(summary.webhooksExpected).toBe(0);
    });
  });
});
