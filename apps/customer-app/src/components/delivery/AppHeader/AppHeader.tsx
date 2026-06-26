import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  return (
    <>
      {/* Light text on orange background — matches Orders page */}
      <StatusBar barStyle="light-content" backgroundColor={DELIVERY_COLORS.primary} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.row}>
          {/* Left: back button or spacer */}
          {showBack ? (
            <TouchableOpacity
              style={styles.sideBtn}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={DELIVERY_COLORS.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.sideBtn} />
          )}

          {/* Title */}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          {/* Right: optional content or spacer */}
          <View style={styles.sideBtn}>
            {rightContent ?? null}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: DELIVERY_COLORS.primary,   // orange — matches Orders page
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: DELIVERY_SPACING.lg,
    paddingVertical: DELIVERY_SPACING.sm,
    backgroundColor: DELIVERY_COLORS.primary,
  },
  sideBtn: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: DELIVERY_TYPOGRAPHY.md,
    fontWeight: '700',
    color: DELIVERY_COLORS.white,              // white text on orange
    letterSpacing: 0.2,
  },
});

export default AppHeader;
