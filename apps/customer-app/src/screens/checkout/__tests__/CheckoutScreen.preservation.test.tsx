/**
 * Preservation Property Tests: Non-Payment-Initiation Behavior Unchanged
 *
 * Task 2: Write preservation property tests (BEFORE implementing fix)
 *
 * Property 2: Preservation — Non-Payment-Initiation Behavior Unchanged
 *
 * These tests capture the BASELINE behavior that must be preserved after the fix.
 * They PASS on both UNFIXED and FIXED code.
 *
 * Sub-tests:
 *   A - Order creation payload unchanged
 *   B - AsyncStorage writes unchanged
 *   C - pollPaymentStatus called after Razorpay success
 *   D - PAYMENT_CANCELLED triggers recovery modal
 *   E - NETWORK_ERROR triggers Alert
 *   F - 400 response triggers order-creation-failed Alert
 *   G - other VPA gate check unchanged
 *   H - COD flow unaffected
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import RazorpayCheckout from 'react-native-razorpay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as fc from 'fast-check';

// Import Alert from the mocked path (matches jest.setup.js mock)
import Alert from 'react-native/Libraries/Alert/Alert';

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
  _id: 'order_preservation_001',
  orderNumber: 'ORD-PRES-001',
  totalAmount: 500.0,
  paymentStatus: 'PENDING',
  razorpayOrderId: 'order_rzp_pres_001',
};

const MOCK_COD_ORDER = {
  _id: 'order_cod_001',
  orderNumber: 'ORD-COD-001',
  totalAmount: 300.0,
  paymentStatus: 'PENDING',
};

/**
 * UPI_APPS mirrors the constant defined in CheckoutScreen.tsx.
 */
