/**
 * useDynamicFontSize Hook
 * 
 * Provides dynamic font sizing support for accessibility.
 * Caps font scaling at 1.3x to prevent layout breaking.
 * 
 * Requirement 15.2: Support dynamic font sizing for drivers who need larger text
 */

import { useWindowDimensions } from 'react-native';

/**
 * Calculate dynamic font size based on system font scale
 * 
 * @param baseSize - The base font size in sp
 * @returns The scaled font size, capped at 1.3x the base size
 * 
 * @example
 * const fontSize = useDynamicFontSize(16); // Returns 16-20.8 based on system settings
 */
export const useDynamicFontSize = (baseSize: number): number => {
  const { fontScale } = useWindowDimensions();
  
  // Cap at 1.3x to prevent layout breaking while still supporting accessibility
  const cappedScale = Math.min(fontScale, 1.3);
  
  return baseSize * cappedScale;
};
