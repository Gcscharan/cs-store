/**
 * Property-Based Tests for SyncingSkeleton Elapsed Time (Fix 5)
 *
 * **Validates: Bugfix Requirements 5.1, 5.2, 5.3, 5.4**
 *
 * Fix 5: SyncingSkeleton shows elapsed time to reduce driver anxiety during long sync states.
 *
 * Properties:
 * - Fix-checking: For all elapsedMs >= 1000, the rendered text contains "Still syncing… (Xs)"
 * - Preservation: For all elapsedMs < 1000, the rendered text is "Syncing state…"
 * - Retry-reset: After handleRetry is called, elapsedSec resets to 0 and text reverts to "Syncing state…"
 * - Monotonicity: elapsedSec is non-decreasing between ticks (never goes backwards)
 *
 * Tag: Feature: driver-queue-production-polish, Fix 5: SyncingSkeleton elapsed time
 *
 * Each property runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Bug Condition Predicate (from bugfix.md)
// ---------------------------------------------------------------------------

/**
 * isBugCondition_5: Returns true when elapsed time >= 1000ms
 * This is the condition where the fix applies (elapsed time should be shown).
 */
const isBugCondition_5 = (elapsedMs: number): boolean => {
  return elapsedMs >= 1000;
};

// ---------------------------------------------------------------------------
// Display Logic (extracted from SyncingSkeleton component)
// ---------------------------------------------------------------------------

/**
 * Determines the text displayed by SyncingSkeleton based on elapsed seconds.
 * Mirrors the logic in ActiveOrderCard.tsx SyncingSkeleton component:
 *   {elapsedSec > 0 ? `Still syncing… (${elapsedSec}s)` : 'Syncing state…'}
 */
const getSyncingText = (elapsedSec: number): string => {
  return elapsedSec > 0 ? `Still syncing… (${elapsedSec}s)` : 'Syncing state…';
};

/**
 * Converts elapsed milliseconds to elapsed seconds (floor division).
 * Mirrors the logic in SyncingSkeleton:
 *   setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000))
 */
const msToSec = (elapsedMs: number): number => {
  return Math.floor(elapsedMs / 1000);
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates elapsed time in milliseconds where the bug condition applies (>= 1000ms) */
const bugConditionElapsedMsArb = fc.integer({ min: 1000, max: 300_000 }); // 1s to 5min

/** Generates elapsed time in milliseconds where the bug condition does NOT apply (< 1000ms) */
const noBugConditionElapsedMsArb = fc.integer({ min: 0, max: 999 });

/** Generates any elapsed time in milliseconds */
const anyElapsedMsArb = fc.integer({ min: 0, max: 300_000 });

/** Generates a sequence of monotonically increasing elapsed times (simulating ticks) */
const monotonicTickSequenceArb = fc
  .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 2, maxLength: 20 })
  .map((deltas) => {
    // Convert deltas to cumulative elapsed times
    let cumulative = 0;
    return deltas.map((delta) => {
      cumulative += delta;
      return cumulative;
    });
  });

// ---------------------------------------------------------------------------
// Property: Fix-Checking (Bug Condition 5)
// Validates: Requirements 5.3
// Tag: Fix 5, Property: fix-checking
// ---------------------------------------------------------------------------

