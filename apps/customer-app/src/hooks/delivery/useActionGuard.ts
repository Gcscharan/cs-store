import { useState, useCallback } from 'react';

export const useActionGuard = <T extends unknown[]>(
  fn: (...args: T) => Promise<void>
) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const guarded = useCallback(
    async (...args: T) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
        await fn(...args);
      } finally {
        setIsProcessing(false);
      }
    },
    [fn, isProcessing]
  );

  return { guarded, isProcessing };
};
