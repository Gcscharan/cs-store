import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { 
  useGetOutboxFailuresQuery, 
  useGetInventoryDriftQuery,
  useGetPaymentRecoverySuggestionQuery,
  useExecutePaymentRecoveryMutation
} from '../../api/adminApi';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

const AdminOpsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'recovery' | 'outbox' | 'inventory'>('recovery');
  const [recoveryOrderId, setRecoveryOrderId] = useState('');
  
  const outboxQ = useGetOutboxFailuresQuery(50);
  const inventoryQ = useGetInventoryDriftQuery(undefined);
  
  const { 
    data: suggestionData, 
    isFetching: isFetchingSuggestion,
    refetch: refetchSuggestion 
  } = useGetPaymentRecoverySuggestionQuery(
    { orderId: recoveryOrderId },
    { skip: !recoveryOrderId || recoveryOrderId.length < 10 }
  );

  const [executeRecovery, { isLoading: isExecutingRecovery }] = useExecutePaymentRecoveryMutation();

  const handleExecuteRecovery = async (action: string) => {
    if (!suggestionData?.paymentIntentId) return;
    
    Alert.alert(
      'Confirm Recovery',
      `Are you sure you want to execute: ${action}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Execute', onPress: async () => {
          try {
            await executeRecovery({
              paymentIntentId: suggestionData.paymentIntentId,
              action,
              reason: 'Admin manual recovery from mobile app'
            }).unwrap();
            Alert.alert('Success', 'Recovery action executed successfully');
            refetchSuggestion();
          } catch (err: any) {
            Alert.alert('Error', err.data?.message || 'Failed to execute recovery');
          }
        }}
      ]
    );
  };

  const renderRecovery = () => (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment Recovery Tool</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter Order ID"
          value={recoveryOrderId}
          onChangeText={setRecoveryOrderId}
          autoCapitalize="none"
        />
        
        {isFetchingSuggestion && <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />}
        
        {suggestionData && (
          <View style={styles.suggestionBox}>
            <Text style={styles.label}>Status: <Text style={styles.value}>{suggestionData.suggestion?.discrepancy}</Text></Text>
            <Text style={styles.label}>Recommendation: <Text style={styles.value}>{suggestionData.suggestion?.recommendedAction}</Text></Text>
            
            <View style={styles.actionRow}>
              {suggestionData.suggestion?.availableActions?.map((action: string) => (
                <TouchableOpacity 
                  key={action}
                  style={styles.actionBtn}
                  onPress={() => handleExecuteRecovery(action)}
                  disabled={isExecutingRecovery}
                >
                  <Text style={styles.actionBtnText}>{action.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderOutbox = () => {
    if (outboxQ.isLoading) return <LoadingState />;
    if (outboxQ.error) return <ErrorState message="Failed to load outbox failures" onRetry={outboxQ.refetch} />;
    
    const items = (outboxQ.data as any)?.items || [];
    
    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item.eventId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={outboxQ.isFetching} onRefresh={outboxQ.refetch} />}
        ListEmptyComponent={<EmptyState title="No outbox failures" description="All background events are processed." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemTitle}>{item.eventType}</Text>
            <Text style={styles.muted}>ID: {item.eventId}</Text>
            <Text style={styles.errorText}>Error: {item.lastError}</Text>
            <Text style={styles.label}>Attempts: {item.attempts}</Text>
          </View>
        )}
      />
    );
  };

  const renderInventory = () => {
    if (inventoryQ.isLoading) return <LoadingState />;
    if (inventoryQ.error) return <ErrorState message="Failed to load inventory drift" onRetry={inventoryQ.refetch} />;
    
    const items = (inventoryQ.data as any)?.drifted || [];
    
    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={inventoryQ.isFetching} onRefresh={inventoryQ.refetch} />}
        ListEmptyComponent={<EmptyState title="No inventory drift" description="All stock levels match reservations." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Actual Reserved:</Text>
              <Text style={styles.value}>{item.reservedStock}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Expected:</Text>
              <Text style={styles.value}>{item.expectedActiveQty}</Text>
            </View>
            <Text style={[styles.driftText, { color: item.drift > 0 ? Colors.error : Colors.success }]}>
              Drift: {item.drift > 0 ? '+' : ''}{item.drift}
            </Text>
          </View>
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Operations" onBack={() => navigation.goBack()} />
      
      <View style={styles.tabs}>
        {(['recovery', 'outbox', 'inventory'] as const).map((t) => (
          <TouchableOpacity 
            key={t} 
            style={[styles.tab, activeTab === t && styles.activeTab]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.activeTabText]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.flex}>
        {activeTab === 'recovery' && renderRecovery()}
        {activeTab === 'outbox' && renderOutbox()}
        {activeTab === 'inventory' && renderInventory()}
      </ScrollView>
    </SafeAreaView>
  );
};

// Reuse styles from other admin screens
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  activeTabText: { color: Colors.primary },
  tabContent: { padding: 12 },
  listContent: { padding: 12 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary, marginBottom: 16 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, fontSize: 14, fontWeight: '600' },
  suggestionBox: { marginTop: 20, padding: 16, backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  value: { color: Colors.textPrimary, fontWeight: '900' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  actionBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  actionBtnText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  itemTitle: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary, marginBottom: 4 },
  muted: { fontSize: 11, color: Colors.textMuted, marginBottom: 8 },
  errorText: { fontSize: 12, color: Colors.error, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  driftText: { fontSize: 14, fontWeight: '900', marginTop: 8 },
});

export default AdminOpsScreen;
