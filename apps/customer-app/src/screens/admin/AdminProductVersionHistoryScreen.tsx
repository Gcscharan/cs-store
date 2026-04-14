import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  useGetProductVersionHistoryQuery,
  useGetProductVersionDiffQuery,
} from '../../api/adminApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type VersionEntry = {
  version: number;
  actionType: 'update' | 'publish' | 'rollback';
  changedFields: string[];
  updatedBy: string;
  createdAt: string;
};

type DiffField = { from: any; to: any };

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  update:   { color: '#6366f1', bg: '#eef2ff', icon: 'create-outline',           label: 'UPDATED'  },
  publish:  { color: '#16a34a', bg: '#dcfce7', icon: 'checkmark-circle-outline', label: 'PUBLISHED' },
  rollback: { color: '#d97706', bg: '#fef3c7', icon: 'arrow-undo-outline',       label: 'ROLLBACK' },
};

const FIELD_LABELS: Record<string, string> = {
  name:         'Name',
  description:  'Description',
  price:        'Price',
  pricePerUnit: 'Price / Unit',
  mrp:          'MRP',
  stock:        'Stock',
  weight:       'Weight (g)',
  category:     'Category',
  tags:         'Tags',
  status:       'Status',
  images:       'Images',
};

const NUMERIC_FIELDS = new Set(['price', 'pricePerUnit', 'mrp', 'stock', 'weight']);
const CURRENCY_FIELDS = new Set(['price', 'pricePerUnit', 'mrp']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
};

const formatValue = (val: any, field?: string): string => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.length === 0 ? '(empty)' : val.join(', ');
  if (typeof val === 'number') {
    if (field && CURRENCY_FIELDS.has(field)) return `₹${val}`;
    return String(val);
  }
  return String(val);
};

/** Returns delta string like "+50" or "-5", null if not numeric or no change */
const getDelta = (from: any, to: any, field: string): { text: string; positive: boolean } | null => {
  if (!NUMERIC_FIELDS.has(field)) return null;
  const a = Number(from);
  const b = Number(to);
  if (isNaN(a) || isNaN(b) || a === b) return null;
  const delta = b - a;
  const prefix = delta > 0 ? '+' : '';
  const text = CURRENCY_FIELDS.has(field) ? `${prefix}₹${delta}` : `${prefix}${delta}`;
  return { text, positive: delta > 0 };
};

// ─── Diff Row ─────────────────────────────────────────────────────────────────

