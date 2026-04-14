import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet,
  ActivityIndicator, Pressable, Animated,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { storage } from '../../utils/storage';
import { showToast } from '../../store/slices/uiSlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import Ionicons from '@expo/vector-icons/Ionicons';
import AdminHeader from '../../components/admin/AdminHeader';
import { BASE_URL } from '../../api/baseApi';

const API_URL = BASE_URL;

export default function AdminProfileScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' });
  const [isChanging, setIsChanging] = useState(false);
  const [pwVisible, setPwVisible] = useState({ current: false, new: false, confirm: false });

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => { 
    logEvent('screen_view', { screen: 'AdminProfile' });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

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
    <View style={s.container}>
      <AdminHeader title="Admin Profile" onBack={() => navigation.goBack()} />
      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={s.profileCard}>
            <View style={s.avatarContainer}>
              <Ionicons name="person-circle" size={64} color="#6366f1" />
            </View>
            <Text style={s.profileName}>{user?.name || 'Admin User'}</Text>
            <Text style={s.profileEmail}>{user?.email || 'admin@example.com'}</Text>
          </View>

          {/* Personal Info */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Personal Information</Text>
            <View style={s.card}>
              <View style={s.infoRow}>
                <View style={s.iconContainer}>
                  <Ionicons name="person-outline" size={20} color="#6366f1" />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>Full Name</Text>
                  <Text style={s.infoValue}>{user?.name || 'Not provided'}</Text>
                </View>
              </View>
              <View style={[s.infoRow, s.divider]}>
                <View style={s.iconContainer}>
                  <Ionicons name="mail-outline" size={20} color="#6366f1" />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>Email</Text>
                  <Text style={s.infoValue}>{user?.email || 'Not provided'}</Text>
                </View>
              </View>
              <View style={[s.infoRow, s.divider]}>
                <View style={s.iconContainer}>
                  <Ionicons name="call-outline" size={20} color="#6366f1" />
                </View>
                <View style={s.infoContent}>
                  <Text style={s.infoLabel}>Phone</Text>
                  <Text style={s.infoValue}>{(user as any)?.phone || 'Not provided'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Security */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Security</Text>
              {!showPasswordForm && (
                <Pressable style={s.changePwBtn} onPress={() => setShowPasswordForm(true)}>
                  <Text style={s.changePwBtnText}>Change Password</Text>
                </Pressable>
              )}
            </View>

            {showPasswordForm && (
              <View style={s.pwCard}>
                {[
                  { key: 'current', label: 'Current Password', placeholder: 'Enter current password', icon: 'lock-closed-outline' },
                  { key: 'new', label: 'New Password', placeholder: 'At least 6 characters', icon: 'key-outline' },
                  { key: 'confirm', label: 'Confirm Password', placeholder: 'Re-enter new password', icon: 'checkmark-circle-outline' },
                ].map((field) => (
                  <View key={field.key} style={s.pwField}>
                    <Text style={s.pwLabel}>{field.label}</Text>
                    <View style={s.pwInputRow}>
                      <Ionicons name={field.icon as any} size={18} color="#9ca3af" style={s.pwInputIcon} />
                      <TextInput
                        style={s.pwInput}
                        value={(pw as any)[field.key]}
                        onChangeText={(v) => setPw({ ...pw, [field.key]: v })}
                        placeholder={field.placeholder}
                        placeholderTextColor="#9ca3af"
                        secureTextEntry={!(pwVisible as any)[field.key]}
                      />
                      <Pressable onPress={() => setPwVisible({ ...pwVisible, [field.key]: !(pwVisible as any)[field.key] })}>
                        <Ionicons name={(pwVisible as any)[field.key] ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
                      </Pressable>
                    </View>
                  </View>
                ))}
                <View style={s.pwActions}>
                  <Pressable style={[s.pwSubmit, isChanging && s.pwSubmitDisabled]} onPress={handleChangePassword} disabled={isChanging}>
                    {isChanging ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.pwSubmitText}>Change Password</Text>}
                  </Pressable>
                  <Pressable style={s.pwCancel} onPress={() => { setShowPasswordForm(false); setPw({ current: '', new: '', confirm: '' }); }}>
                    <Text style={s.pwCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View style={s.actionsGrid}>
              {[
                { label: 'Products', icon: 'cube-outline', screen: 'AdminProducts' },
                { label: 'Users', icon: 'people-outline', screen: 'AdminUsers' },
                { label: 'Orders', icon: 'cart-outline', screen: 'AdminOrders' },
                { label: 'Analytics', icon: 'stats-chart-outline', screen: 'AdminAnalytics' },
                { label: 'Delivery', icon: 'bicycle-outline', screen: 'AdminDeliveryBoys' },
                { label: 'Finance', icon: 'cash-outline', screen: 'AdminFinance' },
                { label: 'Payments', icon: 'card-outline', screen: 'AdminPayments' },
                { label: 'Operations', icon: 'settings-outline', screen: 'AdminOps' },
              ].map((action) => (
                <Pressable 
                  key={action.label} 
                  style={s.actionCard}
                  onPress={() => navigation.navigate(action.screen)}
                >
                  <View style={s.actionIconContainer}>
                    <Ionicons name={action.icon as any} size={24} color="#6366f1" />
                  </View>
                  <Text style={s.actionLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f3f4f6',
  },
  content: { 
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // Profile Card
  profileCard: {
    marginTop: 20,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Sections
  section: { 
    marginBottom: 24,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // Info Card
  card: { 
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16,
  },
  divider: { 
    borderTopWidth: 1, 
    borderTopColor: '#f3f4f6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoContent: { 
    flex: 1,
  },
  infoLabel: { 
    fontSize: 12, 
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  infoValue: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#0f172a',
  },

  // Password Change
  changePwBtn: { 
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  changePwBtnText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: Colors.white,
    letterSpacing: 0.3,
  },
  pwCard: { 
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pwField: { 
    marginBottom: 16,
  },
  pwLabel: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  pwInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  pwInputIcon: {
    marginRight: 10,
  },
  pwInput: { 
    flex: 1, 
    paddingVertical: 12,
    fontSize: 15, 
    color: '#0f172a',
    fontWeight: '500',
  },
  pwActions: { 
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pwSubmit: { 
    flex: 1,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pwSubmitDisabled: { 
    opacity: 0.6,
  },
  pwSubmitText: { 
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  pwCancel: { 
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pwCancelText: { 
    color: '#64748b',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // Quick Actions
  actionsGrid: { 
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: { 
    width: '30%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  actionLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
