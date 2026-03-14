import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useSendOtpMutation, useVerifyOtpMutation } from '../../store/api';
import * as SecureStore from 'expo-secure-store';
import { setUser, setTokens, setStatus } from '../../store/slices/authSlice';

type Step = 'details' | 'otp';

export default function SignupScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);

  const [sendOtp, { isLoading: sending }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();

  const startTimer = () => {
    setTimer(30);
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your full name'); return; }
    if (phone.length !== 10) { Alert.alert('Invalid phone', 'Enter a valid 10-digit number'); return; }
    try {
      await sendOtp({ phone, mode: 'signup' }).unwrap();
      setStep('otp');
      startTimer();
    } catch (err: any) {
      Alert.alert('Error', err?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verifyOtp({ phone, otp, mode: 'signup', name }).unwrap();
      await SecureStore.setItemAsync('accessToken', result.accessToken);
      if (result.refreshToken) {
        await SecureStore.setItemAsync('refreshToken', result.refreshToken);
      }
      dispatch(setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }));
      dispatch(setUser(result.user));
      dispatch(setStatus('ACTIVE'));
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.data?.message || 'Please check and try again');
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      await sendOtp({ phone, mode: 'signup' }).unwrap();
      startTimer();
    } catch (err: any) {
      Alert.alert('Error', err?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>

          <Text style={s.logo}>VyaparSetu</Text>
          <Text style={s.tagline}>Create your account</Text>

          {step === 'details' ? (
            <View style={s.form}>
              <Text style={s.label}>Full Name</Text>
              <TextInput
                style={s.input}
                placeholder="Enter your full name"
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <Text style={[s.label, { marginTop: 16 }]}>Phone Number</Text>
              <View style={s.phoneRow}>
                <Text style={s.countryCode}>+91</Text>
                <TextInput
                  style={s.phoneInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#aaa"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
              <TouchableOpacity
                style={[s.btn, (sending || !name.trim() || phone.length !== 10) && s.btnDisabled]}
                onPress={handleSendOtp}
                disabled={sending || !name.trim() || phone.length !== 10}
              >
                {sending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnTxt}>Continue</Text>}
              </TouchableOpacity>
              <View style={s.loginRow}>
                <Text style={s.loginTxt}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={s.loginLink}>Log in</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.form}>
              <Text style={s.otpInfo}>
                Enter the 6-digit OTP sent to{'\n'}+91 {phone}
              </Text>
              <TextInput
                style={s.otpInput}
                placeholder="• • • • • •"
                placeholderTextColor="#ccc"
                keyboardType="numeric"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />
              <TouchableOpacity
                style={[s.btn, (verifying || otp.length !== 6) && s.btnDisabled]}
                onPress={handleVerify}
                disabled={verifying || otp.length !== 6}
              >
                {verifying
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnTxt}>Create Account</Text>}
              </TouchableOpacity>
              <View style={s.resendRow}>
                {timer > 0 ? (
                  <Text style={s.timerTxt}>Resend OTP in {timer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={s.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => setStep('details')}>
                <Text style={s.changePhone}>Change phone number</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, padding: 24 },
  backBtn: { marginBottom: 8 },
  backTxt: { fontSize: 26, color: '#333' },
  logo: { fontSize: 30, fontWeight: '800', color: '#E95C1E', marginTop: 16 },
  tagline: { fontSize: 16, color: '#888', marginBottom: 36, marginTop: 4 },
  form: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#444' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, fontSize: 16, backgroundColor: '#fafafa' },
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#fafafa' },
  countryCode: { padding: 14, backgroundColor: '#f0f0f0',
    fontSize: 16, color: '#333', borderRightWidth: 1, borderColor: '#ddd' },
  phoneInput: { flex: 1, padding: 14, fontSize: 16 },
  btn: { backgroundColor: '#E95C1E', padding: 17,
    borderRadius: 14, alignItems: 'center', marginTop: 12 },
  btnDisabled: { backgroundColor: '#ccc' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginTxt: { color: '#888', fontSize: 15 },
  loginLink: { color: '#E95C1E', fontWeight: '700', fontSize: 15 },
  otpInfo: { fontSize: 16, color: '#444', textAlign: 'center',
    lineHeight: 24, marginBottom: 20 },
  otpInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 14,
    padding: 18, fontSize: 28, letterSpacing: 12,
    textAlign: 'center', backgroundColor: '#fafafa' },
  resendRow: { alignItems: 'center', marginTop: 12 },
  timerTxt: { color: '#888', fontSize: 14 },
  resendLink: { color: '#E95C1E', fontWeight: '600', fontSize: 15 },
  changePhone: { color: '#666', textAlign: 'center', marginTop: 12, fontSize: 14 },
});
