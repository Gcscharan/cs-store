import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useTranslation } from 'react-i18next';
import { safeT } from '../utils/safeTranslate';
import type { VoiceSearchState } from '../hooks/useVoiceSearch';

type Variant = 'full' | 'header';

interface HomeSearchBarProps {
  navigation: any;
  onPress?: () => void;
  onMicPress?: () => void;
  placeholder?: string;
  voiceState?: VoiceSearchState;
  editable?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  variant?: Variant;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  navigation,
  onPress,
  onMicPress,
  placeholder,
  voiceState = 'idle',
  editable = false,
  value,
  onChangeText,
  onSubmitEditing,
  variant = 'full',
}) => {
  const { t } = useTranslation();

  const handleSearchPress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Search', {});
    }
  };

  const defaultPlaceholder = placeholder || safeT(t, 'home.search_placeholder', 'Search for products…');

  const isHeader = variant === 'header';

  return (
    <View style={[styles.searchBarRow, isHeader && styles.headerContainer]}>
      {editable ? (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={defaultPlaceholder}
            placeholderTextColor={Colors.textMuted}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            returnKeyType="search"
          />
          {value && value.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText?.('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.searchBar}
          onPress={handleSearchPress}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Text style={styles.searchPlaceholder}>
            {defaultPlaceholder}
          </Text>
        </TouchableOpacity>
      )}
      {/* Mic: separate touchable so tap is independent */}
      {onMicPress && (
        <TouchableOpacity
          style={styles.micBtn}
          onPress={onMicPress}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons
            name={voiceState === 'listening' ? 'mic' : 'mic-outline'}
            size={22}
            color={voiceState === 'listening' ? Colors.primary : Colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    height: 48,
  },
  headerContainer: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 8,
  },
  searchBar: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  micBtn: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPlaceholder: {
    color: Colors.textMuted,
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
});
