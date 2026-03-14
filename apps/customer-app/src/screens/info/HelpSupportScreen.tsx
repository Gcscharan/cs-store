import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Linking } from 'react-native';

export default function HelpSupportScreen({ navigation }: any) {
  const callSupport = () => Linking.openURL('tel:18001234567');
  const emailSupport = () => Linking.openURL('mailto:support@vyaparsetu.in');

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Help & Support</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.emoji}>❓</Text>
        <Text style={s.heading}>Need help? We're here!</Text>

        <View style={s.card}>
          <Text style={s.cardIcon}>📞</Text>
          <View style={s.cardContent}>
            <Text style={s.cardTitle}>Call Support</Text>
            <Text style={s.cardDesc}>Available 9 AM - 9 PM, 7 days</Text>
            <TouchableOpacity onPress={callSupport}>
              <Text style={s.link}>1800-123-4567</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardIcon}>📧</Text>
          <View style={s.cardContent}>
            <Text style={s.cardTitle}>Email Us</Text>
            <Text style={s.cardDesc}>We'll respond within 24 hours</Text>
            <TouchableOpacity onPress={emailSupport}>
              <Text style={s.link}>support@vyaparsetu.in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.sectionTitle}>Frequently Asked Questions</Text>

        {[
          { q: 'How do I track my order?', a: 'Go to Orders tab and tap on your order to see live tracking.' },
          { q: 'What is the return policy?', a: 'You can return items within 24 hours of delivery if damaged or wrong.' },
          { q: 'How do I cancel an order?', a: 'Orders can be cancelled before dispatch from Orders tab.' },
          { q: 'What payment methods are accepted?', a: 'We accept UPI, Cards, Net Banking, and Cash on Delivery.' },
        ].map((item, i) => (
          <View key={i} style={s.faqItem}>
            <Text style={s.faqQ}>Q: {item.q}</Text>
            <Text style={s.faqA}>A: {item.a}</Text>
          </View>
        ))}
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
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  card: { flexDirection: 'row', backgroundColor: '#f8f8f8', borderRadius: 12,
    padding: 16, marginBottom: 12, alignItems: 'center', gap: 14 },
  cardIcon: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  cardDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  link: { color: '#E95C1E', fontWeight: '600', marginTop: 6, fontSize: 15 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  faqItem: { backgroundColor: '#fafafa', borderRadius: 10, padding: 14, marginBottom: 10 },
  faqQ: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  faqA: { fontSize: 13, color: '#666', lineHeight: 20 },
});
