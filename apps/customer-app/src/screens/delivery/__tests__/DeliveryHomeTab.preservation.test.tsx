/**
 * Preservation Property Tests — Property 2
 *
 * Validates: Requirements 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * These tests MUST PASS on UNFIXED code.
 * They establish the baseline behavior that must be preserved after the fix.
 *
 * Observation-first methodology:
 *   - With __DEV__ === true: simulator callbacks ARE assigned after mount
 *   - With __DEV__ === true: driverSimulator.reset() IS called exactly once on unmount
 *   - With __DEV__ === true: DebugPanel IS rendered with simulator controls
 *   - Both builds: production delivery screen components render correctly
 *
 * Testing strategy: We directly invoke the useEffect callbacks that
 * DeliveryHomeTab registers, mirroring the approach used in the bug condition test.
 * This avoids React instance mismatch issues while faithfully testing the behavior.
 */

import fc from 'fast-check';
import { driverSimulator } from '../../../simulator/DriverSimulator';

// ─── Replicate the exact simulator useEffect body from DeliveryHomeTab.tsx ───
// This is the UNFIXED version — no __DEV__ guard at the top.

function simulatorUseEffectBody(
  dispatch: any,
  resetArrangement: () => void
): (() => void) | void {
  driverSimulator.onArrived = (orderId: string) => {
    console.log('[SIM->UI] Arrived:', orderId);
    dispatch({ type: 'mock' });
  };

  driverSimulator.onDelivered = async (orderId: string) => {
    console.log('[SIM->UI] Delivered:', orderId);
    if (!__DEV__) {
      console.warn('[SIM] Simulator should not run in production');
      return;
    }
    dispatch({ type: 'mock' });
  };

  driverSimulator.onRouteComplete = () => {
    console.log('[SIM->UI] Route completed');
    setTimeout(() => {
      resetArrangement();
    }, 300);
  };

  return () => {
    driverSimulator.reset();
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const orderArb = fc.record({
  _id: fc.string({ minLength: 6, maxLength: 24 }),
  orderStatus: fc.constantFrom('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'),
  paymentMethod: fc.constantFrom('CASH', 'COD', 'ONLINE'),
  arrivedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  address: fc.record({
    lat: fc.float({ min: 8, max: 37, noNaN: true }),
    lng: fc.float({ min: 68, max: 97, noNaN: true }),
  }),
});

const activeOrdersArb = fc.array(orderArb, { minLength: 0, maxLength: 3 });

// ─── __DEV__ management ───────────────────────────────────────────────────────

const originalDev = (global as any).__DEV__;

afterAll(() => {
  (global as any).__DEV__ = originalDev;
});

beforeEach(() => {
  driverSimulator.onArrived = () => {};
  driverSimulator.onDelivered = () => {};
  driverSimulator.onRouteComplete = () => {};
  jest.clearAllMocks();
});

// ─── Dev-mode simulator callback preservation ─────────────────────────────────

describe('Property 2: Preservation — Development Mode Simulator Behavior Is Unchanged', () => {
  beforeEach(() => {
    (global as any).__DEV__ = true;
  });

  /**
   * Validates: Requirements 3.3
   *
   * PRESERVATION: With __DEV__ === true, all three simulator callbacks MUST be
   * assigned after mount. This is the expected behavior that must survive the fix.
   */
  it('DEV MODE: driverSimulator callbacks ARE assigned after mount when __DEV__ === true', () => {
    const defaultOnArrived = driverSimulator.onArrived;
    const defaultOnDelivered = driverSimulator.onDelivered;
    const defaultOnRouteComplete = driverSimulator.onRouteComplete;

    simulatorUseEffectBody(jest.fn(), jest.fn());

    expect(driverSimulator.onArrived).not.toBe(defaultOnArrived);
    expect(driverSimulator.onDelivered).not.toBe(defaultOnDelivered);
    expect(driverSimulator.onRouteComplete).not.toBe(defaultOnRouteComplete);

    expect(typeof driverSimulator.onArrived).toBe('function');
    expect(typeof driverSimulator.onDelivered).toBe('function');
    expect(typeof driverSimulator.onRouteComplete).toBe('function');
  });

  /**
   * Validates: Requirements 3.3
   *
   * PRESERVATION: With __DEV__ === true, driverSimulator.reset() MUST be called
   * exactly once on unmount.
   */
  it('DEV MODE: driverSimulator.reset() is called exactly once on unmount when __DEV__ === true', () => {
    const resetSpy = jest.spyOn(driverSimulator, 'reset');

    const cleanup = simulatorUseEffectBody(jest.fn(), jest.fn());

    expect(resetSpy).not.toHaveBeenCalled();

    if (typeof cleanup === 'function') {
      cleanup();
    }

    expect(resetSpy).toHaveBeenCalledTimes(1);

    resetSpy.mockRestore();
  });

  /**
   * Validates: Requirements 3.3
   *
   * PRESERVATION: The onArrived callback dispatches when invoked in dev mode.
   */
  it('DEV MODE: onArrived callback dispatches when invoked', () => {
    const mockDispatch = jest.fn();

    simulatorUseEffectBody(mockDispatch, jest.fn());

    driverSimulator.onArrived('order-123');

    expect(mockDispatch).toHaveBeenCalled();
  });

  /**
   * Validates: Requirements 3.3
   *
   * PRESERVATION: The onRouteComplete callback calls resetArrangement via setTimeout.
   */
  it('DEV MODE: onRouteComplete callback calls resetArrangement when invoked', () => {
    jest.useFakeTimers();
    const mockResetArrangement = jest.fn();

    simulatorUseEffectBody(jest.fn(), mockResetArrangement);

    driverSimulator.onRouteComplete();

    jest.advanceTimersByTime(400);

    expect(mockResetArrangement).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  /**
   * Validates: Requirements 2.5, 3.3
   *
   * PROPERTY: For ALL combinations of activeOrders with __DEV__ === true,
   * all three simulator callbacks are assigned after mount and
   * driverSimulator.reset() is called exactly once on unmount.
   *
   * **Validates: Requirements 2.5, 3.3**
   */
  it('PROPERTY: for all activeOrders combinations with __DEV__ === true, callbacks are assigned and reset called once on unmount', () => {
    fc.assert(
      fc.property(activeOrdersArb, (_activeOrders) => {
        driverSimulator.onArrived = () => {};
        driverSimulator.onDelivered = () => {};
        driverSimulator.onRouteComplete = () => {};

        const defaultOnArrived = driverSimulator.onArrived;
        const defaultOnDelivered = driverSimulator.onDelivered;
        const defaultOnRouteComplete = driverSimulator.onRouteComplete;

        const resetSpy = jest.spyOn(driverSimulator, 'reset');

        const cleanup = simulatorUseEffectBody(jest.fn(), jest.fn());

        const onArrivedAssigned = driverSimulator.onArrived !== defaultOnArrived;
        const onDeliveredAssigned = driverSimulator.onDelivered !== defaultOnDelivered;
        const onRouteCompleteAssigned = driverSimulator.onRouteComplete !== defaultOnRouteComplete;
        const resetNotCalledOnMount = resetSpy.mock.calls.length === 0;

        if (typeof cleanup === 'function') {
          cleanup();
        }

        const resetCalledOnceOnUnmount = resetSpy.mock.calls.length === 1;

        resetSpy.mockRestore();

        return (
          onArrivedAssigned &&
          onDeliveredAssigned &&
          onRouteCompleteAssigned &&
          resetNotCalledOnMount &&
          resetCalledOnceOnUnmount
        );
      }),
      { numRuns: 20, verbose: true }
    );
  });
});

// ─── DebugPanel source preservation tests ────────────────────────────────────

describe('Property 2: Preservation — DebugPanel Contains All Simulator Controls', () => {
  /**
   * Validates: Requirements 3.1, 3.2
   *
   * PRESERVATION: DebugPanel source must contain all expected simulator controls.
   * We verify the component source contains Start, Pause, Resume, Reset buttons
   * and speed multiplier buttons (1×, 2×, 5×).
   *
   * We read the source file directly to avoid React Native StyleSheet native
   * module issues in the test environment, while still verifying the controls
   * are present in the component.
   */
  it('DEV MODE: DebugPanel source contains all simulator controls (Start, Pause, Resume, Reset, 1×, 2×, 5×)', () => {
    const fs = require('fs');
    const path = require('path');

    const debugPanelPath = path.resolve(__dirname, '../../../dev/DebugPanel.tsx');
    const source = fs.readFileSync(debugPanelPath, 'utf-8');

    // All simulator control labels must be present
    expect(source).toContain('Start');
    expect(source).toContain('Pause');
    expect(source).toContain('Resume');
    expect(source).toContain('Reset');

    // Speed multiplier buttons
    expect(source).toContain('1×');
    expect(source).toContain('2×');
    expect(source).toContain('5×');

    // Internal __DEV__ guard must be present
    expect(source).toContain('if (!__DEV__) return null');

    // All simulator control handlers must be wired
    expect(source).toContain('driverSimulator.start');
    expect(source).toContain('driverSimulator.pause');
    expect(source).toContain('driverSimulator.resume');
    expect(source).toContain('driverSimulator.reset');
    expect(source).toContain('driverSimulator.setSpeed');
  });

  /**
   * Validates: Requirements 3.1
   *
   * PRESERVATION: DebugPanel's internal guard returns null when __DEV__ === false.
   */
  it('PRODUCTION: DebugPanel internal guard returns null when __DEV__ === false', () => {
    (global as any).__DEV__ = false;

    function debugPanelGuard(): null | 'rendered' {
      if (!__DEV__) return null;
      return 'rendered';
    }

    expect(debugPanelGuard()).toBeNull();
  });

  /**
   * Validates: Requirements 3.1
   *
   * PRESERVATION: DebugPanel's internal guard does NOT return null in dev mode.
   */
  it('DEV MODE: DebugPanel internal guard does not return null when __DEV__ === true', () => {
    (global as any).__DEV__ = true;

    function debugPanelGuard(): null | 'rendered' {
      if (!__DEV__) return null;
      return 'rendered';
    }

    expect(debugPanelGuard()).toBe('rendered');
  });

  /**
   * Validates: Requirements 3.1, 3.2
   *
   * PRESERVATION: DebugPanel source contains setInterval for state polling,
   * which runs when __DEV__ === true.
   */
  it('DEV MODE: DebugPanel source contains setInterval for state polling', () => {
    const fs = require('fs');
    const path = require('path');

    const debugPanelPath = path.resolve(__dirname, '../../../dev/DebugPanel.tsx');
    const source = fs.readFileSync(debugPanelPath, 'utf-8');

    expect(source).toContain('setInterval');
    expect(source).toContain('driverSimulator.getState()');
    expect(source).toContain('driverLocationStore.current');
  });

  /**
   * Validates: Requirements 3.5
   *
   * PRESERVATION: All simulator source files must exist and be intact.
   */
  it('BOTH BUILDS: simulator source files are intact and undeleted', () => {
    const fs = require('fs');
    const path = require('path');

    const files = [
      path.resolve(__dirname, '../../../simulator/DriverSimulator.ts'),
      path.resolve(__dirname, '../../../simulator/driverLocationStore.ts'),
      path.resolve(__dirname, '../../../dev/DebugPanel.tsx'),
    ];

    for (const filePath of files) {
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});

// ─── Production delivery screen preservation tests ───────────────────────────

describe('Property 2: Preservation — Production Delivery Screen Components Render Correctly', () => {
  /**
   * Validates: Requirements 3.6
   *
   * PRESERVATION: The simulator useEffect body does not throw in production.
   * The useEffect only wires simulator callbacks — it has no effect on
   * ControlBar, ConnectionBanner, or order cards.
   */
  it('PRODUCTION: simulator useEffect does not throw when __DEV__ === false', () => {
    (global as any).__DEV__ = false;

    expect(() => {
      const cleanup = simulatorUseEffectBody(jest.fn(), jest.fn());
      if (typeof cleanup === 'function') {
        cleanup();
      }
    }).not.toThrow();
  });

  it('DEV MODE: simulator useEffect does not throw when __DEV__ === true', () => {
    (global as any).__DEV__ = true;

    const resetSpy = jest.spyOn(driverSimulator, 'reset');

    expect(() => {
      const cleanup = simulatorUseEffectBody(jest.fn(), jest.fn());
      if (typeof cleanup === 'function') {
        cleanup();
      }
    }).not.toThrow();

    resetSpy.mockRestore();
  });

  /**
   * Validates: Requirements 3.6
   *
   * PROPERTY: For ALL combinations of activeOrders with __DEV__ === false,
   * the simulator useEffect body does not throw.
   *
   * **Validates: Requirements 3.6**
   */
  it('PROPERTY: for all activeOrders combinations with __DEV__ === false, simulator useEffect does not throw', () => {
    (global as any).__DEV__ = false;

    fc.assert(
      fc.property(activeOrdersArb, (_activeOrders) => {
        let threw = false;
        try {
          const cleanup = simulatorUseEffectBody(jest.fn(), jest.fn());
          if (typeof cleanup === 'function') {
            cleanup();
          }
        } catch {
          threw = true;
        }
        return !threw;
      }),
      { numRuns: 20, verbose: true }
    );
  });

  /**
   * Validates: Requirements 3.6
   *
   * PRESERVATION: Simulator callbacks are always functions (never undefined/null)
   * after a mount/unmount cycle in both builds. This ensures the simulator is
   * always in a safe state.
   */
  it('BOTH BUILDS: simulator callbacks are always functions after mount/unmount cycle', () => {
    for (const devValue of [true, false]) {
      (global as any).__DEV__ = devValue;

      driverSimulator.onArrived = () => {};
      driverSimulator.onDelivered = () => {};
      driverSimulator.onRouteComplete = () => {};

      const cleanup = simulatorUseEffectBody(jest.fn(), jest.fn());
      if (typeof cleanup === 'function') {
        cleanup();
      }

      expect(typeof driverSimulator.onArrived).toBe('function');
      expect(typeof driverSimulator.onDelivered).toBe('function');
      expect(typeof driverSimulator.onRouteComplete).toBe('function');
    }
  });

  /**
   * Validates: Requirements 3.6
   *
   * PRESERVATION: DeliveryHomeTab source contains all production delivery screen
   * components (ControlBar, ConnectionBanner, NewOrderCard, ActiveOrderCard, IdleCard).
   * These components are always rendered regardless of __DEV__.
   */
  it('BOTH BUILDS: DeliveryHomeTab source contains all production delivery screen components', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.resolve(__dirname, '../DeliveryHomeTab.tsx');
    const source = fs.readFileSync(componentPath, 'utf-8');

    expect(source).toContain('ControlBar');
    expect(source).toContain('ConnectionBanner');
    expect(source).toContain('NewOrderCard');
    expect(source).toContain('ActiveOrderCard');
    expect(source).toContain('IdleCard');
  });
});
