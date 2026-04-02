import React, { useState, useEffect, useRef } from 'react'; 
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, 
  KeyboardAvoidingView, Platform, ScrollView,
  Keyboard, Vibration, StatusBar,
} from 'react-native'; 
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux'; 
import { useSendOtpMutation, useVerifyOtpMutation } from '../../api/authApi'; 
import * as SecureStore from 'expo-secure-store'; 
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { setUser, setTokens, setStatus } from '../../store/slices/authSlice'; 
import RNOtpVerify from 'react-native-otp-verify';
 
export default function LoginScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets(); 
  const [phone, setPhone] = useState(''); 
  const [otp, setOtp] = useState(''); 
  const [step, setStep] = useState<'phone' | 'otp'>('phone'); 
  const [timer, setTimer] = useState(0); 
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const logEvent = (evt: string) => console.log('[Analytics]:', evt);
 
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
    if (phone.length !== 10) { 
      Alert.alert('Invalid phone', 'Enter a valid 10-digit number'); 
      return; 
    } 
    try {
      console.log('🔥 Sending OTP for phone:', phone);
      const result = await sendOtp({ phone }).unwrap(); // Removed mode parameter
      console.log('✅ OTP sent successfully:', result);
      setStep('otp'); 
      startTimer(); 
    } catch (err: any) {
      console.error('❌ Send OTP failed:', err);
      console.error('❌ Error data:', err?.data);
      console.error('❌ Error status:', err?.status);
      Alert.alert('Error', err?.data?.message || err?.data?.error || 'Failed to send OTP'); 
    } 
  }; 

  useEffect(() => {
    if (step === 'otp' && Platform.OS === 'android') {
      RNOtpVerify.getOtp()
        .then(() => RNOtpVerify.addListener((message) => {
          const matchedOtp = message.match(/\d{4,6}/)?.[0];
          if (matchedOtp) {
            logEvent('otp_auto_filled');
            setOtp(matchedOtp);
          }
        }))
        .catch(console.log);
      return () => { RNOtpVerify.removeListener(); };
    }
  }, [step]);

  useEffect(() => {
    if (otp.length === 6 && step === 'otp' && !verifying && !isSuccess) {
      Keyboard.dismiss();
      handleVerify();
    }
  }, [otp, step]); 
 
  const handleVerify = async () => { 
    try { 
      const result = await verifyOtp({ phone, otp }).unwrap(); // Removed mode parameter
      
      // Check if user needs onboarding
      if (result.requiresOnboarding) {
        logEvent('new_user_onboarding_required');
        // Navigate to onboarding screen
        navigation.navigate('Onboarding', { phone });
        return;
      }

      // Existing user - complete login
      await SecureStore.setItemAsync('accessToken', result.accessToken); 
      if (result.refreshToken) { 
        await SecureStore.setItemAsync('refreshToken', result.refreshToken); 
      } 
      
      logEvent('otp_verified_success');
      setIsSuccess(true);
      Vibration.vibrate(50);

      dispatch(setTokens({ 
        accessToken: result.accessToken, 
        refreshToken: result.refreshToken, 
      })); 
      dispatch(setUser(result.user)); 
      dispatch(setStatus('ACTIVE'));
      console.log("🔐 LOGIN COMPLETE", {userId: result.user?.id, time: Date.now()});

    } catch (err: any) { 
      logEvent('otp_verification_failed');
      Vibration.vibrate([100, 100, 100]);
      setOtp('');
      setTimeout(() => inputRef.current?.focus(), 100);
      Alert.alert('Invalid OTP', err?.data?.message || 'Please check and try again'); 
    } 
  }; 
 
  return ( 
    <View style={s.container}>
      <ScreenHeader 
        title={step === 'phone' ? 'Login' : 'Verification'} 
        showBackButton={step === 'otp'} 
        onBack={() => setStep('phone')} 
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }} 
      > 
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"> 
          {/* Header */} 
          <View style={s.header}> 
            <Text style={s.logo}>Vyapara Setu</Text> 
            <Text style={s.tagline}>Built for shopkeepers of India</Text> 
          </View> 
 
          {step === 'phone' ? ( 
            <> 
              {/* Hero */} 
              <View style={s.hero}> 
                <Text style={s.title}>Welcome to Vyapara Setu</Text> 
                <Text style={s.subtitle}>Enter your phone number to continue</Text> 
              </View> 
 
              {/* Input */} 
              <View style={s.inputContainer}> 
                <Text style={s.label}>Phone Number</Text> 
                <View style={s.inputBox}> 
                  <Text style={s.country}>🇮🇳 +91</Text> 
                  <TextInput 
                    placeholder="Enter mobile number" 
                    placeholderTextColor="#999" 
                    style={s.input} 
                    keyboardType="phone-pad" 
                    maxLength={10} 
                    value={phone} 
                    onChangeText={setPhone} 
                    autoFocus 
                  /> 
                </View> 
              </View> 
            </> 
          ) : ( 
            <View style={s.otpForm}> 
              <Text style={s.title}>Verify OTP</Text> 
              <Text style={s.subtitle}>Sent to +91 {phone}</Text> 
 
              <TextInput 
                ref={inputRef}
                style={s.otpInput} 
                placeholder="• • • • • •" 
                keyboardType="numeric" 
                maxLength={6} 
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                editable={!verifying && !isSuccess}
                value={otp} 
                onChangeText={(val) => {
                  logEvent('otp_manual_entry');
                  setOtp(val);
                }} 
                autoFocus 
              /> 
 
              <View style={s.resendRow}> 
                {timer > 0 ? ( 
                  <Text style={s.timerTxt}>Resend OTP in {timer}s</Text> 
                ) : ( 
                  <TouchableOpacity onPress={() => { setOtp(''); handleSendOtp(); }}> 
                    <Text style={s.resendLink}>Resend OTP</Text> 
                  </TouchableOpacity> 
                )} 
              </View> 
 
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}> 
                <Text style={s.changeTxt}>← Change phone number</Text> 
              </TouchableOpacity> 
            </View> 
          )} 
        </ScrollView>

        {/* Bottom Fixed CTA */}
        <View style={[s.bottomContainer, { paddingBottom: insets.bottom || 16 }]}>
          {step === 'phone' ? (
            <TouchableOpacity 
              style={[s.primaryButton, (sending || phone.length !== 10) && s.btnDisabled]} 
              onPress={handleSendOtp} 
              disabled={sending || phone.length !== 10} 
            > 
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Continue</Text>} 
            </TouchableOpacity>
          ) : (
            <>
              {isSuccess ? (
                <View style={[s.primaryButton, { backgroundColor: '#4BB543' }]}>
                  <Text style={s.primaryText}>✅ Verified</Text>
                </View>
              ) : (otp.length === 6 || verifying) ? (
                <View style={[s.primaryButton, s.btnDisabled]}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <TouchableOpacity 
                  style={[s.primaryButton, otp.length !== 6 && s.btnDisabled]} 
                  onPress={handleVerify} 
                  disabled={otp.length !== 6} 
                > 
                  <Text style={s.primaryText}>Verify & Continue</Text> 
                </TouchableOpacity> 
              )}
            </>
          )}
          
          <Text style={s.terms}> 
            By continuing, you agree to our Terms & Privacy Policy 
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View> 
  ); 
} 
 
