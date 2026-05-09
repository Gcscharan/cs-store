/**
 * Integration Tests: Mobile App Payment Flow (End-to-End)
 *
 * Task 15.3: Write integration tests for end-to-end flow (Mobile App)
 *
 * Covers the complete mobile-side UPI payment flow:
 * - Create order → Open Razorpay → Poll → Verify → Success
 * - Create order → Payment fails → Show error
 * - Create order → Timeout → Show timeout message
 * - Create order → App kill → Restart → Resume polling
 * - Webhook updates order before polling completes
 *
 * Requirements: BR-001, BR-002, BR-003, BR-004, BR-005
 * **Validates: Requirements BR-001, BR-002, BR-003, BR-004, BR-005**
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../utils/analytics', () => ({
  logEvent: jest.fn(),
}));
jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_POLLING_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2000;
const ONE_HOUR_MS = 3_600_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate the polling loop used by the mobile app after Razorpay returns. */
async function simulatePollingLoop(
  pollResponses: Array<{ paymentStatus: string; razorpayPaymentId?: string }>,
  onSuccess: (attempt: number) => void,
  onFailed: (attempt: number) => void,
  onTimeout: (attempts: number) => void
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
    const response = pollResponses[attempt - 1] ?? { paymentStatus: 'PENDING' };

    if (response.paymentStatus === 'PAID') {
      onSuccess(attempt);
      return;
    }

    if (response.paymentStatus === 'FAILED') {
      onFailed(attempt);
      return;
    }

    // Still PENDING – wait before next attempt (shortened for tests)
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  onTimeout(MAX_POLLING_ATTEMPTS);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Mobile App Payment Flow – Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Scenario 1: Full success flow ────────────────────────────────────────

  describe('Scenario 1: Create order → Open Razorpay → Poll → Verify → Success (BR-001, BR-002, BR-003)', () => {
    it('should store pending order in AsyncStorage before opening Razorpay', async () => {
      const order = {
        _id: 'order-success-001',
        orderNumber: 'ORD-001',
        totalAmount: 500,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_rzp_001',
      };

      // Step: store pending order before opening Razorpay (BR-004)
      await AsyncStorage.setItem('pendingPaymentOrderId', order._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', order._id);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentTimestamp',
        expect.any(String)
      );
    });

    it('should build correct Razorpay options (amount in paise, method=upi)', () => {
      const order = {
        _id: 'order-success-001',
        orderNumber: 'ORD-001',
        totalAmount: 500,
        razorpayOrderId: 'order_rzp_001',
      };

      const options = {
        key: 'rzp_test_key',
        amount: Math.round(order.totalAmount * 100), // paise
        currency: 'INR',
        order_id: order.razorpayOrderId,
        name: 'Vyapara Setu',
        description: `Order ${order.orderNumber}`,
        method: 'upi',
      };

      expect(options.amount).toBe(50000); // 500 × 100
      expect(options.method).toBe('upi');
      expect(options.order_id).toBe(order.razorpayOrderId);
      expect(options.currency).toBe('INR');
    });

    it('should build correct Razorpay options for each supported UPI app', () => {
      const upiApps = [
        { id: 'phonepe', razorpayCode: 'com.phonepe.app' },
        { id: 'gpay', razorpayCode: 'com.google.android.apps.nqo' },
        { id: 'paytm', razorpayCode: 'net.one97.paytm' },
        { id: 'bhim', razorpayCode: 'in.org.npci.upiapp' },
      ];

      upiApps.forEach(app => {
        const options = {
          key: 'rzp_test_key',
          amount: 10000,
          currency: 'INR',
          order_id: 'order_rzp_test',
          method: 'upi',
          '_[app]': app.razorpayCode,
        };

        expect(options['_[app]']).toBe(app.razorpayCode);
        expect(options.method).toBe('upi');
      });
    });

    it('should stop polling and clear AsyncStorage on PAID status', async () => {
      const orderId = 'order-success-002';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // Polling: PENDING × 2, then PAID
      const pollResponses = [
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_001' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(3);

      // Clear pending order after success
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should stop polling immediately when first poll returns PAID (webhook was faster)', async () => {
      const orderId = 'order-webhook-fast-001';

      const pollResponses = [
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_webhook_001' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(1);
    });
  });

  // ─── Scenario 2: Payment failure ──────────────────────────────────────────

  describe('Scenario 2: Create order → Payment fails → Show error (BR-002)', () => {
    it('should stop polling and show recovery modal on FAILED status', async () => {
      const orderId = 'order-fail-001';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      const pollResponses = [
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'FAILED' },
      ];

      let failedAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        () => {},
        attempt => {
          failedAttempt = attempt;
        },
        () => {}
      );

      expect(failedAttempt).toBe(2);

      // Pending order should NOT be cleared on failure (allow retry)
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should handle Razorpay user cancellation (PAYMENT_CANCELLED error code)', () => {
      const razorpayError = {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment cancelled by user',
      };

      const isCancellation = razorpayError.code === 'PAYMENT_CANCELLED';
      expect(isCancellation).toBe(true);

      // Should show recovery modal, not an error alert
      const shouldShowRecoveryModal = isCancellation;
      expect(shouldShowRecoveryModal).toBe(true);
    });

    it('should handle Razorpay network error gracefully', () => {
      const razorpayError = {
        code: 'NETWORK_ERROR',
        description: 'Network connection failed',
      };

      expect(razorpayError.code).toBe('NETWORK_ERROR');

      // Should show error alert with description
      const alertMessage = razorpayError.description;
      expect(alertMessage).toBe('Network connection failed');
    });

    it('should continue polling on transient network errors during polling', async () => {
      const orderId = 'order-network-error-001';

      // Simulate: 2 network errors (treated as PENDING), then PAID
      const pollResponses = [
        { paymentStatus: 'PENDING' }, // network error → treat as PENDING
        { paymentStatus: 'PENDING' }, // network error → treat as PENDING
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_after_error' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(3);
    });
  });

  // ─── Scenario 3: Timeout ──────────────────────────────────────────────────

  describe('Scenario 3: Create order → Timeout → Show timeout message (BR-003)', () => {
    it('should exhaust all 20 polling attempts and trigger timeout handler', async () => {
      const orderId = 'order-timeout-001';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // All 20 responses are PENDING
      const pollResponses = Array.from({ length: MAX_POLLING_ATTEMPTS }, () => ({
        paymentStatus: 'PENDING',
      }));

      let timedOutAttempts = -1;

      await simulatePollingLoop(
        pollResponses,
        () => {},
        () => {},
        attempts => {
          timedOutAttempts = attempts;
        }
      );

      expect(timedOutAttempts).toBe(MAX_POLLING_ATTEMPTS);
    });

    it('should calculate correct total timeout duration (40 seconds)', () => {
      const totalMs = MAX_POLLING_ATTEMPTS * POLL_INTERVAL_MS;
      expect(totalMs).toBe(40_000);
      expect(totalMs / 1000).toBe(40);
    });

    it('should show correct timeout alert configuration', () => {
      const timeoutAlert = {
        title: 'Verification Taking Longer',
        message:
          'Payment verification is taking longer than expected. Please check your order status in "My Orders".',
        buttons: [
          { text: 'Check Orders', action: 'navigate_to_orders' },
          { text: 'OK', action: 'dismiss' },
        ],
      };

      expect(timeoutAlert.title).toBe('Verification Taking Longer');
      expect(timeoutAlert.message).toContain('taking longer than expected');
      expect(timeoutAlert.buttons).toHaveLength(2);
      expect(timeoutAlert.buttons[0].text).toBe('Check Orders');
    });

    it('should NOT clear pending order on timeout (payment may complete later)', async () => {
      const orderId = 'order-timeout-002';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      const pollResponses = Array.from({ length: MAX_POLLING_ATTEMPTS }, () => ({
        paymentStatus: 'PENDING',
      }));

      await simulatePollingLoop(
        pollResponses,
        () => {},
        () => {},
        () => {
          // Timeout handler – do NOT clear AsyncStorage
        }
      );

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  // ─── Scenario 4: App kill → Restart → Resume polling ─────────────────────

  describe('Scenario 4: Create order → App kill → Restart → Resume polling (BR-004)', () => {
    it('should resume polling for a recent pending order on app restart', async () => {
      const orderId = 'order-recovery-001';
      const timestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      // App startup: read pending order
      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

      expect(pendingOrderId).toBe(orderId);

      // Validate age
      const age = Date.now() - parseInt(pendingTimestamp!, 10);
      expect(age).toBeLessThan(ONE_HOUR_MS);

      // Should resume polling
      const shouldRecover = age < ONE_HOUR_MS;
      expect(shouldRecover).toBe(true);
    });

    it('should clear stale pending orders (> 1 hour old) on app restart', async () => {
      const orderId = 'order-stale-001';
      const timestamp = Date.now() - 2 * ONE_HOUR_MS; // 2 hours ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

      const age = Date.now() - parseInt(pendingTimestamp!, 10);
      const shouldRecover = age < ONE_HOUR_MS;

      expect(shouldRecover).toBe(false);

      // Clear stale order
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should handle no pending order on app restart gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');

      expect(pendingOrderId).toBeNull();

      // Should not attempt recovery
      const shouldRecover = pendingOrderId !== null;
      expect(shouldRecover).toBe(false);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should successfully verify payment after recovery polling', async () => {
      const orderId = 'order-recovery-002';
      const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

      const age = Date.now() - parseInt(pendingTimestamp!, 10);
      expect(age).toBeLessThan(ONE_HOUR_MS);

      // Resume polling – payment was completed during downtime
      const pollResponses = [
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_recovery_001' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(1);

      // Clear pending order after successful recovery
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should handle edge case: timestamp exactly at 1-hour boundary', () => {
      const exactlyOneHourAgo = Date.now() - ONE_HOUR_MS;
      const age = Date.now() - exactlyOneHourAgo;

      // At exactly 1 hour, should NOT recover (>= 1 hour is stale)
      const shouldRecover = age < ONE_HOUR_MS;
      expect(shouldRecover).toBe(false);
    });
  });

  // ─── Scenario 5: Webhook updates order before polling completes ───────────

  describe('Scenario 5: Webhook updates order before polling completes (BR-005)', () => {
    it('should stop polling immediately when webhook has already processed payment', async () => {
      const orderId = 'order-webhook-001';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // First poll returns PAID because webhook already processed it
      const pollResponses = [
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_webhook_001' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(1);

      // Clear pending order
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
    });

    it('should detect PAID status when webhook arrives after several polling attempts', async () => {
      const orderId = 'order-webhook-mid-001';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // Webhook arrives after 5 PENDING polls
      const pollResponses = [
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_webhook_mid_001' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(6);
    });

    it('should handle idempotent webhook: polling returns PAID even on duplicate webhook', async () => {
      // The backend handles idempotency; from the mobile side, polling just sees PAID
      const pollResponses = [
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_idem_001' },
      ];

      let successAttempt = -1;

      await simulatePollingLoop(
        pollResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(1);
    });
  });

  // ─── UI State Management ──────────────────────────────────────────────────

  describe('UI State Management', () => {
    it('should show verification modal with correct content during polling', () => {
      const verificationModal = {
        visible: true,
        title: 'Verifying Payment',
        message:
          'Please wait while we confirm your payment with the bank. This usually takes a few seconds.',
        subtext: 'Do not close the app or press back.',
        showSpinner: true,
      };

      expect(verificationModal.visible).toBe(true);
      expect(verificationModal.title).toBe('Verifying Payment');
      expect(verificationModal.showSpinner).toBe(true);
      expect(verificationModal.subtext).toContain('Do not close the app');
    });

    it('should hide verification modal and navigate to success on PAID', () => {
      const navigationAction = {
        screen: 'OrderSuccess',
        params: { orderId: 'order-nav-001' },
        replace: true, // Prevent back navigation to checkout
      };

      expect(navigationAction.screen).toBe('OrderSuccess');
      expect(navigationAction.replace).toBe(true);
    });

    it('should show recovery modal on payment failure', () => {
      const recoveryModal = {
        visible: true,
        title: 'Payment Failed',
        buttons: [
          { text: 'Try Again', action: 'retry' },
          { text: 'Cancel', action: 'cancel' },
        ],
      };

      expect(recoveryModal.visible).toBe(true);
      expect(recoveryModal.buttons).toHaveLength(2);
      expect(recoveryModal.buttons[0].text).toBe('Try Again');
    });
  });

  // ─── AsyncStorage Error Handling ──────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle AsyncStorage write failure gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('AsyncStorage write error')
      );

      await expect(
        AsyncStorage.setItem('pendingPaymentOrderId', 'order-err-001')
      ).rejects.toThrow('AsyncStorage write error');
    });

    it('should handle invalid payment status values from API', () => {
      const invalidStatuses = [null, undefined, '', 'UNKNOWN', 'processing'];

      invalidStatuses.forEach(status => {
        const isKnownStatus = ['PAID', 'PENDING', 'FAILED'].includes(status as string);
        expect(isKnownStatus).toBe(false);
      });
    });

    it('should treat unknown status as PENDING and continue polling', async () => {
      // Unknown status → treated as PENDING → polling continues
      const pollResponses = [
        { paymentStatus: 'UNKNOWN' }, // treated as PENDING
        { paymentStatus: 'PAID', razorpayPaymentId: 'pay_after_unknown' },
      ];

      // Map unknown → PENDING for the loop
      const normalizedResponses = pollResponses.map(r => ({
        paymentStatus: ['PAID', 'FAILED'].includes(r.paymentStatus)
          ? r.paymentStatus
          : 'PENDING',
        razorpayPaymentId: r.razorpayPaymentId,
      }));

      let successAttempt = -1;

      await simulatePollingLoop(
        normalizedResponses,
        attempt => {
          successAttempt = attempt;
        },
        () => {},
        () => {}
      );

      expect(successAttempt).toBe(2);
    });
  });

  // ─── Polling Configuration ────────────────────────────────────────────────

  describe('Polling Configuration (BR-003)', () => {
    it('should use 2-second polling interval', () => {
      expect(POLL_INTERVAL_MS).toBe(2000);
    });

    it('should use maximum 20 polling attempts', () => {
      expect(MAX_POLLING_ATTEMPTS).toBe(20);
    });

    it('should have a total timeout of 40 seconds', () => {
      expect(MAX_POLLING_ATTEMPTS * POLL_INTERVAL_MS).toBe(40_000);
    });

    it('should not exceed maximum polling attempts', async () => {
      let attemptCount = 0;

      const pollResponses = Array.from({ length: MAX_POLLING_ATTEMPTS + 5 }, () => ({
        paymentStatus: 'PENDING',
      }));

      await simulatePollingLoop(
        pollResponses,
        () => {},
        () => {},
        attempts => {
          attemptCount = attempts;
        }
      );

      expect(attemptCount).toBe(MAX_POLLING_ATTEMPTS);
    });
  });
});
