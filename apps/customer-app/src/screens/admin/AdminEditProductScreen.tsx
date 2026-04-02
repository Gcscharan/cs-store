import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useUpdateAdminProductMutation } from '../../api/adminApi';

type RouteParams = { product: any };

const CATEGORY_OPTIONS = [
  'groceries',
  'vegetables',
  'fruits',
  'dairy',
  'meat',
  'beverages',
  'snacks',
  'household',
  'personal_care',
  'medicines',
  'electronics',
  'clothing',
  'other',
] as const;

type Category = (typeof CATEGORY_OPTIONS)[number];

const AdminEditProductScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { product } = (route.params || {}) as RouteParams;

  const [updateProduct, { isLoading }] = useUpdateAdminProductMutation();

  const [name, setName] = useState(String(product?.name || ''));
  const [category, setCategory] = useState<Category>((product?.category as Category) || 'groceries');
  const [sku, setSku] = useState(String(product?.sku || ''));
  const [tags, setTags] = useState(String(product?.tags || ''));
  const [description, setDescription] = useState(String(product?.description || ''));
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [mrp, setMrp] = useState(String(product?.mrp ?? ''));
  const [stock, setStock] = useState(String(product?.stock ?? ''));
  const [weight, setWeight] = useState(String(product?.weight ?? ''));

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      description.trim().length > 0 &&
      String(category).length > 0 &&
      price.trim().length > 0 &&
      stock.trim().length > 0 &&
      weight.trim().length > 0
    );
  }, [name, description, category, price, stock, weight]);

  const onSubmit = async () => {
    if (!product?._id) {
      Alert.alert('Missing product', 'No product was provided to edit.');
      return;
    }

    if (!canSubmit) {
      Alert.alert('Missing fields', 'Please fill all required fields.');
      return;
    }

    await updateProduct({
      id: String(product._id),
      name: name.trim(),
      description: description.trim(),
      category: String(category),
      price: Number(price),
      stock: Number(stock),
      mrp: mrp.trim() === '' ? undefined : Number(mrp),
      weight: Number(weight),
      tags: tags.trim(),
      sku: sku.trim(),
    }).unwrap();

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Edit Product" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Product Name *</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Enter product name" />

          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {CATEGORY_OPTIONS.map((c) => {
              const selected = c === category;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.catPill, selected ? styles.catPillSelected : styles.catPillUnselected, { marginRight: 8 }]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.catText, selected ? styles.catTextSelected : styles.catTextUnselected]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>SKU</Text>
          <TextInput value={sku} onChangeText={setSku} style={styles.input} placeholder="Auto-generated if empty" />

          <Text style={styles.label}>Tags</Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            style={styles.input}
            placeholder="comma-separated tags"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Description *</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.textArea]}
            placeholder="Enter product description"
            multiline
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pricing & Inventory</Text>

          <Text style={styles.label}>Selling Price *</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            style={styles.input}
            keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
            placeholder="0.00"
          />

          <Text style={styles.label}>MRP</Text>
          <TextInput
            value={mrp}
            onChangeText={setMrp}
            style={styles.input}
            keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' })}
            placeholder="0.00"
          />

          <Text style={styles.label}>Stock Quantity *</Text>
          <TextInput
            value={stock}
            onChangeText={setStock}
            style={styles.input}
            keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric' })}
            placeholder="0"
          />

          <Text style={styles.label}>Weight (grams) *</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            style={styles.input}
            keyboardType={Platform.select({ ios: 'number-pad', android: 'numeric' })}
            placeholder="0"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || isLoading) && styles.submitBtnDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit || isLoading}
          activeOpacity={0.9}
        >
          {isLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Update Product</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary, marginBottom: 10 },
  label: { marginTop: 10, fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  input: {
    marginTop: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  textArea: { height: 110, paddingTop: 12, textAlignVertical: 'top' },
  categoryRow: { paddingVertical: 6 },
  catPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  catPillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillUnselected: { backgroundColor: Colors.white, borderColor: Colors.border },
  catText: { fontSize: 12, fontWeight: '900' },
  catTextSelected: { color: Colors.white },
  catTextUnselected: { color: Colors.textSecondary },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: Colors.white, fontWeight: '900', fontSize: 14 },
});

export default AdminEditProductScreen;
