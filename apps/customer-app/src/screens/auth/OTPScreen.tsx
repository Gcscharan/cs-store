import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Vibration,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthNavigationProp, OTPScreenRouteProp } from '../../navigation/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { useVerifyOtpMutation, useSignupMutation } from '../../api/authApi';
import { setStatus, setUser, setTokens } from '../../store/slices/authSlice';
import RNOtpVerify from 'react-native-otp-verify';

const OTPScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const route = useRoute<any>(); // Using any to avoid RouteProp mismatch for now
  const dispatch = useDispatch();

  const { phone, isSignup, name, signupEmail } = route.params;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(60);

  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation();
  const [signup, { isLoading: isSigningUp }] = useSignupMutation();
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const logEvent = (evt: string) => console.log('[Analytics]:', evt);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Start SMS Auto-Read for Android
    if (Platform.OS === 'android') {
      RNOtpVerify.getOtp()
        .then(() => RNOtpVerify.addListener(handleOtpRecieved))
        .catch(console.log);
    }
    
    return () => {
      clearInterval(interval);
      if (Platform.OS === 'android') {
        RNOtpVerify.removeListener();
      }
    };
  }, []);

  const handleOtpRecieved = (message: string) => {
    const matchedOtp = message.match(/\d{4,6}/)?.[0];
    if (matchedOtp) {
      logEvent('otp_auto_filled');
      setOtp(matchedOtp);
    }
  };

  // Auto-submit when exactly 6 digits are typed or autofilled
  useEffect(() => {
    if (otp.length === 6 && !isVerifying && !isSigningUp && !isSuccess) {
      Keyboard.dismiss();
      handleVerify();
    }
  }, [otp]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit code');
      return;
    }

    try {
      let finalTokens: { accessToken: string; refreshToken: string };
      let finalUser: any;

      if (isSignup) {
        await verifyOtp({ 
          phone: phone.replace('+91', ''), 
          otp,
          mode: 'signup'
        }).unwrap();

        const signupRes = await signup({
          name: name!,
          email: signupEmail!,
          phone: phone.replace('+91', ''),
        }).unwrap();

        finalTokens = { accessToken: signupRes.accessToken, refreshToken: signupRes.refreshToken };
        finalUser = signupRes.user;
      } else {
        const res = await verifyOtp({
          phone: phone.replace('+91', ''),
          otp,
          mode: 'login'
        }).unwrap();
        finalTokens = { accessToken: res.accessToken, refreshToken: res.refreshToken };
        finalUser = res.user;
      }

      logEvent('otp_verified_success');
      setIsSuccess(true);
      Vibration.vibrate(50); // Subtle haptic success feedback

      setTimeout(() => {
        dispatch(setTokens(finalTokens));
        dispatch(setUser(finalUser));
        dispatch(setStatus('ACTIVE'));
      }, 500);

    } catch (error: any) {
      logEvent('otp_verification_failed');
      Vibration.vibrate([100, 100, 100]);
      setOtp('');
      setTimeout(() => inputRef.current?.focus(), 100);
      Alert.alert('Error', error?.data?.message || 'Verification failed');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Verification" showBackButton />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>Sent to +91 {phone.replace('+91', '')}</Text>

          <TextInput
            ref={inputRef}
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            placeholder="0 0 0 0 0 0"
            placeholderTextColor={Colors.textMuted}
            editable={!isVerifying && !isSigningUp && !isSuccess}
            autoFocus
          />

          {isSuccess ? (
            <View style={[styles.verifyBtn, { backgroundColor: '#4BB543' }]}>
              <Text style={styles.verifyBtnTxt}>✅ Verified</Text>
            </View>
          ) : otp.length === 6 || isVerifying || isSigningUp ? (
            <View style={[styles.verifyBtn, styles.disabledBtn]}>
              <ActivityIndicator color={Colors.white} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleVerify}
            >
              <Text style={styles.verifyBtnTxt}>Verify & Continue</Text>
            </TouchableOpacity>
          )}

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive code? </Text>
            <TouchableOpacity disabled={timer > 0}>
              <Text style={[styles.resendLink, timer > 0 && styles.disabledLink]}>
                {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 40,
  },
  otpInput: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    color: Colors.textPrimary,
    marginBottom: 32,
  },
  verifyBtn: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnTxt: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  disabledBtn: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  resendRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  resendText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  resendLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledLink: {
    color: Colors.textMuted,
  },
});

export default OTPScreen;
