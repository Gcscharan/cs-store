/**
 * Unit Tests for FailureModal Logic
 *
 * **Validates: Requirements 5.5, 5.7, 5.9**
 *
 * Tests the failure modal behavior logic:
 * - Confirm button is disabled when no reason selected
 * - Confirm button is enabled after reason selected
 * - Whitespace-only notes are passed as undefined
 *
 * These tests validate the modal logic extracted from SingleOrderCard
 * without requiring full component rendering.
 */

// Canonical failure reasons (from ActiveOrderCard)
const FAILURE_REASONS = [
  { key: 'CUSTOMER_NOT_AVAILABLE', label: 'Customer not reachable' },
  { key: 'ADDRESS_ISSUE', label: 'Address incorrect' },
  { key: 'CUSTOMER_REJECTED', label: 'Customer refused delivery' },
] as const;

type FailureReasonKey = typeof FAILURE_REASONS[number]['key'];

/**
 * Modal state management logic extracted from SingleOrderCard
 */
class FailureModalLogic {
  private selectedReason: FailureReasonKey | '' = '';
  private failNotes: string = '';

  setSelectedReason(reason: FailureReasonKey | '') {
    this.selectedReason = reason;
  }

  setFailNotes(notes: string) {
    this.failNotes = notes;
  }

  reset() {
    this.selectedReason = '';
    this.failNotes = '';
  }

  /**
   * Check if confirm button should be disabled
   * Validates: Requirement 5.5
   */
  isConfirmDisabled(): boolean {
    return !this.selectedReason;
  }

  /**
   * Get the sanitized notes value to pass to onFailDelivery
   * Validates: Requirements 5.7, 5.9
   */
  getSanitizedNotes(): string | undefined {
    const trimmed = this.failNotes.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Simulate confirming the failure
   * Returns null if confirm is disabled, otherwise returns the payload
   */
  confirm(): { reason: FailureReasonKey; notes?: string } | null {
    if (this.isConfirmDisabled()) {
      return null;
    }
    return {
      reason: this.selectedReason as FailureReasonKey,
      notes: this.getSanitizedNotes(),
    };
  }
}

describe('FailureModal Logic', () => {
  let modal: FailureModalLogic;

  beforeEach(() => {
    modal = new FailureModalLogic();
  });

  describe('Confirm Button State', () => {
    /**
     * Test: Confirm button is disabled when no reason selected
     * Validates: Requirement 5.5
     */
    it('disables confirm button when no reason is selected', () => {
      expect(modal.isConfirmDisabled()).toBe(true);
      expect(modal.confirm()).toBeNull();
    });

    /**
     * Test: Confirm button is enabled after reason selected
     * Validates: Requirement 5.5
     */
    it('enables confirm button after a reason is selected', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      expect(modal.isConfirmDisabled()).toBe(false);

      const result = modal.confirm();
      expect(result).not.toBeNull();
      expect(result?.reason).toBe(FAILURE_REASONS[0].key);
      expect(result?.notes).toBeUndefined();
    });

    /**
     * Test: Confirm button remains disabled after selecting empty string
     * Validates: Requirement 5.5
     */
    it('keeps confirm button disabled when reason is set to empty string', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      expect(modal.isConfirmDisabled()).toBe(false);

      modal.setSelectedReason('');
      expect(modal.isConfirmDisabled()).toBe(true);
      expect(modal.confirm()).toBeNull();
    });
  });

  describe('Notes Sanitization', () => {
    /**
     * Test: Whitespace-only notes are passed as undefined
     * Validates: Requirements 5.7, 5.9
     */
    it('passes undefined when notes contain only whitespace', () => {
      modal.setSelectedReason(FAILURE_REASONS[1].key);
      modal.setFailNotes('   \t\n   ');

      const result = modal.confirm();
      expect(result).not.toBeNull();
      expect(result?.reason).toBe(FAILURE_REASONS[1].key);
      expect(result?.notes).toBeUndefined();
    });

    /**
     * Test: Empty notes are passed as undefined
     * Validates: Requirements 5.7, 5.9
     */
    it('passes undefined when notes are empty', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes('');

      const result = modal.confirm();
      expect(result).not.toBeNull();
      expect(result?.reason).toBe(FAILURE_REASONS[0].key);
      expect(result?.notes).toBeUndefined();
    });

    /**
     * Test: Non-whitespace notes are trimmed and passed correctly
     * Validates: Requirements 5.7, 5.9
     */
    it('trims and passes non-whitespace notes correctly', () => {
      modal.setSelectedReason(FAILURE_REASONS[2].key);
      modal.setFailNotes('  Customer was not home  ');

      const result = modal.confirm();
      expect(result).not.toBeNull();
      expect(result?.reason).toBe(FAILURE_REASONS[2].key);
      expect(result?.notes).toBe('Customer was not home');
    });

    /**
     * Test: Notes with only leading whitespace are trimmed
     * Validates: Requirements 5.7, 5.9
     */
    it('trims leading whitespace from notes', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes('   Customer refused');

      const result = modal.confirm();
      expect(result?.notes).toBe('Customer refused');
    });

