import React from 'react';
import { View, Text, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
} from '../../../constants/deliveryTheme';

interface ControlBarProps {
  isOnline: boolean;
  earnings: number;
  onToggleOnline: () => void;
  isToggling: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isOnline,
  earnings,
  onToggleOnline,
  isToggling,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { paddingTop: insets.top + DELIVERY_SPACING.sm }]}>
      <View style={styles.row}>
        {/* Earnings — only shown when > 0 */}
        {earnings > 0 && (
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Today</Text>
            <Text style={styles.earningsValue}>₹{earnings}</Text>
          </View>
        )}

        {/* My Route button */}
        <TouchableOpacity
          style={styles.routeBtn}
          onPress={() => navigation.navigate('DeliveryRoute')}
          activeOpacity={0.8}
        >
          <Ionicons name="map" size={14} color={DELIVERY_COLORS.primary} />
          <Text style={styles.routeBtnText}>My Route</Text>
        </TouchableOpacity>

        {/* Online/Offline toggle chip */}
        <Pressable
          onPress={onToggleOnline}
          disabled={isToggling}
          style={[
            styles.onlineChip,
            isOnline ? styles.onlineChipOnline : styles.onlineChipOffline,
            isToggling && styles.onlineChipDisabled,
          ]}
        >
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.onlineChipText, isOnline ? styles.chipTextOnline : styles.chipTextOffline]}>
            {isToggling ? '...' : isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DELIVERY_COLORS.card,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: DELIVERY_COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
  },
  earningsLabel: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
  },
  earningsValue: {
    fontSize: DELIVERY_TYPOGRAPHY.md,
    color: DELIVERY_COLORS.earnings,
    fontWeight: '700',
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
    borderRadius: DELIVERY_RADIUS.full,
    borderWidth: 1.5,
    borderColor: DELIVERY_COLORS.primary,
    backgroundColor: DELIVERY_COLORS.primary + '12',
    minHeight: 36,
  },
  routeBtnText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '700',
    color: DELIVERY_COLORS.primary,
    letterSpacing: 0.3,
  },
  onlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DELIVERY_SPACING.xs,
    paddingHorizontal: DELIVERY_SPACING.md,
    paddingVertical: DELIVERY_SPACING.sm,
    borderRadius: DELIVERY_RADIUS.full,
    borderWidth: 1.5,
    minHeight: 36,
    marginLeft: 'auto',
  },
  onlineChipOnline: {
    backgroundColor: DELIVERY_COLORS.successBg,
    borderColor: DELIVERY_COLORS.success,
  },
  onlineChipOffline: {
    backgroundColor: DELIVERY_COLORS.dangerBg,
    borderColor: DELIVERY_COLORS.danger,
  },
  onlineChipDisabled: {
    opacity: 0.6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: DELIVERY_COLORS.success,
  },
  dotOffline: {
    backgroundColor: DELIVERY_COLORS.danger,
  },
  onlineChipText: {
    fontSize: DELIVERY_TYPOGRAPHY.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chipTextOnline: {
    color: DELIVERY_COLORS.success,
  },
  chipTextOffline: {
    color: DELIVERY_COLORS.danger,
  },
});

export default ControlBar;
