import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/colors';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useDeleteAccountMutation,
  NotificationPreferences,
} from '../../api/profileApi';
import { logout } from '../../store/slices/authSlice';
import { storage } from '../../utils/storage';
import type { ProfileNavigationProp } from '../../navigation/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';

const LANGUAGE_KEY = '@vyaparsetu_language';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
];

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const dispatch = useDispatch();

  const { data: prefs, isLoading: prefsLoading } = useGetNotificationPreferencesQuery();
  const [updatePrefs, { isLoading: isUpdatingPrefs }] = useUpdateNotificationPreferencesMutation();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    orderUpdates: true,
    promotions: true,
    newsletter: false,
    sms: true,
  });

  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Load saved language
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved) {
          setSelectedLanguage(saved);
        }
      } catch (error) {
      }
    };
    loadLanguage();
  }, []);

  // Update local state when prefs load
  useEffect(() => {
    if (prefs) {
      setNotificationPrefs(prefs);
    }
  }, [prefs]);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newPrefs = {
      ...notificationPrefs,
      [key]: !notificationPrefs[key],
    };
    setNotificationPrefs(newPrefs);

    try {
      await updatePrefs(newPrefs).unwrap();
    } catch (error: any) {
      // Revert on error
      setNotificationPrefs(notificationPrefs);
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleLanguageChange = async (code: string) => {
    setSelectedLanguage(code);
    setShowLanguagePicker(false);

    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, code);
    } catch (error) {
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount().unwrap();
              await storage.removeItem('accessToken');
              await storage.removeItem('refreshToken');
              dispatch(logout());
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            } catch (error: any) {
              Alert.alert('Error', error?.data?.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const getLanguageName = () => {
    const lang = LANGUAGES.find((l) => l.code === selectedLanguage);
    return lang?.name || 'English';
  };

  if (prefsLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Settings" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" showBackButton />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>

        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="cube-outline" size={20} color={Colors.primary} />
              <Text style={[styles.prefLabel, { marginLeft: 12 }]}>Order Updates</Text>
            </View>
            <Switch
              value={notificationPrefs.orderUpdates}
              onValueChange={() => handleToggle('orderUpdates')}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationPrefs.orderUpdates ? Colors.primary : Colors.textMuted}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="pricetag-outline" size={20} color={Colors.primary} />
              <Text style={[styles.prefLabel, { marginLeft: 12 }]}>Promotions & Offers</Text>
            </View>
            <Switch
              value={notificationPrefs.promotions}
              onValueChange={() => handleToggle('promotions')}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationPrefs.promotions ? Colors.primary : Colors.textMuted}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="newspaper-outline" size={20} color={Colors.primary} />
              <Text style={[styles.prefLabel, { marginLeft: 12 }]}>Newsletter</Text>
            </View>
            <Switch
              value={notificationPrefs.newsletter}
              onValueChange={() => handleToggle('newsletter')}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationPrefs.newsletter ? Colors.primary : Colors.textMuted}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
              <Text style={[styles.prefLabel, { marginLeft: 12 }]}>SMS Notifications</Text>
            </View>
            <Switch
              value={notificationPrefs.sms}
              onValueChange={() => handleToggle('sms')}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationPrefs.sms ? Colors.primary : Colors.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => setShowLanguagePicker(!showLanguagePicker)}
        >
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="language-outline" size={20} color={Colors.primary} />
              <Text style={[styles.prefLabel, { marginLeft: 12 }]}>App Language</Text>
            </View>
            <View style={styles.prefValue}>
              <Text style={styles.prefValueText}>{getLanguageName()}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </View>
        </TouchableOpacity>

        {showLanguagePicker && (
          <View style={styles.languagePicker}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  selectedLanguage === lang.code && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    selectedLanguage === lang.code && styles.languageOptionTextActive,
                  ]}
                >
                  {lang.name}
                </Text>
                {selectedLanguage === lang.code && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Currency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Currency</Text>

        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="cash-outline" size={20} color={Colors.primary} />
              <Text style={styles.prefLabel}>Display Currency</Text>
            </View>
            <View style={styles.prefValue}>
              <Text style={styles.prefValueText}>₹ INR (Indian Rupee)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.prefLabel}>App Version</Text>
            </View>
            <Text style={styles.prefValueText}>1.0.0</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              <Text style={styles.prefLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>

          <View style={styles.divider} />

          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
              <Text style={styles.prefLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.error }]}>Danger Zone</Text>

        <TouchableOpacity
          style={[styles.card, styles.deleteCard]}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          <View style={styles.prefRow}>
            <View style={styles.prefInfo}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={[styles.prefLabel, { color: Colors.error }]}>Delete Account</Text>
            </View>
            {isDeleting ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={Colors.error} />
            )}
          </View>
        </TouchableOpacity>

        <Text style={styles.warningText}>
          Deleting your account will permanently remove all your data, including orders, addresses,
          and preferences. This action cannot be undone.
        </Text>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  prefInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  prefValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefValueText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  languagePicker: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  languageOptionActive: {
    backgroundColor: Colors.primaryLight + '20',
  },
  languageOptionText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  languageOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  deleteCard: {
    borderColor: Colors.errorLight,
    backgroundColor: Colors.error + '05',
  },
  warningText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
});

export default SettingsScreen;
