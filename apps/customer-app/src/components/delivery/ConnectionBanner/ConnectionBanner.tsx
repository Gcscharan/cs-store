import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SocketStatus } from '../../../hooks/delivery/useDeliverySocket';
import { DELIVERY_COLORS, DELIVERY_TYPOGRAPHY, DELIVERY_SPACING } from '../../../constants/deliveryTheme';

interface ConnectionBannerProps {
  isOnline: boolean;
  socketStatus: SocketStatus;
  connectionType: string;
  isSyncing: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  isOnline,
  socketStatus,
  isSyncing,
}) => {
  // Offline is handled by GlobalConnectivityBanner on the home screen
  if (!isOnline) {
    return null;
  }

  if (socketStatus === 'connected' && !isSyncing) {
    return null;
  }

  let backgroundColor: string;
  let message: string;

  if (isSyncing) {
    backgroundColor = DELIVERY_COLORS.warning;
    message = 'Syncing queued actions…';
  } else if (socketStatus === 'disconnected') {
    backgroundColor = DELIVERY_COLORS.warning;
    message = 'Live updates paused — polling for orders';
  } else {
    backgroundColor = DELIVERY_COLORS.warning;
    message = 'Reconnecting to server…';
  }

  return (
    <View style={[styles.banner, { backgroundColor }]} pointerEvents="box-none">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingVertical: DELIVERY_SPACING.sm,
    paddingHorizontal: DELIVERY_SPACING.lg,
    zIndex: 100,
  },
  text: {
    color: DELIVERY_COLORS.white,
    textAlign: 'center',
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '600',
  },
});
