import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useDeliverySignupMutation } from '../../api/deliveryAuthApi';
import { showToast } from '../../store/slices/uiSlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';

const VEHICLE_TYPES = [
  { id: 'AUTO', label: '🛺 Auto' },
  { id: 'CAR', label: '🚗 Car' },
  { id: 'BIKE', label: '🏍️ Bike' },
  { id: 'SCOOTER', label: '🛵 Scooter' },
  { id: 'CYCLE', label: '🚲 Bicycle' },
];

export default function DeliverySignupScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '', vehicleType: 'AUTO',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [deliverySignup, { isLoading }] = useDeliverySignupMutation();

  useEffect(() => {
    logEvent('screen_view', { screen: 'DeliverySignup' });
  }, []);

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);

    if (Object.keys(e).length > 0) {
      logEvent('delivery_signup_validation_error', { field: Object.keys(e)[0] });
    }
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    logEvent('delivery_signup_attempt', { vehicleType: form.vehicleType });

    try {
      await deliverySignup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        vehicleType: form.vehicleType as any,
      }).unwrap();

      logEvent('delivery_signup_success');
      setSuccess(true);
      setTimeout(() => navigation.navigate('DeliveryLogin'), 3000);
    } catch (err: any) {
      logEvent('delivery_signup_failed', { error: err?.data?.error || 'unknown' });
      const msg = err?.data?.error || 'Failed to create account. Please try again.';
      dispatch(showToast(msg));
    }
  };

  if (success) {
    return (
      <View style={s.container}>
        <ScreenHeader title="Success" />
        <View style={s.successContainer}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Account Submitted!</Text>
          <Text style={s.successDesc}>
            Your delivery partner account has been submitted for review. You'll be notified once approved.
          </Text>
          <ActivityIndicator color={Colors.secondary} style={{ marginTop: 20 }} />
          <Text style={s.redirectText}>Redirecting to login...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScreenHeader title="Apply Now" showBackButton />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={s.logoSection}>
            <View style={s.iconCircle}><Text style={s.iconEmoji}>🚚</Text></View>
            <Text style={s.title}>Join as Delivery Partner</Text>
            <Text style={s.subtitle}>Start earning with Vyapara Setu</Text>
          </View>

          {/* Form */}
          {[
            { key: 'name', label: 'Full Name', icon: '👤', placeholder: 'Enter your full name', type: 'default' as const },
            { key: 'email', label: 'Email Address', icon: '📧', placeholder: 'your@email.com', type: 'email-address' as const },
            { key: 'phone', label: 'Mobile Number', icon: '📱', placeholder: '10-digit mobile number', type: 'phone-pad' as const, maxLength: 10 },
          ].map(field => (
            <View key={field.key} style={s.inputGroup}>
              <Text style={s.label}>{field.label}</Text>
              <View style={[s.inputRow, errors[field.key] && s.inputError]}>
                <Text style={s.inputIcon}>{field.icon}</Text>
                <TextInput
                  style={s.input}
                  value={(form as any)[field.key]}
                  onChangeText={(v) => updateField(field.key, v)}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={field.type}
                  autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                  maxLength={field.maxLength}
                  editable={!isLoading}
                />
              </View>
              {errors[field.key] && <Text style={s.errorText}>{errors[field.key]}</Text>}
            </View>
          ))}

          {/* Vehicle Type */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Vehicle Type</Text>
            <View style={s.vehicleRow}>
              {VEHICLE_TYPES.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[s.vehicleChip, form.vehicleType === v.id && s.vehicleChipActive, { marginRight: 8, marginBottom: 8 }]}
                  onPress={() => updateField('vehicleType', v.id)}
                >
                  <Text style={[s.vehicleLabel, form.vehicleType === v.id && s.vehicleLabelActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Password */}
          {[
            { key: 'password', label: 'Password', placeholder: 'At least 6 characters' },
            { key: 'confirmPassword', label: 'Confirm Password', placeholder: 'Re-enter password' },
          ].map(field => (
            <View key={field.key} style={s.inputGroup}>
              <Text style={s.label}>{field.label}</Text>
              <View style={[s.inputRow, errors[field.key] && s.inputError]}>
                <Text style={s.inputIcon}>🔒</Text>
                <TextInput
                  style={s.input}
                  value={(form as any)[field.key]}
                  onChangeText={(v) => updateField(field.key, v)}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>
              {errors[field.key] && <Text style={s.errorText}>{errors[field.key]}</Text>}
            </View>
          ))}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, isLoading && s.submitBtnDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>Sign Up as Partner</Text>}
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity onPress={() => navigation.navigate('DeliveryLogin')} style={s.loginLink}>
            <Text style={s.loginLinkText}>Already have an account? <Text style={s.linkBold}>Login here</Text></Text>
          </TouchableOpacity>

          {/* Info Box */}
          <View style={s.infoBox}>
            <Text style={s.infoText}>
              <Text style={s.infoBold}>Note: </Text>
              Your account will be reviewed by our team. You'll be notified via email once approved.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 28 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  iconEmoji: { fontSize: 24 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 },
  inputError: { borderColor: Colors.error },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  errorText: { fontSize: 12, color: Colors.error, marginTop: 4 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap' },
  vehicleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  vehicleChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  vehicleLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  vehicleLabelActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.secondary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: 20 },
  loginLinkText: { fontSize: 14, color: Colors.textSecondary },
  linkBold: { color: Colors.secondary, fontWeight: '700' },
  infoBox: { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 12, padding: 14, marginTop: 16 },
  infoText: { fontSize: 12, color: '#1e40af', lineHeight: 18 },
  infoBold: { fontWeight: '700' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  successDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  redirectText: { fontSize: 12, color: Colors.textMuted, marginTop: 12 },
});
