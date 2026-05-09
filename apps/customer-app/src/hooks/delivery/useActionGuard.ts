import { useRef, useCallback } from 'react';

/**
 * useActionGuard — prevents duplicate API calls from rapid taps.
 *
 * Fix #8: uses a ref instead of state for the processing flag.
 * The previous implementation captured `isProcessing` state in the
 * useCallback dependency array, meaning the closure always saw the value
 * from the previous render — the guard never blocked concurrent calls.
 *
 * Using a ref makes the check synchronous and always current, regardless
 * of React's render batching.
 */
export const useActionGuard = <T extends unknown[]>(
  fn: (...args: T) => Promise<void>
) => {
  const isProcessingRef = useRef(false);

  const guarded = useCallback(
    async (...args: T) => {
      // Synchronous ref check — never stale, not subject to render batching
      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;

      try {
        await fn(...args);
      } finally {
        // Always release — even if fn throws
        isProcessingRef.current = false;
      }
    },
    [fn] // fn is the only real dependency — isProcessingRef is stable
  );

  return { guarded };
};
