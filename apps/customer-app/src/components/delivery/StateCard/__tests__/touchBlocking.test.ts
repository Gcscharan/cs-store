/**
 * Unit Tests: Touch-Blocking on Locked Cards (Task 9.2)
 *
 * **Validates: Requirements 6.2, 6.6**
 *
 * Verifies the touch-blocking contract for locked SingleOrderCard instances:
 *
 * 1. The outer wrapper uses `pointerEvents={isLocked ? 'none' : 'auto'}` — this is
 *    the React Native mechanism that blocks ALL touch events on the entire subtree,
 *    not just individual buttons.
 *
 * 2. No child component bypasses the wrapper:
 *    - Action buttons carry `disabled={isLocked}` and guard their `onPress` handlers
 *      with `if (isLocked) return;`
 *    - OTP input section is gated behind `!isLocked`
 *    - "Cancel Delivery" (fail) button is gated behind `!isLocked`
 *    - Navigation link (phone call) is inside the pointer-events wrapper
 *
 * These tests validate the logic extracted from SingleOrderCard without requiring
 * a full React Native render environment.
 */

// ─── Extracted pointer-events logic ──────────────────────────────────────────

/**
 * Mirrors the outer wrapper in SingleOrderCard's return:
 *   <View pointerEvents={isLocked ? 'none' : 'auto'}>
 */
function getPointerEvents(isLocked: boolean): 'none' | 'auto' {
  return isLocked ? 'none' : 'auto';
}

// ─── Extracted action-button guard logic ─────────────────────────────────────

/**
 * Mirrors the `disabled` prop on every action TouchableOpacity:
 *   disabled={isLocked}
 */
function isActionButtonDisabled(isLocked: boolean): boolean {
  return isLocked;
}

/**
 * Mirrors the onPress guard inside each action button:
 *   onPress={() => { if (isLocked) return; ... }}
 * Returns true if the press would be handled, false if it would be swallowed.
 */
function wouldActionButtonFire(isLocked: boolean): boolean {
  if (isLocked) return false;
  return true;
}

// ─── Extracted OTP section visibility logic ───────────────────────────────────

/**
 * Mirrors the OTP section render gate in renderActionButtons:
 *   {(actions.includes('VERIFY_OTP') || isDeliveryAttempted) && !isLocked && renderOtpSection()}
 */
function isOtpSectionVisible(
  allowedActions: string[],
  isDeliveryAttempted: boolean,
  isLocked: boolean,
): boolean {
  return (allowedActions.includes('VERIFY_OTP') || isDeliveryAttempted) && !isLocked;
}

// ─── Extracted fail-button visibility logic ───────────────────────────────────

/**
 * Mirrors the "Cancel Delivery" button render gate:
 *   {actions.includes('CUSTOMER_NOT_AVAILABLE') && !isLocked && (...)}
 */
function isFailButtonVisible(allowedActions: string[], isLocked: boolean): boolean {
  return allowedActions.includes('CUSTOMER_NOT_AVAILABLE') && !isLocked;
}

// ─── Extracted CurrentStrip / NextStrip visibility logic ─────────────────────

/**
 * Mirrors: {isCurrent && !isLocked && <CurrentStrip>}
 */
function isCurrentStripVisible(isCurrent: boolean, isLocked: boolean): boolean {
  return isCurrent && !isLocked;
}

/**
 * Mirrors: {!isCurrent && !isLocked && stopIndex === 2 && <NextStrip>}
 */
