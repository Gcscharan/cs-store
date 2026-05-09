import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Represents the visual state of an action button.
 * 
 * - idle: Default state, ready for user interaction
 * - processing: Action is being executed (before queue entry)
 * - queued: Action is in the queue waiting to sync
 * - synced: Action successfully synced (transient, auto-resets to idle after 2s)
 * - failed: Action failed to execute (transient)
 */
export type ActionButtonState =
  | { type: 'idle' }
  | { type: 'processing' }
  | { type: 'queued' }
  | { type: 'synced'; timestamp: number }
  | { type: 'failed' };

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages action button state transitions for driver actions.
 * 
 * **Critical Pattern** (from IMPLEMENTATION_GUIDE.md):
 * - Queue state is authoritative for 'queued'
 * - Local transient state ONLY for: processing, synced flash, failed flash
 * - Avoid race-condition UX by keeping queue authoritative
 * 
 * **State Flow**:
 * ```
 * idle → processing → queued (if offline) → synced (2s) → idle
 *                  → synced (if online, 2s) → idle
 *                  → failed → idle (manual reset)
 * ```
 * 
 * **Implementation Note**: 
 * This hook manages local transient state for UI feedback. The 'queued' state
 * should ideally be derived from useActionQueue, but since the current
 * implementation doesn't expose the queue array, callers should manage the
 * transition to 'queued' state by checking if the action was enqueued offline.
 * 
 * Future enhancement: Modify useActionQueue to expose queue array for
 * authoritative 'queued' state detection.
 * 
 * @param orderId - The order ID for which to track action state
 * @param actionType - The type of action (e.g., 'pickup', 'deliver', 'markArrived')
 * 
 * @returns Object containing:
 *   - state: Current ActionButtonState
 *   - onActionStart: Callback to invoke when action begins
 *   - onActionSuccess: Callback to invoke when action succeeds
 *   - onActionFailure: Callback to invoke when action fails
 *   - onActionQueued: Callback to invoke when action is queued offline
 * 
 * @example
 * ```tsx
 * const { state, onActionStart, onActionSuccess, onActionFailure, onActionQueued } = 
 *   useActionFeedback(order._id, 'pickup');
 * 
 * const handlePickup = async () => {
 *   onActionStart();
 *   try {
 *     const wasQueued = await pickupOrder(order._id);
 *     if (wasQueued) {
 *       onActionQueued();
 *     } else {
 *       onActionSuccess();
 *     }
 *   } catch (error) {
 *     onActionFailure();
 *   }
 * };
 * ```
 */
export const useActionFeedback = (
  orderId: string,
  actionType: string
): {
  state: ActionButtonState;
  onActionStart: () => void;
  onActionSuccess: () => void;
  onActionFailure: () => void;
  onActionQueued: () => void;
} => {

  // ── Local Transient State (Non-Authoritative) ──────────────────────────────
  
  /**
   * Local state for transient UI feedback only.
   * - processing: Before queue entry
   * - queued: Tracked locally when action is enqueued
   * - synced: Flash after queue removal (2s)
   * - failed: Flash after error
   * 
   * Since useActionQueue doesn't expose the queue array, we track
   * queued state locally and rely on the caller to manage transitions.
   */
  const [transientState, setTransientState] = useState<
    'processing' | 'queued' | 'synced' | 'failed' | null
  >(null);
  
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State Derivation ───────────────────────────────────────────────────────
  
  /**
   * Derive display state with correct precedence:
   * 1. Local transient state for all states (processing/queued/synced/failed)
   * 2. Default to 'idle'
   * 
   * Note: In the ideal implementation, queue state would be authoritative
   * for 'queued', but since useActionQueue doesn't expose the queue array,
   * we manage queued state locally. The caller should transition from
   * processing → queued when the action is enqueued offline.
   */
  const displayState: ActionButtonState = (() => {
    // Local transient states
    if (transientState === 'processing') {
      return { type: 'processing' };
    }
    if (transientState === 'queued') {
      return { type: 'queued' };
    }
    if (transientState === 'synced') {
      return { type: 'synced', timestamp: Date.now() };
    }
    if (transientState === 'failed') {
      return { type: 'failed' };
    }
    
    // Default state
    return { type: 'idle' };
  })();

  // ── Callbacks ──────────────────────────────────────────────────────────────
  
  /**
   * Called when action starts (before queue entry).
   * Sets state to 'processing'.
   */
  const onActionStart = useCallback(() => {
    setTransientState('processing');
  }, []);

  /**
   * Called when action succeeds (after queue removal or immediate success).
   * Sets state to 'synced' for 2 seconds, then auto-resets to idle.
   */
  const onActionSuccess = useCallback(() => {
    setTransientState('synced');
    
    // Clear any existing timer
    if (syncedTimerRef.current) {
      clearTimeout(syncedTimerRef.current);
    }
    
    // Auto-reset to idle after 2 seconds
    syncedTimerRef.current = setTimeout(() => {
      setTransientState(null);
      syncedTimerRef.current = null;
    }, 2000);
  }, []);

  /**
   * Called when action fails.
   * Sets state to 'failed'.
   * Does NOT auto-reset — requires manual reset or retry.
   */
  const onActionFailure = useCallback(() => {
    setTransientState('failed');
  }, []);

  /**
   * Called when action is queued offline.
   * Sets state to 'queued'.
   * Caller should invoke this when the action is enqueued due to offline status.
   */
  const onActionQueued = useCallback(() => {
    setTransientState('queued');
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    return () => {
      // Clear timer on unmount
      if (syncedTimerRef.current) {
        clearTimeout(syncedTimerRef.current);
      }
    };
  }, []);

  // ── Return ─────────────────────────────────────────────────────────────────
  
  return {
    state: displayState,
    onActionStart,
    onActionSuccess,
    onActionFailure,
    onActionQueued,
  };
};
