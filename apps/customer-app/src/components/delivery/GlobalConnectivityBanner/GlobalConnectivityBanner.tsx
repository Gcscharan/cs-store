import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AccessibilityInfo } from 'react-native';
import { useConnectivityState } from '../../../hooks/delivery/useConnectivityState';
import { useDynamicFontSize } from '../../../hooks/delivery/useDynamicFontSize';
import { useHighContrastMode } from '../../../hooks/delivery/useHighContrastMode';
import {
  UX_COLORS,
  UX_TYPOGRAPHY,
  UX_SPACING,
} from '../../../delivery/constants/UXDesignSystem';

interface GlobalConnectivityBannerProps {
  onForceSync?: () => void;
}

/**
 * GlobalConnectivityBanner - Persistent network status indicator
 *
 * Eliminates driver uncertainty about network state ("Did it go through?",
 * "Am I offline?", "Is the app stuck?") by providing a persistent, unmistakable
 * top-of-screen banner for every non-online state.
 *
 * Uses `useConnectivityState` internally for state derivation.
 *
 * State Display:
 * - Offline:     Red background, "Offline" text, persistent, shows queued count if > 0
 * - Syncing:     Yellow background, "Syncing X actions" text
 * - Reconnected: Green background, "Reconnected" text, auto-hides after 3s
 * - Replaying:   Yellow background, "Queue replaying" text
 * - Online (empty queue): Hidden (returns null)
 *
 * Requirements: 2.1-2.7, 6.1-6.6, 11.1-11.7, 15.1-15.4, 15.7
 */
const GlobalConnectivityBannerInner: React.FC<GlobalConnectivityBannerProps> = ({
  onForceSync,
}) => {
  const connectivityState = useConnectivityState();

  // Dynamic font sizing (Requirement 15.2)
  const bannerFontSize = useDynamicFontSize(UX_TYPOGRAPHY.critical.fontSize);
  const forceSyncFontSize = useDynamicFontSize(UX_TYPOGRAPHY.secondary.fontSize);

  // High contrast mode (Requirement 15.7)
  const isHighContrast = useHighContrastMode();

  // Track previous state type to announce changes to screen readers (Requirement 15.4)
  const prevStateTypeRef = useRef<string | null>(null);

  // Hide banner when online with empty queue (Requirement 2.6)
  if (connectivityState.type === 'online') {
    return null;
  }

  // Determine background/text colors and message based on state
  let backgroundColor: string;
  let textColor: string;
  let message: string;
  let showForceSync = false;

  switch (connectivityState.type) {
    case 'offline':
      // Red background — persistent, unmistakable (Requirements 2.1, 6.1)
      backgroundColor = UX_COLORS.offline;
      textColor = isHighContrast ? '#FFFFFF' : UX_COLORS.offlineBg;
      message = 'Offline';
      break;

    case 'syncing':
      // Yellow background — syncing state (Requirement 2.2)
      backgroundColor = UX_COLORS.syncing;
      textColor = isHighContrast ? UX_COLORS.textHighContrast : UX_COLORS.syncingBg;
      message = `Syncing ${connectivityState.count} action${connectivityState.count !== 1 ? 's' : ''}`;
      // Show Force Sync button when onForceSync is provided (Requirement 7.2)
      showForceSync = !!onForceSync;
      break;

    case 'reconnected':
      // Green background — auto-hides after 3s (Requirement 2.3)
      backgroundColor = UX_COLORS.success;
      textColor = isHighContrast ? '#FFFFFF' : UX_COLORS.successBg;
      message = 'Reconnected';
      break;

    case 'replaying':
      // Yellow background — queue replaying (Requirement 2.4)
      backgroundColor = UX_COLORS.syncing;
      textColor = isHighContrast ? UX_COLORS.textHighContrast : UX_COLORS.syncingBg;
      message = 'Queue replaying';
      // Show Force Sync button when onForceSync is provided (Requirement 7.2)
      showForceSync = !!onForceSync;
      break;

    default:
      // Exhaustive type check — should never reach here
      backgroundColor = UX_COLORS.syncing;
      textColor = isHighContrast ? UX_COLORS.textHighContrast : UX_COLORS.syncingBg;
      message = 'Unknown state';
  }

  return (
    <GlobalConnectivityBannerContent
      backgroundColor={backgroundColor}
      textColor={textColor}
      message={message}
      showForceSync={showForceSync}
      onForceSync={onForceSync}
      bannerFontSize={bannerFontSize}
      forceSyncFontSize={forceSyncFontSize}
      prevStateTypeRef={prevStateTypeRef}
      stateType={connectivityState.type}
    />
  );
};

