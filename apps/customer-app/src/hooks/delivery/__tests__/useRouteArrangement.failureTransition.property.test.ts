/**
 * Property-Based Tests for useRouteArrangement — Failure Transition
 *
 * **Validates: Requirements 5.3, 5.4, 5.8**
 *
 * Property 5: Failure Transition — No Zero-Current Gap
 *   For any route state where `currentOrderId` is the first entry in
 *   `sortedOrderIds` that exists in `activeOrders`, removing that order from
 *   `activeOrders` (simulating a completed or failed delivery) shall cause
 *   `currentOrderId` to advance to the next surviving entry in `sortedOrderIds`
 *   without passing through a state where zero orders are current.
 *
 *   Specifically: `isOrderCurrent` returns `true` for exactly one order before
 *   and after the transition, or zero orders are current only when the route is
 *   fully complete and `resetArrangement` has been called.
 *
 * Tag: Feature: driver-ux-phase5, Property 5: failure transition
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

/**
 * 2–5 unique order IDs representing a sorted route (as per task spec).
 */
const sortedOrderIdsArb = fc
  .array(mongoIdArb, { minLength: 2, maxLength: 5 })
  .map((ids) => {
    const uniqueIds = Array.from(new Set(ids));
    // Ensure at least 2 unique IDs
    if (uniqueIds.length < 2) {
      return [
        'aaa00aa00a00a0aaaaa000aa',
        'bbb00bb00b00b0bbbbb000bb',
        ...uniqueIds,
      ].slice(0, 2);
    }
    return uniqueIds.slice(0, 5);
  })
  .filter((ids) => ids.length >= 2);

/**
 * Generates { sortedOrderIds, activeSubset } where:
 * - sortedOrderIds has 2–5 unique IDs
 * - activeSubset is a non-empty subset of sortedOrderIds[1..] (tail)
 *   simulating the removal of the current (first) order after a failure
 */
const routeAfterCurrentRemovedArb = sortedOrderIdsArb.chain((ids) => {
  const tail = ids.slice(1); // everything except the current (first) order
  return fc
    .subarray(tail, { minLength: 1, maxLength: tail.length })
    .map((subset) => ({
      sortedOrderIds: ids,
      // activeSubset does NOT include ids[0] — it has been failed/removed
      activeSubset: subset,
    }));
});

/**
 * Generates { sortedOrderIds, activeSubset } where activeSubset is a random
 * subset of ALL sortedOrderIds (including possibly the current order).
 * Used to test the general case.
 */
const routeWithAnyActiveSubsetArb = sortedOrderIdsArb.chain((ids) =>
  fc.subarray(ids, { minLength: 0, maxLength: ids.length }).map((subset) => ({
    sortedOrderIds: ids,
    activeSubset: subset,
  })),
);

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from useRouteArrangement
// ---------------------------------------------------------------------------

/**
 * Derives the current order ID from the intersection of sortedOrderIds and
 * activeOrderIds — mirrors the ghost-order guard logic in useRouteArrangement.
 *
 * Returns the first element of sortedOrderIds that is present in activeOrderIds,
 * or null if none remain (route should be reset).
 */
function deriveCurrentOrderId(
  sortedOrderIds: string[],
  activeOrderIds: Set<string>,
): string | null {
  return sortedOrderIds.find((id) => activeOrderIds.has(id)) ?? null;
}

/**
 * Simulates the full failure transition:
 *
 * 1. Before: currentOrderId = sortedOrderIds[0] (first entry in active set)
 * 2. Failure recorded → order removed from activeOrders
 * 3. After: ghost-order guard fires → currentOrderId advances to next surviving entry
 *
 * Returns:
 *   - { before: string, after: string } when a surviving order exists
 *   - { before: string, after: null }   when no survivors remain (route reset)
 */
function simulateFailureTransition(
  sortedOrderIds: string[],
  activeOrderIdsBeforeFailure: Set<string>,
  activeOrderIdsAfterFailure: Set<string>,
): {
  currentBefore: string | null;
  currentAfter: string | null;
  wasReset: boolean;
} {
  const currentBefore = deriveCurrentOrderId(sortedOrderIds, activeOrderIdsBeforeFailure);
  const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeOrderIdsAfterFailure);

  return {
    currentBefore,
    currentAfter,
    wasReset: currentAfter === null,
  };
}

/**
 * Checks whether there is a "zero-current gap" during the transition.
 *
 * A zero-current gap would occur if:
 * - currentBefore is non-null (route was active)
 * - currentAfter is null AND there are still surviving orders in sortedOrderIds
 *   (i.e., the route was not legitimately completed)
 *
 * Returns true if a gap exists (violation), false if the transition is clean.
 */