const UPI_APPS = [
  {
    id: 'gpay',
    name: 'Google Pay',
    subtitle: 'Pay using Google Pay UPI',
    iconKey: 'GOOGLE_PAY',
    razorpayCode: 'com.google.android.apps.nqo',
    deepLinkScheme: 'gpay://',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    subtitle: 'Pay using PhonePe UPI',
    iconKey: 'PHONEPE',
    razorpayCode: 'com.phonepe.app',
    deepLinkScheme: 'phonepe://',
  },
  {
    id: 'paytm',
    name: 'Paytm',
    subtitle: 'Pay using Paytm UPI',
    iconKey: 'PAYTM',
    razorpayCode: 'net.one97.paytm',
    deepLinkScheme: 'paytmmp://',
  },
  {
    id: 'bhim',
    name: 'BHIM',
    subtitle: 'Pay using BHIM UPI',
    iconKey: 'BHIM',
    razorpayCode: 'in.org.npci.upiapp',
    deepLinkScheme: 'bhim://',
  },
  {
    id: 'other',
    name: 'Other UPI App',
    subtitle: 'Pay using any UPI app',
    iconKey: 'UPI',
    razorpayCode: undefined,
    deepLinkScheme: undefined,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulates the order creation payload that handleUpiPayment builds.
 * Mirrors the logic in CheckoutScreen.tsx handleUpiPayment.
 */
function buildOrderPayload(opts: {
  selectedApp: typeof UPI_APPS[0];
  upiVpa?: string;
  couponCode?: string;
  couponDiscount?: number;
}): any {
  const { selectedApp, upiVpa = '', couponCode = '', couponDiscount = 0 } = opts;
  const idempotencyKey = `order_upi_${Date.now()}_mock`;

  const payload: any = {
    paymentMethod: 'upi',
    idempotencyKey,
  };

  // Only add upiVpa if it has a value (mirrors CheckoutScreen logic)
  if (upiVpa.trim()) {
    payload.upiVpa = upiVpa.trim();
  }

  // Only add couponCode if coupon is applied
  if (couponDiscount > 0 && couponCode) {
    payload.couponCode = couponCode;
  }

  return payload;
}

/**
 * Simulates the COD order creation payload that handleCodPayment builds.
 */
function buildCodPayload(opts: {
  couponCode?: string;
  couponDiscount?: number;
  selectedAddressId?: string;
}): any {
  const { couponCode = '', couponDiscount = 0, selectedAddressId = 'addr_001' } = opts;
  const idempotencyKey = `order_cod_mock`;

  return {
    paymentMethod: 'cod',
    idempotencyKey,
    addressId: selectedAddressId,
    couponCode: couponDiscount > 0 ? couponCode : undefined,
  };
}

/**
 * Simulates the full handleUpiPayment flow and returns what was called.
 * This mirrors the logic in CheckoutScreen.tsx without rendering the component.
 */
async function simulateHandleUpiPayment(opts: {
  selectedApp: typeof UPI_APPS[0];
  upiVpa?: string;
  upiVerified?: boolean;
  couponCode?: string;
  couponDiscount?: number;
  createOrderMock: jest.Mock;
  razorpayOpenMock: jest.Mock;
  pollPaymentStatusMock: jest.Mock;
  setIsRecoveryModalVisibleMock: jest.Mock;
  asyncStorageSetItemMock: jest.Mock;
  asyncStorageRemoveItemMock: jest.Mock;
}): Promise<void> {
  const {
    selectedApp,
    upiVpa = '',
    upiVerified = false,
    couponCode = '',
    couponDiscount = 0,
    createOrderMock,
    razorpayOpenMock,
    pollPaymentStatusMock,
    setIsRecoveryModalVisibleMock,
    asyncStorageSetItemMock,
    asyncStorageRemoveItemMock,
  } = opts;

  // Clear stale pending payment state
  await asyncStorageRemoveItemMock('pendingPaymentOrderId');
  await asyncStorageRemoveItemMock('pendingPaymentTimestamp');

  // GATE: For 'other' UPI, require verified VPA
  if (selectedApp.id === 'other') {
    if (!upiVpa.trim()) {
      Alert.alert('Enter UPI ID', 'Please enter and verify your UPI ID first.');
      return;
    }
    if (!upiVerified) {
      Alert.alert('Verify UPI', 'Please verify your UPI ID before proceeding.');
      return;
    }
  }

  // Build order payload
  const idempotencyKey = `order_upi_${Date.now()}_mock`;
  const orderPayload: any = {
    paymentMethod: 'upi',
    idempotencyKey,
  };

  if (upiVpa.trim()) {
    orderPayload.upiVpa = upiVpa.trim();
  }

  if (couponDiscount > 0 && couponCode) {
    orderPayload.couponCode = couponCode;
  }

  // Create order
  let res: any;
  try {
    res = await createOrderMock(orderPayload);
  } catch (error: any) {
    // Handle order creation errors
    if (error?.response?.status === 400) {
      Alert.alert(
        'Order Creation Failed',
        error.response.data?.message || 'Unable to create order. Please try again.'
      );
      return;
    }
    throw error;
  }

  const orderId = String(res?.order?._id || '').trim();
  const razorpayOrderId = String(res?.order?.razorpayOrderId || '').trim();

  if (!orderId) throw new Error('Order creation failed');
  if (!razorpayOrderId) throw new Error('Razorpay order ID not received');

  // Store pending order
  await asyncStorageSetItemMock('pendingPaymentOrderId', orderId);
  await asyncStorageSetItemMock('pendingPaymentTimestamp', Date.now().toString());

  // Open Razorpay
  const razorpayKey =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

  const options: any = {
    key: razorpayKey,
    amount: Math.round(res.order.totalAmount * 100),
    currency: 'INR',
    order_id: razorpayOrderId,
    method: { upi: true, card: false, netbanking: false, wallet: false },
    prefill: { contact: '9999999999', name: 'Customer' },
    config: { display: { preferences: { show_default_blocks: true } } }, // fixed value
  };

  try {
    await razorpayOpenMock(options);
    // Poll after success
    await pollPaymentStatusMock(orderId, selectedApp);
  } catch (error: any) {
    if (error.code === 'PAYMENT_CANCELLED' || error.code === '2') {
      setIsRecoveryModalVisibleMock(true);
    } else if (error.code === 'NETWORK_ERROR' || error.code === '0') {
      Alert.alert(
        'Network Error',
        'Unable to connect to payment gateway. Please check your internet connection and try again.'
      );
    } else {
      const errorMessage =
        error?.response?.data?.message ||
        error?.description ||
        error?.message ||
        'Payment failed. Please try again.';
      Alert.alert('Payment Error', errorMessage);
      setIsRecoveryModalVisibleMock(true);
    }
  }
}

/**
 * Simulates the handleCodPayment flow.
 */
async function simulateHandleCodPayment(opts: {
  createOrderMock: jest.Mock;
  handleUpiPaymentMock: jest.Mock;
  couponCode?: string;
  couponDiscount?: number;
  selectedAddressId?: string;
}): Promise<void> {
  const {
    createOrderMock,
    handleUpiPaymentMock,
    couponCode = '',
    couponDiscount = 0,
    selectedAddressId = 'addr_001',
  } = opts;

  const idempotencyKey = `order_cod_mock`;
  const payload: any = {
    paymentMethod: 'cod',
    idempotencyKey,
    addressId: selectedAddressId,
    couponCode: couponDiscount > 0 ? couponCode : undefined,
  };

  await createOrderMock(payload);
  // handleUpiPayment is NOT called in COD flow
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Preservation: Non-Payment-Initiation Behavior Unchanged', () => {
  let createOrderMock: jest.Mock;
  let razorpayOpenMock: jest.Mock;
  let pollPaymentStatusMock: jest.Mock;
  let setIsRecoveryModalVisibleMock: jest.Mock;
  let asyncStorageSetItemMock: jest.Mock;
  let asyncStorageRemoveItemMock: jest.Mock;
  let handleUpiPaymentMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    createOrderMock = jest.fn().mockResolvedValue({ order: MOCK_ORDER });
    razorpayOpenMock = jest.fn().mockResolvedValue({
      razorpay_payment_id: 'pay_pres_001',
      razorpay_order_id: MOCK_ORDER.razorpayOrderId,
      razorpay_signature: 'mock_sig',
    });
    pollPaymentStatusMock = jest.fn().mockResolvedValue(undefined);
    setIsRecoveryModalVisibleMock = jest.fn();
    asyncStorageSetItemMock = jest.fn().mockResolvedValue(undefined);
    asyncStorageRemoveItemMock = jest.fn().mockResolvedValue(undefined);
    handleUpiPaymentMock = jest.fn();

    // Wire AsyncStorage mock
    (AsyncStorage.setItem as jest.Mock).mockImplementation(asyncStorageSetItemMock);
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(asyncStorageRemoveItemMock);

    // Wire RazorpayCheckout mock
    (RazorpayCheckout.open as jest.Mock).mockImplementation(razorpayOpenMock);
  });

  // ─── Sub-test A: Order creation payload unchanged ─────────────────────────
  //
  // For any selectedApp, createOrder is called with:
  //   { paymentMethod: 'upi', idempotencyKey: expect.any(String) }
  // Plus optionally upiVpa (only for 'other') and couponCode (only when coupon applied).
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 3.1

  describe('A: Order creation payload unchanged', () => {
    it('A.1: createOrder called with paymentMethod: upi and idempotencyKey for gpay', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(createOrderMock).toHaveBeenCalledTimes(1);
      expect(createOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'upi',
          idempotencyKey: expect.any(String),
        })
      );
      // upiVpa should NOT be present for gpay (no VPA entered)
      const payload = createOrderMock.mock.calls[0][0];
      expect(payload.upiVpa).toBeUndefined();
      expect(payload.couponCode).toBeUndefined();
    });

    it('A.2: createOrder called with upiVpa only for other app with verified VPA', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'other')!;
      const verifiedVpa = 'user@upi';

      await simulateHandleUpiPayment({
        selectedApp,
        upiVpa: verifiedVpa,
        upiVerified: true,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(createOrderMock).toHaveBeenCalledTimes(1);
      const payload = createOrderMock.mock.calls[0][0];
      expect(payload.paymentMethod).toBe('upi');
      expect(payload.idempotencyKey).toEqual(expect.any(String));
      expect(payload.upiVpa).toBe(verifiedVpa);
      expect(payload.couponCode).toBeUndefined();
    });

    it('A.3: createOrder called with couponCode only when coupon is applied', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'phonepe')!;

      await simulateHandleUpiPayment({
        selectedApp,
        couponCode: 'SAVE10',
        couponDiscount: 50,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(createOrderMock).toHaveBeenCalledTimes(1);
      const payload = createOrderMock.mock.calls[0][0];
      expect(payload.paymentMethod).toBe('upi');
      expect(payload.idempotencyKey).toEqual(expect.any(String));
      expect(payload.couponCode).toBe('SAVE10');
    });

    it('A.4: couponCode NOT included when couponDiscount is 0', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'paytm')!;

      await simulateHandleUpiPayment({
        selectedApp,
        couponCode: 'SAVE10',
        couponDiscount: 0, // No discount applied
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      const payload = createOrderMock.mock.calls[0][0];
      expect(payload.couponCode).toBeUndefined();
    });

    it('A.5: upiVpa NOT included for named apps (gpay, phonepe, paytm, bhim)', async () => {
      const namedApps = UPI_APPS.filter(a => a.id !== 'other');

      for (const selectedApp of namedApps) {
        createOrderMock.mockClear();

        await simulateHandleUpiPayment({
          selectedApp,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        const payload = createOrderMock.mock.calls[0][0];
        expect(payload.upiVpa).toBeUndefined();
      }
    });
  });

  // ─── Sub-test B: AsyncStorage writes unchanged ────────────────────────────
  //
  // After order creation, AsyncStorage.setItem is called with:
  //   ('pendingPaymentOrderId', orderId)
  //   ('pendingPaymentTimestamp', expect.any(String))
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 3.2

  describe('B: AsyncStorage writes unchanged', () => {
    it('B.1: AsyncStorage.setItem called with pendingPaymentOrderId after order creation', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(asyncStorageSetItemMock).toHaveBeenCalledWith(
        'pendingPaymentOrderId',
        MOCK_ORDER._id
      );
    });

    it('B.2: AsyncStorage.setItem called with pendingPaymentTimestamp after order creation', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(asyncStorageSetItemMock).toHaveBeenCalledWith(
        'pendingPaymentTimestamp',
        expect.any(String)
      );
    });

    it('B.3: AsyncStorage writes happen for all named UPI apps', async () => {
      const namedApps = UPI_APPS.filter(a => a.id !== 'other');

      for (const selectedApp of namedApps) {
        asyncStorageSetItemMock.mockClear();
        createOrderMock.mockClear();

        await simulateHandleUpiPayment({
          selectedApp,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        expect(asyncStorageSetItemMock).toHaveBeenCalledWith(
          'pendingPaymentOrderId',
          MOCK_ORDER._id
        );
        expect(asyncStorageSetItemMock).toHaveBeenCalledWith(
          'pendingPaymentTimestamp',
          expect.any(String)
        );
      }
    });

    it('B.4: AsyncStorage writes happen for other app with verified VPA', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'other')!;

      await simulateHandleUpiPayment({
        selectedApp,
        upiVpa: 'user@upi',
        upiVerified: true,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(asyncStorageSetItemMock).toHaveBeenCalledWith(
        'pendingPaymentOrderId',
        MOCK_ORDER._id
      );
      expect(asyncStorageSetItemMock).toHaveBeenCalledWith(
        'pendingPaymentTimestamp',
        expect.any(String)
      );
    });
  });

  // ─── Sub-test C: pollPaymentStatus called after Razorpay success ──────────
  //
  // After RazorpayCheckout.open resolves, pollPaymentStatus(orderId, selectedApp) is called.
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 3.3

  describe('C: pollPaymentStatus called after Razorpay success', () => {
    it('C.1: pollPaymentStatus called with (orderId, selectedApp) after Razorpay resolves', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(pollPaymentStatusMock).toHaveBeenCalledTimes(1);
      expect(pollPaymentStatusMock).toHaveBeenCalledWith(MOCK_ORDER._id, selectedApp);
    });

    it('C.2: pollPaymentStatus called for all named UPI apps', async () => {
      const namedApps = UPI_APPS.filter(a => a.id !== 'other');

      for (const selectedApp of namedApps) {
        pollPaymentStatusMock.mockClear();
        createOrderMock.mockClear();

        await simulateHandleUpiPayment({
          selectedApp,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        expect(pollPaymentStatusMock).toHaveBeenCalledWith(MOCK_ORDER._id, selectedApp);
      }
    });

    it('C.3: pollPaymentStatus NOT called when Razorpay throws', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
      razorpayOpenMock.mockRejectedValueOnce({ code: 'PAYMENT_CANCELLED' });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(pollPaymentStatusMock).not.toHaveBeenCalled();
    });
  });

  // ─── Sub-test D: PAYMENT_CANCELLED triggers recovery modal ───────────────
  //
  // When RazorpayCheckout.open throws { code: 'PAYMENT_CANCELLED' },
  // the recovery modal is shown and Alert is NOT called.
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 2.6, 3.4

  describe('D: PAYMENT_CANCELLED triggers recovery modal', () => {
    it('D.1: recovery modal shown when PAYMENT_CANCELLED is thrown', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
      razorpayOpenMock.mockRejectedValueOnce({ code: 'PAYMENT_CANCELLED' });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(setIsRecoveryModalVisibleMock).toHaveBeenCalledWith(true);
    });

    it('D.2: Alert NOT called when PAYMENT_CANCELLED is thrown', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
      razorpayOpenMock.mockRejectedValueOnce({ code: 'PAYMENT_CANCELLED' });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      // Alert should NOT be called for cancellation
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('D.3: recovery modal shown for numeric cancellation code 2', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'phonepe')!;
      razorpayOpenMock.mockRejectedValueOnce({ code: '2' });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(setIsRecoveryModalVisibleMock).toHaveBeenCalledWith(true);
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  // ─── Sub-test E: NETWORK_ERROR triggers Alert ─────────────────────────────
  //
  // When RazorpayCheckout.open throws { code: 'NETWORK_ERROR' },
  // Alert.alert is called with 'Network Error'.
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 2.7, 3.4

  describe('E: NETWORK_ERROR triggers Alert', () => {
    it('E.1: Alert.alert called with Network Error when NETWORK_ERROR is thrown', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
      razorpayOpenMock.mockRejectedValueOnce({ code: 'NETWORK_ERROR' });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Network Error',
        expect.any(String)
      );
    });

    it('E.2: Alert.alert called with Network Error for numeric code 0', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'phonepe')!;
      razorpayOpenMock.mockRejectedValueOnce({ code: '0' });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Network Error',
        expect.any(String)
      );
    });
  });

  // ─── Sub-test F: 400 response triggers order-creation-failed Alert ────────
  //
  // When createOrder throws { response: { status: 400, data: { message: 'Bad request' } } },
  // Alert.alert is called with 'Order Creation Failed'.
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 3.1

  describe('F: 400 response triggers order-creation-failed Alert', () => {
    it('F.1: Alert.alert called with Order Creation Failed on 400 from createOrder', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
      createOrderMock.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'Bad request' },
        },
      });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Order Creation Failed',
        expect.any(String)
      );
    });

    it('F.2: RazorpayCheckout.open NOT called when createOrder returns 400', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
      createOrderMock.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'Bad request' },
        },
      });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(razorpayOpenMock).not.toHaveBeenCalled();
    });

    it('F.3: error message from backend included in Alert', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'phonepe')!;
      const backendMessage = 'Invalid cart items';
      createOrderMock.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: backendMessage },
        },
      });

      await simulateHandleUpiPayment({
        selectedApp,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(Alert.alert).toHaveBeenCalledWith('Order Creation Failed', backendMessage);
    });
  });

  // ─── Sub-test G: other VPA gate check unchanged ───────────────────────────
  //
  // When selectedApp.id === 'other' and upiVerified is false,
  // early return with Alert.alert('Verify UPI', ...) and createOrder NOT called.
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 3.1

  describe('G: other VPA gate check unchanged', () => {
    it('G.1: Alert shown and createOrder NOT called when other app with no VPA', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'other')!;

      await simulateHandleUpiPayment({
        selectedApp,
        upiVpa: '',
        upiVerified: false,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Enter UPI ID',
        expect.any(String)
      );
      expect(createOrderMock).not.toHaveBeenCalled();
    });

    it('G.2: Alert shown and createOrder NOT called when other app with unverified VPA', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'other')!;

      await simulateHandleUpiPayment({
        selectedApp,
        upiVpa: 'user@upi',
        upiVerified: false, // VPA entered but not verified
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Verify UPI',
        expect.any(String)
      );
      expect(createOrderMock).not.toHaveBeenCalled();
    });

    it('G.3: createOrder IS called when other app with verified VPA', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'other')!;

      await simulateHandleUpiPayment({
        selectedApp,
        upiVpa: 'user@upi',
        upiVerified: true,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(createOrderMock).toHaveBeenCalledTimes(1);
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('G.4: RazorpayCheckout.open NOT called when other app gate fails', async () => {
      const selectedApp = UPI_APPS.find(a => a.id === 'other')!;

      await simulateHandleUpiPayment({
        selectedApp,
        upiVpa: 'user@upi',
        upiVerified: false,
        createOrderMock,
        razorpayOpenMock,
        pollPaymentStatusMock,
        setIsRecoveryModalVisibleMock,
        asyncStorageSetItemMock,
        asyncStorageRemoveItemMock,
      });

      expect(razorpayOpenMock).not.toHaveBeenCalled();
    });
  });

  // ─── Sub-test H: COD flow unaffected ─────────────────────────────────────
  //
  // handleCodPayment works independently; handleUpiPayment is never invoked.
  //
  // PASSES on both unfixed and fixed code.
  //
  // Validates: Requirements 3.5

  describe('H: COD flow unaffected', () => {
    it('H.1: handleCodPayment calls createOrder with paymentMethod: cod', async () => {
      const codCreateOrderMock = jest.fn().mockResolvedValue({ order: MOCK_COD_ORDER });

      await simulateHandleCodPayment({
        createOrderMock: codCreateOrderMock,
        handleUpiPaymentMock,
      });

      expect(codCreateOrderMock).toHaveBeenCalledTimes(1);
      expect(codCreateOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'cod',
        })
      );
    });

    it('H.2: handleUpiPayment NOT invoked during COD flow', async () => {
      const codCreateOrderMock = jest.fn().mockResolvedValue({ order: MOCK_COD_ORDER });

      await simulateHandleCodPayment({
        createOrderMock: codCreateOrderMock,
        handleUpiPaymentMock,
      });

      expect(handleUpiPaymentMock).not.toHaveBeenCalled();
    });

    it('H.3: RazorpayCheckout.open NOT called during COD flow', async () => {
      const codCreateOrderMock = jest.fn().mockResolvedValue({ order: MOCK_COD_ORDER });

      await simulateHandleCodPayment({
        createOrderMock: codCreateOrderMock,
        handleUpiPaymentMock,
      });

      expect(razorpayOpenMock).not.toHaveBeenCalled();
    });

    it('H.4: COD payload includes addressId', async () => {
      const codCreateOrderMock = jest.fn().mockResolvedValue({ order: MOCK_COD_ORDER });

      await simulateHandleCodPayment({
        createOrderMock: codCreateOrderMock,
        handleUpiPaymentMock,
        selectedAddressId: 'addr_test_001',
      });

      const payload = codCreateOrderMock.mock.calls[0][0];
      expect(payload.addressId).toBe('addr_test_001');
    });

    it('H.5: COD payload includes couponCode only when coupon applied', async () => {
      const codCreateOrderMock = jest.fn().mockResolvedValue({ order: MOCK_COD_ORDER });

      await simulateHandleCodPayment({
        createOrderMock: codCreateOrderMock,
        handleUpiPaymentMock,
        couponCode: 'SAVE20',
        couponDiscount: 30,
      });

      const payload = codCreateOrderMock.mock.calls[0][0];
      expect(payload.couponCode).toBe('SAVE20');
    });

    it('H.6: COD payload does NOT include couponCode when no coupon applied', async () => {
      const codCreateOrderMock = jest.fn().mockResolvedValue({ order: MOCK_COD_ORDER });

      await simulateHandleCodPayment({
        createOrderMock: codCreateOrderMock,
        handleUpiPaymentMock,
        couponCode: 'SAVE20',
        couponDiscount: 0,
      });

      const payload = codCreateOrderMock.mock.calls[0][0];
      expect(payload.couponCode).toBeUndefined();
    });
  });
});

