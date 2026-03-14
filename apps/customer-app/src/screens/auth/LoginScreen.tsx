import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useSendOtpMutation, useVerifyOtpMutation } from '../../store/api';
import * as SecureStore from 'expo-secure-store';
import { setUser, setTokens, setStatus } from '../../store/slices/authSlice';

export default function LoginScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [timer, setTimer] = useState(0);

  const [sendOtp, { isLoading: sending }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();

  const startTimer = () => {
    setTimer(30);
    const interval = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) { Alert.alert('Invalid phone', 'Enter a valid 10-digit number'); return; }
    try {
      await sendOtp({ phone, mode: 'login' }).unwrap();
      setStep('otp'); startTimer();
    } catch (err: any) {
      Alert.alert('Error', err?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verifyOtp({ phone, otp, mode: 'login' }).unwrap();
      await SecureStore.setItemAsync('accessToken', result.accessToken);
      if (result.refreshToken) await SecureStore.setItemAsync('refreshToken', result.refreshToken);
      dispatch(setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }));
      dispatch(setUser(result.user));
      dispatch(setStatus('ACTIVE'));
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.data?.message || 'Please check and try again');
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.logo}>VyaparSetu</Text>
          <Text style={s.tagline}>India ka apna store</Text>

          {step === 'phone' ? (
            <View style={s.form}>
              <Text style={s.label}>Enter your phone number</Text>
              <View style={s.phoneRow}>
                <Text style={s.cc}>+91</Text>
                <TextInput style={s.phoneInput} placeholder="10-digit mobile number"
                  placeholderTextColor="#aaa" keyboardType="phone-pad" maxLength={10}
                  value={phone} onChangeText={setPhone} autoFocus />
              </View>
              <TouchableOpacity
                style={[s.btn, (sending || phone.length !== 10) && s.btnDisabled]}
                onPress={handleSendOtp} disabled={sending || phone.length !== 10}>
                {sending ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnTxt}>Get OTP</Text>}
              </TouchableOpacity>
              <View style={s.signupRow}>
                <Text style={s.signupTxt}>New user? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text style={s.signupLink}>Create account →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.form}>
              <Text style={s.otpInfo}>OTP sent to +91 {phone}</Text>
              <TextInput style={s.otpInput} placeholder="• • • • • •"
                placeholderTextColor="#ccc" keyboardType="numeric" maxLength={6}
                value={otp} onChangeText={setOtp} autoFocus />
              <TouchableOpacity
                style={[s.btn, (verifying || otp.length !== 6) && s.btnDisabled]}
                onPress={handleVerify} disabled={verifying || otp.length !== 6}>
                {verifying ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnTxt}>Verify OTP</Text>}
              </TouchableOpacity>
              <View style={s.resendRow}>
                {timer > 0
                  ? <Text style={s.timerTxt}>Resend in {timer}s</Text>
                  : <TouchableOpacity onPress={() => { setOtp(''); handleSendOtp(); }}>
                      <Text style={s.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>}
              </View>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
                <Text style={s.changeTxt}>Change number</Text>
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
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: '800', color: '#E95C1E' },
  tagline: { fontSize: 15, color: '#888', marginBottom: 48, marginTop: 4 },
  form: { gap: 10 },
  label: { fontSize: 16, fontWeight: '600', color: '#333' },
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#fafafa' },
  cc: { padding: 15, backgroundColor: '#f0f0f0', fontSize: 16,
    color: '#333', borderRightWidth: 1, borderColor: '#ddd' },
  phoneInput: { flex: 1, padding: 15, fontSize: 16 },
  btn: { backgroundColor: '#E95C1E', padding: 17, borderRadius: 14,
    alignItems: 'center', marginTop: 8 },
  btnDisabled: { backgroundColor: '#ccc' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  otpInfo: { fontSize: 15, color: '#555', textAlign: 'center' },
  otpInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 14,
    padding: 18, fontSize: 28, letterSpacing: 12, textAlign: 'center', backgroundColor: '#fafafa' },
  resendRow: { alignItems: 'center', marginTop: 8 },
  timerTxt: { color: '#888' },
  resendLink: { color: '#E95C1E', fontWeight: '600' },
  changeTxt: { color: '#666', textAlign: 'center', marginTop: 8 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  signupTxt: { color: '#888', fontSize: 15 },
  signupLink: { color: '#E95C1E', fontWeight: '700', fontSize: 15 },
});
