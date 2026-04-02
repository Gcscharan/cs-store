import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { ScreenHeader } from '../../components/ScreenHeader';
import { setUser, setTokens, setStatus } from '../../store/slices/authSlice';
import { storage } from '../../utils/storage';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useDeliveryLoginMutation } from '../../api/deliveryAuthApi';
import { AppDispatch } from '../../store';

export default function DeliveryLoginScreen({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState<'error' | 'warning'>('error');

  const [deliveryLogin, { isLoading }] = useDeliveryLoginMutation();

  useEffect(() => {
    logEvent('screen_view', { screen: 'DeliveryLogin' });
  }, []);

  const handleLogin = async () => {
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields');
      setErrorType('error');
      return;
    }

    logEvent('delivery_login_attempt');

    try {
      const result = await deliveryLogin({ email: email.trim(), password }).unwrap();

      // Store tokens securely
      await storage.setItem('accessToken', result.tokens.accessToken);
      await storage.setItem('refreshToken', result.tokens.refreshToken);

      // Update Redux state
      dispatch(setUser(result.user as any));
      dispatch(setTokens(result.tokens));
      dispatch(setStatus('ACTIVE'));

      logEvent('delivery_login_success', { userId: result.user._id });
    } catch (err: any) {
      const data = err?.data;
      if (data?.status === 'pending') {
        setErrorMessage('Your account is awaiting admin approval. You will be notified once approved.');
        setErrorType('warning');
        logEvent('delivery_login_failed', { error: 'pending' });
      } else if (data?.status === 'suspended') {
        setErrorMessage('Your account has been suspended. Please contact support at +91 9391795162.');
        setErrorType('error');
        logEvent('delivery_login_failed', { error: 'suspended' });
      } else {
        setErrorMessage(data?.error || 'Invalid email or password');
        setErrorType('error');
        logEvent('delivery_login_failed', { error: 'invalid_credentials' });
      }
    }
  };

  return (
    <View style={s.container}>
      <ScreenHeader title="Delivery Partner" showBackButton />
      <KeyboardAvoidingView style={s.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Logo */}
        <View style={s.logoSection}>
          <View style={s.iconCircle}>
            <Text style={s.iconEmoji}>🚚</Text>
          </View>
          <Text style={s.title}>Delivery Partner</Text>
          <Text style={s.subtitle}>Sign in to start delivering</Text>
        </View>

        {/* Error Banner */}
        {errorMessage !== '' && (
          <View style={[s.errorBanner, errorType === 'warning' && s.warningBanner]}>
            <Text style={s.errorIcon}>{errorType === 'warning' ? '⏳' : '⚠️'}</Text>
            <Text style={[s.errorText, errorType === 'warning' && s.warningText]}>{errorMessage}</Text>
          </View>
        )}

        {/* Form */}
        <View style={s.form}>
          <View style={s.inputGroup}>
            <Text style={[s.label, { marginBottom: 6 }]}>Email Address</Text>
            <View style={s.inputRow}>
              <Text style={s.inputIcon}>📧</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrorMessage(''); }}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={s.inputGroup}>
            <Text style={[s.label, { marginBottom: 6 }]}>Password</Text>
            <View style={s.inputRow}>
              <Text style={s.inputIcon}>🔒</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={(v) => { setPassword(v); setErrorMessage(''); }}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Text>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[s.loginBtn, isLoading && s.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Links */}
        <View style={s.links}>
          <TouchableOpacity onPress={() => navigation.navigate('DeliverySignup')} style={{ marginBottom: 12 }}>
            <Text style={s.linkText}>New to delivery? <Text style={s.linkBold}>Sign up here</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.linkSecondary}>
            <Text style={s.linkSecondaryText}>Not a delivery partner? <Text style={s.linkBold}>Customer Login</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconEmoji: { fontSize: 28 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  errorBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  warningBanner: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  errorIcon: { fontSize: 16, marginRight: 10, marginTop: 1 },
  errorText: { flex: 1, fontSize: 13, color: '#991b1b', lineHeight: 18 },
  warningText: { color: '#92400e' },
  form: {},
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  eyeBtn: { padding: 8 },
  loginBtn: { backgroundColor: Colors.secondary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  links: { alignItems: 'center', marginTop: 32 },
  linkText: { fontSize: 14, color: Colors.textSecondary },
  linkBold: { color: Colors.secondary, fontWeight: '700' },
  linkSecondary: { marginTop: 4 },
  linkSecondaryText: { fontSize: 12, color: Colors.textMuted },
});
