import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function TermsScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <ScreenHeader title="Terms & Conditions" showBackButton />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.lastUpdated}>Last updated: March 2024</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={s.text}>
            By using Vyapara Setu, you agree to these terms. If you do not agree, please do not use our services.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>2. Account Registration</Text>
          <Text style={s.text}>
            You must provide accurate information during registration. You are responsible for maintaining the confidentiality of your account.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Orders & Payments</Text>
          <Text style={s.text}>
            • All prices are in Indian Rupees (INR){'\n'}
            • We reserve the right to cancel orders due to pricing errors or stock unavailability{'\n'}
            • Payment must be made at the time of order placement{'\n'}
            • COD orders require exact change
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>4. Delivery</Text>
          <Text style={s.text}>
            • Delivery times are estimates and not guaranteed{'\n'}
            • We are not liable for delays due to unforeseen circumstances{'\n'}
            • Someone must be available to receive the delivery
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>5. Returns & Refunds</Text>
          <Text style={s.text}>
            • Returns accepted within 7 days of delivery{'\n'}
            • Items must be unused and in original packaging{'\n'}
            • Refunds processed within 5-7 business days{'\n'}
            • Certain items are non-returnable (perishables, personal care)
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>6. Limitation of Liability</Text>
          <Text style={s.text}>
            Vyapara Setu shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>7. Intellectual Property</Text>
          <Text style={s.text}>
            All content on Vyapara Setu, including logos, text, and images, is owned by Vyapara Setu and protected by copyright laws.
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
