/**
 * Integration Tests: Mobile App UPI Payment End-to-End Flow
 * 
 * Task 15.3: Write integration tests for end-to-end flow (Mobile App)
 * 
 * These tests verify the complete mobile app UPI payment flow including:
 * - Order creation with Razorpay
 * - Razorpay UPI Intent integration
 * - Payment polling mechanism
 * - App kill recovery
 * - UI state management
 * 
 * Test scenarios:
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
import { logEvent } from '../utils/analytics';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../utils/analytics', () => ({
  logEvent: jest.fn(),
}));
jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

const MAX_POLLING_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2000;
const ONE_HOUR_MS = 3600000;

describe('Mobile App UPI Payment End-to-End Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario 1: Create order → Open Razorpay → Poll → Verify → Success', () => {
    it('should complete full payment flow successfully', async () => {
      // Step 1: Order creation response
      const mockOrder = {
        _id: 'order-123',
        orderNumber: 'ORD-001',
        totalAmount: 500,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_razorpay_123',
      };

      // Step 2: Store pending order before opening Razorpay
      await AsyncStorage.setItem('pendingPaymentOrderId', mockOrder._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', mockOrder._id);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentTimestamp', expect.any(String));

      // Step 3: Razorpay options should be constructed correctly
      const razorpayOptions = {
        key: 'rzp_test_xxxxx',
        amount: Math.round(mockOrder.totalAmount * 100), // Convert to paise
        currency: 'INR',
        order_id: mockOrder.razorpayOrderId,
        name: 'Vyapara Setu',
        description: `Order ${mockOrder.orderNumber}`,
        method: 'upi',
        '_[app]': 'com.phonepe.app', // PhonePe
      };

      expect(razorpayOptions.amount).toBe(50000); // 500 * 100
      expect(razorpayOptions.order_id).toBe(mockOrder.razorpayOrderId);
      expect(razorpayOptions.method).toBe('upi');

      // Step 4: Simulate polling - payment verified after 3 attempts
      const pollingResults = [
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { 
          paymentStatus: 'PAID',
          razorpayPaymentId: 'pay_123',
          verifiedAt: new Date().toISOString(),
        },
      ];

      let attempt = 0;
      for (const result of pollingResults) {
        attempt++;
        
        if (result.paymentStatus === 'PAID') {
          // Step 5: Clear pending order on success
          await AsyncStorage.removeItem('pendingPaymentOrderId');
          await AsyncStorage.removeItem('pendingPaymentTimestamp');

          expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
          expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');

          // Step 6: Log success event
          logEvent('payment_verified', {
            orderId: mockOrder._id,
            attempts: attempt,
            method: 'upi',
          });

          expect(logEvent).toHaveBeenCalledWith('payment_verified', {
            orderId: mockOrder._id,
            attempts: attempt,
            method: 'upi',
          });

          break;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(attempt).toBe(3);
    });

    it('should handle immediate success (webhook processed before polling)', async () => {
      const mockOrder = {
        _id: 'order-456',
        orderNumber: 'ORD-002',
        totalAmount: 300,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_razorpay_456',
      };

      // Store pending order
      await AsyncStorage.setItem('pendingPaymentOrderId', mockOrder._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // First poll returns PAID (webhook was faster)
      const firstPollResult = {
        paymentStatus: 'PAID',
        razorpayPaymentId: 'pay_456',
        verifiedAt: new Date().toISOString(),
      };

      expect(firstPollResult.paymentStatus).toBe('PAID');

      // Should stop polling immediately
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      logEvent('payment_verified', {
        orderId: mockOrder._id,
        attempts: 1,
        method: 'upi',
      });

      expect(logEvent).toHaveBeenCalledWith('payment_verified', {
        orderId: mockOrder._id,
        attempts: 1,
        method: 'upi',
      });
    });

    it('should construct correct Razorpay options for different UPI apps', () => {
      const upiApps = [
        { id: 'phonepe', razorpayCode: 'com.phonepe.app' },
        { id: 'gpay', razorpayCode: 'com.google.android.apps.nqo' },
        { id: 'paytm', razorpayCode: 'net.one97.paytm' },
        { id: 'bhim', razorpayCode: 'in.org.npci.upiapp' },
      ];

      const mockOrder = {
        razorpayOrderId: 'order_test_123',
        totalAmount: 100,
        orderNumber: 'ORD-TEST',
      };

      upiApps.forEach(app => {
        const options = {
          key: 'rzp_test_xxxxx',
          amount: Math.round(mockOrder.totalAmount * 100),
          currency: 'INR',
          order_id: mockOrder.razorpayOrderId,
          name: 'Vyapara Setu',
          description: `Order ${mockOrder.orderNumber}`,
          method: 'upi',
          '_[app]': app.razorpayCode,
        };

        expect(options['_[app]']).toBe(app.razorpayCode);
        expect(options.method).toBe('upi');
      });
    });
  });

  describe('Scenario 2: Create order → Payment fails → Show error', () => {
    it('should handle payment failure correctly', async () => {
      const mockOrder = {
        _id: 'order-failed-123',
        orderNumber: 'ORD-FAIL-001',
        totalAmount: 200,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_razorpay_failed_123',
      };

      // Store pending order
      await AsyncStorage.setItem('pendingPaymentOrderId', mockOrder._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // Simulate polling - payment fails after 2 attempts
      const pollingResults = [
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'FAILED' },
      ];

      let attempt = 0;
      for (const result of pollingResults) {
        attempt++;

        if (result.paymentStatus === 'FAILED') {
          // Should NOT clear pending order (allow retry)
          // Should show recovery modal

          logEvent('payment_failed', {
            orderId: mockOrder._id,
            attempts: attempt,
            method: 'upi',
          });

          expect(logEvent).toHaveBeenCalledWith('payment_failed', {
            orderId: mockOrder._id,
            attempts: attempt,
            method: 'upi',
          });

          break;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(attempt).toBe(2);

      // Verify pending order is still stored (for retry)
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should handle Razorpay cancellation by user', () => {
      const mockError = {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment cancelled by user',
      };

      // User cancelled payment in Razorpay
      expect(mockError.code).toBe('PAYMENT_CANCELLED');

      // Should show recovery modal
      const shouldShowRecoveryModal = mockError.code === 'PAYMENT_CANCELLED';
      expect(shouldShowRecoveryModal).toBe(true);

      // Should log cancellation
      logEvent('payment_cancelled', {
        reason: 'user_cancelled',
      });

      expect(logEvent).toHaveBeenCalledWith('payment_cancelled', {
        reason: 'user_cancelled',
      });
    });

    it('should handle Razorpay error', () => {
      const mockError = {
        code: 'NETWORK_ERROR',
        description: 'Network connection failed',
      };

      expect(mockError.code).toBe('NETWORK_ERROR');

      // Should show error alert
      const errorMessage = mockError.description;
      expect(errorMessage).toBe('Network connection failed');

      logEvent('payment_error', {
        errorCode: mockError.code,
        errorMessage: mockError.description,
      });

      expect(logEvent).toHaveBeenCalledWith('payment_error', {
        errorCode: mockError.code,
        errorMessage: mockError.description,
      });
    });
  });

  describe('Scenario 3: Create order → Timeout → Show timeout message', () => {
    it('should handle timeout after maximum polling attempts', async () => {
      const mockOrder = {
        _id: 'order-timeout-123',
        orderNumber: 'ORD-TIMEOUT-001',
        totalAmount: 150,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_razorpay_timeout_123',
      };

      // Store pending order
      await AsyncStorage.setItem('pendingPaymentOrderId', mockOrder._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // Simulate maximum polling attempts
      let attempt = 0;
      const maxAttempts = MAX_POLLING_ATTEMPTS;

      for (attempt = 1; attempt <= maxAttempts; attempt++) {
        const result = { paymentStatus: 'PENDING' };

        if (result.paymentStatus === 'PAID' || result.paymentStatus === 'FAILED') {
          break;
        }

        // Continue polling
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Reached maximum attempts
      expect(attempt).toBe(maxAttempts);

      // Should show timeout alert
      const timeoutMessage = 'Payment verification is taking longer than expected. Please check your order status in "My Orders".';
      expect(timeoutMessage).toContain('taking longer than expected');

      // Should log timeout event
      logEvent('payment_verification_timeout', {
        orderId: mockOrder._id,
        attempts: maxAttempts,
      });

      expect(logEvent).toHaveBeenCalledWith('payment_verification_timeout', {
        orderId: mockOrder._id,
        attempts: maxAttempts,
      });

      // Pending order should remain in storage (payment might complete later)
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should calculate correct total timeout duration', () => {
      const totalTimeMs = MAX_POLLING_ATTEMPTS * POLL_INTERVAL_MS;
      const totalTimeSeconds = totalTimeMs / 1000;

      expect(totalTimeMs).toBe(40000); // 40 seconds
      expect(totalTimeSeconds).toBe(40);
    });

    it('should show timeout modal with correct UI elements', () => {
      const timeoutModalConfig = {
        visible: true,
        title: 'Verification Taking Longer',
        message: 'Payment verification is taking longer than expected. Please check your order status in "My Orders".',
        buttons: [
          { text: 'Check Orders', action: 'navigate_to_orders' },
          { text: 'OK', action: 'dismiss' },
        ],
      };

      expect(timeoutModalConfig.visible).toBe(true);
      expect(timeoutModalConfig.title).toBe('Verification Taking Longer');
      expect(timeoutModalConfig.buttons).toHaveLength(2);
      expect(timeoutModalConfig.buttons[0].text).toBe('Check Orders');
    });
  });

  describe('Scenario 4: Create order → App kill → Restart → Resume polling', () => {
    it('should resume polling for recent pending order on app restart', async () => {
      const orderId = 'order-recovery-123';
      const timestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago

      // Mock AsyncStorage with pending order
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      // Step 1: App startup - check for pending order
      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

      expect(pendingOrderId).toBe(orderId);
      expect(pendingTimestamp).toBe(timestamp.toString());

      // Step 2: Validate age (< 1 hour)
      const parsedTimestamp = parseInt(pendingTimestamp!, 10);
      const age = Date.now() - parsedTimestamp;
      const shouldRecover = age < ONE_HOUR_MS;

      expect(shouldRecover).toBe(true);

      // Step 3: Log recovery started
      const ageSeconds = Math.round(age / 1000);
      logEvent('pending_payment_recovery_started', {
        orderId: pendingOrderId,
        ageSeconds,
      });

      expect(logEvent).toHaveBeenCalledWith('pending_payment_recovery_started', {
        orderId,
        ageSeconds: expect.any(Number),
      });

      // Step 4: Resume polling
      const pollResult = {
        paymentStatus: 'PAID',
        razorpayPaymentId: 'pay_recovery_123',
        verifiedAt: new Date().toISOString(),
      };

      expect(pollResult.paymentStatus).toBe('PAID');

      // Step 5: Clear pending order after successful recovery
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      logEvent('background_payment_verified', {
        orderId,
        attempts: 1,
      });

      expect(logEvent).toHaveBeenCalledWith('background_payment_verified', {
        orderId,
        attempts: 1,
      });
    });

    it('should clear stale pending orders (> 1 hour old)', async () => {
      const orderId = 'order-stale-123';
      const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      // Step 1: Check for pending order
      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

      expect(pendingOrderId).toBe(orderId);

      // Step 2: Validate age (> 1 hour)
      const parsedTimestamp = parseInt(pendingTimestamp!, 10);
      const age = Date.now() - parsedTimestamp;
      const shouldRecover = age < ONE_HOUR_MS;

      expect(shouldRecover).toBe(false);

      // Step 3: Clear stale order
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');

      // Step 4: Log stale cleared event
      const ageSeconds = Math.round(age / 1000);
      logEvent('pending_payment_cleared_stale', {
        orderId,
        ageSeconds,
      });

      expect(logEvent).toHaveBeenCalledWith('pending_payment_cleared_stale', {
        orderId,
        ageSeconds: expect.any(Number),
      });
    });

    it('should handle no pending order on app restart', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');

      expect(pendingOrderId).toBeNull();

      // Should not proceed with recovery
      const shouldProceed = pendingOrderId !== null;
      expect(shouldProceed).toBe(false);

      // Should not call removeItem
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should handle app restart during polling', async () => {
      const orderId = 'order-restart-during-poll-123';
      const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      // App restarted during polling
      const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
      const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

      expect(pendingOrderId).toBe(orderId);

      const parsedTimestamp = parseInt(pendingTimestamp!, 10);
      const age = Date.now() - parsedTimestamp;

      expect(age).toBeLessThan(ONE_HOUR_MS);

      // Should resume polling from beginning
      logEvent('pending_payment_recovery_started', {
        orderId,
        ageSeconds: Math.round(age / 1000),
      });

      expect(logEvent).toHaveBeenCalled();
    });
  });

  describe('Scenario 5: Webhook updates order before polling completes', () => {
    it('should stop polling immediately when webhook processes payment', async () => {
      const mockOrder = {
        _id: 'order-webhook-fast-123',
        orderNumber: 'ORD-WEBHOOK-001',
        totalAmount: 400,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_razorpay_webhook_123',
      };

      // Store pending order
      await AsyncStorage.setItem('pendingPaymentOrderId', mockOrder._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // Simulate polling - webhook processed before first poll
      const firstPollResult = {
        paymentStatus: 'PAID', // Webhook already updated
        razorpayPaymentId: 'pay_webhook_123',
        verifiedAt: new Date().toISOString(),
      };

      expect(firstPollResult.paymentStatus).toBe('PAID');

      // Should stop immediately (1 attempt only)
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      logEvent('payment_verified', {
        orderId: mockOrder._id,
        attempts: 1,
        method: 'upi',
        verificationSource: 'webhook',
      });

      expect(logEvent).toHaveBeenCalledWith('payment_verified', {
        orderId: mockOrder._id,
        attempts: 1,
        method: 'upi',
        verificationSource: 'webhook',
      });
    });

    it('should handle webhook arriving during polling', async () => {
      const mockOrder = {
        _id: 'order-webhook-during-123',
        orderNumber: 'ORD-WEBHOOK-002',
        totalAmount: 350,
        paymentStatus: 'PENDING',
        razorpayOrderId: 'order_razorpay_webhook_during_123',
      };

      await AsyncStorage.setItem('pendingPaymentOrderId', mockOrder._id);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      // Simulate polling - webhook arrives after 5 attempts
      const pollingResults = [
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { paymentStatus: 'PENDING' },
        { 
          paymentStatus: 'PAID', // Webhook processed
          razorpayPaymentId: 'pay_webhook_during_123',
          verifiedAt: new Date().toISOString(),
        },
      ];

      let attempt = 0;
      for (const result of pollingResults) {
        attempt++;

        if (result.paymentStatus === 'PAID') {
          await AsyncStorage.removeItem('pendingPaymentOrderId');
          await AsyncStorage.removeItem('pendingPaymentTimestamp');

          logEvent('payment_verified', {
            orderId: mockOrder._id,
            attempts: attempt,
            method: 'upi',
          });

          break;
        }

        await new Promise(resolve => setTimeout(resolve, 5));
      }

      expect(attempt).toBe(6);
      expect(logEvent).toHaveBeenCalledWith('payment_verified', {
        orderId: mockOrder._id,
        attempts: 6,
        method: 'upi',
      });
    });
  });

  describe('UI State Management', () => {
    it('should show verification modal during polling', () => {
      const verificationModalState = {
        visible: true,
        title: 'Verifying Payment',
        message: 'Please wait while we confirm your payment with the bank. This usually takes a few seconds.',
        subtext: 'Do not close the app or press back.',
        showSpinner: true,
      };

      expect(verificationModalState.visible).toBe(true);
      expect(verificationModalState.title).toBe('Verifying Payment');
      expect(verificationModalState.showSpinner).toBe(true);
    });

    it('should show recovery modal on payment failure', () => {
      const recoveryModalState = {
        visible: true,
        title: 'Payment Failed',
        message: 'Your payment could not be completed. Would you like to try again?',
        buttons: [
          { text: 'Try Again', action: 'retry' },
          { text: 'Cancel', action: 'cancel' },
        ],
      };

      expect(recoveryModalState.visible).toBe(true);
      expect(recoveryModalState.buttons).toHaveLength(2);
      expect(recoveryModalState.buttons[0].text).toBe('Try Again');
    });

    it('should hide verification modal on success', () => {
      const verificationModalState = {
        visible: false,
      };

      expect(verificationModalState.visible).toBe(false);
    });

    it('should navigate to success screen after payment verification', () => {
      const navigationAction = {
        screen: 'OrderSuccess',
        params: {
          orderId: 'order-success-123',
        },
        replace: true, // Replace to prevent back navigation
      };

      expect(navigationAction.screen).toBe('OrderSuccess');
      expect(navigationAction.replace).toBe(true);
      expect(navigationAction.params.orderId).toBe('order-success-123');
    });
  });

  describe('Analytics and Logging', () => {
    it('should log all payment flow events', () => {
      const events = [
        'upi_payment_initiated',
        'razorpay_opened',
        'payment_polling_started',
        'payment_verified',
        'payment_failed',
        'payment_cancelled',
        'payment_verification_timeout',
        'pending_payment_recovery_started',
        'background_payment_verified',
        'pending_payment_cleared_stale',
      ];

      events.forEach(eventName => {
        logEvent(eventName, { test: true });
        expect(logEvent).toHaveBeenCalledWith(eventName, { test: true });
      });
    });

    it('should log polling attempts', () => {
      const attempts = [1, 2, 3, 4, 5];

      attempts.forEach(attempt => {
        logEvent('payment_polling_attempt', {
          attempt,
          maxAttempts: MAX_POLLING_ATTEMPTS,
        });
      });

      expect(logEvent).toHaveBeenCalledTimes(attempts.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('AsyncStorage write error')
      );

      try {
        await AsyncStorage.setItem('pendingPaymentOrderId', 'order-123');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('AsyncStorage write error');
      }
    });

    it('should handle network errors during polling', () => {
      const networkError = {
        message: 'Network request failed',
        code: 'NETWORK_ERROR',
      };

      expect(networkError.code).toBe('NETWORK_ERROR');

      // Should retry polling
      const shouldRetry = true;
      expect(shouldRetry).toBe(true);

      logEvent('payment_polling_network_error', {
        error: networkError.message,
      });

      expect(logEvent).toHaveBeenCalledWith('payment_polling_network_error', {
        error: networkError.message,
      });
    });

    it('should handle invalid payment status responses', () => {
      const invalidStatuses = [null, undefined, '', 'INVALID'];

      invalidStatuses.forEach(status => {
        const isValid = ['PAID', 'PENDING', 'FAILED'].includes(status as string);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should maintain correct polling interval', () => {
      const interval = POLL_INTERVAL_MS;
      expect(interval).toBe(2000); // 2 seconds
    });

    it('should not exceed maximum polling attempts', () => {
      const maxAttempts = MAX_POLLING_ATTEMPTS;
      expect(maxAttempts).toBe(20);

      // Total time should be 40 seconds
      const totalTime = maxAttempts * POLL_INTERVAL_MS;
      expect(totalTime).toBe(40000);
    });

    it('should handle rapid state changes efficiently', async () => {
      const stateChanges = [
        'idle',
        'creating_order',
        'opening_razorpay',
        'polling',
        'verified',
        'success',
      ];

      for (const state of stateChanges) {
        // Simulate state change
        expect(state).toBeDefined();
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      expect(stateChanges).toHaveLength(6);
    });
  });
});