const DiffFieldRow: React.FC<{ field: string; from: any; to: any }> = ({ field, from, to }) => {
  const label = FIELD_LABELS[field] ?? field;
  const fromStr = formatValue(from, field);
  const toStr = formatValue(to, field);
  const delta = getDelta(from, to, field);

  return (
    <View style={dr.row}>
      {/* Field label + delta badge */}
      <View style={dr.labelRow}>
        <Text style={dr.label}>{label}</Text>
        {delta && (
          <View style={[dr.deltaBadge, delta.positive ? dr.deltaPos : dr.deltaNeg]}>
            <Text style={[dr.deltaText, delta.positive ? dr.deltaTextPos : dr.deltaTextNeg]}>
              {delta.text}
            </Text>
          </View>
        )}
      </View>

      {/* FROM → TO */}
      <View style={dr.valuesRow}>
        <View style={dr.fromBox}>
          <Text style={dr.fromLabel}>FROM</Text>
          <Text style={dr.fromValue} numberOfLines={4}>{fromStr}</Text>
        </View>
        <View style={dr.arrowWrap}>
          <Ionicons name="arrow-forward" size={14} color="#9ca3af" />
        </View>
        <View style={dr.toBox}>
          <Text style={dr.toLabel}>TO</Text>
          <Text style={dr.toValue} numberOfLines={4}>{toStr}</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Diff Modal ───────────────────────────────────────────────────────────────

const DiffModal: React.FC<{
  visible: boolean;
  productId: string;
  v1: number;
  v2: number;
  onClose: () => void;
}> = ({ visible, productId, v1, v2, onClose }) => {
  const { data, isFetching, error } = useGetProductVersionDiffQuery(
    { productId, v1, v2 },
    { skip: !visible }
  );

  const diff: Record<string, DiffField> = data?.diff ?? {};
  const changedFields: string[] = data?.changedFields ?? [];

  // Separate numeric vs text fields for ordering
  const numericChanged = changedFields.filter(f => NUMERIC_FIELDS.has(f));
  const textChanged = changedFields.filter(f => !NUMERIC_FIELDS.has(f));
  const ordered = [...numericChanged, ...textChanged];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={dm.container}>
        {/* Header */}
        <View style={dm.header}>
          <View style={dm.headerLeft}>
            <View style={dm.versionPill}>
              <Text style={dm.versionPillText}>v{v1}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#9ca3af" style={{ marginHorizontal: 8 }} />
            <View style={[dm.versionPill, dm.versionPillTo]}>
              <Text style={[dm.versionPillText, dm.versionPillTextTo]}>v{v2}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={dm.closeBtn}>
            <Ionicons name="close" size={20} color="#374151" />
          </Pressable>
        </View>

        {isFetching ? (
          <View style={dm.center}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={dm.loadingText}>Computing diff...</Text>
          </View>
        ) : error ? (
          <View style={dm.center}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={dm.errorText}>Failed to load diff</Text>
          </View>
        ) : changedFields.length === 0 ? (
          <View style={dm.center}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#16a34a" />
            <Text style={dm.noChangeText}>No changes between these versions</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={dm.scroll}>
            {/* Summary bar */}
            <View style={dm.summaryBar}>
              <Text style={dm.summaryText}>
                {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed
              </Text>
              <View style={dm.summaryChips}>
                {numericChanged.length > 0 && (
                  <View style={dm.summaryChip}>
                    <Text style={dm.summaryChipText}>{numericChanged.length} numeric</Text>
                  </View>
                )}
                {textChanged.length > 0 && (
                  <View style={[dm.summaryChip, dm.summaryChipText_]}>
                    <Text style={dm.summaryChipText}>{textChanged.length} text</Text>
                  </View>
                )}
              </View>
            </View>

            {ordered.map(field => (
              <DiffFieldRow
                key={field}
                field={field}
                from={diff[field]?.from}
                to={diff[field]?.to}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// ─── Timeline Card ────────────────────────────────────────────────────────────

const VersionCard: React.FC<{
  item: VersionEntry;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  selectionIndex: number; // 0 = not selected, 1 = first selected, 2 = second selected
  onPress: () => void;
  onQuickDiff: () => void;
  showQuickDiff: boolean;
}> = ({ item, isFirst, isLast, isSelected, selectionIndex, onPress, onQuickDiff, showQuickDiff }) => {
  const meta = ACTION_META[item.actionType] ?? ACTION_META.update;

  return (
    <View style={tc.wrapper}>
      {/* Timeline connector */}
      <View style={tc.timelineCol}>
        <View style={[tc.lineTop, isFirst && tc.lineHidden]} />
        <View style={[tc.dot, { backgroundColor: meta.color }]}>
          {isSelected && (
            <View style={tc.dotSelected}>
              <Text style={tc.dotSelectedText}>{selectionIndex}</Text>
            </View>
          )}
        </View>
        <View style={[tc.lineBottom, isLast && tc.lineHidden]} />
      </View>

      {/* Card */}
      <Pressable
        onPress={onPress}
        style={[tc.card, isSelected && tc.cardSelected]}
      >
        {/* Top row: version + action + date */}
        <View style={tc.topRow}>
          <View style={[tc.actionChip, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={11} color={meta.color} />
            <Text style={[tc.actionText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={tc.versionNum}>v{item.version}</Text>
        </View>

        {/* Changed fields */}
        {item.changedFields?.length > 0 ? (
          <View style={tc.fieldsRow}>
            {item.changedFields.slice(0, 4).map(f => (
              <View key={f} style={tc.fieldChip}>
                <Text style={tc.fieldChipText}>{FIELD_LABELS[f] ?? f}</Text>
              </View>
            ))}
            {item.changedFields.length > 4 && (
              <View style={[tc.fieldChip, tc.fieldChipMore]}>
                <Text style={tc.fieldChipText}>+{item.changedFields.length - 4}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={tc.noFields}>No field changes recorded</Text>
        )}

        {/* Date + quick diff */}
        <View style={tc.bottomRow}>
          <Text style={tc.dateText}>{formatDate(item.createdAt)}</Text>
          {showQuickDiff && (
            <Pressable onPress={onQuickDiff} style={tc.quickDiffBtn}>
              <Ionicons name="git-compare-outline" size={12} color="#6366f1" />
              <Text style={tc.quickDiffText}>vs prev</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const AdminProductVersionHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { productId, productName } = route.params ?? {};

  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  const [diffVisible, setDiffVisible] = useState(false);
  const [diffV1, setDiffV1] = useState(0);
  const [diffV2, setDiffV2] = useState(0);

  const { data, isFetching, error, refetch } = useGetProductVersionHistoryQuery(
    { productId, limit: 100 },
    { skip: !productId }
  );

  // Sorted oldest → newest for timeline display
  const versions: VersionEntry[] = [...(data?.versions ?? [])].sort((a, b) => a.version - b.version);

  const toggleSelect = (version: number) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) return prev.filter(v => v !== version);
      if (prev.length >= 2) return [prev[1], version];
      return [...prev, version];
    });
  };

  const openDiff = (v1: number, v2: number) => {
    const [lo, hi] = [v1, v2].sort((a, b) => a - b);
    setDiffV1(lo);
    setDiffV2(hi);
    setDiffVisible(true);
  };

  const canDiff = selectedVersions.length === 2;

  return (
    <View style={s.container}>
      <AdminHeader
        title={productName ? `${productName}` : 'Version History'}
        onBack={() => navigation.goBack()}
      />

      {/* Compare bar */}
      {selectedVersions.length > 0 && (
        <View style={s.compareBar}>
          <View style={s.compareLeft}>
            <Ionicons name="git-compare-outline" size={16} color="#c7d2fe" />
            <Text style={s.compareText}>
              {selectedVersions.length === 1
                ? `v${selectedVersions[0]} selected — pick one more`
                : `v${Math.min(...selectedVersions)} → v${Math.max(...selectedVersions)}`}
            </Text>
          </View>
          <View style={s.compareActions}>
            <Pressable onPress={() => setSelectedVersions([])} style={s.clearBtn}>
              <Text style={s.clearText}>Clear</Text>
            </Pressable>
            {canDiff && (
              <Pressable
                onPress={() => openDiff(selectedVersions[0], selectedVersions[1])}
                style={s.diffBtn}
              >
                <Text style={s.diffBtnText}>View Diff</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isFetching ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={s.errorText}>Failed to load history</Text>
          <Pressable onPress={refetch} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : versions.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="time-outline" size={48} color="#d1d5db" />
          <Text style={s.emptyText}>No version history yet</Text>
          <Text style={s.emptySubText}>Versions are created when a product is updated or published</Text>
        </View>
      ) : (
        <FlatList
          data={versions}
          keyExtractor={item => String(item.version)}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <View style={s.listHeader}>
              <Text style={s.listHeaderTitle}>{versions.length} version{versions.length !== 1 ? 's' : ''}</Text>
              <Text style={s.listHeaderHint}>Tap to select · tap 2 to compare</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const selIdx = selectedVersions.indexOf(item.version);
            return (
              <VersionCard
                item={item}
                isFirst={index === 0}
                isLast={index === versions.length - 1}
                isSelected={selIdx !== -1}
                selectionIndex={selIdx === -1 ? 0 : selIdx + 1}
                onPress={() => toggleSelect(item.version)}
                showQuickDiff={item.version > 1}
                onQuickDiff={() => openDiff(item.version - 1, item.version)}
              />
            );
          }}
        />
      )}

      <DiffModal
        visible={diffVisible}
        productId={productId}
        v1={diffV1}
        v2={diffV2}
        onClose={() => setDiffVisible(false)}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  list: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 15, fontWeight: '700', color: '#ef4444', marginTop: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#9ca3af', fontWeight: '500', marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#6366f1' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  listHeader: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  listHeaderHint: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  compareBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1e1b4b', paddingHorizontal: 16, paddingVertical: 11,
  },
  compareLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  compareText: { color: '#c7d2fe', fontSize: 13, fontWeight: '600' },
  compareActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  clearText: { color: '#c7d2fe', fontSize: 13, fontWeight: '600' },
  diffBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#6366f1' },
  diffBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// Timeline card styles
const tc = StyleSheet.create({
  wrapper: { flexDirection: 'row', paddingHorizontal: 16 },

  timelineCol: { width: 32, alignItems: 'center' },
  lineTop: { width: 2, flex: 1, backgroundColor: '#e5e7eb', minHeight: 12 },
  lineBottom: { width: 2, flex: 1, backgroundColor: '#e5e7eb', minHeight: 12 },
  lineHidden: { backgroundColor: 'transparent' },
  dot: { width: 12, height: 12, borderRadius: 6, marginVertical: 2 },
  dotSelected: {
    position: 'absolute', top: -4, left: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  dotSelectedText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  card: {
    flex: 1, marginLeft: 12, marginBottom: 4,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardSelected: { borderColor: '#6366f1', backgroundColor: '#fafafe' },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  versionNum: { fontSize: 13, fontWeight: '800', color: '#374151' },

  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  fieldChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  fieldChipMore: { backgroundColor: '#eef2ff', borderColor: '#e0e7ff' },
  fieldChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  noFields: { fontSize: 12, color: '#d1d5db', fontWeight: '500', marginBottom: 10 },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  quickDiffBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#eef2ff' },
  quickDiffText: { fontSize: 11, fontWeight: '700', color: '#6366f1' },
});

// Diff row styles
const dr = StyleSheet.create({
  row: { marginBottom: 14, backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151' },
  deltaBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  deltaPos: { backgroundColor: '#dcfce7' },
  deltaNeg: { backgroundColor: '#fee2e2' },
  deltaText: { fontSize: 12, fontWeight: '800' },
  deltaTextPos: { color: '#16a34a' },
  deltaTextNeg: { color: '#dc2626' },

  valuesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  fromBox: { flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#fecaca' },
  fromLabel: { fontSize: 9, fontWeight: '800', color: '#ef4444', letterSpacing: 0.5, marginBottom: 4 },
  fromValue: { fontSize: 13, color: '#7f1d1d', fontWeight: '600', lineHeight: 18 },
  arrowWrap: { paddingTop: 16 },
  toBox: { flex: 1, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  toLabel: { fontSize: 9, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5, marginBottom: 4 },
  toValue: { fontSize: 13, color: '#14532d', fontWeight: '600', lineHeight: 18 },
});

// Diff modal styles
const dm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  versionPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f3f4f6' },
  versionPillTo: { backgroundColor: '#eef2ff' },
  versionPillText: { fontSize: 14, fontWeight: '800', color: '#374151' },
  versionPillTextTo: { color: '#6366f1' },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280', fontWeight: '500' },
  errorText: { marginTop: 12, fontSize: 15, fontWeight: '700', color: '#ef4444' },
  noChangeText: { marginTop: 12, fontSize: 15, fontWeight: '600', color: '#16a34a' },

  scroll: { padding: 20, paddingBottom: 48 },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  summaryText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  summaryChips: { flexDirection: 'row', gap: 6 },
  summaryChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#eef2ff' },
  summaryChipText_: { backgroundColor: '#f3f4f6' },
  summaryChipText: { fontSize: 11, fontWeight: '700', color: '#6366f1' },
});

export default AdminProductVersionHistoryScreen;
