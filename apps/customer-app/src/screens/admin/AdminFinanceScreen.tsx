import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  useGetFinanceDataQuery,
  useGetFinanceGatewayPerformanceQuery,
  useGetFinanceRefundLedgerQuery,
  useGetFinanceRevenueLedgerQuery,
  useGetFinanceHealthQuery,
} from '../../api/adminApi';
import { Linking } from 'react-native';

type Tab = 'overview' | 'revenue' | 'refunds' | 'health';

const todayIso = () => new Date().toISOString().split('T')[0];
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';

const formatCurrency = (amount: number, currency: string = 'INR') => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
};

const formatDate = (iso?: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminFinanceScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [tab, setTab] = useState<Tab>('overview');

  const queryArgs = { from, to };

  const totalsQ = useGetFinanceDataQuery(queryArgs);
  const revenueQ = useGetFinanceRevenueLedgerQuery(queryArgs);
  const refundQ = useGetFinanceRefundLedgerQuery(queryArgs);
  const gatewayQ = useGetFinanceGatewayPerformanceQuery(queryArgs);
  const healthQ = useGetFinanceHealthQuery(undefined);

  const totals = (totalsQ.data as any)?.totals;
  const revenueRows: any[] = (revenueQ.data as any)?.rows || [];
  const refundRows: any[] = (refundQ.data as any)?.rows || [];
  const gatewayRows: any[] = (gatewayQ.data as any)?.rows || [];
  const health = healthQ.data as any;

  const isLoading = totalsQ.isFetching || revenueQ.isFetching || refundQ.isFetching || gatewayQ.isFetching || healthQ.isFetching;
  const hasError = totalsQ.error || revenueQ.error || refundQ.error || gatewayQ.error;

  const handleExport = (type: 'revenue' | 'refund' | 'net' | 'gateway') => {
    let endpoint = '';
    if (type === 'revenue') endpoint = '/internal/finance/revenue-ledger.csv';
    else if (type === 'refund') endpoint = '/internal/finance/refund-ledger.csv';
    else if (type === 'net') endpoint = '/internal/finance/net-revenue.csv';
    else if (type === 'gateway') endpoint = '/internal/finance/gateway-performance.csv';

    const url = `${API_URL}${endpoint}?from=${from}&to=${to}&currency=INR`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open export URL'));
  };

  const codOnline = useMemo(() => {
    let codTotal = 0;
    let onlineTotal = 0;
    for (const row of revenueRows) {
      if (row?.eventType === 'sale') {
        if (row?.gateway === 'COD') codTotal += Number(row.amount || 0);
        else onlineTotal += Number(row.amount || 0);
      }
    }
    return { codTotal, onlineTotal };
  }, [revenueRows]);

  const TabButton = ({ id, label }: { id: Tab; label: string }) => {
    const selected = tab === id;
    return (
      <TouchableOpacity
        onPress={() => setTab(id)}
        style={[styles.tabBtn, selected ? styles.tabBtnSelected : styles.tabBtnUnselected]}
        activeOpacity={0.9}
      >
        <Text style={[styles.tabText, selected ? styles.tabTextSelected : styles.tabTextUnselected]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AdminHeader title="Finance Reports" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Date Range</Text>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>From</Text>
              <TextInput value={from} onChangeText={setFrom} style={styles.input} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To</Text>
              <TextInput value={to} onChangeText={setTo} style={styles.input} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              totalsQ.refetch();
              revenueQ.refetch();
              refundQ.refetch();
              gatewayQ.refetch();
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsRow}>
          <TabButton id="overview" label="Overview" />
          <View style={{ width: 10 }} />
          <TabButton id="revenue" label="Revenue" />
          <View style={{ width: 10 }} />
          <TabButton id="refunds" label="Refunds" />
          <View style={{ width: 10 }} />
          <TabButton id="health" label="Health" />
        </View>

        {isLoading && !totals && !health ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : hasError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load finance data</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                totalsQ.refetch();
                revenueQ.refetch();
                refundQ.refetch();
                gatewayQ.refetch();
                healthQ.refetch();
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : tab === 'overview' ? (
          <>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Key Metrics</Text>
                <TouchableOpacity onPress={() => handleExport('net')}>
                  <Text style={styles.exportBtnText}>📥 Export</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.kvRow}>
                <Text style={[styles.k, { marginRight: 10 }]}>Gross Revenue</Text>
                <Text style={styles.v}>{formatCurrency(Number(totals?.grossRevenue || 0), String(totals?.currency || 'INR'))}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { marginRight: 10 }]}>Refunds</Text>
                <Text style={styles.v}>{formatCurrency(Number(totals?.refundedAmount || 0), String(totals?.currency || 'INR'))}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { marginRight: 10 }]}>Net Revenue</Text>
                <Text style={[styles.v, { color: Colors.primary }]}>
                  {formatCurrency(Number(totals?.netRevenue || 0), String(totals?.currency || 'INR'))}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { marginRight: 10 }]}>Refund Rate</Text>
                <Text style={styles.v}>{((Number(totals?.refundRate || 0) * 100) || 0).toFixed(1)}%</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>COD vs Online</Text>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { marginRight: 10 }]}>COD</Text>
                <Text style={styles.v}>{formatCurrency(codOnline.codTotal, String(totals?.currency || 'INR'))}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.k, { marginRight: 10 }]}>Online</Text>
                <Text style={styles.v}>{formatCurrency(codOnline.onlineTotal, String(totals?.currency || 'INR'))}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Gateway Performance</Text>
                <TouchableOpacity onPress={() => handleExport('gateway')}>
                  <Text style={styles.exportBtnText}>📥 Export</Text>
                </TouchableOpacity>
              </View>
              {gatewayRows.length === 0 ? (
                <Text style={styles.muted}>No gateway data available</Text>
              ) : (
                gatewayRows.map((g, idx) => (
                  <View key={String(idx)} style={styles.gatewayRow}>
                    <Text style={styles.gatewayName}>{String(g.gateway || '-')}</Text>
                    <Text style={styles.gatewayMeta}>
                      Success: {Number(g.successCount || 0)} | Failed: {Number(g.failedCount || 0)} | Pending: {Number(g.pendingCount || 0)} | SR: {((Number(g.successRate || 0) * 100) || 0).toFixed(1)}%
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : tab === 'revenue' ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Revenue Ledger</Text>
              <TouchableOpacity onPress={() => handleExport('revenue')}>
                <Text style={styles.exportBtnText}>📥 Export</Text>
              </TouchableOpacity>
            </View>
            {revenueRows.length === 0 ? (
              <Text style={styles.muted}>No revenue ledger entries found for this date range</Text>
            ) : (
              revenueRows.slice(0, 100).map((r, idx) => (
                <View key={String(idx)} style={[styles.ledgerRow, r.eventType === 'refund' ? styles.ledgerRefund : null]}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.ledgerTop}>{formatDate(r.date)} · {String(r.eventType || '').toUpperCase()}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      Order: {String(r.orderId || '').slice(-8)} · {String(r.gateway || '-')}
                    </Text>
                  </View>
                  <Text style={[styles.ledgerAmount, r.eventType === 'refund' ? { color: Colors.error } : { color: '#16a34a' }]}>
                    {r.eventType === 'refund' ? '-' : '+'}
                    {formatCurrency(Math.abs(Number(r.amount || 0)), String(r.currency || 'INR'))}
                  </Text>
                </View>
              ))
            )}
            {revenueRows.length > 100 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>Showing first 100 of {revenueRows.length} entries.</Text>
            ) : null}
          </View>
        ) : tab === 'refunds' ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Refund Ledger</Text>
              <TouchableOpacity onPress={() => handleExport('refund')}>
                <Text style={styles.exportBtnText}>📥 Export</Text>
              </TouchableOpacity>
            </View>
            {refundRows.length === 0 ? (
              <Text style={styles.muted}>No refund ledger entries found for this date range</Text>
            ) : (
              refundRows.slice(0, 100).map((r, idx) => (
                <View key={String(idx)} style={styles.ledgerRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.ledgerTop}>
                      {formatDate(r.completedAt)} · {String(r.status || 'COMPLETED')}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      Refund: {r.refundId ? String(r.refundId).slice(-8) : '-'} · Order: {String(r.orderId || '').slice(-8)}
                    </Text>
                  </View>
                  <Text style={[styles.ledgerAmount, { color: Colors.error }]}>-{formatCurrency(Number(r.amount || 0), String(r.currency || 'INR'))}</Text>
                </View>
              ))
            )}
            {refundRows.length > 100 ? (
              <Text style={[styles.muted, { marginTop: 10 }]}>Showing first 100 of {refundRows.length} entries.</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Finance Health Integrity</Text>
            <View style={styles.healthStatusRow}>
              <Text style={styles.label}>Global Status:</Text>
              <Text style={[styles.healthStatusBadge, { color: health?.status === 'OK' ? '#16a34a' : health?.status === 'WARN' ? '#ca8a04' : '#dc2626' }]}>
                {health?.status || 'UNKNOWN'}
              </Text>
            </View>
            <View style={styles.divider} />
            {health?.checks?.map((check: any, idx: number) => (
              <View key={idx} style={styles.checkItem}>
                <View style={styles.checkHeader}>
                  <Text style={styles.checkName}>{check.name}</Text>
                  <Text style={[styles.checkStatus, { color: check.status === 'OK' ? '#16a34a' : check.status === 'WARN' ? '#ca8a04' : '#dc2626' }]}>
                    {check.status}
                  </Text>
                </View>
                {check.status !== 'OK' && check.details && (
                  <View style={styles.checkDetails}>
                    <Text style={styles.detailsText}>{JSON.stringify(check.details, null, 2)}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 12, paddingBottom: 24 },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.textPrimary, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
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
  rangeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  refreshBtn: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  refreshText: { fontWeight: '900', color: Colors.textPrimary },
  tabsRow: { flexDirection: 'row', marginBottom: 12 },
  tabBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabBtnSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnUnselected: { backgroundColor: Colors.white, borderColor: Colors.border },
  tabText: { fontSize: 12, fontWeight: '900' },
  tabTextSelected: { color: Colors.white },
  tabTextUnselected: { color: Colors.textSecondary },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  k: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  v: { fontSize: 12, color: Colors.textPrimary, fontWeight: '900', textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  muted: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  gatewayRow: { marginBottom: 12 },
  gatewayName: { fontSize: 13, fontWeight: '900', color: Colors.textPrimary },
  gatewayMeta: { marginTop: 4, fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ledgerRefund: { backgroundColor: '#fff1f2' },
  ledgerTop: { fontSize: 12, fontWeight: '900', color: Colors.textPrimary },
  ledgerAmount: { fontSize: 12, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  exportBtnText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  healthStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  healthStatusBadge: { marginLeft: 8, fontWeight: '900', fontSize: 14 },
  checkItem: { marginBottom: 16 },
  checkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  checkName: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  checkStatus: { fontSize: 12, fontWeight: '900' },
  checkDetails: { marginTop: 6, padding: 8, backgroundColor: Colors.background, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  detailsText: { fontSize: 10, fontFamily: 'monospace', color: Colors.textSecondary },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, fontWeight: '900', color: Colors.error },
  retryBtn: { marginTop: 12, height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: Colors.white, fontWeight: '900' },
});

export default AdminFinanceScreen;
