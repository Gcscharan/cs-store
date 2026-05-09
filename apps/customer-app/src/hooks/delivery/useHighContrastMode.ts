/**
 * useHighContrastMode Hook
 * 
 * Detects and provides high contrast mode state for accessibility.
 * Allows components to adapt their styling for users with visual impairments.
 * 
 * Requirement 15.7: Support high contrast mode for drivers with visual impairments
 */

import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Detect if high contrast mode is enabled on the device
 * 
 * @returns Boolean indicating if high contrast mode is enabled
 * 
 * @example
 * const isHighContrast = useHighContrastMode();
 * const textColor = isHighContrast ? UX_COLORS.textHighContrast : DELIVERY_COLORS.textPrimary;
 */
export const useHighContrastMode = (): boolean => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check initial high contrast state
    AccessibilityInfo.isHighContrastEnabled()
      .then(setIsHighContrast)
      .catch(() => {
        // Fallback to false if API is not available
        setIsHighContrast(false);
      });

    // Listen for high contrast mode changes
    const subscription = AccessibilityInfo.addEventListener(
      'highContrastChanged',
      setIsHighContrast
    );

    // Cleanup listener on unmount
    return () => {
      subscription?.remove();
    };
  }, []);

  return isHighContrast;
};
