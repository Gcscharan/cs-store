import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
} from '../../../constants/deliveryTheme';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightContent,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + DELIVERY_SPACING.sm }]}>
      <View style={styles.row}>
        {/* Left: back button or spacer */}
        {showBack ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={DELIVERY_COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}

        {/* Title — left aligned */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Right: optional content or spacer */}
        <View style={styles.right}>
          {rightContent ?? null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: DELIVERY_COLORS.background,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingBottom: DELIVERY_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: DELIVERY_COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: DELIVERY_TYPOGRAPHY.md,
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
  },
  right: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

export default AppHeader;
