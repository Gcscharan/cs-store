import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useUpdateAdminProductMutation, usePublishAdminProductMutation } from '../../api/adminApi';
import { getBackendCategories, getProductCategories } from '../../constants/categoriesConfig';
import { BASE_URL } from '../../api/baseApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteParams = { product: any };

type ImageEntry =
  | { kind: 'existing'; url: string; removed: boolean }
  | { kind: 'uploading'; localUri: string; abort: AbortController }
  | { kind: 'uploaded'; url: string };

type VideoEntry =
  | { kind: 'existing'; url: string; thumbnail?: string; duration?: number; removed: boolean }
  | { kind: 'uploading'; localUri: string; abort: AbortController }
  | { kind: 'uploaded'; url: string; thumbnail?: string; duration?: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = getProductCategories().map(c => c.label);
const MAX_IMAGES = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const extractImageUrl = (img: any): string | null => {
  if (!img) return null;
  if (typeof img === 'string') return img;
  return (
    img.url ||
    img.variants?.original ||
    img.variants?.large ||
    img.variants?.medium ||
    img.variants?.thumb ||
    null
  );
};

// ─── Section Container ────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    {children}
  </View>
);

// ─── Field ────────────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, helper, required, children }) => (
  <View style={s.field}>
    <View style={s.fieldLabelRow}>
      <Text style={s.fieldLabel}>{label}{required ? ' *' : ''}</Text>
      {helper ? <Text style={s.fieldHelper}>{helper}</Text> : null}
    </View>
    {children}
  </View>
);

// ─── Image Grid ───────────────────────────────────────────────────────────────

