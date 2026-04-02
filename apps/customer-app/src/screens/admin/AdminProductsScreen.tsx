import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useDeleteAdminProductMutation, useGetAdminProductsQuery } from '../../api/adminApi';

type ProductLike = {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  mrp?: number;
  stock: number;
  weight?: number;
  images?: any[];
};

const CATEGORY_PILLS = [
  'All',
  'groceries',
  'vegetables',
  'fruits',
  'dairy',
  'meat',
  'beverages',
  'snacks',
  'household',
  'personal_care',
  'other',
] as const;

type CategoryFilter = (typeof CATEGORY_PILLS)[number];

const getImageUrl = (p: ProductLike): string | undefined => {
  const first = p.images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return (
    first?.url ||
    first?.thumb ||
    first?.small ||
    first?.medium ||
    first?.large ||
    first?.original ||
    first?.variants?.small ||
    first?.variants?.thumb ||
    first?.variants?.medium ||
    first?.variants?.original ||
    undefined
  );
};

const stockColor = (stock: number) => {
  if (stock <= 0) return { bg: '#fee2e2', text: Colors.error };
  if (stock <= 10) return { bg: '#ffedd5', text: Colors.primary };
  return { bg: '#dcfce7', text: '#16a34a' };
};

const AdminProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [q, setQ] = useState('');

  const { data, isFetching, error, refetch } = useGetAdminProductsQuery(undefined);
  const products: ProductLike[] = (data as any)?.products || [];

  const [deleteProduct, { isLoading: deleting }] = useDeleteAdminProductMutation();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== 'All' && String(p.category || '').toLowerCase() !== category) return false;
      if (!query) return true;
      return (
        String(p.name || '').toLowerCase().includes(query) ||
        String(p.description || '').toLowerCase().includes(query) ||
        String(p.category || '').toLowerCase().includes(query)
      );
    });
  }, [products, category, q]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProduct(id).unwrap();
        },
      },
    ]);
  };

  const rightAction = (
    <TouchableOpacity
      onPress={() => navigation.navigate('AdminCreateProduct')}
      style={styles.addBtn}
      activeOpacity={0.9}
    >
      <Text style={styles.addText}>Add +</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Products" onBack={() => navigation.goBack()} rightAction={rightAction} />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search products..."
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
            autoCapitalize="none"
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_PILLS as unknown as string[]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.pillsRow}
          renderItem={({ item }) => {
            const selected = item === category;
            return (
              <TouchableOpacity
                onPress={() => setCategory(item as CategoryFilter)}
                style={[styles.pill, selected ? styles.pillSelected : styles.pillUnselected, { marginRight: 8 }]}
                activeOpacity={0.9}
              >
                <Text style={[styles.pillText, selected ? styles.pillTextSelected : styles.pillTextUnselected]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load products</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item._id)}
            refreshControl={<RefreshControl refreshing={isFetching || deleting} onRefresh={refetch} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySub}>Try changing filters or search</Text>
              </View>
            }
            renderItem={({ item }) => {
              const img = getImageUrl(item);
              const stock = Number(item.stock || 0);
              const stockBadge = stockColor(stock);

              return (
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={[styles.imgWrap, { marginRight: 12 }]}>
                      {img ? <Image source={{ uri: img }} style={styles.img} /> : <View style={styles.imgPlaceholder} />}
                    </View>

                    <View style={styles.body}>
                      <Text style={styles.name} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <View style={styles.metaRow}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>{String(item.category || 'other')}</Text>
                        </View>
                        <Text style={styles.weightText}>{item.weight ? `${item.weight}g` : ''}</Text>
                      </View>

                      <View style={styles.priceRow}>
                        <Text style={[styles.price, { marginRight: 8 }]}>₹{item.price}</Text>
                        {item.mrp ? <Text style={styles.mrp}>₹{item.mrp}</Text> : null}
                      </View>

                      <View style={styles.stockRow}>
                        <View style={[styles.stockBadge, { backgroundColor: stockBadge.bg }]}> 
                          <Text style={[styles.stockText, { color: stockBadge.text }]}>{stock} units</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.actionsCol}>
                      <TouchableOpacity
                        style={[styles.iconBtn, styles.editBtn, { marginBottom: 10 }]}
                        onPress={() => navigation.navigate('AdminEditProduct', { product: item })}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.iconBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, styles.deleteBtn]}
                        onPress={() => confirmDelete(String(item._id), item.name)}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.iconBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  addBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: Colors.white, fontWeight: '900', fontSize: 12 },
  searchWrap: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  search: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  pillsRow: { paddingHorizontal: 12, paddingBottom: 10 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillUnselected: { backgroundColor: Colors.white, borderColor: Colors.border },
  pillText: { fontSize: 12, fontWeight: '900' },
  pillTextSelected: { color: Colors.white },
  pillTextUnselected: { color: Colors.textSecondary },
  listContent: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row' },
  imgWrap: { width: 60, height: 60, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.backgroundDark },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { flex: 1, backgroundColor: Colors.backgroundDark },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.backgroundDark },
  categoryText: { fontSize: 11, fontWeight: '900', color: Colors.textSecondary },
  weightText: { fontSize: 11, color: Colors.textMuted, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  price: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  mrp: { fontSize: 12, fontWeight: '800', color: Colors.textMuted, textDecorationLine: 'line-through' },
  stockRow: { marginTop: 8 },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  stockText: { fontSize: 11, fontWeight: '900' },
  actionsCol: { justifyContent: 'flex-start', alignItems: 'flex-end', marginLeft: 12 },
  iconBtn: { height: 36, width: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editBtn: { backgroundColor: Colors.background },
  deleteBtn: { backgroundColor: '#fee2e2' },
  iconBtnText: { fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  emptySub: { marginTop: 6, fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  errorText: { fontSize: 14, fontWeight: '900', color: Colors.error },
  retryBtn: {
    marginTop: 12,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: Colors.white, fontWeight: '900' },
});

export default AdminProductsScreen;
