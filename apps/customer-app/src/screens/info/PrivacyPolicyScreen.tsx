import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <ScreenHeader title="Privacy Policy" showBackButton />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.lastUpdated}>Last updated: March 2024</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Information We Collect</Text>
          <Text style={s.text}>
            We collect information you provide directly, including name, phone number, email, delivery address, and payment information when you place orders.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={s.text}>
            • Process and deliver your orders{'\n'}
            • Send order updates and notifications{'\n'}
            • Improve our services and user experience{'\n'}
            • Provide customer support{'\n'}
            • Send promotional offers (with your consent)
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Data Security</Text>
          <Text style={s.text}>
            We implement industry-standard security measures to protect your personal information. All payment transactions are encrypted using SSL technology.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>4. Third-Party Sharing</Text>
          <Text style={s.text}>
            We do not sell your personal data. We may share information with delivery partners and payment processors solely to complete your orders.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>5. Your Rights</Text>
          <Text style={s.text}>
            You have the right to access, correct, or delete your personal data. Contact us at privacy@vyaparsetu.in for any privacy-related requests.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>6. Cookies</Text>
          <Text style={s.text}>
            We use cookies and similar technologies to improve your browsing experience and analyze site traffic.
          </Text>
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
  lastUpdated: { fontSize: 12, color: '#888', marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 8 },
  text: { fontSize: 14, color: '#555', lineHeight: 22 },
});
