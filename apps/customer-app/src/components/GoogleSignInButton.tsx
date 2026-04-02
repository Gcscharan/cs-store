import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { setTokens, setUser, setStatus } from '../store/slices/authSlice';
import { storage } from '../utils/storage';
import { Colors } from '../constants/colors';
import { BASE_URL } from '../api/baseApi';
import type { AuthNavigationProp } from '../navigation/types';

interface GoogleSignInButtonProps {
  onOnboardingRequired?: (data: { onboardingToken: string; user: { email: string; name: string; avatar?: string } }) => void;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onOnboardingRequired }) => {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigation = useNavigation<AuthNavigationProp>();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('[GoogleSignIn] Starting sign-in flow...');
      console.log('[GoogleSignIn] BASE_URL:', BASE_URL);

      // Check if device has Google Play Services
      const hasPlayServices = await GoogleSignin.hasPlayServices();
      console.log('[GoogleSignIn] Has Play Services:', hasPlayServices);

      // Sign in and get user info
      const userInfo = await GoogleSignin.signIn();
      console.log('[GoogleSignIn] User info:', JSON.stringify(userInfo, null, 2));
      
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        console.log('[GoogleSignIn] No ID token in response');
        throw new Error('No ID token received from Google');
      }

      console.log('[GoogleSignIn] Got ID token, sending to backend...');
      console.log('[GoogleSignIn] Endpoint:', `${BASE_URL}/auth/google-mobile`);

      // Send ID token to our backend
      const response = await fetch(`${BASE_URL}/auth/google-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();
      console.log('[GoogleSignIn] Backend response status:', response.status);
      console.log('[GoogleSignIn] Backend response:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Google sign-in failed');
      }

      // Check if onboarding is required (new user)
      if (data.onboardingRequired) {
        console.log('[GoogleSignIn] Onboarding required for new user');
        if (onOnboardingRequired) {
          onOnboardingRequired({
            onboardingToken: data.onboardingToken,
            user: data.user,
          });
        } else {
          // Navigate to onboarding screen
          navigation.navigate('Onboarding', {
            onboardingToken: data.onboardingToken,
            email: data.user.email,
            name: data.user.name,
            avatar: data.user.avatar,
          });
        }
        return;
      }

      // Existing user - save tokens and navigate
      console.log('[GoogleSignIn] Login successful, saving tokens...');

      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);

      dispatch(setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));
      dispatch(setUser(data.user));
      dispatch(setStatus('ACTIVE'));

    } catch (error: any) {
      console.log('[GoogleSignIn] Error:', error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled - don't show error
        return;
      }

      if (error.code === statusCodes.IN_PROGRESS) {
        // Already signing in
        return;
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available on this device');
        return;
      }

      Alert.alert('Sign-In Failed', error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleGoogleSignIn}
      disabled={loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.textPrimary} />
      ) : (
        <>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.buttonText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});

export default GoogleSignInButton;