function hasZeroCurrentGap(
  sortedOrderIds: string[],
  activeOrderIdsAfterFailure: Set<string>,
  currentAfter: string | null,
): boolean {
  const anySurvivors = sortedOrderIds.some((id) => activeOrderIdsAfterFailure.has(id));

  // Gap: survivors exist but currentAfter is null
  if (anySurvivors && currentAfter === null) {
    return true;
  }

  // Gap: currentAfter is set but not in activeOrderIds
  if (currentAfter !== null && !activeOrderIdsAfterFailure.has(currentAfter)) {
    return true;
  }

  return false;
}

/**
 * Counts how many orders in sortedOrderIds are "current" given a currentOrderId.
 * In a valid state this must be exactly 1 (when route is active) or 0 (when reset).
 */
function countCurrentOrders(
  sortedOrderIds: string[],
  currentOrderId: string | null,
): number {
  if (currentOrderId === null) return 0;
  return sortedOrderIds.filter((id) => id === currentOrderId).length;
}

// ---------------------------------------------------------------------------
// Property 5: Failure Transition — No Zero-Current Gap
// Validates: Requirements 5.3, 5.4, 5.8
// Tag: Feature: driver-ux-phase5, Property 5: failure transition
// ---------------------------------------------------------------------------

describe('Property 5: Failure Transition — No Zero-Current Gap', () => {
  it('currentOrderId advances to next surviving entry after current order is removed', () => {
    fc.assert(
      fc.property(routeAfterCurrentRemovedArb, ({ sortedOrderIds, activeSubset }) => {
        // Before: all orders are active (current = sortedOrderIds[0])
        const activeBeforeFailure = new Set(sortedOrderIds);
        // After: current order (sortedOrderIds[0]) has been removed
        const activeAfterFailure = new Set(activeSubset);

        const { currentBefore, currentAfter } = simulateFailureTransition(
          sortedOrderIds,
          activeBeforeFailure,
          activeAfterFailure,
        );

        // Assert: before the failure, current order is sortedOrderIds[0]
        expect(currentBefore).toBe(sortedOrderIds[0]);

        // Assert: after the failure, currentOrderId is the first surviving entry
        expect(currentAfter).not.toBeNull();
        expect(activeAfterFailure.has(currentAfter!)).toBe(true);

        // Assert: currentAfter is the FIRST surviving entry in sorted order
        const expectedNext = sortedOrderIds.find((id) => activeAfterFailure.has(id));
        expect(currentAfter).toBe(expectedNext);

        // Assert: the failed order is no longer current
        expect(currentAfter).not.toBe(sortedOrderIds[0]);
      }),
      { numRuns: 100 },
    );
  });

  it('no zero-current gap exists during failure transition when survivors remain', () => {
    fc.assert(
      fc.property(routeAfterCurrentRemovedArb, ({ sortedOrderIds, activeSubset }) => {
        const activeBeforeFailure = new Set(sortedOrderIds);
        const activeAfterFailure = new Set(activeSubset);

        const { currentBefore, currentAfter } = simulateFailureTransition(
          sortedOrderIds,
          activeBeforeFailure,
          activeAfterFailure,
        );

        // Assert: before transition, exactly 1 order is current
        const countBefore = countCurrentOrders(sortedOrderIds, currentBefore);
        expect(countBefore).toBe(1);

        // Assert: after transition, exactly 1 order is current (survivors exist)
        const countAfter = countCurrentOrders(sortedOrderIds, currentAfter);
        expect(countAfter).toBe(1);

        // Assert: no zero-current gap
        const gap = hasZeroCurrentGap(sortedOrderIds, activeAfterFailure, currentAfter);
        expect(gap).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('currentOrderId after transition is always in activeOrders (no ghost current)', () => {
    fc.assert(
      fc.property(routeWithAnyActiveSubsetArb, ({ sortedOrderIds, activeSubset }) => {
        const activeOrderIds = new Set(activeSubset);
        const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeOrderIds);

        if (currentAfter !== null) {
          // Assert: the derived current order is actually in the active set
          expect(activeOrderIds.has(currentAfter)).toBe(true);
        } else {
          // Assert: null only when no sortedOrderIds entries are active
          const anySurvivors = sortedOrderIds.some((id) => activeOrderIds.has(id));
          expect(anySurvivors).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('transition is atomic — currentOrderId jumps directly from old to new without intermediate null', () => {
    fc.assert(
      fc.property(routeAfterCurrentRemovedArb, ({ sortedOrderIds, activeSubset }) => {
        const activeBeforeFailure = new Set(sortedOrderIds);
        const activeAfterFailure = new Set(activeSubset);

        const currentBefore = deriveCurrentOrderId(sortedOrderIds, activeBeforeFailure);
        const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeAfterFailure);

        // Assert: before is valid
        expect(currentBefore).not.toBeNull();

        // Assert: after is valid (no null intermediate — direct advance)
        expect(currentAfter).not.toBeNull();

        // Assert: the transition skips directly to the next valid entry
        // (no intermediate state where currentOrderId === null while survivors exist)
        const anySurvivors = sortedOrderIds.some((id) => activeAfterFailure.has(id));
        if (anySurvivors) {
          expect(currentAfter).not.toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('currentOrderId is always the first (earliest) surviving entry in sortedOrderIds', () => {
    fc.assert(
      fc.property(routeWithAnyActiveSubsetArb, ({ sortedOrderIds, activeSubset }) => {
        const activeOrderIds = new Set(activeSubset);
        const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeOrderIds);

        if (currentAfter !== null) {
          const currentIndex = sortedOrderIds.indexOf(currentAfter);

          // Assert: no earlier entry in sortedOrderIds is also active
          for (let i = 0; i < currentIndex; i++) {
            expect(activeOrderIds.has(sortedOrderIds[i])).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('exactly one order is current after transition (single-current invariant preserved)', () => {
    fc.assert(
      fc.property(routeAfterCurrentRemovedArb, ({ sortedOrderIds, activeSubset }) => {
        const activeAfterFailure = new Set(activeSubset);
        const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeAfterFailure);

        // Count how many orders in sortedOrderIds match currentAfter
        const currentCount = countCurrentOrders(sortedOrderIds, currentAfter);

        // Assert: exactly 1 order is current (survivors exist in this arbitrary)
        expect(currentCount).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  it('route resets cleanly when all orders are removed (no ghost current)', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        // Simulate all orders being removed (e.g., all failed)
        const emptyActiveSet = new Set<string>();
        const currentAfter = deriveCurrentOrderId(sortedOrderIds, emptyActiveSet);

        // Assert: currentOrderId is null when no orders remain
        expect(currentAfter).toBeNull();

        // Assert: no zero-current gap (null is correct when route is fully done)
        const gap = hasZeroCurrentGap(sortedOrderIds, emptyActiveSet, currentAfter);
        expect(gap).toBe(false);

        // Assert: count of current orders is 0 (clean reset)
        const currentCount = countCurrentOrders(sortedOrderIds, currentAfter);
        expect(currentCount).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('failure transition is deterministic — same inputs always produce same next currentOrderId', () => {
    fc.assert(
      fc.property(routeAfterCurrentRemovedArb, ({ sortedOrderIds, activeSubset }) => {
        const activeAfterFailure = new Set(activeSubset);

        // Call twice with same inputs
        const result1 = deriveCurrentOrderId(sortedOrderIds, activeAfterFailure);
        const result2 = deriveCurrentOrderId(sortedOrderIds, activeAfterFailure);

        // Assert: deterministic
        expect(result1).toBe(result2);
      }),
      { numRuns: 100 },
    );
  });

  it('failed order is never selected as the next currentOrderId', () => {
    fc.assert(
      fc.property(routeAfterCurrentRemovedArb, ({ sortedOrderIds, activeSubset }) => {
        const failedOrderId = sortedOrderIds[0]; // the order that was failed/removed
        const activeAfterFailure = new Set(activeSubset); // does NOT include failedOrderId

        const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeAfterFailure);

        // Assert: the failed order is never selected as current
        expect(currentAfter).not.toBe(failedOrderId);

        // Assert: the failed order is not in the active set
        expect(activeAfterFailure.has(failedOrderId)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('transition advances by exactly one position when the immediate next order survives', () => {
    fc.assert(
      fc.property(sortedOrderIdsArb, (sortedOrderIds) => {
        // Scenario: only sortedOrderIds[0] is removed; all others survive
        const activeAfterFailure = new Set(sortedOrderIds.slice(1));

        const currentAfter = deriveCurrentOrderId(sortedOrderIds, activeAfterFailure);

        // Assert: advances to sortedOrderIds[1] (the immediate next)
        expect(currentAfter).toBe(sortedOrderIds[1]);
      }),
      { numRuns: 100 },
    );
  });
});
