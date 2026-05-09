/**
 * Unit Tests for useActionFeedback hook
 *
 * **Validates: Requirements 3.1-3.7**
 *
 * Tests action button state transitions for driver actions, ensuring proper
 * state management for processing, queued, synced, and failed states.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useActionFeedback } from '../useActionFeedback';

describe('useActionFeedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    expect(result.current.state.type).toBe('idle');
  });

  it('transitions to processing when onActionStart is called', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    expect(result.current.state.type).toBe('processing');
  });

  it('transitions to queued when onActionQueued is called', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    act(() => {
      result.current.onActionQueued();
    });

    expect(result.current.state.type).toBe('queued');
  });

  it('transitions to synced when onActionSuccess is called', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    act(() => {
      result.current.onActionSuccess();
    });

    expect(result.current.state.type).toBe('synced');
    if (result.current.state.type === 'synced') {
      expect(result.current.state.timestamp).toBeDefined();
    }
  });

  it('auto-resets to idle after 2 seconds when synced', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    act(() => {
      result.current.onActionSuccess();
    });

    expect(result.current.state.type).toBe('synced');

    // Fast-forward 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.state.type).toBe('idle');
  });

  it('transitions to failed when onActionFailure is called', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    act(() => {
      result.current.onActionFailure();
    });

    expect(result.current.state.type).toBe('failed');
  });

  it('does not auto-reset from failed state', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    act(() => {
      result.current.onActionFailure();
    });

    expect(result.current.state.type).toBe('failed');

    // Fast-forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Should still be in failed state
    expect(result.current.state.type).toBe('failed');
  });

  it('handles processing → synced flow (online success)', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    // Start action
    act(() => {
      result.current.onActionStart();
    });
    expect(result.current.state.type).toBe('processing');

    // Action succeeds immediately (online)
    act(() => {
      result.current.onActionSuccess();
    });
    expect(result.current.state.type).toBe('synced');

    // Auto-reset after 2s
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.state.type).toBe('idle');
  });

  it('handles processing → queued → synced flow (offline success)', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    // Start action
    act(() => {
      result.current.onActionStart();
    });
    expect(result.current.state.type).toBe('processing');

    // Action is queued (offline)
    act(() => {
      result.current.onActionQueued();
    });
    expect(result.current.state.type).toBe('queued');

    // Later, action syncs successfully
    act(() => {
      result.current.onActionSuccess();
    });
    expect(result.current.state.type).toBe('synced');

    // Auto-reset after 2s
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.state.type).toBe('idle');
  });

  it('handles processing → failed flow', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    // Start action
    act(() => {
      result.current.onActionStart();
    });
    expect(result.current.state.type).toBe('processing');

    // Action fails
    act(() => {
      result.current.onActionFailure();
    });
    expect(result.current.state.type).toBe('failed');
  });

  it('clears synced timer on unmount', () => {
    const { result, unmount } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    act(() => {
      result.current.onActionStart();
    });

    act(() => {
      result.current.onActionSuccess();
    });

    expect(result.current.state.type).toBe('synced');

    // Unmount before timer fires
    unmount();

    // Should not throw or cause issues
    act(() => {
      jest.advanceTimersByTime(2000);
    });
  });

  it('handles multiple success calls by resetting timer', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    // First success
    act(() => {
      result.current.onActionSuccess();
    });
    expect(result.current.state.type).toBe('synced');

    // Advance 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.state.type).toBe('synced');

    // Second success (resets timer)
    act(() => {
      result.current.onActionSuccess();
    });
    expect(result.current.state.type).toBe('synced');

    // Advance 1 second (should still be synced, timer was reset)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.state.type).toBe('synced');

    // Advance another 1 second (total 2s from second success)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.state.type).toBe('idle');
  });

  it('allows recovery from failed state by starting new action', () => {
    const { result } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );

    // Action fails
    act(() => {
      result.current.onActionStart();
    });
    act(() => {
      result.current.onActionFailure();
    });
    expect(result.current.state.type).toBe('failed');

    // Retry action
    act(() => {
      result.current.onActionStart();
    });
    expect(result.current.state.type).toBe('processing');

    // Success
    act(() => {
      result.current.onActionSuccess();
    });
    expect(result.current.state.type).toBe('synced');
  });

  it('works with different order IDs and action types', () => {
    const { result: result1 } = renderHook(() => 
      useActionFeedback('order-123', 'pickup')
    );
    const { result: result2 } = renderHook(() => 
      useActionFeedback('order-456', 'deliver')
    );

    // Both start in idle
    expect(result1.current.state.type).toBe('idle');
    expect(result2.current.state.type).toBe('idle');

    // Start first action
    act(() => {
      result1.current.onActionStart();
    });
    expect(result1.current.state.type).toBe('processing');
    expect(result2.current.state.type).toBe('idle');

    // Start second action
    act(() => {
      result2.current.onActionStart();
    });
    expect(result1.current.state.type).toBe('processing');
    expect(result2.current.state.type).toBe('processing');
  });
});
