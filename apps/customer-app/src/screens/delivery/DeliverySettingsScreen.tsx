import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import Constants from 'expo-constants';

const SETTINGS_KEY = '@delivery_settings';

interface SettingsState {
  newOrders: boolean;
  earnings: boolean;
  updates: boolean;
  emergencyAlerts: boolean;
  darkMode: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  newOrders: true,
  earnings: true,
  updates: true,
  emergencyAlerts: true,
  darkMode: false,
};

export default function DeliverySettingsScreen({ navigation }: any) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    logEvent('screen_view', { screen: 'DeliverySettings' });
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings(JSON.parse(stored));
    } catch {}
  };

  const updateSetting = async (key: keyof SettingsState, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    logEvent('setting_toggled', { setting: key, enabled: value });
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleNavAction = (dest: string) => {
    logEvent('setting_navigation', { destination: dest });
    Alert.alert('Coming Soon', `${dest} will be available in the next update.`);
  };

  const sections = [
    {
      title: '🔔 Notifications',
      items: [
        { label: 'New Orders', desc: 'Get notified about new delivery requests', key: 'newOrders' as const, type: 'toggle' },
        { label: 'Earnings Updates', desc: 'Receive updates about your earnings', key: 'earnings' as const, type: 'toggle' },
        { label: 'App Updates', desc: 'Get notified about new features', key: 'updates' as const, type: 'toggle' },
        { label: 'Emergency Alerts', desc: 'Important safety and weather alerts', key: 'emergencyAlerts' as const, type: 'toggle' },
      ],
    },
    {
      title: '🎨 Appearance',
      items: [
        { label: 'Dark Mode', desc: 'Switch between light and dark themes', key: 'darkMode' as const, type: 'toggle' },
      ],
    },
    {
      title: '🛡 Location & Safety',
      items: [
        { label: 'Location Services', desc: 'Allow location access for deliveries', type: 'nav', dest: 'Location Settings' },
        { label: 'Emergency Contacts', desc: 'Manage emergency contact info', type: 'nav', dest: 'Emergency Contacts' },
        { label: 'Safety Tips', desc: 'View safety guidelines', type: 'nav', dest: 'Safety Tips' },
      ],
    },
    {
      title: '⏰ Working Hours',
      items: [
        { label: 'Set Availability', desc: 'Configure your working hours', type: 'nav', dest: 'Availability' },
        { label: 'Auto-Offline', desc: 'Go offline after work hours', type: 'nav', dest: 'Auto-Offline' },
      ],
    },
  ];

  return (
    <View style={s.container}>
      <ScreenHeader title="Settings" showBackButton />

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {sections.map((section, si) => (
          <View key={si} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <View style={s.sectionCard}>
              {section.items.map((item, ii) => (
                <View key={ii} style={[s.settingRow, ii > 0 && s.settingDivider]}>
                  <View style={s.settingInfo}>
                    <Text style={s.settingLabel}>{item.label}</Text>
                    <Text style={s.settingDesc}>{item.desc}</Text>
                  </View>
                  {item.type === 'toggle' && 'key' in item ? (
                    <Switch
                      value={settings[item.key]}
                      onValueChange={(val) => updateSetting(item.key, val)}
                      trackColor={{ false: Colors.border, true: Colors.secondaryLight }}
                      thumbColor={settings[item.key] ? Colors.secondary : Colors.textMuted}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => 'dest' in item && handleNavAction(item.dest!)}>
                      <Text style={s.navArrow}>→</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* App Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ℹ️ App Information</Text>
          <View style={s.sectionCard}>
            {[
              { label: 'Version', value: Constants.expoConfig?.version || '1.0.0' },
              { label: 'Platform', value: 'React Native (Expo)' },
              { label: 'Last Updated', value: new Date().toLocaleDateString() },
            ].map((info, i) => (
              <View key={i} style={[s.infoRow, i > 0 && s.settingDivider]}>
                <Text style={s.infoLabel}>{info.label}</Text>
                <Text style={s.infoValue}>{info.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  sectionCard: { backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  settingDivider: { borderTopWidth: 1, borderTopColor: Colors.surface },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  settingDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  navArrow: { fontSize: 18, color: Colors.textMuted },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoLabel: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  infoValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
});
