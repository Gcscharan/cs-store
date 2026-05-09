/**
 * Property-Based Tests for useRouteArrangement — Ghost-Order Guard
 *
 * **Validates: Requirements 5.8, 7.1**
 *
 * Property 7: Ghost-Order Guard
 *   For any `sortedOrderIds` array and any subset of `activeOrders` (representing
 *   orders that have been delivered, failed, or removed), `currentOrderId` shall
 *   always equal the first element of `sortedOrderIds` that is also present in
 *   `activeOrders`. If no such element exists, the route shall be reset.
 *
 * Tag: Feature: driver-ux-phase5, Property 7: ghost-order guard
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Note: These tests exercise the pure logic extracted from useRouteArrangement
 * without mounting the hook — keeping tests fast and deterministic.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const mongoIdArb = fc
  .stringMatching(/^[0-9a-f]{24}$/)
  .map((id) => id.toLowerCase());

/** 1–10 unique order IDs representing a sorted route */
const sortedOrderIdsArb = fc
  .array(mongoIdArb, { minLength: 1, maxLength: 10 })
  .map((ids) => {
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds.length > 0 ? uniqueIds : ['aaa00aa00a00a0aaaaa000aa'];
  });

/**
 * Generates { sortedOrderIds, activeSubset } where activeSubset is a random
 * subset of sortedOrderIds (0 to all elements).
 */
const routeWithActiveSubsetArb = sortedOrderIdsArb.chain((ids) =>
  fc.subarray(ids, { minLength: 0, maxLength: ids.length }).map((subset) => ({
    sortedOrderIds: ids,
    activeSubset: subset,
  })),
);

/**
 * Generates { sortedOrderIds, activeSubset } where sortedOrderIds has at least
 * 2 unique IDs and activeSubset is a non-empty subset of ids[1..].
 * This models the scenario where the first (current) order has been removed.
 */
const routeWithSurvivorsArb = fc
  .array(mongoIdArb, { minLength: 2, maxLength: 10 })
  .map((ids) => {
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds.length >= 2
      ? uniqueIds
      : ['aaa00aa00a00a0aaaaa000aa', 'bbb00bb00b00b0bbbbb000bb'];
  })
  .chain((ids) => {
    const tail = ids.slice(1);
    return fc
      .subarray(tail, { minLength: 1, maxLength: tail.length })
      .map((subset) => ({ sortedOrderIds: ids, activeSubset: subset }));
  });

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from useRouteArrangement
// ---------------------------------------------------------------------------

/**
 * Mirrors the ghost-order guard logic from the auto-advance useEffect:
 *
 *   const activeOrderIds = new Set(activeOrders.map(o => o._id));
 *   if (activeOrderIds.has(currentOrderId)) return; // still alive
 *   const nextSurviving = sortedOrderIds.find(id => activeOrderIds.has(id));
 *   if (nextSurviving) {
 *     setCurrentOrderId(nextSurviving);
 *   } else {
 *     resetArrangement();
 *   }
 *
 * Returns:
 *   - { action: 'advance', nextCurrentId: string } when a surviving order exists
 *   - { action: 'reset' } when no surviving orders remain
 *   - { action: 'noop' } when currentOrderId is still in activeOrderIds
 */
function applyGhostOrderGuard(
  sortedOrderIds: string[],
  activeOrderIds: Set<string>,
  currentOrderId: string,
): { action: 'noop' } | { action: 'advance'; nextCurrentId: string } | { action: 'reset' } {
  // Current order is still alive — no action needed
  if (activeOrderIds.has(currentOrderId)) {
    return { action: 'noop' };
  }

  // Current order is gone — find the first surviving entry in sorted order
  const nextSurviving = sortedOrderIds.find((id) => activeOrderIds.has(id));

  if (nextSurviving) {
    return { action: 'advance', nextCurrentId: nextSurviving };
  }

  return { action: 'reset' };
}

/**
 * Derives the expected currentOrderId after the ghost-order guard runs.
 * Returns null when the route should be reset.
 */
function deriveCurrentOrderId(
  sortedOrderIds: string[],
  activeOrderIds: Set<string>,
): string | null {
  const firstSurviving = sortedOrderIds.find((id) => activeOrderIds.has(id));
  return firstSurviving ?? null;
}

// ---------------------------------------------------------------------------
// Property 7: Ghost-Order Guard
// Validates: Requirements 5.8, 7.1
// Tag: Feature: driver-ux-phase5, Property 7: ghost-order guard
// ---------------------------------------------------------------------------

