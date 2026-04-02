import React from 'react'; 
import { 
  View, Text, StyleSheet, 
  TouchableOpacity, Share, ScrollView, 
  ActivityIndicator, 
  Alert, 
} from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useSelector } from 'react-redux'; 
import { useGetReferralCodeQuery, useGetReferralStatsQuery } from '../../api/referralApi'; 
import type { RootState } from '../../store'; 
 
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';

export default function ReferEarnScreen({ navigation }: any) { 
  const { user } = useSelector((s: RootState) => s.auth); 
  const { data: referralData, isLoading } = useGetReferralCodeQuery(); 
  const { data: statsData } = useGetReferralStatsQuery(); 
 
  const referCode = referralData?.code 
    || `VS${String(user?.phone || '').slice(-4).toUpperCase() || 'XXXX'}`; 
  const stats = statsData || { totalReferrals: 0, totalEarned: 0, pending: 0 }; 
 
  const handleShare = () => { 
    Share.share({ 
      message: `🎉 Shop on Vyapara Setu and get ₹50 off your first order!\n\nUse my referral code: ${referCode}\n\nDownload now: https://vyaparsetu.in`, 
      title: 'Join Vyapara Setu - Save ₹50!', 
    }); 
  }; 
 
  const handleCopy = async () => { 
    await Clipboard.setStringAsync(referCode); 
    Alert.alert('✅ Copied!', 'Referral code copied to clipboard'); 
  }; 
 
  return ( 
    <View style={s.container}> 
      <ScreenHeader title="Refer & Earn" showBackButton />
 
      <ScrollView showsVerticalScrollIndicator={false}> 
        {/* Hero */} 
        <View style={s.hero}> 
          <Text style={s.heroEmoji}>🎁</Text> 
          <Text style={s.heroTitle}>Earn ₹50 for every friend!</Text> 
          <Text style={s.heroSub}> 
            Share your code. Your friend gets ₹50 off.{'\n'} 
            You earn ₹50 wallet credits! 
          </Text> 
        </View> 
 
        {/* Referral Code */} 
        {isLoading ? ( 
          <ActivityIndicator color="#E95C1E" style={{ margin: 20 }} /> 
        ) : ( 
          <View style={s.codeSection}> 
            <Text style={s.codeLabel}>Your Referral Code</Text> 
            <View style={s.codeBox}> 
              <Text style={s.code}>{referCode}</Text> 
              <TouchableOpacity style={s.copyBtn} onPress={handleCopy}> 
                <Text style={s.copyBtnTxt}>Copy</Text> 
              </TouchableOpacity> 
            </View> 
          </View> 
        )} 
 
        {/* Share button */} 
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}> 
          <Text style={s.shareBtnTxt}>📤 Share with Friends</Text> 
        </TouchableOpacity> 
 
        {/* Stats */} 
        <View style={s.statsRow}> 
          <View style={[s.statCard, { marginRight: 10 }]}> 
            <Text style={s.statNum}>{stats.totalReferrals}</Text> 
            <Text style={s.statLabel}>Friends Joined</Text> 
          </View> 
          <View style={[s.statCard, { marginRight: 10 }]}> 
            <Text style={s.statNum}>₹{stats.totalEarned}</Text> 
            <Text style={s.statLabel}>Total Earned</Text> 
          </View> 
          <View style={s.statCard}> 
            <Text style={s.statNum}>₹{stats.pending || 0}</Text> 
            <Text style={s.statLabel}>Pending</Text> 
          </View> 
        </View> 
 
        {/* How it works */} 
        <View style={s.howSection}> 
          <Text style={s.howTitle}>How it works</Text> 
          {[ 
            { step: '1', emoji: '📤', text: 'Share your referral code with friends' }, 
            { step: '2', emoji: '📱', text: 'Friend downloads and signs up on Vyapara Setu' }, 
            { step: '3', emoji: '🛒', text: 'Friend places their first order' }, 
            { step: '4', emoji: '💰', text: 'You both get ₹50 wallet credits!' }, 
          ].map(item => ( 
            <View key={item.step} style={s.stepRow}> 
              <View style={[s.stepNumCircle, { marginRight: 12 }]}> 
                <Text style={s.stepNumTxt}>{item.step}</Text> 
              </View> 
              <Text style={[s.stepEmoji, { marginRight: 12 }]}>{item.emoji}</Text> 
              <Text style={s.stepTxt}>{item.text}</Text> 
            </View> 
          ))} 
        </View> 
 
        {/* Terms */} 
        <Text style={s.terms}> 
          * Reward credited after friend's first order above ₹200. 
          Valid for new users only. T&C apply. 
        </Text> 
      </ScrollView> 
    </View> 
  ); 
} 
 
const s = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: Colors.background }, 
  header: { flexDirection: 'row', alignItems: 'center', 
    padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' }, 
  back: { fontSize: 24, color: '#333' }, 
  title: { fontSize: 18, fontWeight: '700' }, 
  hero: { alignItems: 'center', padding: 32, backgroundColor: '#fff8f5' }, 
  heroEmoji: { fontSize: 64, marginBottom: 12 }, 
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#222', 
    textAlign: 'center' }, 
  heroSub: { fontSize: 15, color: '#666', textAlign: 'center', 
    lineHeight: 24, marginTop: 8 }, 
  codeSection: { margin: 20 }, 
  codeLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8 }, 
  codeBox: { flexDirection: 'row', alignItems: 'center', 
    borderWidth: 2, borderColor: '#E95C1E', borderStyle: 'dashed', 
    borderRadius: 14, padding: 16 }, 
  code: { flex: 1, fontSize: 28, fontWeight: '900', 
    color: '#E95C1E', letterSpacing: 4 }, 
  copyBtn: { backgroundColor: '#E95C1E', paddingHorizontal: 16, 
    paddingVertical: 8, borderRadius: 8 }, 
  copyBtnTxt: { color: '#fff', fontWeight: '700' }, 
  shareBtn: { backgroundColor: '#E95C1E', marginHorizontal: 20, 
    padding: 17, borderRadius: 14, alignItems: 'center' }, 
  shareBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 17 }, 
  statsRow: { flexDirection: 'row', margin: 20 }, 
  statCard: { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 14, 
    padding: 16, alignItems: 'center' }, 
  statNum: { fontSize: 22, fontWeight: '800', color: '#E95C1E' }, 
  statLabel: { fontSize: 12, color: '#888', marginTop: 4, textAlign: 'center' }, 
  howSection: { margin: 20, marginTop: 0 }, 
  howTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 }, 
  stepRow: { flexDirection: 'row', alignItems: 'center', 
    marginBottom: 16 }, 
  stepNumCircle: { width: 32, height: 32, borderRadius: 16, 
    backgroundColor: '#E95C1E', 
    justifyContent: 'center', alignItems: 'center' }, 
  stepNumTxt: { color: '#fff', fontWeight: '800', fontSize: 15 }, 
  stepEmoji: { fontSize: 24 }, 
  stepTxt: { flex: 1, fontSize: 15, color: '#444', lineHeight: 22 }, 
  terms: { fontSize: 12, color: '#aaa', margin: 20, 
    marginTop: 0, lineHeight: 18 }, 
}); 
