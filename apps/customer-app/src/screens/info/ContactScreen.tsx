import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function ContactScreen({ navigation }: any) {
  const callSupport = () => {
    Linking.openURL('tel:+919876543210').catch(() => Alert.alert('Could not make call'));
  };

  const emailSupport = () => {
    Linking.openURL('mailto:support@vyaparsetu.in').catch(() => Alert.alert('Could not open email'));
  };

  const openMaps = () => {
    const url = 'https://maps.google.com/?q=17.385,78.4867';
    Linking.openURL(url).catch(() => Alert.alert('Could not open maps'));
  };

  return (
    <View style={s.container}>
      <ScreenHeader title="Contact Us" showBackButton />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.hero}>
          <Text style={s.heroIcon}>📞</Text>
          <Text style={s.heroTitle}>Get in Touch</Text>
          <Text style={s.heroText}>We'd love to hear from you</Text>
        </View>

        <View style={s.contactSection}>
          <TouchableOpacity style={[s.contactRow, { marginBottom: 12 }]} onPress={callSupport}>
            <View style={s.contactIconWrap}>
              <Text style={s.contactIcon}>📞</Text>
            </View>
            <View style={s.contactInfo}>
              <Text style={s.contactLabel}>Phone</Text>
              <Text style={s.contactValue}>+91 98765 43210</Text>
              <Text style={s.contactTime}>Mon-Sat, 9am-8pm IST</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.contactRow, { marginBottom: 12 }]} onPress={emailSupport}>
            <View style={s.contactIconWrap}>
              <Text style={s.contactIcon}>📧</Text>
            </View>
            <View style={s.contactInfo}>
              <Text style={s.contactLabel}>Email</Text>
              <Text style={s.contactValue}>support@vyaparsetu.in</Text>
              <Text style={s.contactTime}>We reply within 24 hours</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.contactRow} onPress={openMaps}>
            <View style={s.contactIconWrap}>
              <Text style={s.contactIcon}>📍</Text>
            </View>
            <View style={s.contactInfo}>
              <Text style={s.contactLabel}>Address</Text>
              <Text style={s.contactValue}>Hyderabad, Telangana</Text>
              <Text style={s.contactTime}>India - 500001</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.socialSection}>
          <Text style={s.socialTitle}>Follow Us</Text>
          <View style={s.socialRow}>
            {[
              { icon: '📘', name: 'Facebook' },
              { icon: '📸', name: 'Instagram' },
              { icon: '🐦', name: 'Twitter' },
            ].map((social, i, arr) => (
              <TouchableOpacity key={i} style={[s.socialBtn, i < arr.length - 1 && { marginRight: 12 }]}>
                <Text style={s.socialIcon}>{social.icon}</Text>
                <Text style={s.socialName}>{social.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20 },
  hero: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff8f5', borderRadius: 14, marginBottom: 20 },
  heroIcon: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#222' },
  heroText: { fontSize: 14, color: '#888', marginTop: 4 },
  contactSection: { },
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderRadius: 14, padding: 16 },
  contactIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  contactIcon: { fontSize: 24 },
  contactInfo: { flex: 1, marginLeft: 14 },
  contactLabel: { fontSize: 12, color: '#888' },
  contactValue: { fontSize: 16, fontWeight: '600', color: '#222', marginTop: 2 },
  contactTime: { fontSize: 12, color: '#888', marginTop: 2 },
  chevron: { fontSize: 24, color: '#ccc' },
  socialSection: { marginTop: 24 },
  socialTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  socialRow: { flexDirection: 'row' },
  socialBtn: { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, alignItems: 'center' },
  socialIcon: { fontSize: 28, marginBottom: 6 },
  socialName: { fontSize: 12, color: '#666' },
});
