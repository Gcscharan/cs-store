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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useDeleteAdminUserMutation, useGetAdminUsersQuery } from '../../api/adminApi';

type UserLike = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  createdAt?: string;
  lastLoginAt?: string;
  lastLogin?: string;
};

const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [q, setQ] = useState('');

  const { data, isFetching, error, refetch } = useGetAdminUsersQuery(undefined);
  const users: UserLike[] = (data as any)?.users || [];

  const [deleteUser, { isLoading: deleting }] = useDeleteAdminUserMutation();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => {
      return (
        String(u.name || '').toLowerCase().includes(query) ||
        String(u.email || '').toLowerCase().includes(query) ||
        String(u.phone || '').toLowerCase().includes(query)
      );
    });
  }, [users, q]);

  const confirmDelete = (id: string, name?: string) => {
    Alert.alert('Delete User', `Are you sure you want to delete ${name || 'this user'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteUser(id).unwrap();
          refetch();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Users Management" onBack={() => navigation.goBack()} />

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

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load users</Text>
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
                <Text style={styles.emptyTitle}>No users found</Text>
                <Text style={styles.emptySub}>Try searching with a different query</Text>
              </View>
            }
            renderItem={({ item }) => {
              const initial = String(item.name || 'U').slice(0, 1).toUpperCase();
              const role = String(item.role || 'customer').toUpperCase();
              const joined = formatDate(item.createdAt);
              const lastLogin = item.lastLoginAt || item.lastLogin;

              return (
                <View style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={[styles.avatar, { marginRight: 12 }]}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, { marginRight: 10 }]} numberOfLines={1}>
                          {String(item.name || 'Unknown')}
                        </Text>
                        <View style={styles.roleBadge}>
                          <Text style={styles.roleText}>{role}</Text>
                        </View>
                      </View>
                      <Text style={styles.muted} numberOfLines={1}>
                        {String(item.email || '-')}
                      </Text>
                      <Text style={styles.muted} numberOfLines={1}>
                        {String(item.phone || '-')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaK}>Joined</Text>
                    <Text style={styles.metaV}>{joined}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaK}>Last Login</Text>
                    <Text style={styles.metaV}>{lastLogin ? formatDate(String(lastLogin)) : 'Never'}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(String(item._id), item.name)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
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
  listContent: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 14, fontWeight: '900', color: Colors.textPrimary },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.backgroundDark },
  roleText: { fontSize: 11, fontWeight: '900', color: Colors.textSecondary },
  muted: { marginTop: 2, fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaK: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  metaV: { fontSize: 12, color: Colors.textPrimary, fontWeight: '900' },
  deleteBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: Colors.white, fontWeight: '900' },
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

export default AdminUsersScreen;
