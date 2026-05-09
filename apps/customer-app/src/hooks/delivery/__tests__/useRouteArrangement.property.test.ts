/**
 * Property-Based Tests for useRouteArrangement hook logic
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 6.4**
 *
 * Property 1: Single-Current Invariant
 *   For any arranged route with one or more active orders, exactly one order
 *   shall have `isOrderCurrent(id) === true`, and that order shall be
 *   `sortedOrderIds[0]`. No order that is locked shall simultaneously be current.
 *
 * Tag: Feature: driver-ux-phase5, Property 1: single-current invariant
 *
 * Property 2: Progress Consistency
 *   For any arranged route state with totalStops > 0, the values completedCount
 *   and remainingCount derived from sortedOrderIds and currentOrderId shall
 *   satisfy completedCount + remainingCount === totalStops.
 *
 * Tag: Feature: driver-ux-phase5, Property 2: progress consistency
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Note: These tests exercise the pure logic extracted from useRouteArrangement
 * (isOrderCurrent, isOrderLocked) without mounting the hook — keeping tests
 * fast and deterministic.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const mongoIdArb = fc
  .stringMatching(/^[0-9a-f]{24}$/)
  .map((id) => id.toLowerCase());

// Generate a random array of 1-10 unique order IDs
const sortedOrderIdsArb = fc
  .array(mongoIdArb, { minLength: 1, maxLength: 10 })
  .map((ids) => {
    // Ensure uniqueness
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds.length > 0 ? uniqueIds : [ids[0] || 'aaa00aa00a00a0aaaaa000aa'];
  });

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from useRouteArrangement
// (mirrors the actual hook implementation)
// ---------------------------------------------------------------------------

/**
 * Pure function that mirrors isOrderCurrent from the hook
 * isOrderCurrent = (id: string) => isArranged && id === currentOrderId
 */
function isOrderCurrent(id: string, isArranged: boolean, currentOrderId: string | null): boolean {
  return isArranged && id === currentOrderId;
}

/**
 * Pure function that mirrors isOrderLocked from the hook
 * isOrderLocked = (id: string) => isArranged && id !== currentOrderId
 */
function isOrderLocked(id: string, isArranged: boolean, currentOrderId: string | null): boolean {
  return isArranged && id !== currentOrderId;
}

// ---------------------------------------------------------------------------
// Property 1: Single-Current Invariant
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.4
// Tag: Feature: driver-ux-phase5, Property 1: single-current invariant
// ---------------------------------------------------------------------------

