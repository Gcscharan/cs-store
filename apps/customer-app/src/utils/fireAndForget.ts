/**
 * Fire-and-Forget Utility
 * 
 * Ensures async operations don't block user experience
 * Industry standard pattern (used by Google, Facebook, etc.)
 */

/**
 * Execute function asynchronously without blocking caller
 * 
 * Use for non-critical operations like:
 * - Analytics logging
 * - Metrics tracking
 * - Background sync
 * 
 * @param fn - Async function to execute
 * @param errorHandler - Optional error handler (logs by default)
 */
export function fireAndForget<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: any) => void
): void {
  // Schedule execution in next tick (zero impact on current flow)
  setTimeout(() => {
    fn().catch((error) => {
      if (errorHandler) {
        errorHandler(error);
      } else {
        // Default: log but don't throw
        console.warn('[FireAndForget] Operation failed:', error);
      }
    });
  }, 0);
}

/**
 * Create a fire-and-forget wrapper for RTK Query mutations
 * 
 * Example:
 * const trackClick = useTrackClickMutation();
 * const trackClickAsync = createAsyncMutation(trackClick[0]);
 * 
 * // Later:
 * trackClickAsync({ productId, userId }); // Non-blocking
 */
export function createAsyncMutation<TArgs, TResult>(
  mutation: (args: TArgs) => Promise<TResult>
): (args: TArgs) => void {
  return (args: TArgs) => {
    fireAndForget(() => mutation(args));
  };
}

/**
 * Beacon API wrapper for critical analytics
 * 
 * Uses navigator.sendBeacon when available (guaranteed delivery even on page unload)
 * Falls back to fetch with keepalive flag
 * 
 * @param url - API endpoint
 * @param data - Data to send
 */
export function sendBeacon(url: string, data: any): boolean {
  // Check if sendBeacon is available (web only, not React Native)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      return navigator.sendBeacon(url, blob);
    } catch (error) {
      console.warn('[Beacon] sendBeacon failed, falling back to fetch:', error);
    }
  }
  
  // Fallback: fetch with keepalive (works in React Native)
  fireAndForget(async () => {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      // keepalive ensures request completes even if app closes
      keepalive: true,
    });
  });
  
  return true;
}
