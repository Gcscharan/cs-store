import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  Keyboard,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { 
  useCreateAdminProductMutation, 
  useUpdateAdminProductMutation,
  usePublishAdminProductMutation 
} from '../../api/adminApi';
import { getProductCategories, getBackendCategories } from '../../constants/categoriesConfig';

// Get product categories from MASTER_CATEGORIES (exclude price categories)
const CATEGORY_OPTIONS = getProductCategories().map(cat => cat.label);
type Category = string;

type PickedImage = { uri: string; name: string; type: string };
type UploadedImage = { 
  url: string; 
  status: 'uploading' | 'uploaded' | 'failed';
  localUri?: string; // For preview during upload
  abortController?: AbortController; // For cancellation control
};

type VideoMetadata = {
  url: string;
  thumbnail: string;
  publicId: string;
  hash?: string;
  duration?: number;
};

const AdminCreateProductScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [createProduct, { isLoading: isCreating }] = useCreateAdminProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateAdminProductMutation();
  const [publishProduct, { isLoading: isPublishing }] = usePublishAdminProductMutation();

  // Draft system state
  const [productId, setProductId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Phase 3: Real-time validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  
  // Phase 4: Dirty state tracking
  const lastSavedStateRef = useRef<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORY_OPTIONS[0] || 'Chocolates');
  const [sku, setSku] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('');
  const [weight, setWeight] = useState('');

  const [images, setImages] = useState<PickedImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Refs for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Phase 3: Validation functions
  const validateField = useCallback((fieldName: string, value: string): string => {
    switch (fieldName) {
      case 'name':
        if (!value.trim()) return 'Product name is required';
        if (value.trim().length < 3) return 'Name must be at least 3 characters';
        return '';
      
      case 'description':
        if (!value.trim()) return 'Description is required';
        if (value.trim().length < 10) return 'Description must be at least 10 characters';
        return '';
      
      case 'price':
        if (!value.trim()) return 'Selling price is required';
        const priceNum = parseFloat(value.trim());
        if (isNaN(priceNum) || priceNum <= 0) return 'Price must be greater than 0';
        return '';
      
      case 'pricePerUnit':
        if (!value.trim()) return 'Price per unit is required';
        const ppuNum = parseFloat(value.trim());
        if (isNaN(ppuNum) || ppuNum <= 0) return 'Price per unit must be greater than 0';
        // Cross-field validation: pricePerUnit <= price
        if (price.trim()) {
          const priceValue = parseFloat(price.trim());
          if (!isNaN(priceValue) && ppuNum > priceValue) {
            return 'Price per unit cannot exceed selling price';
          }
        }
        return '';
      
      case 'stock':
        if (!value.trim()) return 'Stock quantity is required';
        const stockNum = parseInt(value.trim(), 10);
        if (isNaN(stockNum) || stockNum < 0) return 'Stock must be 0 or greater';
        return '';
      
      case 'weight':
        if (!value.trim()) return 'Weight is required';
        const weightNum = parseFloat(value.trim());
        if (isNaN(weightNum) || weightNum <= 0) return 'Weight must be greater than 0';
        return '';
      
      case 'mrp':
        if (value.trim()) {
          const mrpNum = parseFloat(value.trim());
          if (isNaN(mrpNum) || mrpNum <= 0) return 'MRP must be greater than 0';
        }
        return '';
      
      default:
        return '';
    }
  }, [price]);

  // Phase 3: Validate field on change (after touched)
  const handleFieldChange = useCallback((fieldName: string, value: string, setter: (val: string) => void) => {
    setter(value);
    
    // Mark field as touched
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
    
    // Validate immediately if field is touched
    const error = validateField(fieldName, value);
    setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
    
    // Cross-field validation: if price changes, re-validate pricePerUnit
    if (fieldName === 'price' && touchedFields.pricePerUnit) {
      const ppuError = validateField('pricePerUnit', pricePerUnit);
      setFieldErrors(prev => ({ ...prev, pricePerUnit: ppuError }));
    }
  }, [validateField, touchedFields, pricePerUnit]);

  // Cleanup: Cancel all ongoing uploads when component unmounts
  useEffect(() => {
    return () => {
      uploadedImages.forEach(img => {
        if (img.status === 'uploading' && img.abortController) {
          img.abortController.abort();
          console.log('⚠️ Upload cancelled on unmount');
        }
      });
      // Cancel any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [uploadedImages]);

  // Phase 4: Compute current form state for dirty checking
  const getCurrentFormState = useCallback(() => {
    const backendCategories = getBackendCategories(category);
    const backendCategory = backendCategories[0];

    const imageUrls = uploadedImages
      .filter(img => img.status === 'uploaded')
      .map(img => img.url)
      .sort(); // Sort for stable comparison

    // Create object with stable key ordering (alphabetical)
    const state = {
      category: backendCategory || undefined,
      description: description.trim() || undefined,
      images: imageUrls.length > 0 ? imageUrls : undefined,
      mrp: mrp.trim() ? parseFloat(mrp.trim()) : undefined,
      name: name.trim(),
      price: price.trim() ? parseFloat(price.trim()) : undefined,
      pricePerUnit: pricePerUnit.trim() ? parseFloat(pricePerUnit.trim()) : undefined,
      sku: sku.trim() || undefined,
      stock: stock.trim() ? parseInt(stock.trim(), 10) : undefined,
      tags: tags.trim() || undefined,
      video: video || undefined,
      weight: weight.trim() ? parseFloat(weight.trim()) : undefined,
    };

    // Stable JSON serialization with sorted keys
    return JSON.stringify(state, Object.keys(state).sort());
  }, [name, description, category, price, pricePerUnit, stock, mrp, weight, tags, sku, uploadedImages]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!name.trim()) {
      // Can't save without name
      return;
    }

    // Don't create a new draft unless all required fields are present
    if (!productId) {
      if (!price.trim() || !stock.trim() || !category.trim()) {
        console.log('⚠️ Skipping auto-save: required fields missing (price, stock, category)');
        return;
      }
    }

    // GAP #2 FIX: Protect against destructive auto-save
    // Don't save if critical numeric fields are empty strings (user might be editing)
    // Only skip if they were previously filled (destructive case)
    const hasDestructiveChange = (
      (price === '' && productId) || // Had product, now price is empty
      (stock === '' && productId) || // Had product, now stock is empty
      (weight === '' && productId)   // Had product, now weight is empty
    );

    if (hasDestructiveChange) {
      console.log('⚠️ Skipping auto-save: destructive change detected');
      return;
    }

    // Phase 4: GAP #3 FIX - Dirty state checking
    const currentState = getCurrentFormState();
    if (lastSavedStateRef.current === currentState) {
      console.log('⚠️ Skipping auto-save: no changes detected (isDirty = false)');
      return;
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setSaveStatus('saving');

    try {
      const backendCategories = getBackendCategories(category);
      const backendCategory = backendCategories[0];

      const imageUrls = uploadedImages
        .filter(img => img.status === 'uploaded')
        .map(img => img.url);

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        category: backendCategory || undefined,
        price: price.trim() ? parseFloat(price.trim()) : undefined,
        pricePerUnit: pricePerUnit.trim() ? parseFloat(pricePerUnit.trim()) : undefined,
        stock: stock.trim() ? parseInt(stock.trim(), 10) : undefined,
        mrp: mrp.trim() ? parseFloat(mrp.trim()) : undefined,
        weight: weight.trim() ? parseFloat(weight.trim()) : undefined,
        tags: tags.trim() || undefined,
        sku: sku.trim() || undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        video: video || undefined,
      };

      if (!productId) {
        // First save - create draft
        console.log('📝 Creating draft product...');
        const response: any = await createProduct(payload).unwrap();
        setProductId(response.productId);
        setIsDraft(response.status === 'draft');
        console.log('✅ Draft created:', response.productId);
      } else {
        // Subsequent saves - update draft
        console.log('📝 Updating draft product...');
        await updateProduct({ id: productId, ...payload }).unwrap();
        console.log('✅ Draft updated');
      }

      // Phase 4: Update last saved state after successful save
      lastSavedStateRef.current = currentState;

      setSaveStatus('saved');
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      console.error('❌ Auto-save failed:', error);
      setSaveStatus('idle');
      // Don't show alert for auto-save failures (silent)
    }
  }, [name, description, category, price, pricePerUnit, stock, mrp, weight, tags, sku, uploadedImages, productId, createProduct, updateProduct, getCurrentFormState]);

  // Auto-save trigger (debounced)
  useEffect(() => {
    if (!name.trim()) {
      // Don't auto-save if name is empty
      return;
    }

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout (2 seconds debounce)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [name, description, category, price, pricePerUnit, stock, mrp, weight, tags, sku, uploadedImages, video, getCurrentFormState]);

  const canPublish = useMemo(() => {
    const hasUploadingImages = uploadedImages.some(img => img.status === 'uploading');
    const hasValidationErrors = Object.values(fieldErrors).some(error => error !== '');
    const hasUploadedImages = uploadedImages.some(img => img.status === 'uploaded');
    
    return (
      name.trim().length > 0 &&
      description.trim().length > 0 &&
      String(category).length > 0 &&
      price.trim().length > 0 &&
      stock.trim().length > 0 &&
      hasUploadedImages &&
      !hasUploadingImages &&
      !hasValidationErrors
    );
  }, [name, description, category, price, stock, uploadedImages, fieldErrors]);

  const uploadImages = async (pickedImages: PickedImage[]) => {
    // DUPLICATE PREVENTION: Check if any URI already exists
    const existingUris = new Set(
      uploadedImages
        .filter(img => img.localUri)
        .map(img => img.localUri)
    );
    
    const newImages = pickedImages.filter(img => !existingUris.has(img.uri));
    
    if (newImages.length === 0) {
      Alert.alert('Duplicate Images', 'All selected images are already uploaded or uploading.');
      return;
    }
    
    if (newImages.length < pickedImages.length) {
      Alert.alert(
        'Duplicate Images', 
        `${pickedImages.length - newImages.length} image(s) already selected. Uploading ${newImages.length} new image(s).`
      );
    }

    // Create AbortController for each upload
    const abortController = new AbortController();
    
    // Add temporary items with 'uploading' status
    const tempImages: UploadedImage[] = newImages.map(img => ({
      url: '', // Will be filled after upload
      status: 'uploading' as const,
      localUri: img.uri,
      abortController, // Store for cancellation
    }));
    
    setUploadedImages(prev => [...prev, ...tempImages]);

    // Upload to backend
    try {
      const formData = new FormData();
      newImages.forEach((img) => {
        formData.append('images', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as any);
      });

      console.log('📤 Uploading images to /api/uploads/images...');
      
      // Get token from storage
      const { storage } = await import('../../utils/storage');
      const token = await storage.getItem('accessToken');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/uploads/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        signal: abortController.signal, // Add cancellation support
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Upload successful:', result);

      // Replace temp items with uploaded URLs
      setUploadedImages(prev => {
        const newImages = [...prev];
        // Remove temp items
        const withoutTemp = newImages.filter(img => img.status !== 'uploading' || !tempImages.some(t => t.localUri === img.localUri));
        // Add uploaded items
        const uploaded: UploadedImage[] = result.images.map((img: any) => ({
          url: img.url,
          status: 'uploaded' as const,
        }));
        return [...withoutTemp, ...uploaded];
      });

      Alert.alert('Success', `${result.images.length} image(s) uploaded successfully`);
    } catch (error: any) {
      // Check if error is due to abort
      if (error.name === 'AbortError') {
        console.log('⚠️ Upload cancelled by user');
        // Remove cancelled uploads from state
        setUploadedImages(prev => 
          prev.filter(img => !tempImages.some(t => t.localUri === img.localUri))
        );
        return;
      }
      
      console.error('❌ Upload failed:', error);
      
      // Mark as failed
      setUploadedImages(prev => 
        prev.map(img => 
          tempImages.some(t => t.localUri === img.localUri) && img.status === 'uploading'
            ? { ...img, status: 'failed' as const, abortController: undefined }
            : img
        )
      );

      Alert.alert('Upload Failed', 'Failed to upload images. Please try again.');
    }
  };

  const retryUpload = async (index: number) => {
    const failedImage = uploadedImages[index];
    if (!failedImage || failedImage.status !== 'failed' || !failedImage.localUri) return;

    // Mark as uploading
    setUploadedImages(prev => 
      prev.map((img, i) => i === index ? { ...img, status: 'uploading' as const } : img)
    );

    try {
      const formData = new FormData();
      formData.append('images', {
        uri: failedImage.localUri,
        name: `retry-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const { storage } = await import('../../utils/storage');
      const token = await storage.getItem('accessToken');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/uploads/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Update with uploaded URL
      setUploadedImages(prev => 
        prev.map((img, i) => 
          i === index 
            ? { url: result.images[0].url, status: 'uploaded' as const }
            : img
        )
      );

      Alert.alert('Success', 'Image uploaded successfully');
    } catch (error) {
      console.error('❌ Retry failed:', error);
      
      // Mark as failed again
      setUploadedImages(prev => 
        prev.map((img, i) => i === index ? { ...img, status: 'failed' as const } : img)
      );

      Alert.alert('Retry Failed', 'Failed to upload image. Please try again.');
    }
  };

  const pickImages = async () => {
    const hasUploadingImages = uploadedImages.some(img => img.status === 'uploading');
    if (hasUploadingImages) {
      Alert.alert('Please wait', 'Images are currently uploading. Please wait for them to finish.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow photo library access to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      // Request full quality so server-side resize can work properly
      quality: 1,
      selectionLimit: 10,
    });

    if (result.canceled) return;

    // ── Client-side validation ────────────────────────────────────────────
    const IMAGE_STANDARDS = {
      ALLOWED_MIME_TYPES: ['image/jpeg', 'image/webp'],
      MAX_FILE_SIZE_BYTES: 500 * 1024,
      MIN_DIMENSION: 600,
      MAX_INPUT_DIMENSION: 4000,
      ASPECT_RATIO_TOLERANCE: 1,
    };

    const rejections: string[] = [];

    for (const asset of result.assets) {
      const mimeType = asset.mimeType || 'image/jpeg';
      const ext = (asset.fileName || '').split('.').pop()?.toLowerCase() ?? '';

      // Format check
      const mimeOk = IMAGE_STANDARDS.ALLOWED_MIME_TYPES.includes(mimeType);
      const extOk = ['jpg', 'jpeg', 'webp'].includes(ext);
      if (!mimeOk && !extOk) {
        rejections.push(`"${asset.fileName || 'image'}": only JPEG and WebP are accepted.`);
        continue;
      }

      // File size check
      if (asset.fileSize && asset.fileSize > IMAGE_STANDARDS.MAX_FILE_SIZE_BYTES) {
        const kb = Math.round(asset.fileSize / 1024);
        rejections.push(`"${asset.fileName || 'image'}": ${kb} KB exceeds the 500 KB limit.`);
      }

      // Dimension checks
      const w = asset.width ?? 0;
      const h = asset.height ?? 0;
      if (w > 0 && h > 0) {
        // Hard pixel guard
        if (w > IMAGE_STANDARDS.MAX_INPUT_DIMENSION || h > IMAGE_STANDARDS.MAX_INPUT_DIMENSION) {
          rejections.push(
            `"${asset.fileName || 'image'}": dimensions ${w}×${h} are too large. Max input is ${IMAGE_STANDARDS.MAX_INPUT_DIMENSION}×${IMAGE_STANDARDS.MAX_INPUT_DIMENSION} px.`,
          );
          continue;
        }
        if (Math.abs(w - h) > IMAGE_STANDARDS.ASPECT_RATIO_TOLERANCE) {
          rejections.push(
            `"${asset.fileName || 'image'}": must be square (1:1). Got ${w}×${h} — please crop before uploading.`,
          );
        }
        const side = Math.min(w, h);
        if (side < IMAGE_STANDARDS.MIN_DIMENSION) {
          rejections.push(
            `"${asset.fileName || 'image'}": too small (${w}×${h}). Minimum is ${IMAGE_STANDARDS.MIN_DIMENSION}×${IMAGE_STANDARDS.MIN_DIMENSION} px.`,
          );
        }
      }
    }

    if (rejections.length > 0) {
      Alert.alert(
        'Image Requirements Not Met',
        rejections.join('\n\n') +
          '\n\nRequirements:\n• JPEG or WebP only\n• Square (1:1 ratio)\n• Min 600×600 px\n• Max 500 KB',
      );
      return;
    }

    const picked = result.assets.map((a, idx) => {
      const filename = a.fileName || `image-${Date.now()}-${idx}.jpg`;
      const type = a.mimeType || 'image/jpeg';
      return { uri: a.uri, name: filename, type };
    });

    // Upload immediately
    await uploadImages(picked);
  };

  const removeImage = (index: number) => {
    const imageToRemove = uploadedImages[index];
    
    // Cancel upload if still in progress
    if (imageToRemove?.status === 'uploading' && imageToRemove.abortController) {
      imageToRemove.abortController.abort();
      console.log('⚠️ Upload cancelled for image at index:', index);
    }
    
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const pickVideo = async () => {
    if (uploadingVideo) {
      Alert.alert('Please wait', 'Video is currently uploading.');
      return;
    }

    try {
      // Request permissions
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to select videos.');
        return;
      }

      // Launch video picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled) return;

      const video = result.assets[0];
      
      // Validate file size (20MB max)
      if (video.fileSize && video.fileSize > 20 * 1024 * 1024) {
        setVideoError('Video file size exceeds 20MB limit');
        return;
      }

      // Note: Duration validation is handled by backend after Cloudinary processing
      // Frontend duration from expo-image-picker may not be accurate

      setVideoError(null);
      setUploadingVideo(true);

      // Upload video
      const formData = new FormData();
      const filename = video.fileName || `video-${Date.now()}.mp4`;
      formData.append('video', {
        uri: video.uri,
        name: filename,
        type: 'video/mp4',
      } as any);

      const { storage } = await import('../../utils/storage');
      const token = await storage.getItem('accessToken');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/admin/upload/video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }

      const videoData = await response.json();
      setVideo(videoData);
      Alert.alert('Success', 'Video uploaded successfully');
    } catch (error: any) {
      console.error('❌ Video upload failed:', error);
      setVideoError(error.message || 'Video upload failed');
      Alert.alert('Upload Failed', error.message || 'Failed to upload video. Please try again.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = () => {
    Alert.alert(
      'Remove Video',
      'Are you sure you want to remove this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setVideo(null);
            setVideoError(null);
          },
        },
      ]
    );
  };

  const handlePublish = async () => {
    if (!canPublish) {
      Alert.alert('Missing fields', 'Please fill all required fields and upload at least one image before publishing.');
      return;
    }

    try {
      const backendCategories = getBackendCategories(category);
      const backendCategory = backendCategories[0];
      const imageUrls = uploadedImages.filter(img => img.status === 'uploaded').map(img => img.url);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category: backendCategory,
        price: parseFloat(price),
        pricePerUnit: pricePerUnit.trim() ? parseFloat(pricePerUnit) : parseFloat(price),
        stock: parseInt(stock, 10),
        mrp: mrp.trim() ? parseFloat(mrp) : undefined,
        weight: weight.trim() ? parseFloat(weight) : undefined,
        tags: tags.trim() || undefined,
        sku: sku.trim() || undefined,
        images: imageUrls,
        video: video || undefined,
        status: 'published',
      };

      let targetId = productId;

      if (!targetId) {
        // No draft yet — create and publish in one shot
        console.log('📢 Creating and publishing product...');
        const response: any = await createProduct(payload).unwrap();
        targetId = response.productId || response.product?._id;
      } else {
        // Update existing draft then publish
        await updateProduct({ id: targetId, ...payload }).unwrap();
        await publishProduct(targetId).unwrap();
      }

      console.log('✅ Product published successfully');
      Alert.alert('Success', 'Product published successfully!');
      navigation.goBack();
    } catch (error: any) {
      console.error('❌ Publish failed:', error);
      if (error.data?.errors) {
        const errorMessages = Object.entries(error.data.errors)
          .map(([field, message]) => `${field}: ${message}`)
          .join('\n');
        Alert.alert('Validation Failed', errorMessages);
      } else {
        Alert.alert('Error', error.data?.message || 'Failed to publish product. Please try again.');
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a product name to save draft.');
      return;
    }

    // Trigger immediate save
    await autoSave();
    Alert.alert('Draft Saved', 'Your product has been saved as a draft.');
  };

  return (
    <View style={styles.safe}>
      <AdminHeader title="Add New Product" onBack={() => navigation.goBack()} />

      {/* Draft Badge & Save Status */}
      {isDraft && (
        <View style={styles.statusBar}>
          <View style={styles.draftBadge}>
            <Text style={styles.draftText}>DRAFT</Text>
          </View>
          {saveStatus === 'saving' && (
            <View style={styles.saveStatus}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text style={styles.saveStatusText}>Saving...</Text>
            </View>
          )}
          {saveStatus === 'saved' && (
            <View style={styles.saveStatus}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={[styles.saveStatusText, { color: '#10b981' }]}>Saved</Text>
            </View>
          )}
        </View>
      )}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.scroll} 
          contentContainerStyle={styles.content} 
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
        {/* Entry Moment */}
        <Text style={styles.introText}>Create a new product. Add details to list it in your store.</Text>

        {/* SECTION 1: Product Identity */}
        <View style={styles.cardLight}>
          <Text style={styles.sectionTitle}>Product Identity</Text>

          <Text style={styles.label}>Product Name *</Text>
          <TextInput 
            value={name} 
            onChangeText={(val) => handleFieldChange('name', val, setName)}
            style={[
              styles.inputPrimary, 
              focusedField === 'name' && styles.inputFocused,
              touchedFields.name && fieldErrors.name && styles.inputError
            ]} 
            placeholder="Enter product name"
            placeholderTextColor="#9ca3af"
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
          />
          {touchedFields.name && fieldErrors.name && (
            <Text style={styles.errorText}>{fieldErrors.name}</Text>
          )}

          <Text style={styles.label}>Category *</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.categoryRow}
            decelerationRate="fast"
          >
            {CATEGORY_OPTIONS.map((c) => {
              const selected = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={({ pressed }) => [
                    styles.catPill, 
                    selected ? styles.catPillSelected : styles.catPillUnselected,
                    {
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    }
                  ]}
                >
                  <Text style={[styles.catText, selected ? styles.catTextSelected : styles.catTextUnselected]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Description *</Text>
          <TextInput
            value={description}
            onChangeText={(val) => handleFieldChange('description', val, setDescription)}
            style={[
              styles.input, 
              styles.textArea, 
              focusedField === 'description' && styles.inputFocused,
              touchedFields.description && fieldErrors.description && styles.inputError
            ]}
            placeholder="Describe your product"
            placeholderTextColor="#9ca3af"
            multiline
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
          />
          {touchedFields.description && fieldErrors.description && (
            <Text style={styles.errorText}>{fieldErrors.description}</Text>
          )}
        </View>

        {/* SECTION 2: Pricing (FOCAL SECTION) */}
        <View style={styles.pricingCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={20} color="#4f46e5" />
            <Text style={styles.sectionTitle}>Pricing</Text>
          </View>

          <Text style={styles.label}>Selling Price (Base) *</Text>
          <View style={[
            styles.priceInputWrap, 
            focusedField === 'price' && styles.priceInputWrapFocused,
            touchedFields.price && fieldErrors.price && styles.inputError
          ]}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              value={price}
              onChangeText={(val) => handleFieldChange('price', val, setPrice)}
              style={styles.priceInput}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              onFocus={() => setFocusedField('price')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {touchedFields.price && fieldErrors.price && (
            <Text style={styles.errorText}>{fieldErrors.price}</Text>
          )}

          <Text style={styles.label}>Price per unit (₹) *</Text>
          <Text style={styles.helperText}>Used for billing (e.g. ₹1, ₹2, ₹5). Cannot exceed Selling Price.</Text>
          <View style={[
            styles.priceInputWrap, 
            focusedField === 'pricePerUnit' && styles.priceInputWrapFocused,
            touchedFields.pricePerUnit && fieldErrors.pricePerUnit && styles.inputError
          ]}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              value={pricePerUnit}
              onChangeText={(val) => handleFieldChange('pricePerUnit', val, setPricePerUnit)}
              style={styles.priceInput}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="1.00"
              placeholderTextColor="#9ca3af"
              onFocus={() => setFocusedField('pricePerUnit')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {touchedFields.pricePerUnit && fieldErrors.pricePerUnit && (
            <Text style={styles.errorText}>{fieldErrors.pricePerUnit}</Text>
          )}

          <Text style={styles.label}>MRP</Text>
          <View style={[
            styles.priceInputWrap, 
            focusedField === 'mrp' && styles.priceInputWrapFocused,
            touchedFields.mrp && fieldErrors.mrp && styles.inputError
          ]}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              value={mrp}
              onChangeText={(val) => handleFieldChange('mrp', val, setMrp)}
              style={styles.priceInput}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              onFocus={() => setFocusedField('mrp')}
              onBlur={() => setFocusedField(null)}
            />
          </View>
          {touchedFields.mrp && fieldErrors.mrp && (
            <Text style={styles.errorText}>{fieldErrors.mrp}</Text>
          )}
        </View>

        {/* SECTION 3: Inventory */}
        <View style={styles.cardLight}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color="#64748b" />
            <Text style={styles.sectionTitle}>Inventory</Text>
          </View>

          <Text style={styles.label}>Stock Quantity *</Text>
          <TextInput
            value={stock}
            onChangeText={(val) => handleFieldChange('stock', val, setStock)}
            style={[
              styles.input, 
              focusedField === 'stock' && styles.inputFocused,
              touchedFields.stock && fieldErrors.stock && styles.inputError
            ]}
            keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric' })}
            placeholder="0"
            placeholderTextColor="#9ca3af"
            onFocus={() => setFocusedField('stock')}
            onBlur={() => setFocusedField(null)}
          />
          {touchedFields.stock && fieldErrors.stock && (
            <Text style={styles.errorText}>{fieldErrors.stock}</Text>
          )}

          <Text style={styles.label}>Weight (grams) *</Text>
          <TextInput
            value={weight}
            onChangeText={(val) => handleFieldChange('weight', val, setWeight)}
            style={[
              styles.input, 
              focusedField === 'weight' && styles.inputFocused,
              touchedFields.weight && fieldErrors.weight && styles.inputError
            ]}
            keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric' })}
            placeholder="0"
            placeholderTextColor="#9ca3af"
            onFocus={() => setFocusedField('weight')}
            onBlur={() => setFocusedField(null)}
          />
          {touchedFields.weight && fieldErrors.weight && (
            <Text style={styles.errorText}>{fieldErrors.weight}</Text>
          )}
        </View>

        {/* SECTION 4: Optional Details */}
        <View style={styles.cardLight}>
          <Text style={[styles.sectionTitle, styles.optionalTitle]}>Optional Details</Text>

          <Text style={styles.labelOptional}>SKU</Text>
          <TextInput 
            value={sku} 
            onChangeText={setSku} 
            style={[styles.input, focusedField === 'sku' && styles.inputFocused]} 
            placeholder="Auto-generated if empty"
            placeholderTextColor="#9ca3af"
            onFocus={() => setFocusedField('sku')}
            onBlur={() => setFocusedField(null)}
          />

          <Text style={styles.labelOptional}>Tags</Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            style={[styles.input, focusedField === 'tags' && styles.inputFocused]}
            placeholder="comma-separated tags"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            onFocus={() => setFocusedField('tags')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        {/* SECTION 5: Product Video */}
        <View style={styles.cardLight}>
          <View style={styles.sectionHeader}>
            <Ionicons name="videocam-outline" size={20} color="#64748b" />
            <Text style={styles.sectionTitle}>Product Video</Text>
            {video && (
              <Text style={styles.videoStatus}>Uploaded</Text>
            )}
          </View>

          {!video ? (
            <TouchableOpacity 
              style={styles.uploadArea} 
              onPress={pickVideo} 
              activeOpacity={0.7}
              disabled={uploadingVideo}
            >
              {uploadingVideo ? (
                <>
                  <ActivityIndicator size="large" color="#4f46e5" />
                  <Text style={styles.uploadText}>Uploading video...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={40} color="#9ca3af" />
                  <Text style={styles.uploadText}>Tap to upload product video</Text>
                  <Text style={styles.uploadSubtext}>MP4 format, max 20MB, max 30 seconds</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.videoPreview}>
              <Image source={{ uri: video.thumbnail }} style={styles.videoThumbnail} />
              <View style={styles.videoOverlay}>
                <Ionicons name="play-circle" size={48} color="#ffffff" />
                {video.duration && (
                  <Text style={styles.videoDuration}>{video.duration.toFixed(1)}s</Text>
                )}
              </View>
              <View style={styles.videoActions}>
                <TouchableOpacity 
                  style={styles.replaceVideoBtn}
                  onPress={pickVideo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={16} color="#4f46e5" />
                  <Text style={styles.replaceVideoText}>Replace Video</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.removeVideoBtn}
                  onPress={removeVideo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.removeVideoText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {videoError && (
            <View style={styles.videoErrorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.videoErrorText}>{videoError}</Text>
            </View>
          )}
        </View>

        {/* SECTION 6: Product Images */}
        <View style={styles.cardLight}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images-outline" size={20} color="#64748b" />
            <Text style={styles.sectionTitle}>Product Images</Text>
            {uploadedImages.length > 0 && (
              <Text style={styles.imageCount}>
                {uploadedImages.filter(img => img.status === 'uploaded').length} uploaded
              </Text>
            )}
          </View>

          {uploadedImages.length === 0 ? (
            <TouchableOpacity 
              style={styles.uploadArea} 
              onPress={pickImages} 
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={40} color="#9ca3af" />
              <Text style={styles.uploadText}>Tap to add product images</Text>
              <Text style={styles.uploadSubtext}>Up to 10 images</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.thumbGrid}>
                {uploadedImages.map((img, index) => (
                  <View key={index} style={styles.thumbContainer}>
                    {img.status === 'uploading' ? (
                      <View style={[styles.thumb, styles.thumbUploading]}>
                        <ActivityIndicator size="small" color="#4f46e5" />
                        <Text style={styles.uploadingText}>Uploading...</Text>
                      </View>
                    ) : img.status === 'failed' ? (
                      <View style={[styles.thumb, styles.thumbFailed]}>
                        <Ionicons name="alert-circle" size={32} color="#ef4444" />
                        <TouchableOpacity 
                          style={styles.retryBtn}
                          onPress={() => retryUpload(index)}
                        >
                          <Ionicons name="refresh" size={16} color="#ffffff" />
                          <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <Image source={{ uri: img.url }} style={styles.thumb} />
                        <Pressable 
                          style={styles.removeBtn}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#ef4444" />
                        </Pressable>
                      </>
                    )}
                  </View>
                ))}
              </View>
              <TouchableOpacity 
                style={[
                  styles.addMoreBtn,
                  uploadedImages.some(img => img.status === 'uploading') && styles.addMoreBtnDisabled
                ]}
                onPress={pickImages}
                activeOpacity={0.7}
                disabled={uploadedImages.some(img => img.status === 'uploading')}
              >
                <Ionicons name="add-circle-outline" size={20} color="#4f46e5" />
                <Text style={styles.addMoreText}>Add more images</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bottom padding for sticky button */}
        <View style={{ height: 80 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky CTA Buttons */}
      <View style={styles.stickyFooter}>
        {/* Secondary: Save Draft */}
        <TouchableOpacity
          style={[styles.secondaryBtn, (isCreating || isUpdating) && styles.secondaryBtnDisabled]}
          onPress={handleSaveDraft}
          disabled={isCreating || isUpdating || !name.trim()}
          activeOpacity={0.8}
        >
          <Ionicons name="save-outline" size={20} color="#4f46e5" />
          <Text style={styles.secondaryText}>Save Draft</Text>
        </TouchableOpacity>

        {/* Primary: Publish */}
        <TouchableOpacity
          style={[styles.submitBtn, (!canPublish || isPublishing || isCreating || isUpdating) && styles.submitBtnDisabled]}
          onPress={handlePublish}
          disabled={!canPublish || isPublishing || isCreating || isUpdating}
          activeOpacity={0.8}
        >
          {isPublishing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="rocket" size={22} color={Colors.white} />
              <Text style={styles.submitText}>Publish Product</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#f3f4f6',
  },
  scroll: { 
    flex: 1,
  },
  content: { 
    padding: 16, 
    paddingBottom: 24,
  },
  
  // Draft Badge & Save Status
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  draftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  draftText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  saveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  
  // Entry Moment
  introText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  
  // Card System (with contrast)
  cardLight: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pricingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  optionalTitle: {
    color: '#64748b',
    marginBottom: 14,
  },
  
  // Labels
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#475569',
    marginBottom: 8,
    marginTop: 12,
  },
  labelOptional: {
    fontSize: 14, 
    fontWeight: '500', 
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 12,
  },
  helperText: { 
    fontSize: 12, 
    color: '#94a3b8', 
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 16,
  },
  
  // Input System
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    color: '#0f172a',
    fontWeight: '500',
    fontSize: 15,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  inputPrimary: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  inputFocused: {
    borderColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  inputError: {
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  textArea: { 
    height: 110, 
    paddingTop: 14, 
    textAlignVertical: 'top',
  },
  
  // Pricing Inputs (Special)
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  priceInputWrapFocused: {
    borderColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4f46e5',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    height: 56,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // Category Pills (refined)
  categoryRow: { 
    paddingVertical: 6,
    paddingRight: 6,
    gap: 10,
  },
  catPill: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 999, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  catPillSelected: { 
    backgroundColor: '#4f46e5', 
    borderColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  catPillUnselected: { 
    backgroundColor: '#ffffff', 
    borderColor: '#e5e7eb',
  },
  catText: { 
    fontSize: 14, 
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  catTextSelected: { 
    color: '#ffffff',
    fontWeight: '600',
  },
  catTextUnselected: { 
    color: '#64748b',
  },
  
  // Image Upload Area (emphasized)
  uploadArea: {
    height: 160,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#c7d2fe',
    borderStyle: 'dashed',
    backgroundColor: '#f8faff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  uploadText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  uploadSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#94a3b8',
  },
  
  // Image Grid
  thumbGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginTop: 12,
    gap: 12,
  },
  thumbContainer: {
    position: 'relative',
  },
  thumb: { 
    width: 80, 
    height: 80, 
    borderRadius: 14, 
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  thumbUploading: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
    backgroundColor: '#f5f7ff',
    borderColor: '#c7d2fe',
  },
  thumbFailed: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  uploadingText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  imageCount: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginLeft: 'auto',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    backgroundColor: '#f5f7ff',
    marginTop: 12,
    gap: 8,
  },
  addMoreBtnDisabled: {
    opacity: 0.5,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  
  // Video Upload Styles
  videoStatus: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginLeft: 'auto',
  },
  videoPreview: {
    marginTop: 8,
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#f9fafb',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 14,
  },
  videoDuration: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  videoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  replaceVideoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    backgroundColor: '#f5f7ff',
    gap: 8,
  },
  replaceVideoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  removeVideoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  removeVideoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  videoErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  videoErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  
  // Sticky Footer
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flexDirection: 'row',
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnDisabled: {
    opacity: 0.5,
  },
  secondaryText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  submitBtn: {
    flexDirection: 'row',
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitBtnDisabled: { 
    opacity: 0.5,
    shadowOpacity: 0.15,
  },
  submitText: { 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 16,
    letterSpacing: 0.3,
  },
});

export default AdminCreateProductScreen;
