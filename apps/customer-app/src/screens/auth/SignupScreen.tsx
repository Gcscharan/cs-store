import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { AuthNavigationProp } from '../../navigation/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { useSendOtpMutation } from '../../api/authApi';

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const route = useRoute<any>();

  const initialPhoneParam: string | undefined = route?.params?.phone;
  const initialDigits = useMemo(() => {
    const digits = String(initialPhoneParam || '').replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [initialPhoneParam]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState(initialDigits);
  const [sendOtp, { isLoading }] = useSendOtpMutation();
  const [error, setError] = useState<string | null>(null);

  const phoneLocked = !!initialDigits;

  const isValidEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );
  const isValidPhone = useMemo(() => /^[0-9]{10}$/.test(phoneDigits), [phoneDigits]);
  const isValidName = useMemo(() => name.trim().length > 0, [name]);

  const canSubmit = isValidName && isValidEmail && isValidPhone && !isLoading;

  const onChangePhone = (value: string) => {
    setError(null);
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setPhoneDigits(digitsOnly);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;

    setError(null);

    try {
      await sendOtp({
        phone: phoneDigits,
        mode: 'signup',
        name: name.trim(),
      }).unwrap();

      navigation.navigate('OTP', {
        phone: `+91${phoneDigits}`,
        isSignup: true,
        name: name.trim(),
        signupEmail: email.trim(),
      });
    } catch (e: any) {
      setError(e?.data?.message || 'Failed to send OTP. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Signup or Login" showBackButton />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join VyaparSetu today</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(v) => {
                setError(null);
                setName(v);
              }}
              placeholder="Enter your full name"
              editable={!isLoading}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => {
                setError(null);
                setEmail(v);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Enter your email"
              editable={!isLoading}
            />

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                style={[styles.phoneInput, phoneLocked && styles.phoneInputLocked]}
                value={phoneDigits}
                onChangeText={onChangePhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="10-digit mobile number"
                editable={!phoneLocked && !isLoading}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
              activeOpacity={0.9}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.bottomLink}>Login</Text>
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
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  prefixBox: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.white,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  phoneInputLocked: {
    color: Colors.textMuted,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.error,
  },
  primaryButton: {
    marginTop: 24,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  bottomText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bottomLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default SignupScreen;
