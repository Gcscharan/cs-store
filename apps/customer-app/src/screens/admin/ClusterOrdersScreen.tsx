import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useGetClustersQuery } from '../../api/adminApi';
import { logEvent } from '../../utils/analytics';

// TypeScript types matching web admin structure
type PreviewOrderItem = {
  quantity?: number;
  qty?: number;
};

type PreviewOrder = {
  orderId?: string;
  itemsQty?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  lat?: number;
  lng?: number;
  // Backward-compatible fields if backend returns richer docs
  _id?: string;
  id?: string;
  items?: PreviewOrderItem[];
  totalAmount?: number;
  subtotal?: number;
};

type PreviewCluster = {
  tempClusterId: string;
  orderCount: number;
  distanceKm: number;
  estimatedTimeMin: number;
  orders: Array<string | PreviewOrder>;
  routePath?: string[];
};

type ClustersResponse = {
  clusters: PreviewCluster[];
};

const ClusterOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { data, isLoading, error, refetch } = useGetClustersQuery(undefined);

  useEffect(() => {
    logEvent('screen_view', { screen: 'ClusterOrders' });
  }, []);

  // Handler for Recent button
  const handleRecentPress = () => {
    console.log('⏰ Recent button pressed - navigating to AdminRecentRoutes');
    navigation.navigate('AdminRecentRoutes');
  };

  // Extract clusters from response
  const clusters: PreviewCluster[] = (data as ClustersResponse)?.clusters || [];

  // Helper function to get order ID from string or PreviewOrder
  const getOrderId = (o: string | PreviewOrder): string => {
    if (typeof o === 'string') return o;
    if (o?.orderId) return String(o.orderId);
    if (o?._id) return String(o._id);
    if (o?.id) return String(o.id);
    return '';
  };

  // Helper function to compute total items in a cluster
  const computeTotalItems = (orders: PreviewCluster['orders']): number => {
    return (orders || []).reduce((sum: number, o) => {
      if (!o || typeof o === 'string') return sum;
      if (typeof o.itemsQty === 'number') {
        return sum + (Number.isFinite(o.itemsQty) ? o.itemsQty : 0);
      }
      const items = Array.isArray(o.items) ? o.items : [];
      const itemQty = items.reduce((s: number, it) => {
        const q = typeof it?.quantity === 'number' ? it.quantity : typeof it?.qty === 'number' ? it.qty : 0;
        return s + (Number.isFinite(q) ? q : 0);
      }, 0);
      return sum + itemQty;
    }, 0);
  };

  // Helper function to compute gross amount
  const computeGrossAmount = (orders: PreviewCluster['orders']): number => {
    return (orders || []).reduce((sum: number, o) => {
      if (!o || typeof o === 'string') return sum;
      if (typeof o.grossAmount === 'number') {
        return sum + (Number.isFinite(o.grossAmount) ? o.grossAmount : 0);
      }
      const v =
        typeof o.totalAmount === 'number'
          ? o.totalAmount
          : typeof o.subtotal === 'number'
            ? o.subtotal
            : 0;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  };

  // Helper function to compute net amount
  const computeNetAmount = (orders: PreviewCluster['orders']): number => {
    const explicitNet = (orders || []).every((o) => typeof o !== 'string' && typeof (o as PreviewOrder).netAmount === 'number');
    if (explicitNet) {
      return (orders || []).reduce((sum: number, o) => {
        if (!o || typeof o === 'string') return sum;
        const v = typeof o.netAmount === 'number' ? o.netAmount : 0;
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);
    }

    const gross = computeGrossAmount(orders);
    const discount = (orders || []).reduce((sum: number, o) => {
      if (!o || typeof o === 'string') return sum;
      const d = typeof o.discountAmount === 'number' ? o.discountAmount : 0;
      return sum + (Number.isFinite(d) ? d : 0);
    }, 0);
    const net = gross - discount;
    return Number.isFinite(net) ? Math.max(0, net) : 0;
  };

  // Handle assign delivery boy button click
  const handleAssignClick = (cluster: PreviewCluster) => {
    logEvent('cluster_assign_initiated', { clusterId: cluster.tempClusterId });
    navigation.navigate('SelectDeliveryPartner', { cluster });
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.safe}>
        <AdminHeader 
          title="Cluster Orders" 
          onBack={() => navigation.goBack()}
          rightAction={
            <TouchableOpacity
              onPress={handleRecentPress}
              style={styles.historyButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="time-outline" size={20} color={Colors.white} />
              <Text style={styles.historyButtonText}>Recent</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading clusters...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.safe}>
        <AdminHeader 
          title="Cluster Orders" 
          onBack={() => navigation.goBack()}
          rightAction={
            <TouchableOpacity
              onPress={handleRecentPress}
              style={styles.historyButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="time-outline" size={20} color={Colors.white} />
              <Text style={styles.historyButtonText}>Recent</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Failed to load clusters</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty state
  if (clusters.length === 0) {
    return (
      <View style={styles.safe}>
        <AdminHeader 
          title="Cluster Orders" 
          onBack={() => navigation.goBack()}
          rightAction={
            <TouchableOpacity
              onPress={handleRecentPress}
              style={styles.historyButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="time-outline" size={20} color={Colors.white} />
              <Text style={styles.historyButtonText}>Recent</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>No packed orders</Text>
          <Text style={styles.emptySubtext}>Pack orders to see them grouped into clusters</Text>
        </View>
      </View>
    );
  }

  // Render cluster cards
  return (
    <View style={styles.safe}>
      <AdminHeader 
        title="Cluster Orders" 
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={handleRecentPress}
            style={styles.historyButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="time-outline" size={20} color={Colors.white} />
            <Text style={styles.historyButtonText}>Recent</Text>
          </TouchableOpacity>
        }
      />
      
      <FlatList
        data={clusters}
        keyExtractor={(item, idx) => item.tempClusterId || `cluster-${idx}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: cluster }) => (
          <View style={styles.clusterCard}>
            {/* Cluster Header */}
            <View style={styles.clusterHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clusterLabel}>Cluster</Text>
                <Text style={styles.clusterIdText}>{cluster.tempClusterId}</Text>
              </View>
            </View>

            {/* Cluster Metadata Grid */}
            <View style={styles.metadataGrid}>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Orders</Text>
                <Text style={styles.metadataValue}>
                  {(cluster.routePath || cluster.orders.map(getOrderId))
                    .filter((x) => String(x).toUpperCase() !== 'WAREHOUSE').length}
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Distance</Text>
                <Text style={styles.metadataValue}>
                  {Number(cluster.distanceKm || 0).toFixed(1)} km
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>ETA</Text>
                <Text style={styles.metadataValue}>
                  {Math.round(Number(cluster.estimatedTimeMin || 0))} min
                </Text>
              </View>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>Items</Text>
                <Text style={styles.metadataValue}>
                  {computeTotalItems(cluster.orders)}
                </Text>
              </View>
            </View>

            {/* Financial Summary */}
            <View style={styles.financialSummary}>
              <Text style={styles.financialText}>
                Gross: ₹{computeGrossAmount(cluster.orders).toLocaleString()}
              </Text>
              <Text style={styles.financialDivider}>|</Text>
              <Text style={styles.financialText}>
                Net: ₹{computeNetAmount(cluster.orders).toLocaleString()}
              </Text>
            </View>

            {/* Order IDs List */}
            <View style={styles.ordersList}>
              <Text style={styles.ordersListTitle}>Order IDs:</Text>
              {(cluster.routePath || cluster.orders.map(getOrderId) || [])
                .filter((x) => String(x).toUpperCase() !== 'WAREHOUSE')
                .map((id, i) => (
                  <Text key={`${cluster.tempClusterId}-${id}-${i}`} style={styles.orderIdText}>
                    {i + 1}. {String(id)}
                  </Text>
                ))}
            </View>

            {/* Assign Delivery Boy Button */}
            <TouchableOpacity
              style={styles.assignButton}
              onPress={() => handleAssignClick(cluster)}
              activeOpacity={0.7}
            >
              <Text style={styles.assignButtonText} numberOfLines={1}>🚚 Assign Delivery Boy</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  retryButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  clusterCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clusterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clusterLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  clusterIdText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metadataItem: {
    width: '50%',
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  financialSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  financialText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  financialDivider: {
    marginHorizontal: 8,
    fontSize: 12,
    color: Colors.border,
  },
  ordersList: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  ordersListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  orderIdText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  assignButton: {
    backgroundColor: Colors.success,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexDirection: 'row',
  },
  assignButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginLeft: 6,
  },
});

export default ClusterOrdersScreen;