const ImageGrid: React.FC<{
  images: ImageEntry[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  isUploading: boolean;
  atLimit: boolean;
}> = ({ images, onRemove, onAdd, isUploading, atLimit }) => {
  const visible = images.filter(img => !(img.kind === 'existing' && img.removed));

  return (
    <View style={ig.grid}>
      {visible.map((img, idx) => {
        const realIdx = images.indexOf(img);
        const uri =
          img.kind === 'existing' ? img.url :
          img.kind === 'uploaded' ? img.url :
          img.kind === 'uploading' ? img.localUri : '';

        return (
          <View key={`${img.kind}-${idx}`} style={ig.cell}>
            {uri ? (
              <Image source={{ uri }} style={ig.img} resizeMode="cover" />
            ) : (
              <View style={[ig.img, ig.placeholder]}>
                <Ionicons name="image-outline" size={24} color="#d1d5db" />
              </View>
            )}

            {/* Uploading overlay */}
            {img.kind === 'uploading' && (
              <View style={ig.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}

            {/* Remove button */}
            {img.kind !== 'uploading' && (
              <Pressable
                style={ig.removeBtn}
                onPress={() => {
                  Alert.alert('Remove Image', 'Remove this image?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => onRemove(realIdx) },
                  ]);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </Pressable>
            )}
          </View>
        );
      })}

      {/* Add button */}
      {!atLimit && (
        <Pressable
          style={[ig.cell, ig.addCell, isUploading && ig.addCellDisabled]}
          onPress={onAdd}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="add" size={28} color={Colors.primary} />
              <Text style={ig.addText}>Add</Text>
            </>
          )}
        </Pressable>
      )}

      {atLimit && (
        <View style={ig.limitNote}>
          <Ionicons name="information-circle-outline" size={14} color="#9ca3af" />
          <Text style={ig.limitText}>Max {MAX_IMAGES} images</Text>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AdminEditProductScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { product } = (route.params || {}) as RouteParams;

  const [updateProduct, { isLoading: isSaving }] = useUpdateAdminProductMutation();
  const [publishProduct, { isLoading: isPublishing }] = usePublishAdminProductMutation();

  const isDraft = product?.status === 'draft' || !product?.status;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(String(product?.name || ''));
  const [description, setDescription] = useState(String(product?.description || ''));
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [pricePerUnit, setPricePerUnit] = useState(
    String(product?.pricePerUnit ?? (product?.price ?? ''))
  );
  const [mrp, setMrp] = useState(String(product?.mrp ?? ''));
  const [stock, setStock] = useState(String(product?.stock ?? ''));
  const [weight, setWeight] = useState(String(product?.weight ?? ''));
  const [tags, setTags] = useState(String(product?.tags || ''));
  const [sku, setSku] = useState(String(product?.sku || ''));

  const initialCategory = product?.category
    ? CATEGORY_OPTIONS.find(opt => {
        const bc = getBackendCategories(opt);
        return bc.includes(String(product.category).toLowerCase());
      }) || CATEGORY_OPTIONS[0]
    : CATEGORY_OPTIONS[0];
  const [category, setCategory] = useState<string>(initialCategory);

  // ── Image state ─────────────────────────────────────────────────────────────
  const [images, setImages] = useState<ImageEntry[]>(() => {
    const raw: any[] = product?.images || [];
    return raw
      .map(img => {
        const url = extractImageUrl(img);
        return url ? ({ kind: 'existing', url, removed: false } as ImageEntry) : null;
      })
      .filter(Boolean) as ImageEntry[];
  });

  // ── Video state ─────────────────────────────────────────────────────────────
  const [video, setVideo] = useState<VideoEntry | null>(() => {
    if (product?.video?.url) {
      return {
        kind: 'existing',
        url: product.video.url,
        thumbnail: product.video.thumbnail,
        duration: product.video.duration,
        removed: false,
      };
    }
    return null;
  });

  const isUploading = images.some(img => img.kind === 'uploading') || (video?.kind === 'uploading');
  const activeImages = images.filter(img => !(img.kind === 'existing' && img.removed));
  const atLimit = activeImages.length >= MAX_IMAGES;
  const hasVideo = video && !(video.kind === 'existing' && video.removed);

  // ── Validation ──────────────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      description.trim().length > 0 &&
      price.trim().length > 0 &&
      pricePerUnit.trim().length > 0 &&
      stock.trim().length > 0 &&
      weight.trim().length > 0 &&
      !isUploading
    );
  }, [name, description, price, pricePerUnit, stock, weight, isUploading]);

  // ── Image upload ─────────────────────────────────────────────────────────────
  const pickAndUpload = useCallback(async () => {
    if (atLimit) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - activeImages.length,
    });

    if (result.canceled || !result.assets?.length) return;

    const toUpload = result.assets.slice(0, MAX_IMAGES - activeImages.length);

    // Add uploading placeholders
    const abortController = new AbortController();
    const placeholders: ImageEntry[] = toUpload.map(asset => ({
      kind: 'uploading',
      localUri: asset.uri,
      abort: abortController,
    }));

    setImages(prev => [...prev, ...placeholders]);

    try {
      const formData = new FormData();
      toUpload.forEach(asset => {
        const ext = asset.uri.split('.').pop() || 'jpg';
        formData.append('images', {
          uri: asset.uri,
          name: `image-${Date.now()}.${ext}`,
          type: `image/${ext}`,
        } as any);
      });

      const { storage } = await import('../../utils/storage');
      const token = await storage.getItem('accessToken');

      const response = await fetch(`${BASE_URL}/uploads/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const data = await response.json();
      const uploadedUrls: string[] = data.images.map((img: any) => img.url);

      setImages(prev => {
        // Remove placeholders, add uploaded
        const withoutPlaceholders = prev.filter(
          img => !(img.kind === 'uploading' && placeholders.some(p => p.localUri === img.localUri))
        );
        const newUploaded: ImageEntry[] = uploadedUrls.map(url => ({
          kind: 'uploaded',
          url,
        }));
        return [...withoutPlaceholders, ...newUploaded];
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Remove failed placeholders
      setImages(prev =>
        prev.filter(
          img => !(img.kind === 'uploading' && placeholders.some(p => p.localUri === img.localUri))
        )
      );
      Alert.alert('Upload failed', 'Could not upload images. Please try again.');
    }
  }, [atLimit, activeImages.length]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => {
      const img = prev[index];
      if (!img) return prev;
      if (img.kind === 'existing') {
        return prev.map((item, i) =>
          i === index ? { ...item, removed: true } : item
        ) as ImageEntry[];
      }
      if (img.kind === 'uploading') {
        img.abort.abort();
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ── Video upload ─────────────────────────────────────────────────────────────
  const pickAndUploadVideo = useCallback(async () => {
    if (hasVideo) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.8,
      videoMaxDuration: 60, // 60 seconds max
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const abortController = new AbortController();

    setVideo({
      kind: 'uploading',
      localUri: asset.uri,
      abort: abortController,
    });

    try {
      const formData = new FormData();
      const ext = asset.uri.split('.').pop() || 'mp4';
      formData.append('video', {
        uri: asset.uri,
        name: `video-${Date.now()}.${ext}`,
        type: `video/${ext}`,
      } as any);

      const { storage } = await import('../../utils/storage');
      const token = await storage.getItem('accessToken');

      const response = await fetch(`${BASE_URL}/uploads/video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const data = await response.json();

      setVideo({
        kind: 'uploaded',
        url: data.video.url,
        thumbnail: data.video.thumbnail,
        duration: data.video.duration,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setVideo(null);
      Alert.alert('Upload failed', 'Could not upload video. Please try again.');
    }
  }, [hasVideo]);

  const removeVideo = useCallback(() => {
    Alert.alert('Remove Video', 'Remove this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (video) {
            if (video.kind === 'existing') {
              setVideo({ ...video, removed: true });
            } else if (video.kind === 'uploading') {
              video.abort.abort();
              setVideo(null);
            } else {
              setVideo(null);
            }
          }
        },
      },
    ]);
  }, [video]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    if (!product?._id || !canSubmit) return;

    const backendCategory = getBackendCategories(category)[0];
    if (!backendCategory) {
      Alert.alert('Invalid category', `"${category}" has no backend mapping.`);
      return;
    }

    const finalImages = images
      .filter(img => !(img.kind === 'existing' && img.removed) && img.kind !== 'uploading')
      .map(img => (img as any).url as string)
      .filter(Boolean);

    const finalVideo = video && !(video.kind === 'existing' && video.removed) && video.kind !== 'uploading'
      ? {
          url: video.url,
          thumbnail: video.thumbnail,
          duration: video.duration,
        }
      : undefined;

    try {
      await updateProduct({
        id: String(product._id),
        name: name.trim(),
        description: description.trim(),
        category: backendCategory,
        price: Number(price),
        pricePerUnit: Number(pricePerUnit),
        stock: Number(stock),
        mrp: mrp.trim() ? Number(mrp) : undefined,
        weight: Number(weight),
        tags: tags.trim() || undefined,
        sku: sku.trim() || undefined,
        images: finalImages,
        video: finalVideo,
      }).unwrap();

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Update failed', err?.data?.message || 'Please try again.');
    }
  };

  const onPublish = async () => {
    if (!product?._id) return;

    // Save current changes first, then publish
    const backendCategory = getBackendCategories(category)[0];
    const finalImages = images
      .filter(img => !(img.kind === 'existing' && img.removed) && img.kind !== 'uploading')
      .map(img => (img as any).url as string)
      .filter(Boolean);

    const finalVideo = video && !(video.kind === 'existing' && video.removed) && video.kind !== 'uploading'
      ? {
          url: video.url,
          thumbnail: video.thumbnail,
          duration: video.duration,
        }
      : undefined;

    try {
      // Save latest changes first
      await updateProduct({
        id: String(product._id),
        name: name.trim(),
        description: description.trim(),
        category: backendCategory,
        price: price.trim() ? Number(price) : undefined,
        pricePerUnit: pricePerUnit.trim() ? Number(pricePerUnit) : undefined,
        stock: stock.trim() ? Number(stock) : undefined,
        mrp: mrp.trim() ? Number(mrp) : undefined,
        weight: weight.trim() ? Number(weight) : undefined,
        tags: tags.trim() || undefined,
        sku: sku.trim() || undefined,
        images: finalImages,
        video: finalVideo,
      }).unwrap();

      // Then publish
      await publishProduct(String(product._id)).unwrap();
      Alert.alert('Published!', 'Product is now live in the store.');
      navigation.goBack();
    } catch (err: any) {
      const errors = err?.data?.errors;
      if (errors) {
        const msg = Object.entries(errors).map(([f, m]) => `• ${m}`).join('\n');
        Alert.alert('Cannot publish', msg);
      } else {
        Alert.alert('Failed', err?.data?.message || 'Please try again.');
      }
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <AdminHeader title="Edit Product" onBack={() => navigation.goBack()} />

      {/* Status badge */}
      <View style={s.statusBar}>
        <View style={[s.statusBadge, isDraft ? s.statusBadgeDraft : s.statusBadgePublished]}>
          <Ionicons
            name={isDraft ? 'document-outline' : 'checkmark-circle-outline'}
            size={12}
            color={isDraft ? '#d97706' : '#16a34a'}
          />
          <Text style={[s.statusText, isDraft ? s.statusTextDraft : s.statusTextPublished]}>
            {isDraft ? 'DRAFT' : 'PUBLISHED'}
          </Text>
        </View>
        {isDraft && (
          <Text style={s.statusHint}>Fill all fields and add an image to publish</Text>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Images ── */}
        <Section title="Product Images">
          <Text style={s.sectionHelper}>
            {activeImages.length}/{MAX_IMAGES} images · tap ❌ to remove
          </Text>
          <ImageGrid
            images={images}
            onRemove={removeImage}
            onAdd={pickAndUpload}
            isUploading={isUploading}
            atLimit={atLimit}
          />
        </Section>

        {/* ── Video ── */}
        <Section title="Product Video">
          <Text style={s.sectionHelper}>
            Optional · Max 60 seconds · tap ❌ to remove
          </Text>
          {hasVideo && video ? (
            <View style={vg.videoContainer}>
              {video.kind === 'uploading' ? (
                <View style={vg.uploadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={vg.uploadingText}>Uploading video...</Text>
                </View>
              ) : (
                <>
                  {video.thumbnail ? (
                    <Image source={{ uri: video.thumbnail }} style={vg.thumbnail} resizeMode="cover" />
                  ) : (
                    <View style={[vg.thumbnail, vg.placeholderBox]}>
                      <Ionicons name="videocam-outline" size={40} color="#d1d5db" />
                    </View>
                  )}
                  <View style={vg.videoInfo}>
                    <Ionicons name="videocam" size={16} color={Colors.primary} />
                    <Text style={vg.videoText}>
                      Video {video.duration ? `(${video.duration.toFixed(1)}s)` : ''}
                    </Text>
                  </View>
                  <Pressable style={vg.removeBtn} onPress={removeVideo} hitSlop={8}>
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <Pressable
              style={[vg.addVideoBtn, isUploading && vg.addVideoBtnDisabled]}
              onPress={pickAndUploadVideo}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="videocam-outline" size={28} color={Colors.primary} />
                  <Text style={vg.addVideoText}>Add Video</Text>
                </>
              )}
            </Pressable>
          )}
        </Section>

        {/* ── Basic Info ── */}
        <Section title="Basic Information">
          <Field label="Product Name" required>
            <TextInput
              value={name}
              onChangeText={setName}
              style={s.input}
              placeholder="Enter product name"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>

          <Field label="Category" required>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pillsRow}
            >
              {CATEGORY_OPTIONS.map(c => {
                const selected = c === category;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[s.pill, selected ? s.pillSelected : s.pillUnselected]}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.pillText, selected ? s.pillTextSelected : s.pillTextUnselected]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Field>

          <Field label="Description" required>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[s.input, s.textArea]}
              placeholder="Enter product description"
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </Field>

          <Field label="Tags" helper="comma-separated">
            <TextInput
              value={tags}
              onChangeText={setTags}
              style={s.input}
              placeholder="e.g. organic, fresh, local"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </Field>

          <Field label="SKU" helper="leave blank to keep existing">
            <TextInput
              value={sku}
              onChangeText={setSku}
              style={s.input}
              placeholder="Auto-generated if empty"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </Field>
        </Section>

        {/* ── Pricing & Inventory ── */}
        <Section title="Pricing & Inventory">
          <Field label="Selling Price (₹)" required>
            <TextInput
              value={price}
              onChangeText={setPrice}
              style={s.input}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>

          <Field
            label="Price per Unit (₹)"
            helper="Used for billing — cannot exceed selling price"
            required
          >
            <TextInput
              value={pricePerUnit}
              onChangeText={setPricePerUnit}
              style={s.input}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="1.00"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>

          <Field label="MRP (₹)" helper="optional">
            <TextInput
              value={mrp}
              onChangeText={setMrp}
              style={s.input}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>

          <Field label="Stock Quantity" required>
            <TextInput
              value={stock}
              onChangeText={setStock}
              style={s.input}
              keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric' })}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>

          <Field label="Weight (grams)" required>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              style={s.input}
              keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
          </Field>
        </Section>

        {/* ── Submit ── */}
        {isDraft ? (
          <View style={s.footerRow}>
            <TouchableOpacity
              style={[s.saveBtn, (!canSubmit || isSaving || isPublishing) && s.btnDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit || isSaving || isPublishing}
              activeOpacity={0.9}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={Colors.primary} />
                  <Text style={s.saveBtnText}>Save Draft</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.publishBtn, (isSaving || isPublishing || isUploading) && s.btnDisabled]}
              onPress={onPublish}
              disabled={isSaving || isPublishing || isUploading}
              activeOpacity={0.9}
            >
              {isPublishing ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color={Colors.white} />
                  <Text style={s.publishBtnText}>Publish</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.submitBtn, (!canSubmit || isSaving) && s.btnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit || isSaving}
            activeOpacity={0.9}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.submitText}>Update Product</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  // Section
  section: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  sectionHelper: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 14,
  },

  // Field
  field: { marginTop: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  fieldHelper: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  // Input
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },

  // Category pills
  pillsRow: { paddingVertical: 4, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillUnselected: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  pillTextSelected: { color: Colors.white },
  pillTextUnselected: { color: Colors.textSecondary },

  // Submit
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  // Status bar
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  statusBadgeDraft: { backgroundColor: '#fef3c7' },
  statusBadgePublished: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  statusTextDraft: { color: '#d97706' },
  statusTextPublished: { color: '#16a34a' },
  statusHint: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Footer row (draft: two buttons)
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8 },
  saveBtn: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  saveBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
  publishBtn: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: '#16a34a',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#16a34a', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  publishBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
});

// Image grid styles
const ig = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  cell: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  img: { width: '100%', height: '100%', borderRadius: 12 },
  placeholder: { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCell: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addCellDisabled: { opacity: 0.5 },
  addText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  limitNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    width: '100%',
  },
  limitText: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
});

// Video grid styles
const vg = StyleSheet.create({
  videoContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f3f4f6',
    marginTop: 4,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  placeholderBox: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadingText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  videoInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  videoText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVideoBtn: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  addVideoBtnDisabled: {
    opacity: 0.5,
  },
  addVideoText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default AdminEditProductScreen;
