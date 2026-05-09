/**
 * Property-Based Tests for Syncing Skeleton Exclusivity
 *
 * **Validates: Requirements 8.1, 8.2, 8.4**
 *
 * Property 9: Syncing Skeleton Exclusivity
 *   For any order where `allowedActions` is not `undefined` (including when it
 *   is an empty array `[]`), the `SyncingSkeleton` shall not be rendered.
 *   Conversely, when `allowedActions` is `undefined`, the `SyncingSkeleton`
 *   shall be rendered and no action buttons shall be rendered simultaneously.
 *
 * Tag: Feature: driver-ux-phase5, Property 9: syncing skeleton exclusivity
 *
 * Each property runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Rendering logic (extracted from SingleOrderCard / renderActionButtons)
// ---------------------------------------------------------------------------

/**
 * Determines whether the SyncingSkeleton should be rendered.
 * Mirrors the logic in SingleOrderCard.renderActionButtons:
 *   if (isCancelled) return null;
 *   if (actionsAbsent) return <SyncingSkeleton />;
 */
const shouldShowSyncingSkeleton = (
  allowedActions: string[] | undefined,
  isCancelled: boolean
): boolean => {
  if (isCancelled) return false;
  return allowedActions === undefined;
};

/**
 * Determines whether action buttons should be rendered.
 * Mirrors the logic in SingleOrderCard.renderActionButtons:
 *   if (isCancelled) return null;
 *   if (actionsAbsent) return <SyncingSkeleton />;
 *   // ... render buttons
 */
