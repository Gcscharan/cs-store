import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Switch, Alert,
} from 'react-native';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
];

export default function SettingsScreen({ navigation }: any) {
  const [language, setLanguage] = useState('en');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will clear app data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {} },
    ]);
  };

  const SettingRow = ({ label, sub, children }: any) => (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Language */}
        <Text style={s.sectionTitle}>🌐 Language</Text>
        <View style={s.card}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[s.langRow, language === lang.code && s.langRowActive]}
              onPress={() => setLanguage(lang.code)}
            >
              <Text style={[s.langLabel, language === lang.code && s.langLabelActive]}>
                {lang.label}
              </Text>
              <Text style={s.langNative}>{lang.native}</Text>
              {language === lang.code && <Text style={s.check}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Notifications */}
        <Text style={s.sectionTitle}>🔔 Notifications</Text>
        <View style={s.card}>
          <SettingRow label="Push Notifications" sub="Order updates, offers">
            <Switch value={pushEnabled} onValueChange={setPushEnabled}
              trackColor={{ false: '#ddd', true: '#fcbca1' }}
              thumbColor={pushEnabled ? '#E95C1E' : '#f4f3f4'} />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="SMS Notifications" sub="Order status via SMS">
            <Switch value={smsEnabled} onValueChange={setSmsEnabled}
              trackColor={{ false: '#ddd', true: '#fcbca1' }}
              thumbColor={smsEnabled ? '#E95C1E' : '#f4f3f4'} />
          </SettingRow>
          <View style={s.divider} />
          <SettingRow label="Email Notifications" sub="Promotions & newsletters">
            <Switch value={emailEnabled} onValueChange={setEmailEnabled}
              trackColor={{ false: '#ddd', true: '#fcbca1' }}
              thumbColor={emailEnabled ? '#E95C1E' : '#f4f3f4'} />
          </SettingRow>
        </View>

        {/* Account */}
        <Text style={s.sectionTitle}>👤 Account</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.menuRow} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={s.menuLabel}>Edit Profile</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.menuRow} onPress={() => navigation.navigate('Addresses')}>
            <Text style={s.menuLabel}>Manage Addresses</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.menuRow} onPress={handleClearCache}>
            <Text style={s.menuLabel}>Clear Cache</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={s.sectionTitle}>ℹ️ About</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.menuRow}>
            <Text style={s.menuLabel}>Terms & Conditions</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.menuRow}>
            <Text style={s.menuLabel}>Privacy Policy</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <View style={s.menuRow}>
            <Text style={s.menuLabel}>App Version</Text>
            <Text style={s.version}>1.0.0</Text>
          </View>
        </View>

        {/* Support */}
        <Text style={s.sectionTitle}>📞 Support</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.menuRow}>
            <Text style={s.menuLabel}>Help Center</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.menuRow}>
            <Text style={s.menuLabel}>Contact Us</Text>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333',
    marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f5f5f5', marginLeft: 16 },
  langRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  langRowActive: { backgroundColor: '#fff8f5' },
  langLabel: { fontSize: 15, color: '#333', width: 80 },
  langLabelActive: { color: '#E95C1E', fontWeight: '600' },
  langNative: { fontSize: 14, color: '#888', flex: 1 },
  check: { color: '#E95C1E', fontWeight: '700', fontSize: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 16 },
  menuLabel: { fontSize: 15, color: '#333' },
  menuArrow: { fontSize: 18, color: '#bbb' },
  version: { fontSize: 14, color: '#888' },
});
