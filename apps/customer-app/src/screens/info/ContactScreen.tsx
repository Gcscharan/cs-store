import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Linking } from 'react-native';

export default function ContactScreen({ navigation }: any) {
  const callPhone = () => Linking.openURL('tel:18001234567');
  const sendEmail = () => Linking.openURL('mailto:hello@vyaparsetu.in');

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Contact Us</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.emoji}>📞</Text>
        <Text style={s.heading}>We'd love to hear from you!</Text>

        <TouchableOpacity style={s.contactCard} onPress={callPhone}>
          <Text style={s.icon}>📞</Text>
          <View style={s.contactInfo}>
            <Text style={s.contactTitle}>Phone</Text>
            <Text style={s.contactDetail}>1800-123-4567</Text>
            <Text style={s.contactNote}>Mon-Sun: 9 AM to 9 PM</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.contactCard} onPress={sendEmail}>
          <Text style={s.icon}>📧</Text>
          <View style={s.contactInfo}>
            <Text style={s.contactTitle}>Email</Text>
            <Text style={s.contactDetail}>hello@vyaparsetu.in</Text>
            <Text style={s.contactNote}>We'll respond within 24 hours</Text>
          </View>
        </TouchableOpacity>

        <View style={s.addressCard}>
          <Text style={s.icon}>📍</Text>
          <View style={s.contactInfo}>
            <Text style={s.contactTitle}>Address</Text>
            <Text style={s.contactDetail}>VyaparSetu Technologies Pvt Ltd{'\n'}Vijayawada, Andhra Pradesh - 521235</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Follow Us</Text>
        <View style={s.socialRow}>
          <TouchableOpacity style={s.socialBtn}><Text style={s.socialIcon}>📘</Text></TouchableOpacity>
          <TouchableOpacity style={s.socialBtn}><Text style={s.socialIcon}>📸</Text></TouchableOpacity>
          <TouchableOpacity style={s.socialBtn}><Text style={s.socialIcon}>🐦</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 24, alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  contactCard: { flexDirection: 'row', backgroundColor: '#f8f8f8', borderRadius: 14, padding: 18, marginBottom: 12, alignItems: 'center', gap: 16, width: '100%' },
  addressCard: { flexDirection: 'row', backgroundColor: '#f8f8f8', borderRadius: 14, padding: 18, marginBottom: 12, alignItems: 'center', gap: 16, width: '100%' },
  icon: { fontSize: 28 },
  contactInfo: { flex: 1 },
  contactTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  contactDetail: { fontSize: 14, color: '#E95C1E', marginTop: 4, lineHeight: 20 },
  contactNote: { fontSize: 12, color: '#888', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  socialRow: { flexDirection: 'row', gap: 16 },
  socialBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  socialIcon: { fontSize: 28 },
});