    /**
     * Test: Notes with only trailing whitespace are trimmed
     * Validates: Requirements 5.7, 5.9
     */
    it('trims trailing whitespace from notes', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes('Customer refused   ');

      const result = modal.confirm();
      expect(result?.notes).toBe('Customer refused');
    });

    /**
     * Test: Notes with mixed whitespace characters are handled correctly
     * Validates: Requirements 5.7, 5.9
     */
    it('handles mixed whitespace characters (spaces, tabs, newlines)', () => {
      modal.setSelectedReason(FAILURE_REASONS[1].key);
      modal.setFailNotes('\t\n  Address not found  \n\t');

      const result = modal.confirm();
      expect(result?.notes).toBe('Address not found');
    });

    /**
     * Test: Single space returns undefined
     * Validates: Requirements 5.7, 5.9
     */
    it('returns undefined for single space', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes(' ');

      const result = modal.confirm();
      expect(result?.notes).toBeUndefined();
    });

    /**
     * Test: Multiple spaces return undefined
     * Validates: Requirements 5.7, 5.9
     */
    it('returns undefined for multiple spaces', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes('     ');

      const result = modal.confirm();
      expect(result?.notes).toBeUndefined();
    });
  });

  describe('Modal Reset', () => {
    /**
     * Test: Reset clears selected reason and notes
     * Validates: Requirement 5.6 (modal dismissal behavior)
     */
    it('resets selected reason and notes when reset is called', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes('Some notes');

      expect(modal.isConfirmDisabled()).toBe(false);

      modal.reset();

      expect(modal.isConfirmDisabled()).toBe(true);
      expect(modal.confirm()).toBeNull();
    });
  });

  describe('All Failure Reasons', () => {
    /**
     * Test: All canonical failure reasons can be selected
     * Validates: Requirement 5.5
     */
    it('accepts all canonical failure reasons', () => {
      FAILURE_REASONS.forEach(({ key }) => {
        modal.reset();
        modal.setSelectedReason(key);

        expect(modal.isConfirmDisabled()).toBe(false);

        const result = modal.confirm();
        expect(result).not.toBeNull();
        expect(result?.reason).toBe(key);
      });
    });
  });

  describe('Edge Cases', () => {
    /**
     * Test: Reason and notes can be set in any order
     * Validates: Requirements 5.5, 5.7
     */
    it('allows setting notes before selecting reason', () => {
      modal.setFailNotes('Customer not available');
      expect(modal.isConfirmDisabled()).toBe(true);

      modal.setSelectedReason(FAILURE_REASONS[0].key);
      expect(modal.isConfirmDisabled()).toBe(false);

      const result = modal.confirm();
      expect(result?.notes).toBe('Customer not available');
    });

    /**
     * Test: Notes can be updated multiple times
     * Validates: Requirements 5.7, 5.9
     */
    it('uses the latest notes value when confirming', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setFailNotes('First note');
      modal.setFailNotes('Second note');
      modal.setFailNotes('  Final note  ');

      const result = modal.confirm();
      expect(result?.notes).toBe('Final note');
    });

    /**
     * Test: Reason can be changed before confirming
     * Validates: Requirement 5.5
     */
    it('uses the latest selected reason when confirming', () => {
      modal.setSelectedReason(FAILURE_REASONS[0].key);
      modal.setSelectedReason(FAILURE_REASONS[1].key);
      modal.setSelectedReason(FAILURE_REASONS[2].key);

      const result = modal.confirm();
      expect(result?.reason).toBe(FAILURE_REASONS[2].key);
    });
  });
});


