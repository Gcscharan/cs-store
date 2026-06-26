import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import {
  hideToast,
  showNextNotificationToast,
  dismissNotificationToast,
} from '../../store/slices/uiSlice';
import { RootState } from '../../store';
import { navigateFromNotification } from '../../utils/notificationDeepLink';
import { Colors } from '../../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const AUTO_DISMISS_MS = 7000;
const QUEUE_GAP_MS = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Category → visual theme (icon + accent color + soft background)
// ─────────────────────────────────────────────────────────────────────────────

type ToastTheme = {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  iconBg: string;
};

const CATEGORY_THEME: Record<string, ToastTheme> = {
  order: { icon: 'cube', accent: '#FF6A00', iconBg: '#FFF1E6' },
  delivery: { icon: 'bicycle', accent: '#2563EB', iconBg: '#E8F0FE' },
  payment: { icon: 'card', accent: '#16A34A', iconBg: '#E7F7EE' },
  account: { icon: 'shield-checkmark', accent: '#7C3AED', iconBg: '#F1E9FE' },
  promo: { icon: 'pricetag', accent: '#DB2777', iconBg: '#FCE7F1' },
  default: { icon: 'notifications', accent: '#FF6A00', iconBg: '#FFF1E6' },
};

function getToastTheme(category?: string, isSummary?: boolean): ToastTheme {
  if (isSummary) return { icon: 'mail', accent: '#FF6A00', iconBg: '#FFF1E6' };
  return CATEGORY_THEME[category || 'default'] || CATEGORY_THEME.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Toast — preserves original showToast/hideToast behavior
// ─────────────────────────────────────────────────────────────────────────────

const LegacyToast = () => {
  const { visible, message } = useSelector((state: RootState) => state.ui.toast);
  const dispatch = useDispatch();

  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after 4 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 100,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => dispatch(hideToast()));
      }, AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    }
  }, [visible, dispatch, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>✅ {message}</Text>
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification Toast — queue-based with swipe-to-dismiss and tap-to-navigate
// ─────────────────────────────────────────────────────────────────────────────

const NotificationToastDisplay = () => {
  const dispatch = useDispatch();
  const { current, isDisplaying, queue, overflowCount } = useSelector(
    (state: RootState) => state.ui.notificationToastQueue
  );

  const translateY = useRef(new Animated.Value(-100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show next toast from queue when nothing is displaying
  useEffect(() => {
    if (!isDisplaying && (queue.length > 0 || overflowCount > 0)) {
      // Add gap between toasts
      gapTimerRef.current = setTimeout(() => {
        dispatch(showNextNotificationToast());
      }, QUEUE_GAP_MS);
    }

    return () => {
      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current);
      }
    };
  }, [isDisplaying, queue.length, overflowCount, dispatch]);

  // Animate in when a new toast is being displayed
  useEffect(() => {
    if (isDisplaying && current) {
      // Reset positions
      translateY.setValue(-100);
      translateX.setValue(0);
      opacity.setValue(0);
      progress.setValue(1);

      // Slide in from top
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Countdown progress bar (width-based, can't use native driver)
      Animated.timing(progress, {
        toValue: 0,
        duration: AUTO_DISMISS_MS,
        useNativeDriver: false,
      }).start();

      // Auto-dismiss after timeout
      dismissTimerRef.current = setTimeout(() => {
        animateDismiss();
      }, AUTO_DISMISS_MS);

      return () => {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }
      };
    }
  }, [isDisplaying, current?.id]);

  const animateDismiss = useCallback(
    (direction: 'up' | 'left' | 'right' = 'up') => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      const animations: Animated.CompositeAnimation[] = [
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ];

      if (direction === 'up') {
        animations.push(
          Animated.timing(translateY, {
            toValue: -100,
            duration: 250,
            useNativeDriver: true,
          })
        );
      } else {
        animations.push(
          Animated.timing(translateX, {
            toValue: direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH,
            duration: 250,
            useNativeDriver: true,
          })
        );
      }

      Animated.parallel(animations).start(() => {
        dispatch(dismissNotificationToast());
      });
    },
    [dispatch, opacity, translateY, translateX]
  );

  // Swipe-to-dismiss gesture via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Respond to horizontal swipes
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Track horizontal swipe movement
        translateX.setValue(gestureState.dx);
        // Also allow upward swipe
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
          // Swipe past threshold — dismiss horizontally
          animateDismiss(gestureState.dx > 0 ? 'right' : 'left');
        } else if (gestureState.dy < -SWIPE_THRESHOLD * 0.5) {
          // Upward swipe past threshold — dismiss up
          animateDismiss('up');
        } else {
          // Snap back to center
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              tension: 80,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              tension: 80,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // Tap-to-navigate using deepLink
  const handleTap = useCallback(() => {
    if (!current?.deepLink) return;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    // Use the shared resolver so toast taps behave identically to push taps.
    navigateFromNotification({ deepLink: current.deepLink, category: current.category });

    // Dismiss after navigation
    dispatch(dismissNotificationToast());
  }, [current, dispatch]);

  if (!isDisplaying || !current) return null;

  const isSummary = current.id.startsWith('summary-');
  const theme = getToastTheme(current.category, isSummary);
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.notificationToast,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.cardShadow}>
        {/* Colored accent bar on the left edge */}
        <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />

        <TouchableOpacity
          style={styles.notificationContent}
          onPress={handleTap}
          activeOpacity={0.92}
        >
          <View style={[styles.notificationIcon, { backgroundColor: theme.iconBg }]}>
            <Ionicons name={theme.icon} size={20} color={theme.accent} />
          </View>

          <View style={styles.notificationBody}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={styles.notificationBodyText} numberOfLines={2}>
              {current.body}
            </Text>
          </View>

          {current.deepLink && (
            <View style={[styles.chevron, { backgroundColor: theme.iconBg }]}>
              <Ionicons name="chevron-forward" size={16} color={theme.accent} />
            </View>
          )}
        </TouchableOpacity>

        {/* Countdown progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: theme.accent },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Note: notification:new socket events are handled in socketClient.ts
// setupEventHandlers(), which dispatches enqueueNotificationToast + showNextNotificationToast.
// No additional socket listener is needed here.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Combined Toast Component — renders both legacy and notification toasts
// ─────────────────────────────────────────────────────────────────────────────

export const Toast = () => {
  return (
    <>
      <LegacyToast />
      <NotificationToastDisplay />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Legacy toast styles (bottom position)
  toast: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#323232',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Notification toast styles (top position, premium card)
  notificationToast: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    zIndex: 10000,
  },
  cardShadow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 14,
    flexDirection: 'row',
  },
  accentBar: {
    width: 5,
  },
  notificationContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  notificationBodyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  chevronText: {
    fontSize: 20,
    color: '#CCCCCC',
    fontWeight: '300',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 5,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: 3,
    borderBottomLeftRadius: 18,
    opacity: 0.85,
  },
});
