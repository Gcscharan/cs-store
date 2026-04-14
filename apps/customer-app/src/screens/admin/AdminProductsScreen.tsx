import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useDeleteAdminProductMutation, useGetAdminProductsQuery } from '../../api/adminApi';
import { MASTER_CATEGORIES, getBackendCategories } from '../../constants/categoriesConfig';
import Ionicons from '@expo/vector-icons/Ionicons';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  status?: 'draft' | 'published';
};

type StatusTab = 'all' | 'draft' | 'published';

const CATEGORY_PILLS = ['All', ...MASTER_CATEGORIES.map(c => c.label)] as const;
type CategoryFilter = (typeof CATEGORY_PILLS)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getImageUrl = (p: ProductLike): string | undefined => {
  const first = p.images?.[0];
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  return first?.url || first?.variants?.original || first?.variants?.medium || first?.variants?.thumb || undefined;
};

const stockColor = (stock: number) => {
  if (stock <= 0) return { bg: '#fee2e2', text: Colors.error };
  if (stock <= 10) return { bg: '#ffedd5', text: Colors.primary };
  return { bg: '#dcfce7', text: '#16a34a' };
};

const getDraftHint = (p: ProductLike): string => {
  if (!p.price) return 'Missing price';
  if (!p.description) return 'Missing description';
  if (!p.images?.length) return 'No images added';
  if (!p.stock) return 'Stock not set';
  return 'Not published yet';
};

// ─── Status Tabs ─────────────────────────────────────────────────────────────

