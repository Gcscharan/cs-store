import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';

export default function AboutScreen({ navigation }: any) {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>About Us</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.emoji}>🏪</Text>
        <Text style={s.heading}>VyaparSetu</Text>
        <Text style={s.body}>
          VyaparSetu is India's fastest growing grocery delivery platform. We connect local stores with customers, ensuring fresh products reach your doorstep within hours.
        </Text>
        <Text style={s.body}>
          Founded with a mission to support local businesses and provide convenience to customers across Andhra Pradesh and beyond, we're committed to delivering quality products at competitive prices.
        </Text>
        <View style={s.stats}>
          <View style={s.statItem}>
            <Text style={s.statNum}>500+</Text>
            <Text style={s.statLabel}>Partner Stores</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statNum}>1L+</Text>
            <Text style={s.statLabel}>Happy Customers</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statNum}>50K+</Text>
            <Text style={s.statLabel}>Orders Delivered</Text>
          </View>
        </View>
        <Text style={s.body}>
          Our platform empowers local kirana stores to reach more customers while providing shoppers with the convenience of home delivery for their daily essentials.
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
  content: { padding: 24, alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: 16 },
  heading: { fontSize: 26, fontWeight: '800', color: '#E95C1E', marginBottom: 16 },
  body: { fontSize: 15, color: '#444', lineHeight: 26, textAlign: 'center', marginBottom: 16 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 24 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#E95C1E' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
});
