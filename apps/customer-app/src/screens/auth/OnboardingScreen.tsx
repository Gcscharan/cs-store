import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { RootState } from '../../store';
import { setStatus, setUser, setTokens } from '../../store/slices/authSlice';
import {
  useSendOtpMutation,
  useCheckPhoneMutation,
  useVerifyOnboardingOtpMutation,
  useCompleteOnboardingMutation,
} from '../../api/authApi';

const OnboardingScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation();
  const [checkPhone, { isLoading: isCheckingPhone }] = useCheckPhoneMutation();
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOnboardingOtpMutation();
  const [completeOnboarding, { isLoading: isCompleting }] = useCompleteOnboardingMutation();

  // Prefill name from user object if available
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleSendOtp = async () => {
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      // 1. Check if phone exists
      const checkRes = await checkPhone({ phone }).unwrap();
      if (checkRes.exists) {
        Alert.alert('Phone Exists', 'This number is already registered. Please login instead.');
        return;
      }

      // 2. Send OTP
      await sendOtp({ phone, mode: 'signup' }).unwrap();
      setOtpSent(true);
      setOtpCooldown(60);
      Alert.alert('OTP Sent', 'A verification code has been sent to your mobile number');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code');
      return;
    }

    try {
      await verifyOtp({ phone, otp }).unwrap();
      setOtpVerified(true);
      Alert.alert('Verified', 'Mobile number verified successfully');
    } catch (error: any) {
      Alert.alert('Error', error?.data?.message || 'Invalid OTP');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || name.length < 2) {
      Alert.alert('Invalid Name', 'Please enter your full name');
      return;
    }

    if (!otpVerified) {
      Alert.alert('Verification Required', 'Please verify your phone number first');
      return;
    }

    try {
      const response = await completeOnboarding({ name, phone }).unwrap();
      dispatch(setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      }));
      dispatch(setUser(response.user));
      dispatch(setStatus('ACTIVE'));
    } catch (error: any) {
      Alert.alert('Error', error?.data?.message || 'Failed to complete onboarding');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Join Us" showBackButton />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>Complete your profile to get started</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                editable={!isCompleting}
              />

              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 12 }]}
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    setOtpVerified(false);
                    setOtpSent(false);
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!otpVerified && !isCompleting}
                />
                {!otpVerified && (
                  <TouchableOpacity
                    style={[
                      styles.otpBtn,
                      (isSendingOtp || otpCooldown > 0) && styles.disabledBtn,
                    ]}
                    onPress={handleSendOtp}
                    disabled={isSendingOtp || otpCooldown > 0}
                  >
                    {isSendingOtp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.otpBtnTxt}>
                        {otpCooldown > 0 ? `${otpCooldown}s` : otpSent ? 'Resend' : 'Send'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {otpSent && !otpVerified && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { marginBottom: 8 }]}>Enter OTP</Text>
                <View style={styles.phoneInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 12 }]}
                    placeholder="6-digit code"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.otpBtn, isVerifyingOtp && styles.disabledBtn]}
                    onPress={handleVerifyOtp}
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.otpBtnTxt}>Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {otpVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedTxt}>✓ Phone Verified</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!otpVerified || isCompleting) && styles.disabledSubmit,
              ]}
              onPress={handleSubmit}
              disabled={!otpVerified || isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnTxt}>Complete Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 32,
  },
  form: {},
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  input: {
    height: 54,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    color: Colors.textPrimary,
  },
  phoneInputRow: {
    flexDirection: 'row',
  },
  otpBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    minWidth: 80,
  },
  otpBtnTxt: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  verifiedBadge: {
    backgroundColor: '#E6F4EA',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifiedTxt: {
    color: '#1E8E3E',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnTxt: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  disabledBtn: {
    backgroundColor: Colors.textMuted,
  },
  disabledSubmit: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default OnboardingScreen;