// Inner content component that can use hooks unconditionally
interface BannerContentProps {
  backgroundColor: string;
  textColor: string;
  message: string;
  showForceSync: boolean;
  onForceSync?: () => void;
  bannerFontSize: number;
  forceSyncFontSize: number;
  prevStateTypeRef: React.MutableRefObject<string | null>;
  stateType: string;
}

const GlobalConnectivityBannerContent: React.FC<BannerContentProps> = ({
  backgroundColor,
  textColor,
  message,
  showForceSync,
  onForceSync,
  bannerFontSize,
  forceSyncFontSize,
  prevStateTypeRef,
  stateType,
}) => {
  // Announce state changes to screen readers (Requirement 15.4)
  useEffect(() => {
    if (prevStateTypeRef.current !== stateType) {
      AccessibilityInfo.announceForAccessibility(message);
      prevStateTypeRef.current = stateType;
    }
  }, [stateType, message, prevStateTypeRef]);

  return (
    <View
      style={[styles.banner, { backgroundColor }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          styles.text,
          { color: textColor, fontSize: bannerFontSize },
        ]}
      >
        {message}
      </Text>

      {showForceSync && (
        <TouchableOpacity
          style={styles.forceSyncButton}
          onPress={onForceSync}
          accessibilityRole="button"
          accessibilityLabel="Force sync queued actions"
          accessibilityHint="Manually trigger queue replay to sync pending actions"
        >
          <Text
            style={[
              styles.forceSyncText,
              { color: textColor, fontSize: forceSyncFontSize },
            ]}
          >
            Force Sync
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Wrap with React.memo to prevent unnecessary re-renders.
 * The banner only needs to re-render when onForceSync reference changes.
 * Connectivity state is derived internally via useConnectivityState.
 *
 * Requirements: 14.1, 14.4
 */
export const GlobalConnectivityBanner = React.memo(
  GlobalConnectivityBannerInner,
  (prev, next) => prev.onForceSync === next.onForceSync,
);

GlobalConnectivityBanner.displayName = 'GlobalConnectivityBanner';

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingVertical: UX_SPACING.edgePadding / 2,   // 8dp vertical
    paddingHorizontal: UX_SPACING.edgePadding,      // 16dp horizontal
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    // Position at top of screen, above all content (Requirement 2.5)
    position: 'relative',
  },
  text: {
    textAlign: 'center',
    fontWeight: UX_TYPOGRAPHY.critical.fontWeight,   // 600
    lineHeight: UX_TYPOGRAPHY.critical.lineHeight,
  },
  forceSyncButton: {
    marginLeft: UX_SPACING.componentGap,             // 12dp
    paddingVertical: UX_SPACING.componentGap / 2,    // 6dp
    paddingHorizontal: UX_SPACING.componentGap,      // 12dp
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    // Minimum touch target: 48x48dp (Requirement 5.1, 15.5)
    minHeight: UX_SPACING.touchTarget,
    minWidth: UX_SPACING.touchTarget * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forceSyncText: {
    fontWeight: UX_TYPOGRAPHY.secondary.fontWeight,  // 500
    lineHeight: UX_TYPOGRAPHY.secondary.lineHeight,
  },
});
