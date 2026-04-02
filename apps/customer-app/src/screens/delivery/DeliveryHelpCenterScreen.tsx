import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';

const ISSUE_OPTIONS = [
  {
    id: 'order-earning',
    title: '💰 Order Earning Issue',
    desc: 'Problems with order payments and earnings',
    color: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  {
    id: 'daily-incentive',
    title: '📅 Daily Incentive Issue',
    desc: 'Issues with daily bonuses and incentives',
    color: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  {
    id: 'incentives-payout',
    title: '💳 Incentives & Payout Issue',
    desc: 'Problems with incentives and payment processing',
    color: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  {
    id: 'leave',
    title: '🚪 I Want to Leave Vyapara Setu',
    desc: 'Information about leaving the delivery partner program',
    color: '#fef2f2',
    borderColor: '#fecaca',
  },
];

export default function DeliveryHelpCenterScreen({ navigation }: any) {
  useEffect(() => {
    logEvent('screen_view', { screen: 'DeliveryHelpCenter' });
  }, []);

  const handleIssue = (issueId: string, title: string) => {
    logEvent('help_issue_tapped', { issueType: issueId });
    Alert.alert(
      title,
      'This support form will be available in the next update. For immediate help, please call our support team.',
      [
        { text: 'Call Support', onPress: () => Linking.openURL('tel:9391795162') },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>❓ Help Center</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={s.content}>
        {/* Title */}
        <Text style={s.pageTitle}>How can we help?</Text>
        <Text style={s.pageDesc}>Select the type of issue you're experiencing</Text>

        {/* Issue Cards */}
        {ISSUE_OPTIONS.map(issue => (
          <TouchableOpacity
            key={issue.id}
            style={[s.issueCard, { backgroundColor: issue.color, borderColor: issue.borderColor }]}
            onPress={() => handleIssue(issue.id, issue.title)}
            activeOpacity={0.7}
          >
            <Text style={s.issueTitle}>{issue.title}</Text>
            <Text style={s.issueDesc}>{issue.desc}</Text>
          </TouchableOpacity>
        ))}

        {/* Immediate Help */}
        <View style={s.helpSection}>
          <Text style={s.helpTitle}>Need Immediate Help?</Text>
          <View style={s.helpCards}>
            <TouchableOpacity
              style={[s.helpCard, { marginRight: 12 }]}
              onPress={() => {
                logEvent('help_emergency_tapped');
                navigation.navigate('DeliveryEmergency');
              }}
            >
              <Text style={s.helpCardIcon}>🆘</Text>
              <Text style={s.helpCardTitle}>Emergency</Text>
              <Text style={s.helpCardDesc}>Urgent safety issues</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.helpCard}
              onPress={() => {
                logEvent('help_call_support');
                Linking.openURL('tel:9391795162');
              }}
            >
              <Text style={s.helpCardIcon}>📞</Text>
              <Text style={s.helpCardTitle}>Call Support</Text>
              <Text style={s.helpCardDesc}>+91 9391795162</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1, padding: 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  pageDesc: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  issueCard: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 12 },
  issueTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  issueDesc: { fontSize: 13, color: Colors.textSecondary },
  helpSection: { marginTop: 24 },
  helpTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14, textAlign: 'center' },
  helpCards: { flexDirection: 'row' },
  helpCard: { flex: 1, backgroundColor: Colors.background, borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  helpCardIcon: { fontSize: 28, marginBottom: 8 },
  helpCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  helpCardDesc: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
});
