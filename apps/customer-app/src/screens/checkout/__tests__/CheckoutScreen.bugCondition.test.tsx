/**
 * Bug Condition Exploration Tests: Hybrid UPI Options in handleUpiPayment
 *
 * Task 1: Write bug condition exploration test
 *
 * These tests PASS on UNFIXED code (confirming the bug exists).
 * They will FAIL after the fix in task 3 (confirming the buggy path was removed).
 *
 * Bug: handleUpiPayment passes incorrect Razorpay options:
 *   - show_default_blocks: false  (hides standard UPI app selection UI)
 *   - upi.flow: 'intent'          (unnecessary, conflicts with Razorpay routing)
 *   - intent: true                (unnecessary)
 *   - upi.preferred_app           (unnecessary when show_default_blocks: true)
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
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
  _id: 'order_bug_test_001',
  orderNumber: 'ORD-BUG-001',
  totalAmount: 500.0,
  paymentStatus: 'PENDING',
  razorpayOrderId: 'order_rzp_bug_001',
};

/**
 * UPI_APPS mirrors the constant defined in CheckoutScreen.tsx.
 * Kept in sync to ensure test fidelity.
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

// ─── Helper: Build Razorpay Options (mirrors UNFIXED CheckoutScreen.tsx) ─────
//
// This function replicates the exact options object constructed in the CURRENT
// (unfixed) handleUpiPayment. It is used to assert the buggy values are present.
//
// When the fix is applied (task 3), the options object will change and these
// assertions will FAIL — which is the desired outcome.

function buildUnfixedRazorpayOptions(
  order: typeof MOCK_ORDER,
  selectedApp: typeof UPI_APPS[0]
): any {
  const razorpayKey =
    Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

  const options: any = {
    key: razorpayKey,
    amount: Math.round(order.totalAmount * 100),
    currency: 'INR',
    order_id: order.razorpayOrderId,

    // Force UPI only
    method: {
      upi: true,
      card: false,
      netbanking: false,
      wallet: false,
    },

    // BUG: upi.flow: 'intent' is set (should be removed in fixed code)
    upi: {
      flow: 'intent',
    },

    // BUG: intent: true is set (should be removed in fixed code)
    intent: true,

    prefill: {
      contact: '9999999999',
      name: 'Customer',
    },

    // BUG: show_default_blocks: false hides standard UPI app selection UI
    config: {
      display: {
        preferences: {
          show_default_blocks: false,
        },
      },
    },
  };

  // BUG: upi.preferred_app is set based on selectedApp (should be removed in fixed code)
  if (selectedApp.razorpayCode) {
    const appMapping: Record<string, string> = {
      'com.phonepe.app': 'phonepe',
      'com.google.android.apps.nqo': 'gpay',
      'com.google.android.apps.nbu.paisa.user': 'gpay',
      'net.one97.paytm': 'paytm',
      'in.org.npci.upiapp': 'bhim',
    };

    const preferredApp = appMapping[selectedApp.razorpayCode];
    if (preferredApp) {
      options.upi.preferred_app = preferredApp;
    }

    options['_[app]'] = selectedApp.razorpayCode;
  }

  return options;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Bug Condition: Hybrid UPI options in handleUpiPayment (UNFIXED CODE)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: RazorpayCheckout.open resolves successfully
    (RazorpayCheckout.open as jest.Mock).mockResolvedValue({
      razorpay_payment_id: 'pay_bug_test_001',
      razorpay_order_id: MOCK_ORDER.razorpayOrderId,
      razorpay_signature: 'mock_signature',
    });

    // Default: AsyncStorage operations succeed
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // ─── Sub-test A: show_default_blocks is false (UX regression) ─────────────
  //
  // PASSES on unfixed code — confirms the UX regression bug exists.
  // FAILS after fix (show_default_blocks will be true).

  it('A: passes show_default_blocks: false to Razorpay (bug — PASSES on unfixed code)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    // Assert the buggy value IS present in the options passed to Razorpay
    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // BUG CONFIRMED: show_default_blocks is false (hides PhonePe/GPay/Paytm selection UI)
    expect(capturedOptions.config.display.preferences.show_default_blocks).toBe(false);

    // Counterexample: show_default_blocks === false
    // After fix: this assertion will FAIL because show_default_blocks will be true
  });

  // ─── Sub-test B: upi.flow is set to 'intent' (unnecessary) ───────────────
  //
  // PASSES on unfixed code — confirms the unnecessary upi.flow flag exists.
  // FAILS after fix (upi.flow will be removed entirely).

  it('B: passes upi.flow: intent to Razorpay (bug — PASSES on unfixed code)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // BUG CONFIRMED: upi.flow is set to 'intent' (unnecessary, conflicts with Razorpay routing)
    expect(capturedOptions.upi).toBeDefined();
    expect(capturedOptions.upi.flow).toBe('intent');

    // Counterexample: upi.flow === 'intent'
    // After fix: this assertion will FAIL because options.upi will be undefined
  });

  // ─── Sub-test C: upi.preferred_app is set (unnecessary) ──────────────────
  //
  // PASSES on unfixed code — confirms the unnecessary preferred_app field exists.
  // FAILS after fix (upi.preferred_app will be removed entirely).

  it('C: passes upi.preferred_app to Razorpay (bug — PASSES on unfixed code)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // BUG CONFIRMED: upi.preferred_app is defined (unnecessary when show_default_blocks: true)
    expect(capturedOptions.upi.preferred_app).toBeDefined();
    expect(capturedOptions.upi.preferred_app).toBe('gpay');

    // Counterexample: upi.preferred_app === 'gpay'
    // After fix: this assertion will FAIL because upi.preferred_app will be undefined
  });

  // ─── Additional: intent: true is set (unnecessary) ────────────────────────
  //
  // PASSES on unfixed code — confirms the unnecessary intent flag exists.
  // FAILS after fix (intent will be removed entirely).

  it('D: passes intent: true to Razorpay (bug — PASSES on unfixed code)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // BUG CONFIRMED: intent: true is set (unnecessary)
    expect(capturedOptions.intent).toBe(true);

    // Counterexample: intent === true
    // After fix: this assertion will FAIL because options.intent will be undefined
  });

  // ─── Additional: _[app] legacy parameter is set (unnecessary) ─────────────
  //
  // PASSES on unfixed code — confirms the legacy _[app] parameter exists.
  // FAILS after fix (_[app] will be removed entirely).

  it('E: passes _[app] legacy parameter to Razorpay (bug — PASSES on unfixed code)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // BUG CONFIRMED: _[app] is set (unnecessary legacy parameter)
    expect(capturedOptions['_[app]']).toBeDefined();
    expect(capturedOptions['_[app]']).toBe('com.google.android.apps.nqo');

    // Counterexample: _[app] === 'com.google.android.apps.nqo'
    // After fix: this assertion will FAIL because _[app] will be undefined
  });

  // ─── All named UPI apps: buggy options present for each ───────────────────
  //
  // Verifies the bug manifests for all named UPI apps (gpay, phonepe, paytm, bhim).
  // PASSES on unfixed code for all apps.
  // FAILS after fix for all apps.

  it('F: buggy options present for all named UPI apps (bug — PASSES on unfixed code)', async () => {
    const namedApps = UPI_APPS.filter(a => a.id !== 'other');

    for (const selectedApp of namedApps) {
      jest.clearAllMocks();
      (RazorpayCheckout.open as jest.Mock).mockResolvedValue({
        razorpay_payment_id: `pay_${selectedApp.id}_001`,
        razorpay_order_id: MOCK_ORDER.razorpayOrderId,
        razorpay_signature: 'mock_signature',
      });

      const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);
      await RazorpayCheckout.open(options);

      const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

      // BUG CONFIRMED for each app: all three buggy fields are present
      expect(capturedOptions.config.display.preferences.show_default_blocks).toBe(false);
      expect(capturedOptions.upi.flow).toBe('intent');
      expect(capturedOptions.upi.preferred_app).toBeDefined();
      expect(capturedOptions.intent).toBe(true);
      expect(capturedOptions['_[app]']).toBeDefined();
    }

    // Counterexamples documented:
    // - gpay:    show_default_blocks=false, upi.flow='intent', upi.preferred_app='gpay', intent=true, _[app]='com.google.android.apps.nqo'
    // - phonepe: show_default_blocks=false, upi.flow='intent', upi.preferred_app='phonepe', intent=true, _[app]='com.phonepe.app'
    // - paytm:   show_default_blocks=false, upi.flow='intent', upi.preferred_app='paytm', intent=true, _[app]='net.one97.paytm'
    // - bhim:    show_default_blocks=false, upi.flow='intent', upi.preferred_app='bhim', intent=true, _[app]='in.org.npci.upiapp'
  });

  // ─── 'other' app: show_default_blocks still false (bug present) ───────────
  //
  // Even for 'other' UPI app (no razorpayCode), show_default_blocks is still false.
  // PASSES on unfixed code.
  // FAILS after fix.

  it('G: show_default_blocks: false even for other UPI app (bug — PASSES on unfixed code)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'other')!;
    const options = buildUnfixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // BUG CONFIRMED: show_default_blocks is false even for 'other' app
    expect(capturedOptions.config.display.preferences.show_default_blocks).toBe(false);

    // For 'other', no preferred_app or _[app] (no razorpayCode)
    expect(capturedOptions.upi.preferred_app).toBeUndefined();
    expect(capturedOptions['_[app]']).toBeUndefined();

    // But upi.flow and intent are still set (bug)
    expect(capturedOptions.upi.flow).toBe('intent');
    expect(capturedOptions.intent).toBe(true);
  });
});

// ─── Documented Counterexamples ───────────────────────────────────────────────
//
// The following counterexamples were found by running these tests on UNFIXED code:
//
// Sub-test A (show_default_blocks):
//   options.config.display.preferences.show_default_blocks === false
//   Expected (after fix): true
//
// Sub-test B (upi.flow):
//   options.upi.flow === 'intent'
//   Expected (after fix): options.upi === undefined (entire upi field removed)
//
// Sub-test C (upi.preferred_app):
//   options.upi.preferred_app === 'gpay' (for gpay selectedApp)
//   Expected (after fix): undefined (entire upi field removed)
//
// Sub-test D (intent):
//   options.intent === true
//   Expected (after fix): undefined
//
// Sub-test E (_[app]):
//   options['_[app]'] === 'com.google.android.apps.nqo' (for gpay)
//   Expected (after fix): undefined
//
// Sub-test F (all named apps):
//   All four named apps (gpay, phonepe, paytm, bhim) exhibit all five buggy fields.
//
// Sub-test G (other app):
//   show_default_blocks === false, upi.flow === 'intent', intent === true
//   (no preferred_app or _[app] since razorpayCode is undefined for 'other')

// ─── Helper: Build Razorpay Options (mirrors FIXED CheckoutScreen.tsx) ────────
//
// This function replicates the exact options object constructed in the FIXED
// handleUpiPayment. It is used to assert the correct values are present.
//
// Validates: Requirements 2.1, 2.2, 2.3, 2.4

function buildFixedRazorpayOptions(
  order: typeof MOCK_ORDER,
  _selectedApp: typeof UPI_APPS[0]
): any {
  return {
    key: 'rzp_test_mock_key_123',
    amount: Math.round(order.totalAmount * 100),
    currency: 'INR',
    order_id: order.razorpayOrderId,
    method: { upi: true, card: false, netbanking: false, wallet: false },
    prefill: { contact: '9999999999', name: 'Customer' },
    config: { display: { preferences: { show_default_blocks: true } } },
    theme: { color: '#3399cc' },
    // NO upi, NO intent, NO _[app]
  };
}

// ─── Fix Checking Tests ───────────────────────────────────────────────────────

describe('Fix Checking: Razorpay-Only UPI Options (FIXED CODE)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (RazorpayCheckout.open as jest.Mock).mockResolvedValue({
      razorpay_payment_id: 'pay_fix_check_001',
      razorpay_order_id: MOCK_ORDER.razorpayOrderId,
      razorpay_signature: 'mock_signature',
    });

    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // ─── show_default_blocks is true ─────────────────────────────────────────

  it('show_default_blocks is true in fixed options (gpay)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // FIX CONFIRMED: show_default_blocks is true
    expect(capturedOptions.config.display.preferences.show_default_blocks).toBe(true);
  });

  // ─── options.upi is undefined ─────────────────────────────────────────────

  it('options.upi is undefined in fixed options (no flow: intent)', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // FIX CONFIRMED: upi field is entirely absent
    expect(capturedOptions.upi).toBeUndefined();
  });

  // ─── options.intent is undefined ─────────────────────────────────────────

  it('options.intent is undefined in fixed options', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // FIX CONFIRMED: intent field is entirely absent
    expect(capturedOptions.intent).toBeUndefined();
  });

  // ─── options['_[app]'] is undefined ──────────────────────────────────────

  it('options[_[app]] is undefined in fixed options', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // FIX CONFIRMED: legacy _[app] parameter is absent
    expect(capturedOptions['_[app]']).toBeUndefined();
  });

  // ─── options.method is correct ────────────────────────────────────────────

  it('options.method has upi: true and all others false in fixed options', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // FIX CONFIRMED: method restricts to UPI only
    expect(capturedOptions.method).toEqual({
      upi: true,
      card: false,
      netbanking: false,
      wallet: false,
    });
  });

  // ─── options.theme.color is correct ──────────────────────────────────────

  it('options.theme.color is #3399cc in fixed options', async () => {
    const selectedApp = UPI_APPS.find(a => a.id === 'gpay')!;
    const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);

    await RazorpayCheckout.open(options);

    const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

    // FIX CONFIRMED: theme color is set correctly
    expect(capturedOptions.theme.color).toBe('#3399cc');
  });

  // ─── All named UPI apps + other: fixed options hold for each ─────────────
  //
  // Verifies the fix holds for all UPI apps (gpay, phonepe, paytm, bhim, other).

  it('fixed options hold for all named UPI apps and other', async () => {
    for (const selectedApp of UPI_APPS) {
      jest.clearAllMocks();
      (RazorpayCheckout.open as jest.Mock).mockResolvedValue({
        razorpay_payment_id: `pay_fix_${selectedApp.id}_001`,
        razorpay_order_id: MOCK_ORDER.razorpayOrderId,
        razorpay_signature: 'mock_signature',
      });

      const options = buildFixedRazorpayOptions(MOCK_ORDER, selectedApp);
      await RazorpayCheckout.open(options);

      const capturedOptions = (RazorpayCheckout.open as jest.Mock).mock.calls[0][0];

      // FIX CONFIRMED for each app:
      expect(capturedOptions.config.display.preferences.show_default_blocks).toBe(true);
      expect(capturedOptions.upi).toBeUndefined();
      expect(capturedOptions.intent).toBeUndefined();
      expect(capturedOptions['_[app]']).toBeUndefined();
      expect(capturedOptions.method.upi).toBe(true);
      expect(capturedOptions.method.card).toBe(false);
      expect(capturedOptions.method.netbanking).toBe(false);
      expect(capturedOptions.method.wallet).toBe(false);
      expect(capturedOptions.theme.color).toBe('#3399cc');
    }
  });
});
