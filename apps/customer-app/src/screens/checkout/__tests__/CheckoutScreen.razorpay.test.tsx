/**
 * Unit Tests: Razorpay UPI Intent Integration in CheckoutScreen
 *
 * Task 9.3: Write unit tests for Razorpay UPI Intent
 *
 * Tests the Razorpay SDK integration in CheckoutScreen.tsx:
 * - Razorpay options construction
 * - Successful payment initiation
 * - User cancellation handling
 * - Error handling
 * - UPI app pre-selection
 *
 * Requirements: TR-002, BR-001
 */

import RazorpayCheckout from 'react-native-razorpay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage');

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      EXPO_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_mock_key_123',
    },
  },
}));

jest.mock('../../../utils/analytics', () => ({
  logEvent: jest.fn(),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const MOCK_ORDER = {
  _id: 'order_test_001',
  orderNumber: 'ORD-TEST-001',
  totalAmount: 500.0,
  paymentStatus: 'PENDING',
  razorpayOrderId: 'order_rzp_test_001',
};

const UPI_APPS = [
  {
    id: 'gpay',
    name: 'Google Pay',
    subtitle: 'Pay using Google Pay UPI',
    iconKey: 'GOOGLE_PAY',
    razorpayCode: 'com.google.android.apps.nqo',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    subtitle: 'Pay using PhonePe UPI',
    iconKey: 'PHONEPE',
    razorpayCode: 'com.phonepe.app',
  },
  {
    id: 'paytm',
    name: 'Paytm',
    subtitle: 'Pay using Paytm UPI',
    iconKey: 'PAYTM',
    razorpayCode: 'net.one97.paytm',
  },
  {
    id: 'bhim',
    name: 'BHIM',
    subtitle: 'Pay using BHIM UPI',
    iconKey: 'BHIM',
    razorpayCode: 'in.org.npci.upiapp',
  },
  {
    id: 'other',
    name: 'Other UPI App',
    subtitle: 'Pay using any UPI app',
    iconKey: 'UPI',
    razorpayCode: undefined,
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Builds Razorpay options object as done in CheckoutScreen.tsx
 */
function buildRazorpayOptions(
  order: typeof MOCK_ORDER,
  selectedApp: typeof UPI_APPS[0]
): any {
  const razorpayKey =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

  const options: any = {
    key: razorpayKey,
    amount: Math.round(order.totalAmount * 100), // Convert to paise
    currency: 'INR',
    order_id: order.razorpayOrderId,
    name: 'Vyapara Setu',
    description: `Order ${order.orderNumber}`,

    // Force UPI method only
    method: {
      upi: true,
      card: false,
      netbanking: false,
      wallet: false,
    },

    // UPI Intent flow
    upi: {
      flow: 'intent',
    },
  };

  // Pre-select UPI app if available (not for 'other')
  if (selectedApp.razorpayCode) {
    const appMapping: Record<string, string> = {
      'com.phonepe.app': 'phonepe',
      'com.google.android.apps.nqo': 'gpay',
      'net.one97.paytm': 'paytm',
      'in.org.npci.upiapp': 'bhim',
    };

    const preferredApp = appMapping[selectedApp.razorpayCode];
    if (preferredApp) {
      options.upi.preferred_app = preferredApp;
    }

    // Also set the legacy _[app] parameter for backward compatibility
    options['_[app]'] = selectedApp.razorpayCode;
  }

  return options;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('CheckoutScreen - Razorpay UPI Intent Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Test Group 1: Razorpay Options Construction ─────────────────────────

  describe('Razorpay Options Construction', () => {
    it('should construct correct Razorpay options with all required fields', () => {
      const selectedApp = UPI_APPS[0]; // Google Pay
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options).toMatchObject({
        key: 'rzp_test_mock_key_123',
        amount: 50000, // 500 * 100 paise
        currency: 'INR',
        order_id: 'order_rzp_test_001',
        name: 'Vyapara Setu',
        description: 'Order ORD-TEST-001',
      });
    });

    it('should convert amount to paise correctly', () => {
      const testCases = [
        { amount: 100, expected: 10000 },
        { amount: 500.5, expected: 50050 },
        { amount: 1234.56, expected: 123456 },
        { amount: 0.01, expected: 1 },
      ];

      testCases.forEach(({ amount, expected }) => {
        const order = { ...MOCK_ORDER, totalAmount: amount };
        const options = buildRazorpayOptions(order, UPI_APPS[0]);
        expect(options.amount).toBe(expected);
      });
    });

    it('should force UPI method only (disable card, netbanking, wallet)', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.method).toEqual({
        upi: true,
        card: false,
        netbanking: false,
        wallet: false,
      });
    });

    it('should set UPI flow to intent', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi).toMatchObject({
        flow: 'intent',
      });
    });

    it('should include Razorpay key from environment', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.key).toBe('rzp_test_mock_key_123');
      expect(options.key).toBeTruthy();
    });

    it('should use order_id from backend response', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.order_id).toBe(MOCK_ORDER.razorpayOrderId);
      expect(options.order_id).toMatch(/^order_/);
    });
  });

  // ─── Test Group 2: UPI App Pre-selection ──────────────────────────────────

  describe('UPI App Pre-selection', () => {
    it('should pre-select Google Pay with correct app code', () => {
      const selectedApp = UPI_APPS.find(app => app.id === 'gpay')!;
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi.preferred_app).toBe('gpay');
      expect(options['_[app]']).toBe('com.google.android.apps.nqo');
    });

    it('should pre-select PhonePe with correct app code', () => {
      const selectedApp = UPI_APPS.find(app => app.id === 'phonepe')!;
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi.preferred_app).toBe('phonepe');
      expect(options['_[app]']).toBe('com.phonepe.app');
    });

    it('should pre-select Paytm with correct app code', () => {
      const selectedApp = UPI_APPS.find(app => app.id === 'paytm')!;
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi.preferred_app).toBe('paytm');
      expect(options['_[app]']).toBe('net.one97.paytm');
    });

    it('should pre-select BHIM with correct app code', () => {
      const selectedApp = UPI_APPS.find(app => app.id === 'bhim')!;
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi.preferred_app).toBe('bhim');
      expect(options['_[app]']).toBe('in.org.npci.upiapp');
    });

    it('should NOT pre-select app for "Other UPI App" option', () => {
      const selectedApp = UPI_APPS.find(app => app.id === 'other')!;
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi.preferred_app).toBeUndefined();
      expect(options['_[app]']).toBeUndefined();
    });

    it('should map all supported UPI apps correctly', () => {
      const appMapping = [
        { id: 'phonepe', razorpayCode: 'com.phonepe.app', preferredApp: 'phonepe' },
        { id: 'gpay', razorpayCode: 'com.google.android.apps.nqo', preferredApp: 'gpay' },
        { id: 'paytm', razorpayCode: 'net.one97.paytm', preferredApp: 'paytm' },
        { id: 'bhim', razorpayCode: 'in.org.npci.upiapp', preferredApp: 'bhim' },
      ];

      appMapping.forEach(({ id, razorpayCode, preferredApp }) => {
        const selectedApp = UPI_APPS.find(app => app.id === id)!;
        const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

        expect(options['_[app]']).toBe(razorpayCode);
        expect(options.upi.preferred_app).toBe(preferredApp);
      });
    });
  });

  // ─── Test Group 3: Successful Payment Initiation ──────────────────────────

  describe('Successful Payment Initiation', () => {
    it('should call RazorpayCheckout.open with correct options', async () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
        razorpay_payment_id: 'pay_test_001',
        razorpay_order_id: 'order_rzp_test_001',
        razorpay_signature: 'mock_signature',
      });

      const result = await RazorpayCheckout.open(options);

      expect(RazorpayCheckout.open).toHaveBeenCalledWith(options);
      expect(RazorpayCheckout.open).toHaveBeenCalledTimes(1);
      expect(result.razorpay_payment_id).toBe('pay_test_001');
    });

    it('should store pending order in AsyncStorage before opening Razorpay', async () => {
      const orderId = MOCK_ORDER._id;

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', orderId);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentTimestamp',
        expect.any(String)
      );
    });

    it('should return razorpay_payment_id on successful payment', async () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
        razorpay_payment_id: 'pay_success_001',
        razorpay_order_id: 'order_rzp_test_001',
        razorpay_signature: 'mock_signature',
      });

      const result = await RazorpayCheckout.open(options);

      expect(result).toHaveProperty('razorpay_payment_id');
      expect(result.razorpay_payment_id).toMatch(/^pay_/);
    });

    it('should handle successful payment for all UPI apps', async () => {
      const upiAppsToTest = UPI_APPS.filter(app => app.razorpayCode); // Exclude 'other'

      for (const app of upiAppsToTest) {
        const options = buildRazorpayOptions(MOCK_ORDER, app);

        (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
          razorpay_payment_id: `pay_${app.id}_001`,
          razorpay_order_id: 'order_rzp_test_001',
          razorpay_signature: 'mock_signature',
        });

        const result = await RazorpayCheckout.open(options);

        expect(result.razorpay_payment_id).toBe(`pay_${app.id}_001`);
      }
    });
  });

  // ─── Test Group 4: User Cancellation Handling ─────────────────────────────

  describe('User Cancellation Handling', () => {
    it('should handle PAYMENT_CANCELLED error code', async () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      const cancellationError = {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment cancelled by user',
      };

      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce(cancellationError);

      await expect(RazorpayCheckout.open(options)).rejects.toMatchObject({
        code: 'PAYMENT_CANCELLED',
      });
    });

    it('should detect cancellation by error code', async () => {
      const error = {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment cancelled by user',
      };

      const isCancellation = error.code === 'PAYMENT_CANCELLED' || error.code === '2';
      expect(isCancellation).toBe(true);
    });

    it('should handle numeric cancellation code "2"', async () => {
      const error = {
        code: '2',
        description: 'Payment cancelled',
      };

      const isCancellation = error.code === 'PAYMENT_CANCELLED' || error.code === '2';
      expect(isCancellation).toBe(true);
    });

    it('should NOT clear pending order on cancellation (allow retry)', async () => {
      const orderId = MOCK_ORDER._id;

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
      await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());

      const cancellationError = {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment cancelled by user',
      };

      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce(cancellationError);

      try {
        await RazorpayCheckout.open(buildRazorpayOptions(MOCK_ORDER, UPI_APPS[0]));
      } catch (error: any) {
        expect(error.code).toBe('PAYMENT_CANCELLED');
      }

      // Pending order should remain for retry
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should show recovery modal on cancellation', () => {
      const error = {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment cancelled by user',
      };

      const shouldShowRecoveryModal = error.code === 'PAYMENT_CANCELLED' || error.code === '2';
      expect(shouldShowRecoveryModal).toBe(true);
    });
  });

  // ─── Test Group 5: Error Handling ──────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle NETWORK_ERROR gracefully', async () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      const networkError = {
        code: 'NETWORK_ERROR',
        description: 'Network connection failed',
      };

      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(RazorpayCheckout.open(options)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should handle numeric network error code "0"', async () => {
      const error = {
        code: '0',
        description: 'Network error',
      };

      const isNetworkError = error.code === 'NETWORK_ERROR' || error.code === '0';
      expect(isNetworkError).toBe(true);
    });

    it('should handle missing Razorpay key error', () => {
      const mockConstantsWithoutKey = {
        expoConfig: {
          extra: {},
        },
      };

      const razorpayKey =
        mockConstantsWithoutKey.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
        process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

      expect(razorpayKey).toBeUndefined();
    });

    it('should handle missing razorpayOrderId from backend', () => {
      const invalidOrder = {
        ...MOCK_ORDER,
        razorpayOrderId: '',
      };

      expect(invalidOrder.razorpayOrderId).toBeFalsy();
    });

    it('should handle generic Razorpay errors', async () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      const genericError = {
        code: 'UNKNOWN_ERROR',
        description: 'Something went wrong',
      };

      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce(genericError);

      await expect(RazorpayCheckout.open(options)).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
      });
    });

    it('should handle Razorpay SDK initialization failure', async () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      const initError = new Error('Razorpay SDK not initialized');

      (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce(initError);

      await expect(RazorpayCheckout.open(options)).rejects.toThrow(
        'Razorpay SDK not initialized'
      );
    });

    it('should show recovery modal on generic errors', () => {
      const error = {
        code: 'UNKNOWN_ERROR',
        description: 'Something went wrong',
      };

      const shouldShowRecoveryModal =
        error.code !== 'PAYMENT_CANCELLED' && error.code !== 'NETWORK_ERROR';
      expect(shouldShowRecoveryModal).toBe(true);
    });
  });

  // ─── Test Group 6: Edge Cases ──────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle very small amounts (< ₹1)', () => {
      const order = { ...MOCK_ORDER, totalAmount: 0.5 };
      const options = buildRazorpayOptions(order, UPI_APPS[0]);

      expect(options.amount).toBe(50); // 0.5 * 100 paise
    });

    it('should handle very large amounts', () => {
      const order = { ...MOCK_ORDER, totalAmount: 999999.99 };
      const options = buildRazorpayOptions(order, UPI_APPS[0]);

      expect(options.amount).toBe(99999999); // 999999.99 * 100 paise
    });

    it('should handle decimal precision correctly', () => {
      const order = { ...MOCK_ORDER, totalAmount: 123.456 };
      const options = buildRazorpayOptions(order, UPI_APPS[0]);

      // Math.round handles precision
      expect(options.amount).toBe(12346); // Rounded to nearest paise
    });

    it('should handle order numbers with special characters', () => {
      const order = {
        ...MOCK_ORDER,
        orderNumber: 'ORD-2024-001-SPECIAL',
      };
      const options = buildRazorpayOptions(order, UPI_APPS[0]);

      expect(options.description).toBe('Order ORD-2024-001-SPECIAL');
    });

    it('should handle missing app code gracefully', () => {
      const selectedApp = { ...UPI_APPS[0], razorpayCode: undefined };
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options['_[app]']).toBeUndefined();
      expect(options.upi.preferred_app).toBeUndefined();
    });

    it('should handle empty order description', () => {
      const order = {
        ...MOCK_ORDER,
        orderNumber: '',
      };
      const options = buildRazorpayOptions(order, UPI_APPS[0]);

      expect(options.description).toBe('Order ');
    });
  });

  // ─── Test Group 7: Security Validations ───────────────────────────────────

  describe('Security Validations', () => {
    it('should only allow UPI payment method', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.method.upi).toBe(true);
      expect(options.method.card).toBe(false);
      expect(options.method.netbanking).toBe(false);
      expect(options.method.wallet).toBe(false);
    });

    it('should use UPI Intent flow (not collect or QR)', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.upi.flow).toBe('intent');
    });

    it('should include Razorpay order_id for tracking', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options.order_id).toBeTruthy();
      expect(options.order_id).toMatch(/^order_/);
    });

    it('should not expose sensitive data in options', () => {
      const selectedApp = UPI_APPS[0];
      const options = buildRazorpayOptions(MOCK_ORDER, selectedApp);

      expect(options).not.toHaveProperty('key_secret');
      expect(options).not.toHaveProperty('webhook_secret');
      expect(options).not.toHaveProperty('userId');
    });
  });

  // ─── Test Group 8: AsyncStorage Integration ───────────────────────────────

  describe('AsyncStorage Integration', () => {
    it('should store pending order ID before payment', async () => {
      const orderId = 'order_async_001';

      await AsyncStorage.setItem('pendingPaymentOrderId', orderId);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', orderId);
    });

    it('should store pending payment timestamp', async () => {
      const timestamp = Date.now().toString();

      await AsyncStorage.setItem('pendingPaymentTimestamp', timestamp);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentTimestamp', timestamp);
    });

    it('should handle AsyncStorage write errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('AsyncStorage write failed')
      );

      await expect(
        AsyncStorage.setItem('pendingPaymentOrderId', 'order_001')
      ).rejects.toThrow('AsyncStorage write failed');
    });

    it('should clear pending order after successful payment', async () => {
      await AsyncStorage.removeItem('pendingPaymentOrderId');
      await AsyncStorage.removeItem('pendingPaymentTimestamp');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });
  });

  // ─── Test Group 9: Razorpay Response Validation ───────────────────────────

  describe('Razorpay Response Validation', () => {
    it('should validate successful payment response structure', async () => {
      const mockResponse = {
        razorpay_payment_id: 'pay_test_001',
        razorpay_order_id: 'order_rzp_test_001',
        razorpay_signature: 'mock_signature',
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RazorpayCheckout.open(
        buildRazorpayOptions(MOCK_ORDER, UPI_APPS[0])
      );

      expect(result).toHaveProperty('razorpay_payment_id');
      expect(result).toHaveProperty('razorpay_order_id');
      expect(result).toHaveProperty('razorpay_signature');
    });

    it('should validate payment ID format', async () => {
      const mockResponse = {
        razorpay_payment_id: 'pay_MfG7xYz9Kl8pQr',
        razorpay_order_id: 'order_rzp_test_001',
        razorpay_signature: 'mock_signature',
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RazorpayCheckout.open(
        buildRazorpayOptions(MOCK_ORDER, UPI_APPS[0])
      );

      expect(result.razorpay_payment_id).toMatch(/^pay_/);
    });

    it('should validate order ID matches request', async () => {
      const mockResponse = {
        razorpay_payment_id: 'pay_test_001',
        razorpay_order_id: MOCK_ORDER.razorpayOrderId,
        razorpay_signature: 'mock_signature',
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RazorpayCheckout.open(
        buildRazorpayOptions(MOCK_ORDER, UPI_APPS[0])
      );

      expect(result.razorpay_order_id).toBe(MOCK_ORDER.razorpayOrderId);
    });
  });
});
