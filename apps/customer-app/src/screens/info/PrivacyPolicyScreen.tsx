import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.emoji}>🔒</Text>
        <Text style={s.lastUpdated}>Last updated: {new Date().toISOString().slice(0, 10)}</Text>

        <Text style={s.section}>Introduction</Text>
        <Text style={s.body}>
          VyaparSetu respects your privacy. We collect minimal data necessary to provide our services. Your personal information is never sold to third parties.
        </Text>

        <Text style={s.section}>Data Collection</Text>
        <Text style={s.body}>
          We collect the following information when you use our services:{'\n'}
          • Name and phone number{'\n'}
          • Delivery address{'\n'}
          • Order history{'\n'}
          • Payment information (processed securely by payment partners)
        </Text>

        <Text style={s.section}>How We Use Your Data</Text>
        <Text style={s.body}>
          Your data is used to:{'\n'}
          • Process and deliver your orders{'\n'}
          • Send order updates and offers{'\n'}
          • Improve our services{'\n'}
          • Provide customer support
        </Text>

        <Text style={s.section}>Data Security</Text>
        <Text style={s.body}>
          We use industry-standard encryption to protect your data. All payments are processed through secure payment gateways.
        </Text>

        <Text style={s.section}>Your Rights</Text>
        <Text style={s.body}>
          You may request deletion of your account and associated data at any time by contacting our support team.
        </Text>

        <Text style={s.section}>Contact</Text>
        <Text style={s.body}>
          For privacy-related queries, contact us at:{'\n'}
          📧 privacy@vyaparsetu.in
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
    borderBottomWidth: 1, borderColor: '#f0f0f0' },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 24 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  lastUpdated: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 20 },
  section: { fontSize: 17, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  body: { fontSize: 14, color: '#555', lineHeight: 22 },
});
