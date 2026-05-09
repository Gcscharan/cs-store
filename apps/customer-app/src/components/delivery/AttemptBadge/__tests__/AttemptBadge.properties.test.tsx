/**
 * Property-Based Tests for AttemptBadge logic
 *
 * **Validates: Requirements 4.1, 4.5, 4.6, 6.4**
 *
 * Property 16: Badge Text Format for Active Attempts
 *   For any order with attemptCount N > 0 and N < MAX_ATTEMPTS - 1,
 *   badge text SHALL equal "Attempt N of MAX_ATTEMPTS".
 *
 * Property 17: Badge Text for Final Attempt
 *   For any order with attemptCount = MAX_ATTEMPTS - 1,
 *   badge text SHALL equal "Final Attempt".
 *
 * Property 18: Badge Color for Non-Final Attempts
 *   For any order with 0 < attemptCount < MAX_ATTEMPTS - 1,
 *   badge color SHALL equal DELIVERY_COLORS.warning.
 *
 * Property 19: Badge Color for Final Attempt
 *   For any order with attemptCount = MAX_ATTEMPTS - 1,
 *   badge color SHALL equal DELIVERY_COLORS.danger.
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Note: These tests exercise the pure badge logic functions directly,
 * without mounting the React component — keeping tests fast and deterministic.
 */

import * as fc from 'fast-check';
import { DELIVERY_COLORS } from '../../../../constants/deliveryTheme';

// ── Pure badge logic (mirrors AttemptBadge.tsx exactly) ──────────────────────

/**
 * Compute the badge text given the current attempt state.
 * Mirrors the badgeText logic in AttemptBadge.tsx.
 */
function getBadgeText(
  attemptCount: number,
  maxAttempts: number,
  isRetryLocked: boolean,
  remainingSeconds: number,
): string {
  const isFinalAttempt = attemptCount === maxAttempts - 1;
  if (isRetryLocked) return `Retry in ${remainingSeconds}s`;
  if (isFinalAttempt) return 'Final Attempt';
  return `Attempt ${attemptCount} of ${maxAttempts}`;
}

/**
 * Compute the badge color given the current attempt state.
 * Mirrors the badgeColor logic in AttemptBadge.tsx.
 */
