import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useGetPaymentLogsQuery } from '../../api/adminApi';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

const AdminPaymentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { data, isLoading, isFetching, error, refetch } = useGetPaymentLogsQuery(undefined);
  
  const logs = (data as any)?.rows || [];

  const formatDate = (iso?: string): string => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'PAID' || s === 'SUCCESS' || s === 'CAPTURED') return '#16a34a';
    if (s === 'FAILED' || s === 'CANCELLED') return '#dc2626';
    return '#ca8a04';
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load payment logs" onRetry={refetch} screenName="AdminPayments" />;

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Payment Logs" onBack={() => navigation.goBack()} />
      
      <FlatList
        data={logs}
        keyExtractor={(item, index) => item.paymentIntentId || String(index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState 
            title="No payment logs found" 
            description="Payment transaction history will appear here." 
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Order: {String(item.orderId).slice(-8)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.value}>₹{item.amount}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Gateway</Text>
              <Text style={styles.value}>{item.gateway}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDate(item.createdAt || item.date)}</Text>
            </View>

            {item.paymentIntentId && (
              <View style={styles.row}>
                <Text style={styles.label}>Intent ID</Text>
                <Text style={styles.mutedValue} numberOfLines={1}>{item.paymentIntentId}</Text>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  listContent: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  value: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  mutedValue: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 20,
  },
});

export default AdminPaymentsScreen;