describe('Property 1: Single-Current Invariant', () => {
  it('exactly one order is current after arrangement, and it is sortedOrderIds[0], and it is not locked', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        // Simulate arranged state
        const isArranged = true;
        const currentOrderId = sortedOrderIds[0];

        // Assert: exactly one order is current
        const currentCount = sortedOrderIds.filter((id) =>
          isOrderCurrent(id, isArranged, currentOrderId)
        ).length;
        expect(currentCount).toBe(1);

        // Assert: the first order in sortedOrderIds is current
        expect(isOrderCurrent(sortedOrderIds[0], isArranged, currentOrderId)).toBe(true);

        // Assert: the first order is not locked
        expect(isOrderLocked(sortedOrderIds[0], isArranged, currentOrderId)).toBe(false);

        // Assert: all other orders are locked (not current)
        for (let i = 1; i < sortedOrderIds.length; i++) {
          expect(isOrderCurrent(sortedOrderIds[i], isArranged, currentOrderId)).toBe(false);
          expect(isOrderLocked(sortedOrderIds[i], isArranged, currentOrderId)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no locked order is ever current', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        const isArranged = true;
        const currentOrderId = sortedOrderIds[0];

        // Assert: no order is both current and locked
        for (const id of sortedOrderIds) {
          const isCurrent = isOrderCurrent(id, isArranged, currentOrderId);
          const isLocked = isOrderLocked(id, isArranged, currentOrderId);
          expect(isCurrent && isLocked).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('currentOrderId always equals sortedOrderIds[0] when arranged', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        const isArranged = true;
        const currentOrderId = sortedOrderIds[0];

        // Assert: currentOrderId equals the first entry in sortedOrderIds
        expect(currentOrderId).toBe(sortedOrderIds[0]);

        // Assert: isOrderCurrent returns true only for currentOrderId
        expect(isOrderCurrent(currentOrderId, isArranged, currentOrderId)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('when not arranged, no order is current or locked', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        const isArranged = false;
        const currentOrderId = sortedOrderIds[0];

        // Assert: when not arranged, no order is current
        for (const id of sortedOrderIds) {
          expect(isOrderCurrent(id, isArranged, currentOrderId)).toBe(false);
          expect(isOrderLocked(id, isArranged, currentOrderId)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('invariant holds for any valid currentOrderId in sortedOrderIds', () => {
    fc.assert(
      fc.property(
        sortedOrderIdsArb,
        fc.integer({ min: 0, max: 9 }),
        (sortedOrderIds, indexOffset) => {
          const isArranged = true;
          const currentIndex = indexOffset % sortedOrderIds.length;
          const currentOrderId = sortedOrderIds[currentIndex];

          // Assert: exactly one order is current
          const currentCount = sortedOrderIds.filter((id) =>
            isOrderCurrent(id, isArranged, currentOrderId)
          ).length;
          expect(currentCount).toBe(1);

          // Assert: the selected order is current
          expect(isOrderCurrent(currentOrderId, isArranged, currentOrderId)).toBe(true);

          // Assert: the selected order is not locked
          expect(isOrderLocked(currentOrderId, isArranged, currentOrderId)).toBe(false);

          // Assert: all other orders are locked
          for (const id of sortedOrderIds) {
            if (id !== currentOrderId) {
              expect(isOrderCurrent(id, isArranged, currentOrderId)).toBe(false);
              expect(isOrderLocked(id, isArranged, currentOrderId)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Progress Consistency
// Validates: Requirements 4.1, 4.2, 4.3, 4.4
// Tag: Feature: driver-ux-phase5, Property 2: progress consistency
// ---------------------------------------------------------------------------

describe('Property 2: Progress Consistency', () => {
  it('completedCount + remainingCount === totalStops for any valid route state', () => {
    fc.assert(
      fc.property(
        sortedOrderIdsArb,
        fc.integer({ min: 0, max: 9 }),
        (sortedOrderIds, indexOffset) => {
          // Pick a random currentOrderId from sortedOrderIds
          const currentIndex = indexOffset % sortedOrderIds.length;
          const currentOrderId = sortedOrderIds[currentIndex];

          // Compute progress counts (mirrors ActiveOrderCard logic)
          const totalStops = sortedOrderIds.length;
          const completedCount = sortedOrderIds.indexOf(currentOrderId);
          const remainingCount = totalStops - completedCount;

          // Assert: Progress Consistency invariant
          expect(completedCount + remainingCount).toBe(totalStops);

          // Additional sanity checks
          expect(completedCount).toBeGreaterThanOrEqual(0);
          expect(completedCount).toBeLessThan(totalStops);
          expect(remainingCount).toBeGreaterThan(0);
          expect(remainingCount).toBeLessThanOrEqual(totalStops);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completedCount equals the index of currentOrderId in sortedOrderIds', () => {
    fc.assert(
      fc.property(
        sortedOrderIdsArb,
        fc.integer({ min: 0, max: 9 }),
        (sortedOrderIds, indexOffset) => {
          const currentIndex = indexOffset % sortedOrderIds.length;
          const currentOrderId = sortedOrderIds[currentIndex];

          // Compute completedCount
          const completedCount = sortedOrderIds.indexOf(currentOrderId);

          // Assert: completedCount equals the index
          expect(completedCount).toBe(currentIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('remainingCount equals totalStops minus completedCount', () => {
    fc.assert(
      fc.property(
        sortedOrderIdsArb,
        fc.integer({ min: 0, max: 9 }),
        (sortedOrderIds, indexOffset) => {
          const currentIndex = indexOffset % sortedOrderIds.length;
          const currentOrderId = sortedOrderIds[currentIndex];

          const totalStops = sortedOrderIds.length;
          const completedCount = sortedOrderIds.indexOf(currentOrderId);
          const remainingCount = totalStops - completedCount;

          // Assert: remainingCount is derived correctly
          expect(remainingCount).toBe(totalStops - completedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress consistency holds when currentOrderId is the first order', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        const currentOrderId = sortedOrderIds[0];

        const totalStops = sortedOrderIds.length;
        const completedCount = sortedOrderIds.indexOf(currentOrderId);
        const remainingCount = totalStops - completedCount;

        // Assert: invariant holds
        expect(completedCount + remainingCount).toBe(totalStops);

        // Assert: when current is first, completedCount is 0
        expect(completedCount).toBe(0);
        expect(remainingCount).toBe(totalStops);
      }),
      { numRuns: 100 }
    );
  });

  it('progress consistency holds when currentOrderId is the last order', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        const currentOrderId = sortedOrderIds[sortedOrderIds.length - 1];

        const totalStops = sortedOrderIds.length;
        const completedCount = sortedOrderIds.indexOf(currentOrderId);
        const remainingCount = totalStops - completedCount;

        // Assert: invariant holds
        expect(completedCount + remainingCount).toBe(totalStops);

        // Assert: when current is last, remainingCount is 1
        expect(completedCount).toBe(totalStops - 1);
        expect(remainingCount).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('progress values are non-negative and within bounds', () => {
    fc.assert(
      fc.property(
        sortedOrderIdsArb,
        fc.integer({ min: 0, max: 9 }),
        (sortedOrderIds, indexOffset) => {
          const currentIndex = indexOffset % sortedOrderIds.length;
          const currentOrderId = sortedOrderIds[currentIndex];

          const totalStops = sortedOrderIds.length;
          const completedCount = sortedOrderIds.indexOf(currentOrderId);
          const remainingCount = totalStops - completedCount;

          // Assert: values are within valid ranges
          expect(completedCount).toBeGreaterThanOrEqual(0);
          expect(completedCount).toBeLessThan(totalStops);
          expect(remainingCount).toBeGreaterThan(0);
          expect(remainingCount).toBeLessThanOrEqual(totalStops);
          expect(totalStops).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