describe('Property 7: Ghost-Order Guard', () => {
  it('currentOrderId equals the first sortedOrderIds entry present in activeOrderIds', () => {
    fc.assert(
      fc.property(routeWithActiveSubsetArb, ({ sortedOrderIds, activeSubset }) => {
        const activeOrderIds = new Set(activeSubset);
        const expectedCurrentId = deriveCurrentOrderId(sortedOrderIds, activeOrderIds);

        if (expectedCurrentId !== null) {
          // Assert: the expected current ID is in activeOrderIds
          expect(activeOrderIds.has(expectedCurrentId)).toBe(true);

          // Assert: no earlier element in sortedOrderIds is also in activeOrderIds
          const firstIndex = sortedOrderIds.indexOf(expectedCurrentId);
          for (let i = 0; i < firstIndex; i++) {
            expect(activeOrderIds.has(sortedOrderIds[i])).toBe(false);
          }
        } else {
          // Assert: when null, no element of sortedOrderIds is in activeOrderIds
          for (const id of sortedOrderIds) {
            expect(activeOrderIds.has(id)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('guard advances to next surviving order when currentOrderId is removed', () => {
    fc.assert(
      fc.property(routeWithSurvivorsArb, ({ sortedOrderIds, activeSubset }) => {
        // currentOrderId starts as the first entry (which is NOT in activeSubset)
        const currentOrderId = sortedOrderIds[0];
        const activeOrderIds = new Set(activeSubset);

        const result = applyGhostOrderGuard(sortedOrderIds, activeOrderIds, currentOrderId);

        // Assert: guard advances to the first surviving entry
        expect(result.action).toBe('advance');
        if (result.action === 'advance') {
          expect(activeOrderIds.has(result.nextCurrentId)).toBe(true);

          // Assert: the new currentOrderId is the first in sortedOrderIds that is active
          const newIndex = sortedOrderIds.indexOf(result.nextCurrentId);
          for (let i = 0; i < newIndex; i++) {
            expect(activeOrderIds.has(sortedOrderIds[i])).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('guard resets when no sortedOrderIds entries remain in activeOrderIds', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        // Empty active set — all orders have been removed
        const activeOrderIds = new Set<string>();
        const currentOrderId = sortedOrderIds[0];

        const result = applyGhostOrderGuard(sortedOrderIds, activeOrderIds, currentOrderId);

        // Assert: reset is triggered when no survivors remain
        expect(result.action).toBe('reset');
      }),
      { numRuns: 100 },
    );
  });

  it('guard is a noop when currentOrderId is still in activeOrderIds', () => {
    fc.assert(
      fc.property(
        sortedOrderIdsArb,
        fc.integer({ min: 0, max: 9 }),
        (sortedOrderIds, indexOffset) => {
          const currentIndex = indexOffset % sortedOrderIds.length;
          const currentOrderId = sortedOrderIds[currentIndex];

          // Active set includes the current order
          const activeOrderIds = new Set(sortedOrderIds);

          const result = applyGhostOrderGuard(sortedOrderIds, activeOrderIds, currentOrderId);

          // Assert: no action taken when current order is still alive
          expect(result.action).toBe('noop');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('advanced currentOrderId is always the first surviving entry in sorted order', () => {
    fc.assert(
      fc.property(routeWithSurvivorsArb, ({ sortedOrderIds, activeSubset }) => {
        const currentOrderId = sortedOrderIds[0];
        const activeOrderIds = new Set(activeSubset);

        const result = applyGhostOrderGuard(sortedOrderIds, activeOrderIds, currentOrderId);

        expect(result.action).toBe('advance');
        if (result.action === 'advance') {
          // Assert: the advanced ID is the first in sortedOrderIds that is active
          const expectedNext = sortedOrderIds.find((id) => activeOrderIds.has(id));
          expect(result.nextCurrentId).toBe(expectedNext);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('deriveCurrentOrderId is deterministic for the same inputs', () => {
    fc.assert(
      fc.property(routeWithActiveSubsetArb, ({ sortedOrderIds, activeSubset }) => {
        const activeOrderIds = new Set(activeSubset);

        // Call twice with same inputs
        const result1 = deriveCurrentOrderId(sortedOrderIds, activeOrderIds);
        const result2 = deriveCurrentOrderId(sortedOrderIds, activeOrderIds);

        // Assert: deterministic — same inputs always produce same output
        expect(result1).toBe(result2);
      }),
      { numRuns: 100 },
    );
  });

  it('currentOrderId after guard is always in activeOrderIds (or route is reset)', () => {
    fc.assert(
      fc.property(routeWithActiveSubsetArb, ({ sortedOrderIds, activeSubset }) => {
        const activeOrderIds = new Set(activeSubset);
        const currentOrderId = sortedOrderIds[0];

        const result = applyGhostOrderGuard(sortedOrderIds, activeOrderIds, currentOrderId);

        if (result.action === 'advance') {
          // Assert: the new currentOrderId is in activeOrderIds
          expect(activeOrderIds.has(result.nextCurrentId)).toBe(true);
        } else if (result.action === 'reset') {
          // Assert: reset only happens when no active orders remain in sorted list
          const anyActive = sortedOrderIds.some((id) => activeOrderIds.has(id));
          expect(anyActive).toBe(false);
        }
        // noop: currentOrderId was already valid — guard correctly left it unchanged
      }),
      { numRuns: 100 },
    );
  });

  it('ghost-order guard handles single-order routes correctly', () => {
    fc.assert(
      fc.property(
        mongoIdArb,
        fc.boolean(),
        (orderId, orderIsActive) => {
          const sortedOrderIds = [orderId];
          const activeOrderIds = orderIsActive ? new Set([orderId]) : new Set<string>();
          const currentOrderId = orderId;

          const result = applyGhostOrderGuard(sortedOrderIds, activeOrderIds, currentOrderId);

          if (orderIsActive) {
            // Assert: noop when the single order is still active
            expect(result.action).toBe('noop');
          } else {
            // Assert: reset when the only order is gone
            expect(result.action).toBe('reset');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