const s = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: Colors.background }, 
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 140 }, 
  
  // Header
  header: { alignItems: 'center', marginTop: 20 }, 
  logo: { fontSize: 26, fontWeight: '800', color: '#FF6A00' }, 
  tagline: { fontSize: 14, color: '#777', marginTop: 4 }, 
  
  // Hero
  hero: { marginTop: 40 }, 
  title: { fontSize: 22, fontWeight: '700', color: '#111' }, 
  subtitle: { fontSize: 14, color: '#666', marginTop: 6 }, 
  
  // Input
  inputContainer: { marginTop: 30 }, 
  label: { fontSize: 13, color: '#666', marginBottom: 6 }, 
  inputBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    paddingHorizontal: 14, 
    height: 55 
  }, 
  country: { marginRight: 8, fontWeight: '600' }, 
  input: { flex: 1, fontSize: 16 }, 
  
  // Primary Button
  primaryButton: { 
    height: 55, 
    borderRadius: 14, 
    backgroundColor: '#FF6A00', 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#FF6A00', 
    shadowOpacity: 0.3, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }
  }, 
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' }, 
  btnDisabled: { backgroundColor: '#ccc', shadowOpacity: 0 }, 
  
  // Bottom Container
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  
  // Footer
  footer: { marginTop: 30, alignItems: 'center' }, 
  footerText: { fontSize: 14, color: '#555' }, 
  create: { color: '#FF6A00', fontWeight: '700' }, 
  terms: { fontSize: 11, color: '#999', marginTop: 12, textAlign: 'center' }, 
  
  // OTP Screen
  otpForm: { marginTop: 40 }, 
  otpInput: { 
    borderWidth: 1.5, 
    borderColor: '#E5E5E5', 
    borderRadius: 14, 
    padding: 18, 
    fontSize: 28, 
    letterSpacing: 12, 
    textAlign: 'center', 
    backgroundColor: '#FFFFFF', 
    marginTop: 30 
  }, 
  resendRow: { alignItems: 'center', marginTop: 18 }, 
  timerTxt: { color: '#888', fontSize: 14 }, 
  resendLink: { color: '#FF6A00', fontWeight: '600', fontSize: 15 }, 
  changeTxt: { color: '#666', textAlign: 'center', marginTop: 18, fontSize: 14 }, 
}); 
