import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function CancellationScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <ScreenHeader title="Returns & Cancellation" showBackButton />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.cardIcon}>↩️</Text>
          <Text style={s.cardTitle}>Easy Returns</Text>
          <Text style={s.cardText}>
            We want you to be completely satisfied with your purchase. If you're not happy, we'll make it right.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Return Policy</Text>
          <Text style={s.text}>
            • Returns accepted within 7 days of delivery{'\n'}
            • Items must be unused, unwashed, and in original packaging{'\n'}
            • Original tags must be attached{'\n'}
            • Refund will be credited to original payment method
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Non-Returnable Items</Text>
          <Text style={s.text}>
            • Perishable goods (food items, flowers){'\n'}
            • Personal care products{'\n'}
            • Innerwear and lingerie{'\n'}
            • Customized or personalized items{'\n'}
            • Items marked as "Non-returnable"
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>How to Return</Text>
          <Text style={s.text}>
            1. Go to My Orders{'\n'}
            2. Select the order{'\n'}
            3. Click "Request Refund"{'\n'}
            4. Choose reason and submit{'\n'}
            5. We'll arrange pickup within 2-3 days
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Order Cancellation</Text>
          <Text style={s.text}>
            • Cancel before dispatch for full refund{'\n'}
            • Once dispatched, return process applies{'\n'}
            • COD orders can be cancelled before delivery
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Refund Timeline</Text>
          <Text style={s.text}>
            • UPI: 1-2 business days{'\n'}
            • Bank Account: 5-7 business days{'\n'}
            • Wallet: Instant{'\n'}
            • COD: Refund to bank account in 7-10 days
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
  card: { backgroundColor: '#fff8f5', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  cardIcon: { fontSize: 40, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  cardText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 8 },
  text: { fontSize: 14, color: '#555', lineHeight: 22 },
});
