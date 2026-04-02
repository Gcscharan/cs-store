import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Switch, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { ErrorState } from '../../components/common/ErrorState';
import {
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useToggleKillswitchMutation,
  useForceRouteRecomputeMutation,
  AdminSettings,
} from '../../api/settingsApi';
import { showToast } from '../../store/slices/uiSlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';

export default function AdminSettingsScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { data, isLoading, error, refetch } = useGetAdminSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateAdminSettingsMutation();
  const [toggleKillswitch] = useToggleKillswitchMutation();
  const [forceRecompute, { isLoading: isRecomputing }] = useForceRouteRecomputeMutation();

  const [form, setForm] = useState({ storeName: '', storeEmail: '', supportPhone: '' });

  useEffect(() => { logEvent('screen_view', { screen: 'AdminSettings' }); }, []);

  useEffect(() => {
    if (data) {
      setForm({ storeName: data.storeName || '', storeEmail: data.storeEmail || '', supportPhone: data.supportPhone || '' });
    }
  }, [data]);

  const handleSave = async () => {
    if (!form.storeName.trim()) { dispatch(showToast('Store name is required')); return; }
    try {
      await updateSettings(form).unwrap();
      dispatch(showToast('Settings saved'));
      logEvent('admin_settings_saved');
    } catch {
      dispatch(showToast('Failed to save settings'));
    }
  };

  const handleKillswitch = (value: boolean) => {
    Alert.alert(
      value ? 'Enable Tracking Killswitch' : 'Disable Tracking Killswitch',
      value ? 'This will DISABLE tracking for ALL delivery boys. Are you sure?' : 'This will resume tracking for all delivery boys.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: value ? 'destructive' : 'default', onPress: async () => {
          try {
            await toggleKillswitch({ enabled: value }).unwrap();
            dispatch(showToast(`Killswitch ${value ? 'enabled' : 'disabled'}`));
            refetch();
          } catch { dispatch(showToast('Failed to toggle killswitch')); }
        }},
      ]
    );
  };

  const handleRecompute = () => {
    Alert.alert(
      '⚠️ Force Recompute',
      'This will recompute ALL delivery routes. This is a resource-intensive operation. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Recompute', style: 'destructive', onPress: async () => {
          try {
            await forceRecompute().unwrap();
            dispatch(showToast('Route recomputation triggered'));
            logEvent('admin_force_recompute');
          } catch { dispatch(showToast('Recomputation failed')); }
        }},
      ]
    );
  };

  if (isLoading) return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={s.container}><ErrorState message="Failed to load settings" onRetry={refetch} screenName="AdminSettings" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Admin Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={s.content}>
        {/* General Settings */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>⚙️ General</Text>
          <View style={s.card}>
            {[
              { key: 'storeName', label: 'Store Name', placeholder: 'Vyapara Setu' },
              { key: 'storeEmail', label: 'Store Email', placeholder: 'admin@store.com', keyboard: 'email-address' as const },
              { key: 'supportPhone', label: 'Support Phone', placeholder: '+91 9391795162', keyboard: 'phone-pad' as const },
            ].map((field, i) => (
              <View key={field.key} style={[s.fieldRow, i > 0 && s.fieldDivider]}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={s.fieldInput}
                  value={(form as any)[field.key]}
                  onChangeText={(v) => setForm(prev => ({ ...prev, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={field.keyboard || 'default'}
                />
              </View>
            ))}
          </View>
          <TouchableOpacity style={[s.saveBtn, isSaving && s.saveBtnDisabled]} onPress={handleSave} disabled={isSaving}>
            <Text style={s.saveBtnText}>{isSaving ? 'Saving…' : '💾 Save Changes'}</Text>
          </TouchableOpacity>
        </View>

        {/* Delivery Info (Read-only) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📍 Delivery Configuration</Text>
          <View style={s.card}>
            {[
              { label: 'Warehouse', value: data ? `${data.warehouseLat?.toFixed(4)}, ${data.warehouseLng?.toFixed(4)}` : 'N/A' },
              { label: 'Pincode', value: data?.warehousePincode || 'N/A' },
              { label: 'Local Radius', value: `${data?.localRadiusKm || 0} km` },
              { label: 'Route Capacity', value: `${data?.routeCapacityMin || 0} – ${data?.routeCapacityMax || 0} orders` },
              { label: 'Delivery Hubs', value: `${data?.hubs?.length || 0} configured` },
            ].map((item, i) => (
              <View key={i} style={[s.infoRow, i > 0 && s.fieldDivider]}>
                <Text style={s.infoLabel}>{item.label}</Text>
                <Text style={s.infoValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tracking Killswitch */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🚚 Tracking Control</Text>
          <View style={s.card}>
            <View style={s.killRow}>
              <View style={s.killInfo}>
                <Text style={s.killLabel}>Tracking Killswitch</Text>
                <Text style={s.killDesc}>Disable live tracking for all delivery boys</Text>
              </View>
              <Switch
                value={data?.killswitchEnabled || false}
                onValueChange={handleKillswitch}
                trackColor={{ false: Colors.border, true: Colors.errorLight }}
                thumbColor={data?.killswitchEnabled ? Colors.error : Colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Payment Info (Read-only) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>💳 Payment</Text>
          <View style={s.card}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Razorpay Status</Text>
              <Text style={[s.infoValue, { color: data?.razorpayConfigured ? Colors.success : Colors.error }]}>
                {data?.razorpayConfigured ? '✅ Active' : '❌ Not Configured'}
              </Text>
            </View>
            {data?.razorpayKeyId && (
              <View style={[s.infoRow, s.fieldDivider]}>
                <Text style={s.infoLabel}>Key ID</Text>
                <Text style={s.infoValue}>{data.razorpayKeyId.slice(0, 8)}****</Text>
              </View>
            )}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: Colors.error }]}>⚠️ Danger Zone</Text>
          <TouchableOpacity style={s.dangerBtn} onPress={handleRecompute} disabled={isRecomputing}>
            <Text style={s.dangerBtnText}>{isRecomputing ? 'Recomputing…' : '🔄 Force Route Recompute'}</Text>
            <Text style={s.dangerBtnDesc}>Recompute all delivery routes from scratch</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  card: { backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  fieldRow: { padding: 14 },
  fieldDivider: { borderTopWidth: 1, borderTopColor: Colors.surface },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: { fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.secondary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  killRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  killInfo: { flex: 1, marginRight: 12 },
  killLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  killDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  dangerBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 16, alignItems: 'center' },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: Colors.error },
  dangerBtnDesc: { fontSize: 12, color: '#991b1b', marginTop: 4 },
});
