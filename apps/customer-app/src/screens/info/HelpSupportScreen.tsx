import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function HelpSupportScreen({ navigation }: any) {
  const openWhatsApp = () => {
    const url = 'whatsapp://send?phone=919876543210&text=Hi, I need help with my order';
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('WhatsApp not installed');
    }).catch(() => Alert.alert('Could not open WhatsApp'));
  };

  const callSupport = () => {
    Linking.openURL('tel:+919876543210').catch(() => Alert.alert('Could not make call'));
  };

  const emailSupport = () => {
    Linking.openURL('mailto:support@vyaparsetu.in').catch(() => Alert.alert('Could not open email'));
  };

  return (
    <View style={s.container}>
      <ScreenHeader title="Help & Support" showBackButton />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.intro}>We're here to help! Choose how you'd like to reach us.</Text>

        <View style={s.contactGrid}>
          <TouchableOpacity style={[s.contactCard, { marginBottom: 12 }]} onPress={callSupport}>
            <Text style={s.contactIcon}>📞</Text>
            <Text style={s.contactTitle}>Call Us</Text>
            <Text style={s.contactInfo}>+91 98765 43210</Text>
            <Text style={s.contactTime}>Mon-Sat, 9am-8pm</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.contactCard, { marginBottom: 12 }]} onPress={openWhatsApp}>
            <Text style={s.contactIcon}>💬</Text>
            <Text style={s.contactTitle}>WhatsApp</Text>
            <Text style={s.contactInfo}>Chat with us</Text>
            <Text style={s.contactTime}>Quick response</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.contactCard} onPress={emailSupport}>
            <Text style={s.contactIcon}>📧</Text>
            <Text style={s.contactTitle}>Email</Text>
            <Text style={s.contactInfo}>support@vyaparsetu.in</Text>
            <Text style={s.contactTime}>24-48hr response</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
          
          {[
            { q: 'How do I track my order?', a: 'Go to Orders → Select your order → Track Order' },
            { q: 'How do I return a product?', a: 'Go to Order Details → Request Refund within 7 days' },
            { q: 'Where is my refund?', a: 'Refunds take 5-7 business days after approval' },
            { q: 'How do I change my address?', a: 'Account → Addresses → Edit or Add New' },
          ].map((item, i) => (
            <View key={i} style={s.faqItem}>
              <Text style={s.faqQ}>Q: {item.q}</Text>
              <Text style={s.faqA}>A: {item.a}</Text>
            </View>
          ))}
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
  intro: { fontSize: 15, color: '#666', marginBottom: 20, lineHeight: 22 },
  contactGrid: { },
  contactCard: { backgroundColor: '#f8f8f8', borderRadius: 14, padding: 16, alignItems: 'center' },
  contactIcon: { fontSize: 32, marginBottom: 8 },
  contactTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  contactInfo: { fontSize: 14, color: '#E95C1E', marginTop: 4 },
  contactTime: { fontSize: 12, color: '#888', marginTop: 2 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  faqItem: { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, marginBottom: 10 },
  faqQ: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  faqA: { fontSize: 13, color: '#666', lineHeight: 20 },
});