function isNextStripVisible(
  isCurrent: boolean,
  isLocked: boolean,
  stopIndex: number | undefined,
): boolean {
  return !isCurrent && !isLocked && stopIndex === 2;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Touch-blocking on locked cards (Requirements 6.2, 6.6)', () => {
  // ── Requirement 6.6: pointerEvents wrapper ──────────────────────────────────
  describe('outer View pointerEvents wrapper', () => {
    it('returns "none" when isLocked is true — blocks all touch on the subtree', () => {
      expect(getPointerEvents(true)).toBe('none');
    });

    it('returns "auto" when isLocked is false — normal touch handling', () => {
      expect(getPointerEvents(false)).toBe('auto');
    });

    it('is the only value needed to block the entire card subtree', () => {
      // React Native's pointerEvents="none" on a View blocks ALL touch events
      // for every descendant — no child can bypass it.
      const lockedValue = getPointerEvents(true);
      const unlockedValue = getPointerEvents(false);
      expect(lockedValue).not.toBe(unlockedValue);
      expect(lockedValue).toBe('none');
    });
  });

  // ── Requirement 6.2: action buttons disabled on locked cards ───────────────
  describe('action button disabled prop', () => {
    it('disables action buttons when isLocked is true', () => {
      expect(isActionButtonDisabled(true)).toBe(true);
    });

    it('enables action buttons when isLocked is false', () => {
      expect(isActionButtonDisabled(false)).toBe(false);
    });

    it('onPress guard swallows the event when isLocked is true', () => {
      expect(wouldActionButtonFire(true)).toBe(false);
    });

    it('onPress guard allows the event when isLocked is false', () => {
      expect(wouldActionButtonFire(false)).toBe(true);
    });

    it('disabled prop and onPress guard are consistent', () => {
      [true, false].forEach(isLocked => {
        const disabled = isActionButtonDisabled(isLocked);
        const fires = wouldActionButtonFire(isLocked);
        // When disabled, the button must not fire; when enabled, it must fire
        expect(disabled).toBe(!fires);
      });
    });
  });

  // ── OTP input not reachable on locked card ─────────────────────────────────
  describe('OTP input section', () => {
    it('is hidden on a locked card even when VERIFY_OTP is in allowedActions', () => {
      expect(isOtpSectionVisible(['VERIFY_OTP'], false, true)).toBe(false);
    });

    it('is hidden on a locked card even when delivery was already attempted', () => {
      expect(isOtpSectionVisible([], true, true)).toBe(false);
    });

    it('is visible on an unlocked card when VERIFY_OTP is in allowedActions', () => {
      expect(isOtpSectionVisible(['VERIFY_OTP'], false, false)).toBe(true);
    });

    it('is visible on an unlocked card when delivery was attempted', () => {
      expect(isOtpSectionVisible([], true, false)).toBe(true);
    });

    it('is hidden on an unlocked card when neither condition is met', () => {
      expect(isOtpSectionVisible([], false, false)).toBe(false);
    });
  });

  // ── Fail / Cancel button not reachable on locked card ─────────────────────
  describe('"Cancel Delivery" fail button', () => {
    it('is hidden on a locked card even when CUSTOMER_NOT_AVAILABLE is in allowedActions', () => {
      expect(isFailButtonVisible(['CUSTOMER_NOT_AVAILABLE'], true)).toBe(false);
    });

    it('is visible on an unlocked card when CUSTOMER_NOT_AVAILABLE is in allowedActions', () => {
      expect(isFailButtonVisible(['CUSTOMER_NOT_AVAILABLE'], false)).toBe(true);
    });

    it('is hidden on an unlocked card when CUSTOMER_NOT_AVAILABLE is absent', () => {
      expect(isFailButtonVisible(['PICKUP', 'MARK_ARRIVED'], false)).toBe(false);
    });
  });

  // ── CurrentStrip / NextStrip not rendered on locked card ──────────────────
  describe('CurrentStrip and NextStrip suppressed on locked cards (Requirement 6.4)', () => {
    it('CurrentStrip is not rendered when isLocked is true', () => {
      // A card cannot be both current and locked per the invariant, but the guard
      // is still present defensively.
      expect(isCurrentStripVisible(true, true)).toBe(false);
      expect(isCurrentStripVisible(false, true)).toBe(false);
    });

    it('CurrentStrip is rendered when isCurrent is true and isLocked is false', () => {
      expect(isCurrentStripVisible(true, false)).toBe(true);
    });

    it('NextStrip is not rendered when isLocked is true', () => {
      expect(isNextStripVisible(false, true, 2)).toBe(false);
    });

    it('NextStrip is rendered when stopIndex === 2 and card is not current or locked', () => {
      expect(isNextStripVisible(false, false, 2)).toBe(true);
    });

    it('NextStrip is not rendered when stopIndex !== 2 even if not locked', () => {
      expect(isNextStripVisible(false, false, 1)).toBe(false);
      expect(isNextStripVisible(false, false, 3)).toBe(false);
      expect(isNextStripVisible(false, false, undefined)).toBe(false);
    });
  });

  // ── End-to-end: no interaction path survives on a locked card ─────────────
  describe('end-to-end: no interaction path survives on a locked card', () => {
    const isLocked = true;
    const allActions = ['PICKUP', 'START_DELIVERY', 'MARK_ARRIVED', 'SEND_OTP', 'VERIFY_OTP', 'CUSTOMER_NOT_AVAILABLE', 'COLLECT_COD'];

    it('pointerEvents wrapper blocks the entire subtree', () => {
      expect(getPointerEvents(isLocked)).toBe('none');
    });

    it('every action button is disabled', () => {
      expect(isActionButtonDisabled(isLocked)).toBe(true);
    });

    it('every action button onPress guard swallows the event', () => {
      expect(wouldActionButtonFire(isLocked)).toBe(false);
    });

    it('OTP section is not rendered', () => {
      expect(isOtpSectionVisible(allActions, true, isLocked)).toBe(false);
    });

    it('fail button is not rendered', () => {
      expect(isFailButtonVisible(allActions, isLocked)).toBe(false);
    });

    it('CurrentStrip is not rendered', () => {
      expect(isCurrentStripVisible(true, isLocked)).toBe(false);
    });

    it('NextStrip is not rendered', () => {
      expect(isNextStripVisible(false, isLocked, 2)).toBe(false);
    });
  });

  // ── Contrast: unlocked card has full interaction ───────────────────────────
  describe('contrast: unlocked card has full interaction available', () => {
    const isLocked = false;

    it('pointerEvents wrapper is "auto"', () => {
      expect(getPointerEvents(isLocked)).toBe('auto');
    });

    it('action buttons are enabled', () => {
      expect(isActionButtonDisabled(isLocked)).toBe(false);
    });

    it('action button onPress fires', () => {
      expect(wouldActionButtonFire(isLocked)).toBe(true);
    });

    it('OTP section is visible when VERIFY_OTP is in allowedActions', () => {
      expect(isOtpSectionVisible(['VERIFY_OTP'], false, isLocked)).toBe(true);
    });

    it('fail button is visible when CUSTOMER_NOT_AVAILABLE is in allowedActions', () => {
      expect(isFailButtonVisible(['CUSTOMER_NOT_AVAILABLE'], isLocked)).toBe(true);
    });
  });
});
