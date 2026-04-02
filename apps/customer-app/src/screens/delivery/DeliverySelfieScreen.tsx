import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors } from '../../constants/colors';
import { logEvent } from '../../utils/analytics';
import { useUpdateSelfieMutation } from '../../api/deliveryApi';

type ScreenState = 'initial' | 'preview' | 'uploading' | 'success' | 'error';

export default function DeliverySelfieScreen({ navigation }: any) {
  const [state, setState] = useState<ScreenState>('initial');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [updateSelfie] = useUpdateSelfieMutation();

  useEffect(() => {
    logEvent('screen_view', { screen: 'DeliverySelfie' });
  }, []);

  const compressImage = async (uri: string): Promise<string> => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return `data:image/jpeg;base64,${result.base64}`;
  };

  const handleCamera = async () => {
    logEvent('selfie_camera_opened');

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed for selfie verification. You can upload from gallery instead.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri);
      setPreview(compressed);
      setState('preview');
      logEvent('selfie_captured', { source: 'camera' });
    }
  };

  const handleGallery = async () => {
    logEvent('selfie_gallery_opened');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Gallery access is needed to select a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri);
      setPreview(compressed);
      setState('preview');
      logEvent('selfie_captured', { source: 'gallery' });
    }
  };

  const handleUpload = async () => {
    if (!preview) return;

    setState('uploading');
    setErrorMsg('');
    logEvent('selfie_upload_started');
    const startTime = Date.now();

    try {
      await updateSelfie({ selfieUrl: preview }).unwrap();
      setState('success');
      logEvent('selfie_upload_success', { durationMs: Date.now() - startTime });
      setTimeout(() => navigation.goBack(), 2000);
    } catch (err: any) {
      setState('error');
      setErrorMsg(err?.data?.error || 'Upload failed. Please try again.');
      logEvent('selfie_upload_failed', { error: err?.data?.error || 'unknown' });
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setState('initial');
    setErrorMsg('');
  };

  // Success State
  if (state === 'success') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Selfie Uploaded!</Text>
          <Text style={s.successDesc}>Your selfie has been successfully uploaded.</Text>
          <ActivityIndicator color={Colors.success} style={{ marginTop: 20 }} />
          <Text style={s.redirectText}>Redirecting to dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Selfie Verification</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.content}>
        {/* Preview State */}
        {preview && state !== 'initial' ? (
          <View style={s.previewSection}>
            <Image source={{ uri: preview }} style={s.previewImage} />
            <View style={s.previewActions}>
              <TouchableOpacity style={[s.retakeBtn, { marginRight: 12 }]} onPress={handleRetake} disabled={state === 'uploading'}>
                <Text style={s.retakeBtnText}>❌ Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.uploadBtn, state === 'uploading' && s.btnDisabled]}
                onPress={handleUpload}
                disabled={state === 'uploading'}
              >
                {state === 'uploading' ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={s.uploadBtnText}>✅ Upload Selfie</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Initial State — CTAs */
          <View style={s.ctaSection}>
            <TouchableOpacity style={[s.cameraCta, { marginBottom: 16 }]} onPress={handleCamera}>
              <Text style={[s.ctaIcon, { marginRight: 12 }]}>📷</Text>
              <Text style={s.ctaText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.galleryCta} onPress={handleGallery}>
              <Text style={[s.ctaIcon, { marginRight: 12 }]}>📤</Text>
              <Text style={s.ctaText}>Upload from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {errorMsg !== '' && (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>⚠️ {errorMsg}</Text>
            <TouchableOpacity onPress={handleUpload}>
              <Text style={s.retryLink}>Tap to retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions */}
        {state === 'initial' && (
          <View style={s.instructionsCard}>
            <Text style={s.instructionsTitle}>📋 Instructions</Text>
            {[
              'Ensure good lighting and clear visibility of your face',
              'Look directly at the camera with a neutral expression',
              'Make sure your entire face is visible in the frame',
              'Maximum file size: 5MB (auto-compressed)',
            ].map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={s.tipDot} />
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backText: { fontSize: 16, color: Colors.secondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successIcon: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  successDesc: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
  redirectText: { fontSize: 12, color: Colors.textMuted, marginTop: 12 },
  ctaSection: { marginTop: 20 },
  cameraCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.secondary, borderRadius: 16, paddingVertical: 20 },
  galleryCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4b5563', borderRadius: 16, paddingVertical: 20 },
  ctaIcon: { fontSize: 24 },
  ctaText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  previewSection: { alignItems: 'center' },
  previewImage: { width: 280, height: 280, borderRadius: 16, marginBottom: 20 },
  previewActions: { flexDirection: 'row' },
  retakeBtn: { flex: 1, backgroundColor: '#6b7280', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  retakeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  uploadBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  uploadBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  errorBanner: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, marginTop: 16 },
  errorText: { fontSize: 13, color: '#991b1b' },
  retryLink: { fontSize: 13, color: Colors.secondary, fontWeight: '700', marginTop: 6 },
  instructionsCard: { backgroundColor: Colors.background, borderRadius: 16, padding: 20, marginTop: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 },
  instructionsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.secondary, marginTop: 6, marginRight: 10 },
  tipText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});
