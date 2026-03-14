import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

export default function CancellationScreen({ navigation }: any) {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Returns & Cancellation</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.emoji}>↩️</Text>

        <Text style={s.section}>Cancellation Policy</Text>
        <View style={s.card}>
          <Text style={s.cardTitle}>Before Dispatch</Text>
          <Text style={s.cardBody}>Full refund if cancelled before the order is dispatched from the store.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>After Dispatch</Text>
          <Text style={s.cardBody}>Orders cannot be cancelled once dispatched. Please refuse delivery if needed.</Text>
        </View>

        <Text style={s.section}>Return Policy</Text>
        <View style={s.card}>
          <Text style={s.cardTitle}>Damaged Items</Text>
          <Text style={s.cardBody}>Full refund or replacement. Report within 24 hours of delivery.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Wrong Items</Text>
          <Text style={s.cardBody}>Full refund or correct item delivery. Report within 24 hours.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Fresh Produce</Text>
          <Text style={s.cardBody}>Non-returnable due to perishable nature. Quality issues can be reported.</Text>
        </View>

        <Text style={s.section}>Refund Timeline</Text>
        <Text style={s.body}>
          • UPI: 3-5 business days{'\n'}
          • Cards: 5-7 business days{'\n'}
          • COD: Not applicable
        </Text>

        <Text style={s.note}>
          For any return requests, please contact our support team within 24 hours of delivery with photos of the issue.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 24 },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  section: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 12 },
  card: { backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#666', lineHeight: 20 },
  body: { fontSize: 14, color: '#555', lineHeight: 22 },
  note: { fontSize: 13, color: '#888', marginTop: 20, padding: 14, backgroundColor: '#fff8f5', borderRadius: 10, lineHeight: 20 },
});
