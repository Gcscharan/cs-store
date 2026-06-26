/**
 * useHighContrastMode Hook
 *
 * Detects high text contrast accessibility setting where supported.
 * On unsupported platforms, returns false.
 */

import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

export const useHighContrastMode = (): boolean => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    let mounted = true;

    const readContrast = async () => {
      try {
        if (typeof AccessibilityInfo.isHighTextContrastEnabled === 'function') {
          const enabled = await AccessibilityInfo.isHighTextContrastEnabled();
          if (mounted) setIsHighContrast(enabled);
          return;
        }
        if (mounted) setIsHighContrast(false);
      } catch {
        if (mounted) setIsHighContrast(false);
      }
    };

    readContrast();

    return () => {
      mounted = false;
    };
  }, []);

  return isHighContrast;
};
