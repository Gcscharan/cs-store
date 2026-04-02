import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Colors } from '../../constants/colors';
import { useAddReviewMutation, useUpdateReviewMutation } from '../../api/reviewsApi';
import { BASE_URL } from '../../api/baseApi';
import { storage } from '../../utils/storage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HomeStackParamList } from '../../navigation/types';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

type WriteReviewScreenRouteProp = RouteProp<HomeStackParamList, 'WriteReview'>;
type WriteReviewNavigationProp = StackNavigationProp<HomeStackParamList, 'WriteReview'>;

export default function WriteReviewScreen() {
  const navigation = useNavigation<WriteReviewNavigationProp>();
  const route = useRoute<WriteReviewScreenRouteProp>();
  const { productId, productName, existingReview } = route.params;
  const isEditing = !!existingReview;

  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [comment, setComment] = useState<string>(existingReview?.comment ?? '');
  const [images, setImages] = useState<string[]>(existingReview?.images ?? []);
  const [isUploading, setIsUploading] = useState(false);

  const [addReview, { isLoading: isAdding }] = useAddReviewMutation();
  const [updateReview, { isLoading: isUpdating }] = useUpdateReviewMutation();
  const isSubmitting = isAdding || isUpdating;

  const hasUnsavedChanges = 
    rating !== (existingReview?.rating ?? 0) || 
    comment !== (existingReview?.comment ?? '') || 
    JSON.stringify(images) !== JSON.stringify(existingReview?.images ?? []);

  // Handle back button with unsaved changes
  useEffect(() => {
    const handleBack = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          'Discard changes?',
          'You have unsaved changes. Are you sure you want to go back?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backHandler.remove();
  }, [hasUnsavedChanges, navigation]);

  const onBackPress = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [hasUnsavedChanges, navigation]);

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can only upload up to 5 images.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow access to your photos to upload review pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadImage(result.assets[0].base64);
    }
  };

  const uploadImage = async (base64: string) => {
    setIsUploading(true);
    try {
      const token = await storage.getItem('accessToken');
      const response = await fetch(`${BASE_URL}/uploads/cloudinary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await response.json();
      if (response.ok) {
        setImages((prev) => [...prev, data.full]);
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error: any) {
      Alert.alert('Upload Error', error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => setImages((prev) => prev.filter((_, i) => i !== index)) 
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating before submitting.');
      return;
    }
    if (!comment.trim() || comment.trim().length < 10) {
      Alert.alert('Review too short', 'Please write at least 10 characters in your review.');
      return;
    }

    try {
      if (isEditing) {
        await updateReview({
          productId,
          reviewId: existingReview._id,
          rating,
          comment: comment.trim(),
          images: images,
        }).unwrap();
        Alert.alert('Updated!', 'Your review has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await addReview({
          productId,
          rating,
          comment: comment.trim(),
          images: images.length > 0 ? images : undefined,
        }).unwrap();
        Alert.alert('Thank you!', 'Your review has been submitted.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      const msg = e?.data?.message || 'Failed to submit review. Please try again.';
      Alert.alert('Error', msg);
    }
  };

  const canSubmit = rating > 0 && comment.trim().length >= 10 && !isSubmitting && !isUploading;

  return (
    <View style={s.container}>
      <ScreenHeader 
        title={isEditing ? 'Edit Review' : 'Write a Review'} 
        showBackButton 
        onBack={onBackPress}
      />
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.productBanner}>
            <Text style={s.productLabel}>Reviewing</Text>
            <Text style={s.productName}>{productName}</Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Rating</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity 
                  key={star} 
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                  style={s.starBtn}
                >
                  <Ionicons 
                    name={star <= rating ? "star" : "star-outline"} 
                    size={40} 
                    color={star <= rating ? "#FFB800" : Colors.textMuted} 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.ratingLabel, { textAlign: 'center' }]}>{RATING_LABELS[rating] || 'Select rating'}</Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Comment</Text>
            <TextInput
              style={s.textInput}
              placeholder="Tell us what you like or dislike about this product"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Add Photos (Optional)</Text>
            <View style={s.imagesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageScroll}>
                {images.map((uri, idx) => (
                  <View key={idx} style={s.imageWrapper}>
                    <Image source={{ uri }} style={s.reviewImage} />
                    <TouchableOpacity 
                      style={s.removeImageBtn}
                      onPress={() => removeImage(idx)}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity 
                    style={s.addImageBtn}
                    onPress={pickImage}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={24} color={Colors.primary} />
                        <Text style={s.addImageText}>Add Photo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.submitBtn, (rating === 0 || isSubmitting) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={s.submitBtnText}>
                {isEditing ? 'Update Review' : 'Submit Review'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  productBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  productIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  productInfo: {
    flex: 1,
  },
  productLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'center',
  },
  starBtn: {
    padding: 2,
  },
  ratingLabelContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f59e0b',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 160,
    backgroundColor: Colors.white,
    lineHeight: 22,
  },
  textInputError: {
    borderColor: Colors.error,
  },
  charCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  charCountError: {
    fontSize: 13,
    color: Colors.error,
  },
  charCount: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  imagesContainer: {
    marginTop: 4,
  },
  imageScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 16,
    marginTop: 10,
  },
  reviewImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addImageBtn: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff8f5',
    marginTop: 10,
  },
  addImageText: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 6,
    fontWeight: '700',
  },
  imageHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  tipsCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
