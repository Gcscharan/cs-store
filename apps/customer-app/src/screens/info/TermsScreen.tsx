import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

export default function TermsScreen({ navigation }: any) {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Terms & Conditions</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.emoji}>📜</Text>
        <Text style={s.lastUpdated}>Last updated: {new Date().toISOString().slice(0, 10)}</Text>

        <Text style={s.section}>1. Acceptance of Terms</Text>
        <Text style={s.body}>
          By using VyaparSetu, you agree to these terms of service. If you do not agree, please do not use our services.
        </Text>

        <Text style={s.section}>2. Orders & Pricing</Text>
        <Text style={s.body}>
          • All purchases are subject to product availability{'\n'}
          • Prices may vary and are subject to change{'\n'}
          • We reserve the right to cancel orders in case of pricing errors or unavailability
        </Text>

        <Text style={s.section}>3. Delivery</Text>
        <Text style={s.body}>
          • Delivery timelines are estimates and may vary based on location and demand{'\n'}
          • We are not liable for delays beyond our control
        </Text>

        <Text style={s.section}>4. Returns & Refunds</Text>
        <Text style={s.body}>
          • Damaged or incorrect items can be returned within 24 hours{'\n'}
          • Refunds will be processed within 3-5 business days{'\n'}
          • Fresh produce is non-returnable
        </Text>

        <Text style={s.section}>5. User Conduct</Text>
        <Text style={s.body}>
          Users must not:{'\n'}
          • Provide false information{'\n'}
          • Use the platform for illegal purposes{'\n'}
          • Attempt to manipulate pricing or reviews
        </Text>

        <Text style={s.section}>6. Limitation of Liability</Text>
        <Text style={s.body}>
          VyaparSetu shall not be liable for any indirect, incidental, or consequential damages arising from use of our services.
        </Text>

        <Text style={s.section}>7. Changes to Terms</Text>
        <Text style={s.body}>
          We may update these terms from time to time. Continued use of the platform constitutes acceptance of updated terms.
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
