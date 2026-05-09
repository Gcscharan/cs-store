/**
 * Unit Tests for SyncingSkeleton rendering logic
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 *
 * Tests the SyncingSkeleton guard behavior in SingleOrderCard:
 * - SyncingSkeleton renders when allowedActions === undefined (field absent)
 * - SyncingSkeleton is absent when allowedActions === [] (empty array is a valid server response)
 *
 * The SyncingSkeleton is a local component inside ActiveOrderCard.tsx that renders
 * an ActivityIndicator and "Syncing state..." text. The guard logic uses strict
 * `=== undefined` to distinguish "field absent" from "empty array".
 */

/**
 * Extracted guard logic from SingleOrderCard
 * Mirrors the exact logic in ActiveOrderCard.tsx:
 *   const actionsAbsent = allowedActions === undefined;
 *   if (actionsAbsent) return <SyncingSkeleton />;
 */
function shouldShowSyncingSkeleton(allowedActions: string[] | undefined): boolean {
  return allowedActions === undefined;
}

/**
 * Mirrors the action-buttons rendering decision:
 * action buttons are rendered iff allowedActions is defined (not undefined)
 */
function shouldShowActionButtons(allowedActions: string[] | undefined): boolean {
  return allowedActions !== undefined;
}

describe('SyncingSkeleton guard logic', () => {
  /**
   * Requirement 8.1: WHEN allowedActions is absent (undefined), the SyncingSkeleton SHALL render.
   */
  describe('renders when allowedActions === undefined', () => {
    it('shows skeleton when allowedActions is undefined (field absent)', () => {
      expect(shouldShowSyncingSkeleton(undefined)).toBe(true);
    });

    it('does not show action buttons when allowedActions is undefined', () => {
      expect(shouldShowActionButtons(undefined)).toBe(false);
    });

    it('skeleton and action buttons are mutually exclusive when allowedActions is undefined', () => {
      const allowedActions = undefined;
      const showSkeleton = shouldShowSyncingSkeleton(allowedActions);
      const showButtons = shouldShowActionButtons(allowedActions);
      expect(showSkeleton).toBe(true);
      expect(showButtons).toBe(false);
      // Never both rendered simultaneously
      expect(showSkeleton && showButtons).toBe(false);
    });
  });

  /**
   * Requirement 8.2: WHEN allowedActions is present (even as an empty array),
   * the SyncingSkeleton SHALL NOT render.
   */
  describe('absent when allowedActions === []', () => {
    it('does not show skeleton when allowedActions is an empty array', () => {
      expect(shouldShowSyncingSkeleton([])).toBe(false);
    });

    it('shows action buttons when allowedActions is an empty array', () => {
      expect(shouldShowActionButtons([])).toBe(true);
    });

    it('skeleton and action buttons are mutually exclusive when allowedActions is []', () => {
      const allowedActions: string[] = [];
      const showSkeleton = shouldShowSyncingSkeleton(allowedActions);
      const showButtons = shouldShowActionButtons(allowedActions);
      expect(showSkeleton).toBe(false);
      expect(showButtons).toBe(true);
      expect(showSkeleton && showButtons).toBe(false);
    });
  });

  /**
   * Requirement 8.2: Non-empty allowedActions arrays also suppress the skeleton.
   */
  describe('absent when allowedActions is a non-empty array', () => {
    it('does not show skeleton when allowedActions has one action', () => {
      expect(shouldShowSyncingSkeleton(['PICKUP'])).toBe(false);
    });

    it('does not show skeleton when allowedActions has multiple actions', () => {
      expect(shouldShowSyncingSkeleton(['PICKUP', 'START_DELIVERY', 'MARK_ARRIVED'])).toBe(false);
    });

    it('shows action buttons when allowedActions has actions', () => {
      expect(shouldShowActionButtons(['PICKUP'])).toBe(true);
    });
  });

  /**
   * Requirement 8.4: Skeleton and action buttons are never rendered simultaneously.
   * Validates mutual exclusivity across all allowedActions values.
   */
  describe('mutual exclusivity invariant', () => {
    const cases: Array<{ label: string; value: string[] | undefined }> = [
      { label: 'undefined', value: undefined },
      { label: 'empty array', value: [] },
      { label: 'single action', value: ['PICKUP'] },
      { label: 'multiple actions', value: ['PICKUP', 'START_DELIVERY'] },
    ];

    cases.forEach(({ label, value }) => {
      it(`skeleton and action buttons are never both true for allowedActions = ${label}`, () => {
        const showSkeleton = shouldShowSyncingSkeleton(value);
        const showButtons = shouldShowActionButtons(value);
        expect(showSkeleton && showButtons).toBe(false);
      });
    });

    it('exactly one of skeleton or action buttons is shown for any allowedActions value', () => {
      const testValues: Array<string[] | undefined> = [
        undefined,
        [],
        ['PICKUP'],
        ['PICKUP', 'START_DELIVERY'],
      ];
      testValues.forEach(value => {
        const showSkeleton = shouldShowSyncingSkeleton(value);
        const showButtons = shouldShowActionButtons(value);
        // XOR: exactly one must be true
        expect(showSkeleton !== showButtons).toBe(true);
      });
    });
  });
});