const StatusTabs: React.FC<{
  active: StatusTab;
  counts: { all: number; draft: number; published: number };
  onChange: (t: StatusTab) => void;
}> = ({ active, counts, onChange }) => {
  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'draft',     label: 'Drafts' },
    { key: 'published', label: 'Published' },
  ];
  return (
    <View style={ts.bar}>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        const count = counts[tab.key];
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={ts.tabWrap}>
            <View style={[ts.pill, isActive && ts.pillActive]}>
              <Text style={[ts.label, isActive && ts.labelActive]}>{tab.label}</Text>
              {count > 0 && (
                <View style={[ts.badge, isActive ? ts.badgeActive : ts.badgeInactive]}>
                  <Text style={[ts.badgeText, isActive && ts.badgeTextActive]}>{count}</Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status?: 'draft' | 'published' }> = ({ status }) => {
  if (status === 'published') {
    return (
      <View style={sb.live}>
        <View style={sb.dot} />
        <Text style={sb.liveText}>LIVE</Text>
      </View>
    );
  }
  return (
    <View style={sb.draft}>
      <Text style={sb.draftIcon}>📝</Text>
      <Text style={sb.draftText}>DRAFT</Text>
    </View>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ tab: StatusTab; hasSearch: boolean }> = ({ tab, hasSearch }) => {
  if (hasSearch) return (
    <View style={s.emptyWrap}>
      <Ionicons name="search-outline" size={48} color="#d1d5db" />
      <Text style={s.emptyTitle}>No results found</Text>
      <Text style={s.emptySub}>Try a different search term</Text>
    </View>
  );
  if (tab === 'draft') return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>📝</Text>
      <Text style={s.emptyTitle}>No drafts yet</Text>
      <Text style={s.emptySub}>Start creating a product to save it as draft</Text>
    </View>
  );
  if (tab === 'published') return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>🚀</Text>
      <Text style={s.emptyTitle}>No published products</Text>
      <Text style={s.emptySub}>Publish a draft to make it visible to customers</Text>
    </View>
  );
  return (
    <View style={s.emptyWrap}>
      <Ionicons name="cube-outline" size={64} color="#d1d5db" />
      <Text style={s.emptyTitle}>No products found</Text>
      <Text style={s.emptySub}>Tap + to add your first product</Text>
    </View>
  );
};

// ─── Animated Card ────────────────────────────────────────────────────────────

const AnimatedCard: React.FC<{ onPress: () => void; isDraft: boolean; children: React.ReactNode }> = ({
  onPress, isDraft, children,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.card, isDraft && s.cardDraft, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AdminProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [q, setQ] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const { data, isFetching, error, refetch } = useGetAdminProductsQuery(undefined);
  const allProducts: ProductLike[] = (data as any)?.products || [];
  const [deleteProduct, { isLoading: deleting }] = useDeleteAdminProductMutation();

  const counts = useMemo(() => ({
    all:       allProducts.length,
    draft:     allProducts.filter(p => p.status !== 'published').length,
    published: allProducts.filter(p => p.status === 'published').length,
  }), [allProducts]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allProducts.filter(p => {
      if (statusTab === 'draft' && p.status === 'published') return false;
      if (statusTab === 'published' && p.status !== 'published') return false;
      if (category !== 'All') {
        const cat = MASTER_CATEGORIES.find(c => c.label === category);
        if (cat) {
          if (cat.type === 'price') {
            if (Number(p.price) !== Number(cat.value)) return false;
          } else {
            if (!getBackendCategories(category).includes(String(p.category || '').toLowerCase())) return false;
          }
        }
      }
      if (!query) return true;
      return (
        String(p.name || '').toLowerCase().includes(query) ||
        String(p.description || '').toLowerCase().includes(query) ||
        String(p.category || '').toLowerCase().includes(query)
      );
    });
  }, [allProducts, statusTab, category, q]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete Product', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProduct(id).unwrap() },
    ]);
  };

  const ListHeader = () => (
    <View>
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
          <TextInput
            value={q} onChangeText={setQ}
            placeholder="Search products..." placeholderTextColor="#9ca3af"
            style={s.searchInput} autoCapitalize="none"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
        {(CATEGORY_PILLS as unknown as string[]).map(item => {
          const sel = item === category;
          return (
            <Pressable
              key={item}
              onPress={() => setCategory(item as CategoryFilter)}
              style={({ pressed }) => [s.pill, sel ? s.pillSel : s.pillUnsel, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[s.pillText, sel ? s.pillTextSel : s.pillTextUnsel]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={s.root}>
      <AdminHeader
        title="Products"
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => navigation.navigate('AdminCreateProduct')} style={s.addBtn}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addText}>Add</Text>
          </Pressable>
        }
      />

      <StatusTabs active={statusTab} counts={counts} onChange={setStatusTab} />

      {error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={s.errorText}>Failed to load products</Text>
          <Pressable style={s.retryBtn} onPress={refetch}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={item => String(item._id)}
          refreshControl={<RefreshControl refreshing={isFetching || deleting} onRefresh={refetch} />}
          contentContainerStyle={s.list}
          style={{ opacity: fadeAnim }}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={<EmptyState tab={statusTab} hasSearch={q.trim().length > 0} />}
          renderItem={({ item }) => {
            const img = getImageUrl(item);
            const stock = Number(item.stock || 0);
            const sc = stockColor(stock);
            const isDraft = item.status !== 'published';

            return (
              <AnimatedCard
                isDraft={isDraft}
                onPress={() => navigation.navigate('AdminEditProduct', { product: item })}
              >
                {/* Status badge — absolute top-right */}
                <View style={s.badgeWrap}>
                  <StatusBadge status={item.status} />
                </View>

                <View style={s.row}>
                  {/* Thumbnail */}
                  <View style={[s.thumb, isDraft && s.thumbDraft]}>
                    {img ? (
                      <Image source={{ uri: img }} style={s.thumbImg} />
                    ) : (
                      <View style={s.thumbEmpty}>
                        <Ionicons name="image-outline" size={22} color={isDraft ? '#c4c4c4' : '#9ca3af'} />
                      </View>
                    )}
                  </View>

                  {/* Body */}
                  <View style={s.body}>
                    <Text style={[s.name, isDraft && s.nameDraft]} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {/* Incomplete hint for drafts */}
                    {isDraft && (
                      <View style={s.hintRow}>
                        <Ionicons name="alert-circle-outline" size={11} color="#f59e0b" />
                        <Text style={s.hintText}>{getDraftHint(item)}</Text>
                      </View>
                    )}

                    <View style={s.metaRow}>
                      {item.category ? (
                        <View style={s.catChip}>
                          <Text style={s.catText}>{item.category}</Text>
                        </View>
                      ) : null}
                      {item.weight ? <Text style={s.weightText}>{item.weight}g</Text> : null}
                    </View>

                    <View style={[s.stockBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.stockText, { color: sc.text }]}>{stock} units</Text>
                    </View>
                  </View>

                  {/* Right: price + actions */}
                  <View style={s.right}>
                    <View style={s.priceWrap}>
                      {item.price ? (
                        <>
                          <Text style={[s.price, isDraft && s.priceDraft]}>₹{item.price}</Text>
                          {item.mrp && item.mrp > item.price ? (
                            <Text style={s.mrp}>₹{item.mrp}</Text>
                          ) : null}
                        </>
                      ) : (
                        <Text style={s.noPrice}>—</Text>
                      )}
                    </View>

                    {/* Actions: edit + delete only */}
                    <View style={s.actions}>
                      <Pressable
                        style={s.actionBtn}
                        onPress={() => navigation.navigate('AdminEditProduct', { product: item })}
                        hitSlop={4}
                      >
                        <Ionicons name="create-outline" size={17} color="#6366f1" />
                      </Pressable>
                      <Pressable
                        style={[s.actionBtn, s.actionBtnDel]}
                        onPress={() => confirmDelete(String(item._id), item.name)}
                        hitSlop={4}
                      >
                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Draft CTA */}
                {isDraft && (
                  <View style={s.draftCta}>
                    <Ionicons name="arrow-forward-circle-outline" size={13} color="#6366f1" />
                    <Text style={s.draftCtaText}>Continue editing</Text>
                  </View>
                )}
              </AnimatedCard>
            );
          }}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const ts = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  tabWrap: { flex: 1 },
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 7, paddingHorizontal: 10, borderRadius: 999, gap: 5,
  },
  pillActive: { backgroundColor: '#eef2ff' },
  label: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  labelActive: { color: '#4f46e5', fontWeight: '800' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeActive: { backgroundColor: '#4f46e5' },
  badgeInactive: { backgroundColor: '#e5e7eb' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#9ca3af' },
  badgeTextActive: { color: '#fff' },
});

const sb = StyleSheet.create({
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5 },
  draft: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  draftIcon: { fontSize: 10 },
  draftText: { fontSize: 10, fontWeight: '700', color: '#c2410c', letterSpacing: 0.5 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', height: 36,
    paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#4f46e5', gap: 5,
    shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  addText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', height: 46,
    borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff', paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },

  pillsRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  pillSel: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pillUnsel: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextSel: { color: '#fff' },
  pillTextUnsel: { color: '#64748b' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardDraft: {
    backgroundColor: '#f9f9f9', opacity: 0.93,
    borderColor: '#d1d5db', borderStyle: 'dashed',
    shadowOpacity: 0.02,
  },
  badgeWrap: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },

  // Thumbnail
  thumb: {
    width: 68, height: 68, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', marginRight: 12,
  },
  thumbDraft: { opacity: 0.7 },
  thumbImg: { width: '100%', height: '100%' },
  thumbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Body
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4, paddingRight: 56, lineHeight: 19 },
  nameDraft: { color: '#6b7280' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  hintText: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#eef2ff' },
  catText: { fontSize: 10, fontWeight: '700', color: '#6366f1' },
  weightText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  stockText: { fontSize: 10, fontWeight: '800' },

  // Right
  right: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 10 },
  priceWrap: { alignItems: 'flex-end', marginBottom: 8 },
  price: { fontSize: 16, fontWeight: '800', color: '#4f46e5' },
  priceDraft: { color: '#9ca3af' },
  mrp: { fontSize: 12, color: '#9ca3af', textDecorationLine: 'line-through' },
  noPrice: { fontSize: 13, color: '#d1d5db', fontWeight: '600' },

  // Actions — edit + delete only, 40px touch targets
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f5f5ff', borderWidth: 1, borderColor: '#e0e7ff',
  },
  actionBtnDel: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },

  // Draft CTA
  draftCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  draftCtaText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  emptySub: { marginTop: 6, fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  errorText: { fontSize: 15, fontWeight: '700', color: '#ef4444', marginTop: 12 },
  retryBtn: {
    marginTop: 16, height: 46, paddingHorizontal: 24, borderRadius: 12,
    backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center',
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default AdminProductsScreen;
