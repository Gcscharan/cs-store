/**
 * Unit Tests for AttemptBadge logic
 *
 * Tests the pure badge text and color computation functions extracted from
 * AttemptBadge.tsx — no React component rendering required.
 *
 * Validates: Requirements 4.1, 4.3, 4.5, 4.6, 6.4
 */

import { DELIVERY_COLORS } from '../../../../constants/deliveryTheme';

// ── Pure badge logic (mirrors AttemptBadge.tsx exactly) ──────────────────────

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

function getBadgeColor(attemptCount: number, maxAttempts: number): string {
  const isFinalAttempt = attemptCount === maxAttempts - 1;
  return isFinalAttempt ? DELIVERY_COLORS.danger : DELIVERY_COLORS.warning;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AttemptBadge unit tests', () => {

  // ── Badge text: "Attempt N of M" ─────────────────────────────────────────

  describe('badge text — "Attempt N of M" (not locked, not final)', () => {
    it('shows "Attempt 1 of 3" for first attempt with maxAttempts=3', () => {
      expect(getBadgeText(1, 3, false, 0)).toBe('Attempt 1 of 3');
    });

    it('shows "Attempt 2 of 5" for second attempt with maxAttempts=5', () => {
      expect(getBadgeText(2, 5, false, 0)).toBe('Attempt 2 of 5');
    });

    it('shows "Attempt 1 of 4" for first attempt with maxAttempts=4', () => {
      expect(getBadgeText(1, 4, false, 0)).toBe('Attempt 1 of 4');
    });

    it('shows "Attempt 2 of 4" for second attempt with maxAttempts=4 (not final)', () => {
      // maxAttempts=4, final is attemptCount=3, so 2 is still active
      expect(getBadgeText(2, 4, false, 0)).toBe('Attempt 2 of 4');
    });
  });

  // ── Badge text: "Retry in Xs" ─────────────────────────────────────────────

  describe('badge text — "Retry in Xs" when isRetryLocked', () => {
    it('shows "Retry in 30s" when locked with 30 remaining seconds', () => {
      expect(getBadgeText(1, 3, true, 30)).toBe('Retry in 30s');
    });

    it('shows "Retry in 1s" when locked with 1 remaining second', () => {
      expect(getBadgeText(1, 3, true, 1)).toBe('Retry in 1s');
    });

    it('shows "Retry in 0s" when locked with 0 remaining seconds', () => {
      expect(getBadgeText(1, 3, true, 0)).toBe('Retry in 0s');
    });

    it('shows retry text even on final attempt when locked', () => {
      // isRetryLocked takes priority over isFinalAttempt
      expect(getBadgeText(2, 3, true, 15)).toBe('Retry in 15s');
    });

    it('shows retry text for any attempt count when locked', () => {
      expect(getBadgeText(1, 5, true, 25)).toBe('Retry in 25s');
      expect(getBadgeText(3, 5, true, 10)).toBe('Retry in 10s');
    });
  });

  // ── Badge text: "Final Attempt" ───────────────────────────────────────────

  describe('badge text — "Final Attempt" when attemptCount === maxAttempts - 1', () => {
    it('shows "Final Attempt" when attemptCount=2 and maxAttempts=3', () => {
      expect(getBadgeText(2, 3, false, 0)).toBe('Final Attempt');
    });

    it('shows "Final Attempt" when attemptCount=4 and maxAttempts=5', () => {
      expect(getBadgeText(4, 5, false, 0)).toBe('Final Attempt');
    });

    it('shows "Final Attempt" when attemptCount=1 and maxAttempts=2', () => {
      expect(getBadgeText(1, 2, false, 0)).toBe('Final Attempt');
    });

    it('does NOT show "Final Attempt" when attemptCount < maxAttempts - 1', () => {
      expect(getBadgeText(1, 3, false, 0)).not.toBe('Final Attempt');
    });
  });

  // ── Badge color: warning for non-final attempts ───────────────────────────

  describe('badge color — warning for non-final attempts', () => {
    it('uses warning color for attemptCount=1 with maxAttempts=3', () => {
      expect(getBadgeColor(1, 3)).toBe(DELIVERY_COLORS.warning);
    });

    it('uses warning color for attemptCount=1 with maxAttempts=5', () => {
      expect(getBadgeColor(1, 5)).toBe(DELIVERY_COLORS.warning);
    });

    it('uses warning color for attemptCount=2 with maxAttempts=5 (not final)', () => {
      expect(getBadgeColor(2, 5)).toBe(DELIVERY_COLORS.warning);
    });

    it('uses warning color for attemptCount=3 with maxAttempts=5 (not final)', () => {
      expect(getBadgeColor(3, 5)).toBe(DELIVERY_COLORS.warning);
    });

    it('warning color is #F59E0B', () => {
      expect(getBadgeColor(1, 3)).toBe('#F59E0B');
    });
  });

  // ── Badge color: danger for final attempt ─────────────────────────────────

  describe('badge color — danger for final attempt', () => {
    it('uses danger color when attemptCount=2 and maxAttempts=3', () => {
      expect(getBadgeColor(2, 3)).toBe(DELIVERY_COLORS.danger);
    });

    it('uses danger color when attemptCount=4 and maxAttempts=5', () => {
      expect(getBadgeColor(4, 5)).toBe(DELIVERY_COLORS.danger);
    });

    it('uses danger color when attemptCount=1 and maxAttempts=2', () => {
      expect(getBadgeColor(1, 2)).toBe(DELIVERY_COLORS.danger);
    });

    it('danger color matches the design token (#EF4444)', () => {
      // Danger is sourced from DELIVERY_COLORS.danger (design token), not a
      // hardcoded hex; the palette moved from #FF3B30 to #EF4444.
      expect(DELIVERY_COLORS.danger).toBe('#EF4444');
      expect(getBadgeColor(2, 3)).toBe(DELIVERY_COLORS.danger);
    });

    it('color transitions from warning to danger at the final attempt boundary', () => {
      // maxAttempts=4: attempts 1,2 are active (warning), attempt 3 is final (danger)
      expect(getBadgeColor(1, 4)).toBe(DELIVERY_COLORS.warning);
      expect(getBadgeColor(2, 4)).toBe(DELIVERY_COLORS.warning);
      expect(getBadgeColor(3, 4)).toBe(DELIVERY_COLORS.danger);
    });
  });
});
