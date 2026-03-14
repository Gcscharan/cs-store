import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Share, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

export default function ReferEarnScreen({ navigation }: any) {
  const { user } = useSelector((s: RootState) => s.auth);
  const referCode = user?.phone?.slice(-4)
    ? `VS${user.phone.slice(-4).toUpperCase()}`
    : 'VSXXXX';

  const handleShare = () => {
    Share.share({
      message: `Shop on VyaparSetu and get ₹50 off your first order! Use my referral code: ${referCode}\n\nDownload: https://vyaparsetu.in`,
      title: 'Join VyaparSetu',
    });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Refer & Earn</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heroEmoji}>🎁</Text>
        <Text style={s.heroTitle}>Earn ₹50 for every friend!</Text>
        <Text style={s.heroSub}>
          Share your referral code and earn ₹50 when your friend places their first order
        </Text>
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>Your Referral Code</Text>
          <Text style={s.code}>{referCode}</Text>
        </View>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnTxt}>📤 Share with Friends</Text>
        </TouchableOpacity>
        <View style={s.stepsSection}>
          <Text style={s.stepsTitle}>How it works</Text>
          {[
            { step: '1', text: 'Share your code with friends' },
            { step: '2', text: 'Friend signs up and places first order' },
            { step: '3', text: 'You earn ₹50 in wallet credits' },
          ].map(item => (
            <View key={item.step} style={s.stepRow}>
              <View style={s.stepNum}><Text style={s.stepNumTxt}>{item.step}</Text></View>
              <Text style={s.stepTxt}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { fontSize: 24, color: '#333' },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 24, alignItems: 'center', gap: 16 },
  heroEmoji: { fontSize: 64 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#222', textAlign: 'center' },
  heroSub: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 24 },
  codeCard: { backgroundColor: '#fff8f5', borderWidth: 2, borderColor: '#E95C1E',
    borderStyle: 'dashed', borderRadius: 16, padding: 24,
    alignItems: 'center', width: '100%' },
  codeLabel: { fontSize: 13, color: '#888', marginBottom: 8 },
  code: { fontSize: 32, fontWeight: '900', color: '#E95C1E', letterSpacing: 6 },
  shareBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 40,
    paddingVertical: 16, borderRadius: 14, width: '100%', alignItems: 'center' },
  shareBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 17 },
  stepsSection: { width: '100%', marginTop: 8 },
  stepsTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  stepNum: { width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E95C1E', justifyContent: 'center', alignItems: 'center' },
  stepNumTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stepTxt: { fontSize: 15, color: '#444', flex: 1 },
});
