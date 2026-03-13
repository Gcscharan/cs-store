import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useSendOtpMutation, useVerifyOtpMutation } from '../../store/api';
import * as SecureStore from 'expo-secure-store';
import { setUser, setTokens, setStatus } from '../../store/slices/authSlice';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  const [sendOtp, { isLoading: sendingOtp }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit number');
      return;
    }
    try {
      await sendOtp({ phone, mode: 'login' }).unwrap();
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', err?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const result = await verifyOtp({ phone, otp, mode: 'login' }).unwrap();
      await SecureStore.setItemAsync('accessToken', result.accessToken);
      await SecureStore.setItemAsync('refreshToken', result.refreshToken || '');
      dispatch(setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }));
      dispatch(setUser(result.user));
      dispatch(setStatus('ACTIVE'));
    } catch (err: any) {
      Alert.alert('Error', err?.data?.message || 'Invalid OTP');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.logo}>Vyapara Setu</Text>
      <Text style={styles.subtitle}>India ka apna store</Text>

      {step === 'phone' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Enter your phone number</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.countryCode}>+91</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="10-digit mobile number"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <TouchableOpacity
            style={[styles.button, phone.length !== 10 && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={phone.length !== 10 || sendingOtp}
          >
            {sendingOtp ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Enter OTP sent to +91 {phone}</Text>
          <TextInput
            style={styles.otpInput}
            placeholder="6-digit OTP"
            placeholderTextColor="#888"
            keyboardType="numeric"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
          <TouchableOpacity
            style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={otp.length !== 6 || verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.changePhone}>Change phone number</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  logo: { fontSize: 28, fontWeight: '700', color: '#E95C1E', marginTop: 40 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 40 },
  form: { gap: 16 },
  label: { fontSize: 16, color: '#333', fontWeight: '500' },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  countryCode: {
    padding: 14,
    backgroundColor: '#f5f5f5',
    fontSize: 16,
    color: '#333',
    borderRightWidth: 1,
    borderColor: '#ddd',
  },
  phoneInput: { flex: 1, padding: 14, fontSize: 16 },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#E95C1E',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  changePhone: { color: '#E95C1E', textAlign: 'center', marginTop: 8 },
});
