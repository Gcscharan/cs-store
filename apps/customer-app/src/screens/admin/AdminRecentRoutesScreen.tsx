import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { logEvent } from '../../utils/analytics';
import { useGetRecentRoutesQuery } from '../../api/adminApi';

type RouteStatus = 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

interface RecentRouteItem {
  routeId: string;
  status: RouteStatus;
  assignedAt: string | null;
  updatedAt: string | null;
  deliveryBoy: { id: string; name: string; phone: string } | null;
  counts: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    completed: number;
  };
  progressPct: number;
}

const POLL_MS = 15000; // 15 seconds

const formatDateTime = (v: string | null | undefined): string => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
  const st = String(status || '').toUpperCase();
  if (st === 'CREATED') return { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' };
  if (st === 'ASSIGNED') return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' };
  if (st === 'IN_PROGRESS') return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
  if (st === 'COMPLETED') return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
  return { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' };
};

export default function AdminRecentRoutesScreen() {
  console.log('🎬 AdminRecentRoutesScreen MOUNTED');
  
  const navigation = useNavigation<any>();
  
  const { data, isLoading, isFetching, error, refetch } = useGetRecentRoutesQuery(50, {
    pollingInterval: 15000, // Auto-refresh every 15 seconds
  });

  console.log('📊 RTK Query State:', {
    hasData: !!data,
    isLoading,
    isFetching,
    hasError: !!error,
    routesCount: data?.routes?.length || 0,
  });

  useEffect(() => {
    console.log('📊 Screen View Event Logged');
    logEvent('screen_view', { screen: 'AdminRecentRoutes' });
  }, []);

  const routes: RecentRouteItem[] = data?.routes || [];
  const refreshing = isFetching && !isLoading;

  const handleRoutePress = (routeId: string) => {
    // Navigate to route detail screen
    navigation.navigate('AdminRouteDetail', { routeId });
  };

  const renderRouteItem = ({ item }: { item: RecentRouteItem }) => {
    const total = Number(item.counts?.total || 0);
    const completed = Number(item.counts?.completed || 0);
    const pct = Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(item.progressPct)
          ? item.progressPct
          : total > 0
          ? Math.round((completed / total) * 100)
          : 0
      )
    );

    const statusColors = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.routeCard}
        onPress={() => handleRoutePress(item.routeId)}
        activeOpacity={0.7}
      >
        {/* Header: Route ID + Status */}
        <View style={styles.routeHeader}>
          <Text style={styles.routeId}>{item.routeId}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors.bg, borderColor: statusColors.border },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Delivery Boy Info */}
        <View style={styles.deliveryBoySection}>
          <View style={styles.deliveryBoyIcon}>
            <Ionicons name="person" size={16} color={Colors.primary} />
          </View>
          {item.deliveryBoy ? (
            <View style={styles.deliveryBoyInfo}>
              <Text style={styles.deliveryBoyName}>{item.deliveryBoy.name}</Text>
              <Text style={styles.deliveryBoyPhone}>{item.deliveryBoy.phone}</Text>
            </View>
          ) : (
            <Text style={styles.noDeliveryBoy}>No delivery partner assigned</Text>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {completed} / {total} completed
            </Text>
            <Text style={styles.progressPercent}>{pct}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* Timestamps */}
        <View style={styles.timestampSection}>
          <View style={styles.timestampRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.timestampLabel}>Assigned:</Text>
            <Text style={styles.timestampValue}>{formatDateTime(item.assignedAt)}</Text>
          </View>
          <View style={styles.timestampRow}>
            <Ionicons name="refresh-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.timestampLabel}>Updated:</Text>
            <Text style={styles.timestampValue}>{formatDateTime(item.updatedAt)}</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => handleRoutePress(item.routeId)}
          activeOpacity={0.8}
        >
          <Ionicons name="map-outline" size={18} color={Colors.primary} />
          <Text style={styles.mapButtonText}>View Details</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoading && routes.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyText}>Loading recent routes...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.emptyTitle}>Failed to load routes</Text>
          <Text style={styles.emptySubtitle}>
            {(error as any)?.data?.message || 'Please try again'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No assigned routes yet</Text>
        <Text style={styles.emptySubtitle}>
          Assign a cluster to a delivery partner to see it here
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Recent Assignments" onBack={() => navigation.goBack()} />

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoBannerContent}>
          <Text style={styles.infoBannerTitle}>Last assigned clusters</Text>
          <Text style={styles.infoBannerSubtitle}>Sorted by assigned time • Auto-refreshes every 15s</Text>
        </View>
      </View>

      {/* Routes List */}
      <FlatList
        data={routes}
        renderItem={renderRouteItem}
        keyExtractor={(item) => item.routeId}
        contentContainerStyle={[
          styles.listContent,
          routes.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetch}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  infoBanner: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoBannerContent: {
    marginBottom: 8,
  },
  infoBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeId: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deliveryBoySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  deliveryBoyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  deliveryBoyInfo: {
    flex: 1,
  },
  deliveryBoyName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  deliveryBoyPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  noDeliveryBoy: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.success,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  timestampSection: {
    marginBottom: 12,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timestampLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 6,
    marginRight: 4,
    fontWeight: '500',
  },
  timestampValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
});

