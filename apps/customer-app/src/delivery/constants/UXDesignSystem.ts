/**
 * UX Design System for Driver Confidence UX Overhaul
 * 
 * This design system provides stress-optimized UI constants for delivery drivers
 * working under real-world conditions (riding, rain, sunlight, stress).
 * 
 * Requirements: 5.1-5.7, 15.1-15.7
 */

/**
 * Color Palette
 * 
 * Optimized for:
 * - High contrast in sunlight (Requirement 5.2)
 * - Clear state differentiation
 * - Accessibility compliance (4.5:1 contrast ratio - Requirement 15.3)
 */
export const UX_COLORS = {
  // State colors
  offline: '#E53E3E',        // Red - offline state
  offlineBg: '#FED7D7',      // Light red - offline background
  syncing: '#D69E2E',        // Yellow - syncing state
  syncingBg: '#FEEBC8',      // Light yellow - syncing background
  success: '#38A169',        // Green - success state
  successBg: '#C6F6D5',      // Light green - success background
  error: '#E53E3E',          // Red - error state
  errorBg: '#FED7D7',        // Light red - error background
  locked: '#718096',         // Gray - locked state
  lockedBg: '#EDF2F7',       // Light gray - locked background

  // Action button states
  processing: '#3182CE',     // Blue - processing state
  queued: '#D69E2E',         // Yellow - queued state
  synced: '#38A169',         // Green - synced state
  failed: '#E53E3E',         // Red - failed state

  // High contrast (sunlight visibility - Requirement 5.2)
  primaryAction: '#2B6CB0',  // Dark blue - primary action buttons
  dangerAction: '#C53030',   // Dark red - danger action buttons
  textHighContrast: '#1A202C', // Near black - high contrast text
};

/**
 * Typography Scale
 * 
 * Optimized for:
 * - Readability under stress (Requirement 5.3)
 * - Quick scanning while riding
 * - Minimum 16sp for critical info (Requirement 5.3)
 * - Large COD amounts to prevent misreading (Requirement 9.5)
 */
export const UX_TYPOGRAPHY = {
  // Critical info (customer name, address, next action - Requirement 5.3)
  critical: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  // COD amounts (Requirement 9.5)
  codAmount: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
  },
  // Order ID, status badges
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  // Helper text, timestamps
  tertiary: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
};

/**
 * Spacing and Layout
 * 
 * Optimized for:
 * - Touch targets (48x48dp minimum - Requirement 5.1, 15.5)
 * - Thumb reach positioning (Requirement 5.4)
 * - Avoiding accidental touches (Requirement 5.6)
 */
export const UX_SPACING = {
  // Touch target minimum (Requirements 5.1, 15.5)
  touchTarget: 48,
  // Edge padding (avoid accidental touches - Requirement 5.6)
  edgePadding: 16,
  // Component spacing
  componentGap: 12,
  // Section spacing
  sectionGap: 24,
};

/**
 * Animation Timings
 * 
 * Optimized for:
 * - Smooth state transitions
 * - Clear feedback without delay
 * - Synced duration for consistent UX
 */
export const UX_ANIMATIONS = {
  // Button state transitions (Requirement 3.6, 3.7)
  buttonTransition: 200,
  // Banner auto-hide (reconnected state - Requirement 2.3)
  bannerAutoHide: 3000,
  // Synced state display duration (Requirement 3.3)
  syncedDuration: 2000,
  // Screen transitions (Requirement 14.5)
  screenTransition: 300,
};