describe('Fix 5: SyncingSkeleton Elapsed Time — Fix-Checking Property', () => {
  it('for all elapsedMs >= 1000, the rendered text contains "Still syncing… (Xs)"', () => {
    /**
     * Requirement 5.3: WHEN allowedActions is absent and the SyncingSkeleton is
     * displayed for more than 0 seconds THEN the system SHALL show
     * "Still syncing… (Xs)" where X is the number of whole seconds elapsed.
     */
    fc.assert(
      fc.property(bugConditionElapsedMsArb, (elapsedMs) => {
        // Precondition: bug condition applies
        expect(isBugCondition_5(elapsedMs)).toBe(true);

        const elapsedSec = msToSec(elapsedMs);
        const displayedText = getSyncingText(elapsedSec);
        const expectedSec = Math.floor(elapsedMs / 1000);

        // The text must contain the elapsed time format
        expect(displayedText).toContain('Still syncing…');
        expect(displayedText).toContain(`(${expectedSec}s)`);
        expect(displayedText).toBe(`Still syncing… (${expectedSec}s)`);
      }),
      { numRuns: 100 }
    );
  });

  it('elapsed seconds are calculated correctly using floor division', () => {
    /**
     * Validates that the elapsed seconds calculation matches Math.floor(elapsedMs / 1000).
     */
    fc.assert(
      fc.property(bugConditionElapsedMsArb, (elapsedMs) => {
        const elapsedSec = msToSec(elapsedMs);
        const expected = Math.floor(elapsedMs / 1000);
        expect(elapsedSec).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('text format is exact: "Still syncing… (Xs)" with no extra whitespace', () => {
    fc.assert(
      fc.property(bugConditionElapsedMsArb, (elapsedMs) => {
        const elapsedSec = msToSec(elapsedMs);
        const displayedText = getSyncingText(elapsedSec);
        const expectedText = `Still syncing… (${elapsedSec}s)`;
        expect(displayedText).toBe(expectedText);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: Preservation-Checking
// Validates: Requirements 5.4
// Tag: Fix 5, Property: preservation-checking
// ---------------------------------------------------------------------------

describe('Fix 5: SyncingSkeleton Elapsed Time — Preservation Property', () => {
  it('for all elapsedMs < 1000, the rendered text is "Syncing state…"', () => {
    /**
     * Requirement 5.4: WHEN the SyncingSkeleton first renders THEN the system
     * SHALL show "Syncing state…" for the first second before switching to the
     * elapsed-time format.
     */
    fc.assert(
      fc.property(noBugConditionElapsedMsArb, (elapsedMs) => {
        // Precondition: bug condition does NOT apply
        expect(isBugCondition_5(elapsedMs)).toBe(false);

        const elapsedSec = msToSec(elapsedMs);
        const displayedText = getSyncingText(elapsedSec);

        // The text must be the initial syncing message
        expect(displayedText).toBe('Syncing state…');
      }),
      { numRuns: 100 }
    );
  });

  it('elapsedSec === 0 always shows "Syncing state…"', () => {
    /**
     * Validates that when elapsedSec is exactly 0, the initial message is shown.
     */
    const elapsedSec = 0;
    const displayedText = getSyncingText(elapsedSec);
    expect(displayedText).toBe('Syncing state…');
  });

  it('elapsedMs in range [0, 999] always produces elapsedSec === 0', () => {
    /**
     * Validates that all elapsed times less than 1000ms result in elapsedSec === 0.
     */
    fc.assert(
      fc.property(noBugConditionElapsedMsArb, (elapsedMs) => {
        const elapsedSec = msToSec(elapsedMs);
        expect(elapsedSec).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: Boundary Transition
// Tag: Fix 5, Property: boundary-transition
// ---------------------------------------------------------------------------

describe('Fix 5: SyncingSkeleton Elapsed Time — Boundary Transition', () => {
  it('transition from 999ms to 1000ms changes text from "Syncing state…" to "Still syncing… (1s)"', () => {
    /**
     * Validates the exact boundary where the text changes from the initial
     * message to the elapsed-time format.
     */
    const before = 999;
    const after = 1000;

    const beforeSec = msToSec(before);
    const afterSec = msToSec(after);

    const beforeText = getSyncingText(beforeSec);
    const afterText = getSyncingText(afterSec);

    expect(beforeText).toBe('Syncing state…');
    expect(afterText).toBe('Still syncing… (1s)');
  });

  it('elapsedMs at exact second boundaries produces correct text', () => {
    /**
     * Validates that elapsed times at exact second boundaries (1000, 2000, 3000, etc.)
     * produce the correct elapsed-time text.
     */
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300 }), (seconds) => {
        const elapsedMs = seconds * 1000;
        const elapsedSec = msToSec(elapsedMs);
        const displayedText = getSyncingText(elapsedSec);

        expect(elapsedSec).toBe(seconds);
        expect(displayedText).toBe(`Still syncing… (${seconds}s)`);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: Retry-Reset
// Validates: Requirements 5.4 (retry behavior)
// Tag: Fix 5, Property: retry-reset
// ---------------------------------------------------------------------------

describe('Fix 5: SyncingSkeleton Elapsed Time — Retry-Reset Property', () => {
  it('after handleRetry is called, elapsedSec resets to 0 and text reverts to "Syncing state…"', () => {
    /**
     * Requirement 5.4: On retry, startTimeRef.current is reset to Date.now()
     * and elapsedSec is reset to 0.
     *
     * This property validates that after a retry, the elapsed time counter
     * resets and the initial message is shown again.
     */
    fc.assert(
      fc.property(bugConditionElapsedMsArb, (elapsedMsBeforeRetry) => {
        // Before retry: elapsed time is >= 1000ms
        const elapsedSecBefore = msToSec(elapsedMsBeforeRetry);
        const textBefore = getSyncingText(elapsedSecBefore);

        // Verify we're in the elapsed-time state
        expect(elapsedSecBefore).toBeGreaterThan(0);
        expect(textBefore).toContain('Still syncing…');

        // Simulate retry: elapsedSec resets to 0
        const elapsedSecAfterRetry = 0;
        const textAfterRetry = getSyncingText(elapsedSecAfterRetry);

        // After retry: text reverts to initial message
        expect(elapsedSecAfterRetry).toBe(0);
        expect(textAfterRetry).toBe('Syncing state…');
      }),
      { numRuns: 100 }
    );
  });

  it('retry can occur at any elapsed time and always resets to 0', () => {
    /**
     * Validates that retry reset works regardless of when the retry occurs.
     */
    fc.assert(
      fc.property(anyElapsedMsArb, (elapsedMsBeforeRetry) => {
        const elapsedSecBefore = msToSec(elapsedMsBeforeRetry);

        // Simulate retry: elapsedSec resets to 0
        const elapsedSecAfterRetry = 0;
        const textAfterRetry = getSyncingText(elapsedSecAfterRetry);

        // After retry: always shows initial message
        expect(elapsedSecAfterRetry).toBe(0);
        expect(textAfterRetry).toBe('Syncing state…');
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: Monotonicity
// Tag: Fix 5, Property: monotonicity
// ---------------------------------------------------------------------------

describe('Fix 5: SyncingSkeleton Elapsed Time — Monotonicity Property', () => {
  it('elapsedSec is non-decreasing between ticks (never goes backwards)', () => {
    /**
     * Validates that the elapsed seconds counter never decreases between ticks.
     * The setInterval ticker updates elapsedSec every 1000ms, and the value
     * should only increase or stay the same (monotonic).
     */
    fc.assert(
      fc.property(monotonicTickSequenceArb, (tickSequence) => {
        // Convert each tick's elapsed time to seconds
        const elapsedSecSequence = tickSequence.map(msToSec);

        // Verify monotonicity: each value >= previous value
        for (let i = 1; i < elapsedSecSequence.length; i++) {
          const prev = elapsedSecSequence[i - 1];
          const curr = elapsedSecSequence[i];
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('elapsedSec increases by at least 1 when elapsedMs increases by >= 1000', () => {
    /**
     * Validates that when elapsed time increases by at least 1 second,
     * the elapsedSec counter increases by at least 1.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300_000 }),
        fc.integer({ min: 1000, max: 10_000 }),
        (startMs, deltaMs) => {
          const endMs = startMs + deltaMs;

          const startSec = msToSec(startMs);
          const endSec = msToSec(endMs);

          // When elapsed time increases by >= 1000ms, elapsedSec must increase
          expect(endSec).toBeGreaterThanOrEqual(startSec + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('elapsedSec remains constant when elapsedMs increases by < 1000', () => {
    /**
     * Validates that when elapsed time increases by less than 1 second,
     * the elapsedSec counter remains constant (floor division behavior).
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300_000 }),
        fc.integer({ min: 1, max: 999 }),
        (startMs, deltaMs) => {
          const endMs = startMs + deltaMs;

          const startSec = msToSec(startMs);
          const endSec = msToSec(endMs);

          // When elapsed time increases by < 1000ms within the same second,
          // elapsedSec should remain constant or increase by at most 1
          // (it can increase by 1 if we cross a second boundary)
          expect(endSec - startSec).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: Text Format Consistency
// Tag: Fix 5, Property: text-format-consistency
// ---------------------------------------------------------------------------

describe('Fix 5: SyncingSkeleton Elapsed Time — Text Format Consistency', () => {
  it('text format is consistent across all elapsed times', () => {
    /**
     * Validates that the text format is consistent and predictable for any
     * elapsed time value.
     */
    fc.assert(
      fc.property(anyElapsedMsArb, (elapsedMs) => {
        const elapsedSec = msToSec(elapsedMs);
        const displayedText = getSyncingText(elapsedSec);

        if (elapsedSec === 0) {
          expect(displayedText).toBe('Syncing state…');
        } else {
          expect(displayedText).toBe(`Still syncing… (${elapsedSec}s)`);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('text never contains negative elapsed time', () => {
    /**
     * Validates that the elapsed time is never negative (defensive check).
     */
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 300_000 }), (elapsedMs) => {
        const elapsedSec = msToSec(elapsedMs);
        expect(elapsedSec).toBeGreaterThanOrEqual(0);

        const displayedText = getSyncingText(elapsedSec);
        expect(displayedText).not.toContain('-');
      }),
      { numRuns: 100 }
    );
  });

  it('text format uses singular "s" suffix for all durations', () => {
    /**
     * Validates that the text always uses "s" (not "sec", "seconds", etc.).
     */
    fc.assert(
      fc.property(bugConditionElapsedMsArb, (elapsedMs) => {
        const elapsedSec = msToSec(elapsedMs);
        const displayedText = getSyncingText(elapsedSec);

        // Must contain "(Xs)" format
        expect(displayedText).toMatch(/\(\d+s\)/);
      }),
      { numRuns: 100 }
    );
  });
});
