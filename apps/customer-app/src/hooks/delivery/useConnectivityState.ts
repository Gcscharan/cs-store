import { useState, useEffect, useRef, useMemo } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useActionQueue } from './useActionQueue';

/**
 * Connectivity state types for the GlobalConnectivityBanner.
 * 
 * State precedence (mutually exclusive):
 * 1. reconnected - Just reconnected, auto-hide after 3s
 * 2. offline - No network connection
 * 3. replaying - Queue is actively replaying
 * 4. syncing - Actions are queued and waiting to sync
 * 5. online - Connected with empty queue (hidden state)
 */
export type ConnectivityState = 
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'syncing'; count: number }
  | { type: 'reconnected'; timestamp: number }
  | { type: 'replaying' };

/**
 * Hook to derive UI connectivity state from network status and action queue.
 * 
 * This hook implements the state derivation logic specified in the design document,
 * ensuring mutually exclusive state rendering with clear precedence order.
 * 
 * @returns ConnectivityState - The current connectivity state for UI display
 */
export const useConnectivityState = (): ConnectivityState => {
  const { isOnline } = useNetworkStatus();
  const { queueLength, isSyncing } = useActionQueue();
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);

  // Track previous online state to detect reconnection
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    // Detect transition from offline to online (reconnection)
    if (!prevOnline.current && isOnline) {
      setReconnectedAt(Date.now());
      // Auto-hide "Reconnected" banner after 3 seconds
      const timer = setTimeout(() => {
        setReconnectedAt(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  // State precedence: reconnected > offline > replaying > syncing > online
  // useMemo for derived state computation (Requirement 14.1)
  const connectivityState = useMemo((): ConnectivityState => {
    if (reconnectedAt) {
      return { type: 'reconnected', timestamp: reconnectedAt };
    }

    if (!isOnline) {
      return { type: 'offline' };
    }

    if (isSyncing) {
      return { type: 'replaying' };
    }

    if (queueLength > 0) {
      return { type: 'syncing', count: queueLength };
    }

    return { type: 'online' };
  }, [reconnectedAt, isOnline, isSyncing, queueLength]);

  return connectivityState;
};
