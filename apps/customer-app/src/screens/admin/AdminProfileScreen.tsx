import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { storage } from '../../utils/storage';
import { showToast } from '../../store/slices/uiSlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

export default function AdminProfileScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' });
  const [isChanging, setIsChanging] = useState(false);
  const [pwVisible, setPwVisible] = useState({ current: false, new: false, confirm: false });

  useEffect(() => { logEvent('screen_view', { screen: 'AdminProfile' }); }, []);

  const handleChangePassword = async () => {
    if (!pw.current || !pw.new || !pw.confirm) {
      dispatch(showToast('All fields are required')); return;
    }
    if (pw.new.length < 6) {
      dispatch(showToast('Password must be at least 6 characters')); return;
    }
    if (pw.new !== pw.confirm) {
      dispatch(showToast('Passwords do not match')); return;
    }

    setIsChanging(true);
    try {
      const token = await storage.getItem('accessToken');
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.new }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(showToast('Password changed successfully'));
        setPw({ current: '', new: '', confirm: '' });
        setShowPasswordForm(false);
        logEvent('admin_password_changed');
      } else {
        dispatch(showToast(data.error || 'Failed to change password'));
      }
    } catch {
      dispatch(showToast('Network error. Please try again.'));
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Admin Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={s.content}>
        {/* Profile Banner */}
        <View style={s.banner}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>👤</Text>
          </View>
          <Text style={s.bannerName}>{user?.name || 'Admin User'}</Text>
          <Text style={s.bannerEmail}>{user?.email || 'admin@example.com'}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>🛡 Administrator</Text>
          </View>
        </View>

        {/* Personal Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Personal Information</Text>
          <View style={s.card}>
            {[
              { icon: '👤', label: 'Full Name', value: user?.name || 'Not provided' },
              { icon: '📧', label: 'Email', value: user?.email || 'Not provided' },
              { icon: '📱', label: 'Phone', value: (user as any)?.phone || 'Not provided' },
            ].map((item, i) => (
              <View key={i} style={[s.infoRow, i > 0 && s.divider]}>
                <Text style={s.infoIcon}>{item.icon}</Text>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>{item.label}</Text>
                  <Text style={s.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Account Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account Information</Text>
          <View style={s.card}>
            {[
              { icon: '🛡', label: 'Role', value: (user as any)?.isAdmin ? 'Administrator' : 'User' },
              { icon: '🟢', label: 'Status', value: 'Active', color: Colors.success },
              { icon: '📅', label: 'Member Since', value: (user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString() : 'N/A' },
            ].map((item, i) => (
              <View key={i} style={[s.infoRow, i > 0 && s.divider]}>
                <Text style={s.infoIcon}>{item.icon}</Text>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>{item.label}</Text>
                  <Text style={[s.infoValue, item.color ? { color: item.color } : {}]}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Security */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>🔒 Security</Text>
            {!showPasswordForm && (
              <TouchableOpacity style={s.changePwBtn} onPress={() => setShowPasswordForm(true)}>
                <Text style={s.changePwBtnText}>Change Password</Text>
              </TouchableOpacity>
            )}
          </View>

          {showPasswordForm && (
            <View style={s.pwCard}>
              {[
                { key: 'current', label: 'Current Password', placeholder: 'Enter current password' },
                { key: 'new', label: 'New Password', placeholder: 'At least 6 characters' },
                { key: 'confirm', label: 'Confirm Password', placeholder: 'Re-enter new password' },
              ].map((field) => (
                <View key={field.key} style={s.pwField}>
                  <Text style={s.pwLabel}>{field.label}</Text>
                  <View style={s.pwInputRow}>
                    <TextInput
                      style={s.pwInput}
                      value={(pw as any)[field.key]}
                      onChangeText={(v) => setPw({ ...pw, [field.key]: v })}
                      placeholder={field.placeholder}
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!(pwVisible as any)[field.key]}
                    />
                    <TouchableOpacity onPress={() => setPwVisible({ ...pwVisible, [field.key]: !(pwVisible as any)[field.key] })}>
                      <Text>{(pwVisible as any)[field.key] ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={s.pwActions}>
                <TouchableOpacity style={[s.pwSubmit, isChanging && s.pwSubmitDisabled, { marginRight: 10 }]} onPress={handleChangePassword} disabled={isChanging}>
                  {isChanging ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.pwSubmitText}>Change Password</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.pwCancel} onPress={() => { setShowPasswordForm(false); setPw({ current: '', new: '', confirm: '' }); }}>
                  <Text style={s.pwCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionsGrid}>
            {[
              { label: 'Products', icon: '📦', color: '#dbeafe', screen: 'AdminProducts' },
              { label: 'Users', icon: '👥', color: '#dcfce7', screen: 'AdminUsers' },
              { label: 'Orders', icon: '🛒', color: '#fef3c7', screen: 'AdminOrders' },
              { label: 'Analytics', icon: '📊', color: '#e0e7ff', screen: 'AdminAnalytics' },
              { label: 'Delivery', icon: '🚚', color: '#fae8ff', screen: 'AdminDeliveryBoys' },
              { label: 'Finance', icon: '💰', color: '#d1fae5', screen: 'AdminFinance' },
              { label: 'Payments', icon: '💳', color: '#fef3c7', screen: 'AdminPayments' },
              { label: 'Ops', icon: '⚙️', color: '#e0e7ff', screen: 'AdminOps' },
            ].map((action) => (
              <TouchableOpacity key={action.label} style={[s.actionCard, { backgroundColor: action.color, marginRight: 10, marginBottom: 10 }]}
                onPress={() => navigation.navigate(action.screen)}>
                <Text style={s.actionIcon}>{action.icon}</Text>
                <Text style={s.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
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
  content: { flex: 1 },
  banner: { backgroundColor: '#4338ca', padding: 28, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28 },
  bannerName: { fontSize: 22, fontWeight: '800', color: Colors.white },
  bannerEmail: { fontSize: 14, color: '#c7d2fe', marginTop: 4 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  roleText: { fontSize: 12, color: '#e0e7ff', fontWeight: '600' },
  section: { padding: 16, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  card: { backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.surface },
  infoIcon: { fontSize: 18, marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary },
  infoValue: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  changePwBtn: { backgroundColor: Colors.secondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  changePwBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  pwCard: { backgroundColor: Colors.backgroundDark, borderRadius: 14, padding: 16, marginTop: 10 },
  pwField: { marginBottom: 12 },
  pwLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  pwInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 },
  pwInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  pwActions: { flexDirection: 'row', marginTop: 4 },
  pwSubmit: { flex: 1, backgroundColor: Colors.secondary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  pwSubmitDisabled: { opacity: 0.6 },
  pwSubmitText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  pwCancel: { flex: 1, backgroundColor: Colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  pwCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  actionCard: { width: '30%', borderRadius: 14, padding: 14, alignItems: 'center' },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
});
