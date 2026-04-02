import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import {
  useApproveDeliveryBoyMutation,
  useGetDeliveryBoysQuery,
  useSuspendDeliveryBoyMutation,
} from '../../api/adminApi';

type DeliveryBoyLike = {
  user: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: 'pending' | 'active' | 'suspended' | string;
    deliveryProfile?: {
      vehicleType?: string;
      assignedAreas?: string[];
    };
    createdAt?: string;
  };
  deliveryBoy?: {
    availability?: 'available' | 'busy' | 'offline' | string;
    earnings?: number;
    completedOrdersCount?: number;
  } | null;
};

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const availabilityDot = (availability?: string) => {
  const a = String(availability || '').toLowerCase();
  if (a === 'available') return '#16a34a';
  if (a === 'busy') return Colors.primary;
  return Colors.textMuted;
};

const AdminDeliveryBoysScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [q, setQ] = useState('');

  const { data, isFetching, error, refetch } = useGetDeliveryBoysQuery(undefined);
  const list: DeliveryBoyLike[] = (data as any)?.deliveryBoys || (data as any)?.rows || (data as any) || [];

  const [approve, { isLoading: approving }] = useApproveDeliveryBoyMutation();
  const [suspend, { isLoading: suspending }] = useSuspendDeliveryBoyMutation();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (Array.isArray(list) ? list : [])
      .filter((b) => b?.user?._id)
      .filter((b) => {
        const st = String(b.user.status || '').toUpperCase();
        if (filter !== 'ALL' && st !== filter) return false;
        if (!query) return true;
        return (
          String(b.user.name || '').toLowerCase().includes(query) ||
          String(b.user.email || '').toLowerCase().includes(query) ||
          String(b.user.phone || '').toLowerCase().includes(query)
        );
      });
  }, [list, filter, q]);

  const doSuspend = (id: string) => {
    Alert.alert('Suspend Partner', 'Suspend this delivery partner?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        style: 'destructive',
        onPress: async () => {
          await suspend({ id, reason: 'Suspended by admin' }).unwrap();
          refetch();
        },
      },
    ]);
  };

  const doApprove = async (id: string) => {
    await approve(id).unwrap();
    refetch();
  };

  const filters: Array<{ key: StatusFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'PENDING' },
    { key: 'ACTIVE', label: 'ACTIVE' },
    { key: 'SUSPENDED', label: 'SUSPENDED' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Delivery Partners" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by name/email/phone"
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
            autoCapitalize="none"
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(i) => i.key}
          contentContainerStyle={styles.filtersRow}
          renderItem={({ item }) => {
            const selected = item.key === filter;
            return (
              <TouchableOpacity
                onPress={() => setFilter(item.key)}
                style={[styles.pill, selected ? styles.pillSelected : styles.pillUnselected, { marginRight: 8 }]}
                activeOpacity={0.9}
              >
                <Text style={[styles.pillText, selected ? styles.pillTextSelected : styles.pillTextUnselected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load delivery partners</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refetch} activeOpacity={0.9}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.user._id)}
            refreshControl={<RefreshControl refreshing={isFetching || approving || suspending} onRefresh={refetch} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No partners found</Text>
                <Text style={styles.emptySub}>Try changing filters or search</Text>
              </View>
            }
            renderItem={({ item }) => {
              const st = String(item.user.status || '').toUpperCase();
              const availability = item.deliveryBoy?.availability;
              const dotColor = availabilityDot(availability);
              const vehicle = item.user.deliveryProfile?.vehicleType || '-';
              const areas = item.user.deliveryProfile?.assignedAreas || [];
              const completed = Number(item.deliveryBoy?.completedOrdersCount || 0);
              const earnings = Number(item.deliveryBoy?.earnings || 0);

              return (
                <View style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{String(item.user.name || '-')}</Text>
                      <Text style={styles.muted}>{String(item.user.email || '-')}</Text>
                      <Text style={styles.muted}>{String(item.user.phone || '-')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <StatusBadge status={st} />
                      <View style={[styles.availRow, { marginTop: 8 }]}>
                        <View style={[styles.dot, { backgroundColor: dotColor, marginRight: 6 }]} />
                        <Text style={styles.availText}>{String(availability || 'offline')}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.k}>Vehicle</Text>
                    <Text style={styles.v}>{String(vehicle)}</Text>
                  </View>

                  {areas.length > 0 ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.k}>Areas</Text>
                      <Text style={styles.v} numberOfLines={2}>
                        {areas.join(', ')}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.infoRow}>
                    <Text style={styles.k}>Stats</Text>
                    <Text style={styles.v}>Completed: {completed} | Earnings: ₹{earnings}</Text>
                  </View>

                  <Text style={styles.joined}>Joined: {formatDate(item.user.createdAt)}</Text>

                  <View style={styles.actionsRow}>
                    {st === 'PENDING' ? (
                      <TouchableOpacity style={[styles.actionBtn, styles.btnGreen, { marginRight: 10 }]} onPress={() => doApprove(String(item.user._id))} activeOpacity={0.9}>
                        <Text style={styles.actionText}>Approve ✓</Text>
                      </TouchableOpacity>
                    ) : null}

                    {st === 'ACTIVE' ? (
                      <TouchableOpacity style={[styles.actionBtn, styles.btnRed]} onPress={() => doSuspend(String(item.user._id))} activeOpacity={0.9}>
                        <Text style={styles.actionText}>Suspend</Text>
                      </TouchableOpacity>
                    ) : null}

                    {st === 'SUSPENDED' ? (
                      <TouchableOpacity style={[styles.actionBtn, styles.btnGreen]} onPress={() => doApprove(String(item.user._id))} activeOpacity={0.9}>
                        <Text style={styles.actionText}>Reactivate ✓</Text>
                      </TouchableOpacity>
                    ) : null}
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
  filtersRow: { paddingHorizontal: 12, paddingBottom: 10 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillUnselected: { backgroundColor: Colors.white, borderColor: Colors.border },
  pillText: { fontSize: 12, fontWeight: '900' },
  pillTextSelected: { color: Colors.white },
  pillTextUnselected: { color: Colors.textSecondary },
  listContent: { padding: 12, paddingBottom: 24 },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary },
  muted: { marginTop: 2, fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  availRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  availText: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  k: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  v: { flex: 1, textAlign: 'right', fontSize: 12, color: Colors.textPrimary, fontWeight: '900' },
  joined: { marginTop: 10, fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', marginTop: 12 },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGreen: { backgroundColor: '#16a34a' },
  btnRed: { backgroundColor: Colors.error },
  actionText: { color: Colors.white, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  emptySub: { marginTop: 6, fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  errorText: { fontSize: 14, fontWeight: '900', color: Colors.error },
  retryBtn: { marginTop: 12, height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: Colors.white, fontWeight: '900' },
});

export default AdminDeliveryBoysScreen;
