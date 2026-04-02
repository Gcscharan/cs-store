import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function AboutScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <ScreenHeader title="About Vyapara Setu" showBackButton />

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.logoSection}>
          <Text style={s.logo}>Vyapara Setu</Text>
          <Text style={s.tagline}>India ka apna store</Text>
        </View>

        <Text style={s.section}>
          Vyapara Setu is India's trusted online shopping platform, bringing you quality products at affordable prices with reliable delivery right to your doorstep.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Our Mission</Text>
          <Text style={s.cardText}>
            To make quality products accessible to every Indian, bridging the gap between local businesses and customers through technology.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Why Choose Us?</Text>
          {[
            { icon: '🚚', title: 'Reliable Delivery', desc: 'Delivery within 3–7 business days' },
            { icon: '🔒', title: 'Secure Payments', desc: '100% secure payment options' },
            { icon: '↩️', title: 'Easy Returns', desc: '7-day hassle-free returns' },
            { icon: '✅', title: 'Quality Assured', desc: 'Verified sellers & products' },
          ].map((item, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={[s.featureIcon, { marginRight: 12 }]}>{item.icon}</Text>
              <View style={s.featureText}>
                <Text style={s.featureTitle}>{item.title}</Text>
                <Text style={s.featureDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.version}>Version 1.0.0</Text>
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
  logoSection: { alignItems: 'center', paddingVertical: 24 },
  logo: { fontSize: 32, fontWeight: '900', color: '#E95C1E' },
  tagline: { fontSize: 14, color: '#888', marginTop: 4 },
  section: { fontSize: 15, color: '#444', lineHeight: 24, marginBottom: 20 },
  card: { backgroundColor: '#f8f8f8', borderRadius: 14, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#666', lineHeight: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureIcon: { fontSize: 24 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  featureDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  version: { textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 20 },
});