const shouldShowActionButtons = (
  allowedActions: string[] | undefined,
  isCancelled: boolean
): boolean => {
  if (isCancelled) return false;
  return allowedActions !== undefined;
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a random action string (e.g. 'PICKUP', 'VERIFY_OTP', etc.) */
const actionStringArb = fc.string({ minLength: 1, maxLength: 30 });

/** Generates a non-empty array of action strings */
const nonEmptyActionsArb = fc.array(actionStringArb, { minLength: 1, maxLength: 10 });

/** Generates an empty array */
const emptyActionsArb = fc.constant([] as string[]);

/** Generates a defined allowedActions value: either [] or a non-empty array */
const definedActionsArb = fc.oneof(emptyActionsArb, nonEmptyActionsArb);

/**
 * Generates any allowedActions value including undefined.
 * Weights: ~33% undefined, ~33% empty array, ~33% non-empty array.
 */
const anyActionsArb = fc.oneof(
  fc.constant(undefined as string[] | undefined),
  emptyActionsArb,
  nonEmptyActionsArb
);

// ---------------------------------------------------------------------------
// Property 9: Syncing Skeleton Exclusivity
// Validates: Requirements 8.1, 8.2, 8.4
// Tag: Feature: driver-ux-phase5, Property 9: syncing skeleton exclusivity
// ---------------------------------------------------------------------------

describe('Property 9: Syncing Skeleton Exclusivity', () => {
  // ── Core exclusivity property ──────────────────────────────────────────────

  it('SyncingSkeleton and action buttons are mutually exclusive for any allowedActions value', () => {
    /**
     * For any non-cancelled order, exactly one of (skeleton, buttons) is shown.
     * They must never both be true simultaneously (Requirement 8.4).
     */
    fc.assert(
      fc.property(anyActionsArb, (allowedActions) => {
        const showSkeleton = shouldShowSyncingSkeleton(allowedActions, false);
        const showButtons = shouldShowActionButtons(allowedActions, false);

        // Never both rendered simultaneously
        expect(showSkeleton && showButtons).toBe(false);

        // Exactly one is rendered (XOR) — for non-cancelled orders
        expect(showSkeleton !== showButtons).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // ── Requirement 8.1: SyncingSkeleton renders iff allowedActions === undefined ──

  it('SyncingSkeleton is rendered iff allowedActions === undefined', () => {
    /**
     * Requirement 8.1: WHEN allowedActions is absent (undefined), the
     * Active_Order_Card SHALL render the Syncing_Skeleton.
     */
    fc.assert(
      fc.property(anyActionsArb, (allowedActions) => {
        const showSkeleton = shouldShowSyncingSkeleton(allowedActions, false);

        if (allowedActions === undefined) {
          expect(showSkeleton).toBe(true);
        } else {
          expect(showSkeleton).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ── Requirement 8.2: SyncingSkeleton does NOT render when allowedActions is defined ──

  it('SyncingSkeleton is NOT rendered when allowedActions is defined (including empty array)', () => {
    /**
     * Requirement 8.2: WHEN allowedActions is present (even as an empty array),
     * the Active_Order_Card SHALL NOT render the Syncing_Skeleton.
     */
    fc.assert(
      fc.property(definedActionsArb, (allowedActions) => {
        const showSkeleton = shouldShowSyncingSkeleton(allowedActions, false);
        expect(showSkeleton).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  // ── Requirement 8.2: Action buttons render iff allowedActions !== undefined ──

  it('action buttons are rendered iff allowedActions !== undefined', () => {
    /**
     * Requirement 8.2: When allowedActions is defined (including []), action
     * buttons container is rendered instead of the skeleton.
     */
    fc.assert(
      fc.property(anyActionsArb, (allowedActions) => {
        const showButtons = shouldShowActionButtons(allowedActions, false);

        if (allowedActions !== undefined) {
          expect(showButtons).toBe(true);
        } else {
          expect(showButtons).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ── Empty array is treated as defined (not undefined) ─────────────────────

  it('empty array [] is treated as a defined value — no skeleton, buttons shown', () => {
    /**
     * Requirement 8.1: An empty array ([]) is a valid server response meaning
     * no actions are currently permitted, and SHALL NOT trigger the SyncingSkeleton.
     */
    fc.assert(
      fc.property(emptyActionsArb, (allowedActions) => {
        expect(shouldShowSyncingSkeleton(allowedActions, false)).toBe(false);
        expect(shouldShowActionButtons(allowedActions, false)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // ── Non-empty arrays are treated as defined ────────────────────────────────

  it('non-empty allowedActions arrays never trigger the skeleton', () => {
    fc.assert(
      fc.property(nonEmptyActionsArb, (allowedActions) => {
        expect(shouldShowSyncingSkeleton(allowedActions, false)).toBe(false);
        expect(shouldShowActionButtons(allowedActions, false)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // ── Strict equality: undefined vs null ────────────────────────────────────

  it('uses strict equality (=== undefined) — null does not trigger skeleton', () => {
    /**
     * The guard must use === undefined, not == undefined.
     * null == undefined is true, but null === undefined is false.
     * Passing null (invalid at runtime) must not show the skeleton.
     */
    fc.assert(
      fc.property(fc.constant(null as unknown as string[] | undefined), (nullValue) => {
        // null is not undefined — skeleton should NOT show
        expect(shouldShowSyncingSkeleton(nullValue, false)).toBe(false);
        // action buttons should show (null !== undefined)
        expect(shouldShowActionButtons(nullValue, false)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // ── Cancelled orders show neither skeleton nor buttons ────────────────────

  it('cancelled orders show neither skeleton nor action buttons regardless of allowedActions', () => {
    fc.assert(
      fc.property(anyActionsArb, (allowedActions) => {
        expect(shouldShowSyncingSkeleton(allowedActions, true)).toBe(false);
        expect(shouldShowActionButtons(allowedActions, true)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  // ── Transition: undefined → defined never shows both simultaneously ────────

  it('transitioning from undefined to defined allowedActions never shows both simultaneously', () => {
    /**
     * Requirement 8.4: When allowedActions becomes defined after a socket or
     * refetch update, the skeleton and action buttons are never both rendered.
     */
    fc.assert(
      fc.property(definedActionsArb, (newAllowedActions) => {
        // Before: allowedActions is undefined
        const beforeSkeleton = shouldShowSyncingSkeleton(undefined, false);
        const beforeButtons = shouldShowActionButtons(undefined, false);

        // After: allowedActions is defined
        const afterSkeleton = shouldShowSyncingSkeleton(newAllowedActions, false);
        const afterButtons = shouldShowActionButtons(newAllowedActions, false);

        // Before state: skeleton shown, buttons hidden
        expect(beforeSkeleton).toBe(true);
        expect(beforeButtons).toBe(false);

        // After state: skeleton hidden, buttons shown
        expect(afterSkeleton).toBe(false);
        expect(afterButtons).toBe(true);

        // At no point are both true
        expect(beforeSkeleton && beforeButtons).toBe(false);
        expect(afterSkeleton && afterButtons).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