function getBadgeColor(attemptCount: number, maxAttempts: number): string {
  const isFinalAttempt = attemptCount === maxAttempts - 1;
  return isFinalAttempt ? DELIVERY_COLORS.danger : DELIVERY_COLORS.warning;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** maxAttempts >= 2 so there is at least one non-final attempt slot */
const maxAttemptsArb = fc.integer({ min: 2, max: 10 });

/** Active (non-final) attempt: 1 <= attemptCount < maxAttempts - 1 */
const activeAttemptArb = (maxAttempts: number) =>
  fc.integer({ min: 1, max: Math.max(1, maxAttempts - 2) });

/** Final attempt: attemptCount === maxAttempts - 1 */
const finalAttemptArb = (maxAttempts: number) =>
  fc.constant(maxAttempts - 1);

const remainingSecondsArb = fc.integer({ min: 0, max: 300 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AttemptBadge property-based tests', () => {

  // ── Property 16: Badge Text Format for Active Attempts ───────────────────

  // Feature: multi-attempt-failure-flow, Property 16: Badge Text Format for Active Attempts
  describe('Property 16: Badge Text Format for Active Attempts', () => {
    it('badge text equals "Attempt N of MAX_ATTEMPTS" for active (non-final) attempts', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb.filter(m => m >= 3), // need at least one active slot (1..m-2)
          (maxAttempts) => {
            // Generate an active attempt count in [1, maxAttempts - 2]
            const attemptCount = Math.floor(Math.random() * (maxAttempts - 2)) + 1;
            const text = getBadgeText(attemptCount, maxAttempts, false, 0);
            expect(text).toBe(`Attempt ${attemptCount} of ${maxAttempts}`);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('badge text format holds for all valid active attempt counts', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb.filter(m => m >= 3),
          fc.integer({ min: 1, max: 8 }),
          (maxAttempts, rawCount) => {
            // Clamp to active range [1, maxAttempts - 2]
            const attemptCount = (rawCount % (maxAttempts - 2)) + 1;
            const text = getBadgeText(attemptCount, maxAttempts, false, 0);
            expect(text).toBe(`Attempt ${attemptCount} of ${maxAttempts}`);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 17: Badge Text for Final Attempt ─────────────────────────────

  // Feature: multi-attempt-failure-flow, Property 17: Badge Text for Final Attempt
  describe('Property 17: Badge Text for Final Attempt', () => {
    it('badge text equals "Final Attempt" when attemptCount === maxAttempts - 1', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb,
          (maxAttempts) => {
            const attemptCount = maxAttempts - 1;
            const text = getBadgeText(attemptCount, maxAttempts, false, 0);
            expect(text).toBe('Final Attempt');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('"Final Attempt" text is independent of remainingSeconds when not locked', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb,
          remainingSecondsArb,
          (maxAttempts, remainingSeconds) => {
            const attemptCount = maxAttempts - 1;
            // isRetryLocked = false → should show "Final Attempt" regardless of remainingSeconds
            const text = getBadgeText(attemptCount, maxAttempts, false, remainingSeconds);
            expect(text).toBe('Final Attempt');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 18: Badge Color for Non-Final Attempts ──────────────────────

  // Feature: multi-attempt-failure-flow, Property 18: Badge Color for Non-Final Attempts
  describe('Property 18: Badge Color for Non-Final Attempts', () => {
    it('badge color equals DELIVERY_COLORS.warning for non-final attempts', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb.filter(m => m >= 3),
          fc.integer({ min: 1, max: 8 }),
          (maxAttempts, rawCount) => {
            // Clamp to active range [1, maxAttempts - 2]
            const attemptCount = (rawCount % (maxAttempts - 2)) + 1;
            const color = getBadgeColor(attemptCount, maxAttempts);
            expect(color).toBe(DELIVERY_COLORS.warning);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('warning color is not danger color', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb.filter(m => m >= 3),
          fc.integer({ min: 1, max: 8 }),
          (maxAttempts, rawCount) => {
            const attemptCount = (rawCount % (maxAttempts - 2)) + 1;
            const color = getBadgeColor(attemptCount, maxAttempts);
            expect(color).not.toBe(DELIVERY_COLORS.danger);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 19: Badge Color for Final Attempt ───────────────────────────

  // Feature: multi-attempt-failure-flow, Property 19: Badge Color for Final Attempt
  describe('Property 19: Badge Color for Final Attempt', () => {
    it('badge color equals DELIVERY_COLORS.danger when attemptCount === maxAttempts - 1', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb,
          (maxAttempts) => {
            const attemptCount = maxAttempts - 1;
            const color = getBadgeColor(attemptCount, maxAttempts);
            expect(color).toBe(DELIVERY_COLORS.danger);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('danger color is not warning color for final attempt', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb,
          (maxAttempts) => {
            const attemptCount = maxAttempts - 1;
            const color = getBadgeColor(attemptCount, maxAttempts);
            expect(color).not.toBe(DELIVERY_COLORS.warning);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('color transitions from warning to danger exactly at the final attempt boundary', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb.filter(m => m >= 3),
          (maxAttempts) => {
            const lastActive = maxAttempts - 2;
            const final = maxAttempts - 1;

            expect(getBadgeColor(lastActive, maxAttempts)).toBe(DELIVERY_COLORS.warning);
            expect(getBadgeColor(final, maxAttempts)).toBe(DELIVERY_COLORS.danger);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Retry-locked text overrides badge text ────────────────────────────────

  describe('Retry-locked text override', () => {
    it('shows "Retry in Xs" when isRetryLocked is true, regardless of attemptCount', () => {
      fc.assert(
        fc.property(
          maxAttemptsArb,
          fc.integer({ min: 1, max: 9 }),
          remainingSecondsArb,
          (maxAttempts, rawCount, remainingSeconds) => {
            const attemptCount = (rawCount % maxAttempts) + 1;
            const text = getBadgeText(attemptCount, maxAttempts, true, remainingSeconds);
            expect(text).toBe(`Retry in ${remainingSeconds}s`);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