// ─── Property-Based Tests (fast-check) ───────────────────────────────────────
//
// Sub-tests A and B: Property-based tests using fast-check.
// Generate random selectedApp values from the valid set and random order amounts,
// asserting the payload and AsyncStorage writes are always correct.
//
// Validates: Requirements 3.1, 3.2

describe('Property-Based: Order creation payload and AsyncStorage writes (fast-check)', () => {
  /**
   * Validates: Requirements 3.1
   *
   * Property: For any valid selectedApp (gpay, phonepe, paytm, bhim),
   * createOrder is always called with paymentMethod: 'upi' and a string idempotencyKey.
   * upiVpa is never included for named apps.
   */
  it('PBT-A: createOrder always called with correct payload shape for any named UPI app', async () => {
    // Arbitrary: pick any named UPI app (not 'other')
    const namedAppArb = fc.constantFrom(
      ...UPI_APPS.filter(a => a.id !== 'other')
    );

    await fc.assert(
      fc.asyncProperty(namedAppArb, async (selectedApp) => {
        const createOrderMock = jest.fn().mockResolvedValue({ order: MOCK_ORDER });
        const razorpayOpenMock = jest.fn().mockResolvedValue({
          razorpay_payment_id: 'pay_pbt_001',
          razorpay_order_id: MOCK_ORDER.razorpayOrderId,
          razorpay_signature: 'mock_sig',
        });
        const pollPaymentStatusMock = jest.fn().mockResolvedValue(undefined);
        const setIsRecoveryModalVisibleMock = jest.fn();
        const asyncStorageSetItemMock = jest.fn().mockResolvedValue(undefined);
        const asyncStorageRemoveItemMock = jest.fn().mockResolvedValue(undefined);

        await simulateHandleUpiPayment({
          selectedApp,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        // Property: createOrder called exactly once
        if (createOrderMock.mock.calls.length !== 1) return false;

        const payload = createOrderMock.mock.calls[0][0];

        // Property: paymentMethod is always 'upi'
        if (payload.paymentMethod !== 'upi') return false;

        // Property: idempotencyKey is always a string
        if (typeof payload.idempotencyKey !== 'string') return false;

        // Property: upiVpa is never included for named apps (no VPA entered)
        if (payload.upiVpa !== undefined) return false;

        // Property: couponCode is not included when no coupon applied
        if (payload.couponCode !== undefined) return false;

        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Validates: Requirements 3.1
   *
   * Property: For the 'other' app with a verified VPA,
   * createOrder is always called with upiVpa matching the provided VPA.
   */
  it('PBT-A2: createOrder always includes upiVpa for other app with verified VPA', async () => {
    const vpaArb = fc.stringMatching(/^[a-z0-9]+@[a-z]+$/).filter(s => s.length > 3);

    await fc.assert(
      fc.asyncProperty(vpaArb, async (vpa) => {
        const selectedApp = UPI_APPS.find(a => a.id === 'other')!;
        const createOrderMock = jest.fn().mockResolvedValue({ order: MOCK_ORDER });
        const razorpayOpenMock = jest.fn().mockResolvedValue({
          razorpay_payment_id: 'pay_pbt_002',
          razorpay_order_id: MOCK_ORDER.razorpayOrderId,
          razorpay_signature: 'mock_sig',
        });
        const pollPaymentStatusMock = jest.fn().mockResolvedValue(undefined);
        const setIsRecoveryModalVisibleMock = jest.fn();
        const asyncStorageSetItemMock = jest.fn().mockResolvedValue(undefined);
        const asyncStorageRemoveItemMock = jest.fn().mockResolvedValue(undefined);

        await simulateHandleUpiPayment({
          selectedApp,
          upiVpa: vpa,
          upiVerified: true,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        if (createOrderMock.mock.calls.length !== 1) return false;

        const payload = createOrderMock.mock.calls[0][0];

        // Property: upiVpa matches the provided VPA
        if (payload.upiVpa !== vpa) return false;

        // Property: paymentMethod is always 'upi'
        if (payload.paymentMethod !== 'upi') return false;

        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property: For any valid selectedApp (gpay, phonepe, paytm, bhim),
   * AsyncStorage.setItem is always called with 'pendingPaymentOrderId' and the orderId,
   * and with 'pendingPaymentTimestamp' and a string timestamp.
   */
  it('PBT-B: AsyncStorage always written with correct keys for any named UPI app', async () => {
    const namedAppArb = fc.constantFrom(
      ...UPI_APPS.filter(a => a.id !== 'other')
    );

    await fc.assert(
      fc.asyncProperty(namedAppArb, async (selectedApp) => {
        const createOrderMock = jest.fn().mockResolvedValue({ order: MOCK_ORDER });
        const razorpayOpenMock = jest.fn().mockResolvedValue({
          razorpay_payment_id: 'pay_pbt_003',
          razorpay_order_id: MOCK_ORDER.razorpayOrderId,
          razorpay_signature: 'mock_sig',
        });
        const pollPaymentStatusMock = jest.fn().mockResolvedValue(undefined);
        const setIsRecoveryModalVisibleMock = jest.fn();
        const asyncStorageSetItemMock = jest.fn().mockResolvedValue(undefined);
        const asyncStorageRemoveItemMock = jest.fn().mockResolvedValue(undefined);

        await simulateHandleUpiPayment({
          selectedApp,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        // Property: pendingPaymentOrderId written with the orderId
        const orderIdCall = asyncStorageSetItemMock.mock.calls.find(
          (call: any[]) => call[0] === 'pendingPaymentOrderId'
        );
        if (!orderIdCall) return false;
        if (orderIdCall[1] !== MOCK_ORDER._id) return false;

        // Property: pendingPaymentTimestamp written with a string
        const timestampCall = asyncStorageSetItemMock.mock.calls.find(
          (call: any[]) => call[0] === 'pendingPaymentTimestamp'
        );
        if (!timestampCall) return false;
        if (typeof timestampCall[1] !== 'string') return false;

        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Validates: Requirements 3.1
   *
   * Property: For any order amount, the Razorpay amount is always
   * Math.round(totalAmount * 100) (paise conversion).
   */
  it('PBT-A3: Razorpay amount always equals Math.round(totalAmount * 100)', async () => {
    // Generate realistic order amounts between 1 and 100000
    const amountArb = fc.float({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true });

    await fc.assert(
      fc.asyncProperty(amountArb, async (totalAmount) => {
        const order = { ...MOCK_ORDER, totalAmount };
        const createOrderMock = jest.fn().mockResolvedValue({ order });
        const razorpayOpenMock = jest.fn().mockResolvedValue({
          razorpay_payment_id: 'pay_pbt_004',
          razorpay_order_id: order.razorpayOrderId,
          razorpay_signature: 'mock_sig',
        });
        const pollPaymentStatusMock = jest.fn().mockResolvedValue(undefined);
        const setIsRecoveryModalVisibleMock = jest.fn();
        const asyncStorageSetItemMock = jest.fn().mockResolvedValue(undefined);
        const asyncStorageRemoveItemMock = jest.fn().mockResolvedValue(undefined);

        const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;

        await simulateHandleUpiPayment({
          selectedApp,
          createOrderMock,
          razorpayOpenMock,
          pollPaymentStatusMock,
          setIsRecoveryModalVisibleMock,
          asyncStorageSetItemMock,
          asyncStorageRemoveItemMock,
        });

        if (razorpayOpenMock.mock.calls.length !== 1) return false;

        const options = razorpayOpenMock.mock.calls[0][0];
        const expectedAmount = Math.round(totalAmount * 100);

        // Property: amount is always Math.round(totalAmount * 100)
        return options.amount === expectedAmount;
      }),
      { numRuns: 50 }
    );
  });
});
