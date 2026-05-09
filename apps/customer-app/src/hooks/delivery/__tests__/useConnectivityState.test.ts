/**
 * Unit Tests for useConnectivityState Hook
 * 
 * **Validates: Requirements 2.1-2.7, 6.1-6.6**
 * 
 * Tests the state derivation logic and precedence order for connectivity states.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useConnectivityState } from '../useConnectivityState';
import { useNetworkStatus } from '../useNetworkStatus';
import { useActionQueue } from '../useActionQueue';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../useNetworkStatus');
jest.mock('../useActionQueue');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockUseActionQueue = useActionQueue as jest.MockedFunction<typeof useActionQueue>;

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('useConnectivityState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ── State: Online ─────────────────────────────────────────────────────────

  it('should return online state when connected with no queued actions', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 0,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    expect(result.current).toEqual({ type: 'online' });
  });

  // ── State: Offline ────────────────────────────────────────────────────────

  it('should return offline state when not connected', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 0,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    expect(result.current).toEqual({ type: 'offline' });
  });

  it('should return offline state even when actions are queued', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 5,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    expect(result.current).toEqual({ type: 'offline' });
  });

  // ── State: Syncing ────────────────────────────────────────────────────────

  it('should return syncing state when online with queued actions', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 3,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    expect(result.current).toEqual({ type: 'syncing', count: 3 });
  });

  // ── State: Replaying ──────────────────────────────────────────────────────

  it('should return replaying state when queue is actively syncing', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 5,
      isSyncing: true,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    expect(result.current).toEqual({ type: 'replaying' });
  });

  // ── State: Reconnected ────────────────────────────────────────────────────

  it('should return reconnected state when transitioning from offline to online', () => {
    const { result, rerender } = renderHook(() => useConnectivityState());

    // Start offline
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 0,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    rerender({});
    expect(result.current).toEqual({ type: 'offline' });

    // Transition to online
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    
    act(() => {
      rerender({});
    });

    expect(result.current.type).toBe('reconnected');
    expect(result.current).toHaveProperty('timestamp');
  });

  it('should auto-hide reconnected state after 3 seconds', async () => {
    const { result, rerender } = renderHook(() => useConnectivityState());

    // Start offline
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 0,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    rerender({});

    // Transition to online
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    
    act(() => {
      rerender({});
    });

    expect(result.current.type).toBe('reconnected');

    // Fast-forward 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(result.current).toEqual({ type: 'online' });
    });
  });

  // ── State Precedence ──────────────────────────────────────────────────────

  it('should prioritize reconnected over replaying', () => {
    const { result, rerender } = renderHook(() => useConnectivityState());

    // Start offline
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 5,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    rerender({});

    // Transition to online with replaying
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 5,
      isSyncing: true,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });
    
    act(() => {
      rerender({});
    });

    // Should show reconnected, not replaying
    expect(result.current.type).toBe('reconnected');
  });

  it('should prioritize replaying over syncing', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 5,
      isSyncing: true,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    // Should show replaying, not syncing
    expect(result.current).toEqual({ type: 'replaying' });
  });

  it('should prioritize syncing over online', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 3,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    // Should show syncing, not online
    expect(result.current).toEqual({ type: 'syncing', count: 3 });
  });

  it('should prioritize offline over syncing', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 5,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    // Should show offline, not syncing
    expect(result.current).toEqual({ type: 'offline' });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────────

  it('should not show reconnected when starting online', () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 0,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    const { result } = renderHook(() => useConnectivityState());

    expect(result.current).toEqual({ type: 'online' });
  });

  it('should handle multiple offline/online transitions correctly', () => {
    const { result, rerender } = renderHook(() => useConnectivityState());

    // Start online
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    mockUseActionQueue.mockReturnValue({
      queueLength: 0,
      isSyncing: false,
      enqueue: jest.fn(),
      replayQueue: jest.fn(),
      hasPendingActionsForOrder: jest.fn(),
    });

    rerender({});
    expect(result.current).toEqual({ type: 'online' });

    // Go offline
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    act(() => {
      rerender({});
    });
    expect(result.current).toEqual({ type: 'offline' });

    // Reconnect (first time)
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    act(() => {
      rerender({});
    });
    expect(result.current.type).toBe('reconnected');

    // Wait for auto-hide
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Go offline again
    mockUseNetworkStatus.mockReturnValue({ isOnline: false, connectionType: 'none' });
    act(() => {
      rerender({});
    });
    expect(result.current).toEqual({ type: 'offline' });

    // Reconnect (second time)
    mockUseNetworkStatus.mockReturnValue({ isOnline: true, connectionType: 'wifi' });
    act(() => {
      rerender({});
    });
    expect(result.current.type).toBe('reconnected');
  });
});
