import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import { useGetDeliveryPartnersQuery, useAssignClusterMutation, useAssignOrderMutation } from '../../api/adminApi';
import { logEvent } from '../../utils/analytics';
import { useDispatch } from 'react-redux';
import { showToast } from '../../store/slices/uiSlice';
import { AppDispatch } from '../../store';

interface DeliveryPartner {
  _id: string;
  name: string;
  phone?: string;
  vehicleType?: string;
  isAvailable?: boolean;
  currentLoad?: number;
}

interface RouteParams {
  // Single-order assignment mode
  orderId?: string;
  // Cluster assignment mode
  cluster?: {
    tempClusterId: string;
    orderCount: number;
    distanceKm: number;
    estimatedTimeMin: number;
    orders: Array<any>;
    routePath?: string[];
  };
}

const SelectDeliveryPartnerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();
  
  const { cluster, orderId } = route.params as RouteParams;
  const isSingleOrder = !!orderId && !cluster;

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  
  const {
    data: partnersResponse,
    isLoading,
    error,
    refetch,
  } = useGetDeliveryPartnersQuery(undefined);

  const [assignCluster, { isLoading: isAssigningCluster }] = useAssignClusterMutation();
  const [assignOrder, { isLoading: isAssigningOrder }] = useAssignOrderMutation();
  const isAssigning = isAssigningCluster || isAssigningOrder;

  const partners = partnersResponse?.deliveryPartners || partnersResponse || [];

  useEffect(() => {
    logEvent('screen_view', { 
      screen: 'SelectDeliveryPartner',
      mode: isSingleOrder ? 'single_order' : 'cluster',
      ...(isSingleOrder ? { orderId } : { clusterId: cluster?.tempClusterId }),
    });
  }, []);

  const handleSelectPartner = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
  };

  const handleConfirmSelection = async () => {
    if (!selectedPartnerId) return;

    try {
      if (isSingleOrder && orderId) {
        // Single order assignment
        await assignOrder({
          id: orderId,
          deliveryBoyId: selectedPartnerId,
        }).unwrap();

        dispatch(showToast('Delivery partner assigned successfully'));
        logEvent('order_assigned', { orderId, partnerId: selectedPartnerId });
        // Navigate back — invalidatesTags on assignOrder mutation will refresh the orders list
        navigation.goBack();
      } else if (cluster) {
        // Cluster assignment
        const getOrderId = (o: any): string => {
          if (typeof o === 'string') return o;
          if (o?.orderId) return String(o.orderId);
          if (o?._id) return String(o._id);
          if (o?.id) return String(o.id);
          return '';
        };

        const orderIds = (cluster.routePath || cluster.orders.map(getOrderId) || [])
          .filter((x) => String(x).toUpperCase() !== 'WAREHOUSE');

        await assignCluster({
          deliveryBoyId: selectedPartnerId,
          orderIds,
          routePath: cluster.routePath || orderIds,
        }).unwrap();

        dispatch(showToast('Cluster assigned successfully'));
        logEvent('cluster_assigned', {
          clusterId: cluster.tempClusterId,
          orderCount: orderIds.length,
          partnerId: selectedPartnerId,
        });
        navigation.navigate('AdminOrders');
      }
    } catch (err: any) {
      console.error('Assign error:', err);
      dispatch(showToast(err.data?.message || 'Failed to assign delivery partner'));
    }
  };

  const renderPartnerItem = ({ item }: { item: DeliveryPartner }) => {
    const isSelected = selectedPartnerId === item._id;
    const isAvailable = item.isAvailable !== false;

    return (
      <TouchableOpacity
        style={[
          styles.partnerCard,
          isSelected && styles.partnerCardSelected,
          !isAvailable && styles.partnerCardBusy,
        ]}
        onPress={() => handleSelectPartner(item._id)}
        activeOpacity={0.85}
      >
        {/* Selection Indicator */}
        {isSelected && <View style={styles.selectionIndicator} />}

        <View style={styles.partnerCardContent}>
          {/* Left: Avatar + Info */}
          <View style={styles.partnerLeft}>
            {/* Avatar Circle */}
            <View style={[styles.avatar, !isAvailable && styles.avatarBusy]}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Partner Info */}
            <View style={styles.partnerInfo}>
              <Text style={[styles.partnerName, !isAvailable && styles.textBusy]}>
                {item.name}
              </Text>
              <View style={styles.partnerMeta}>
                {item.phone && (
                  <View style={styles.metaItem}>
                    <Ionicons name="call" size={12} color={isAvailable ? Colors.textSecondary : '#9CA3AF'} />
                    <Text style={[styles.metaText, !isAvailable && styles.textBusy]}>
                      {item.phone}
                    </Text>
                  </View>
                )}
                {item.vehicleType && (
                  <View style={styles.metaItem}>
                    <Ionicons name="car" size={12} color={isAvailable ? Colors.textSecondary : '#9CA3AF'} />
                    <Text style={[styles.metaText, !isAvailable && styles.textBusy]}>
                      {item.vehicleType}
                    </Text>
                  </View>
                )}
              </View>
              {typeof item.currentLoad === 'number' && (
                <View style={styles.loadContainer}>
                  <Ionicons name="cube" size={12} color={isAvailable ? '#FF9500' : '#9CA3AF'} />
                  <Text style={[styles.currentLoad, !isAvailable && styles.textBusy]}>
                    {item.currentLoad} active {item.currentLoad === 1 ? 'order' : 'orders'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: Status or Checkmark */}
          <View style={styles.partnerRight}>
            {isSelected ? (
              <View style={styles.checkmarkCircle}>
                <Ionicons name="checkmark" size={20} color={Colors.white} />
              </View>
            ) : (
              <View
                style={[
                  styles.statusBadge,
                  isAvailable ? styles.statusAvailable : styles.statusBusy,
                ]}
              >
                <View style={[styles.statusDot, isAvailable && styles.statusDotActive]} />
                <Text
                  style={[
                    styles.statusText,
                    isAvailable ? styles.statusTextAvailable : styles.statusTextBusy,
                  ]}
                >
                  {isAvailable ? 'Available' : 'Busy'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading delivery partners...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load delivery partners</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!partners || partners.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="bicycle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No delivery partners available</Text>
          <Text style={styles.emptySubtext}>Please try again later</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={partners}
        renderItem={renderPartnerItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader 
        title="Select Delivery Partner" 
        onBack={() => navigation.goBack()} 
      />

      {/* Info Banner */}
      <View style={styles.clusterBanner}>
        <View style={styles.bannerIconContainer}>
          <Ionicons name={isSingleOrder ? 'receipt' : 'cube'} size={20} color={Colors.primary} />
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>
            {isSingleOrder ? 'Assign Delivery Partner' : `Cluster ${cluster?.tempClusterId}`}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {isSingleOrder
              ? `Order #${String(orderId).slice(-6).toUpperCase()}`
              : `${cluster?.orderCount} orders • ${Number(cluster?.distanceKm || 0).toFixed(1)} km • ${Math.round(Number(cluster?.estimatedTimeMin || 0))} min`}
          </Text>
        </View>
      </View>

      {/* Partner Count */}
      {!isLoading && !error && partners.length > 0 && (
        <View style={styles.countBanner}>
          <Ionicons name="people" size={16} color={Colors.textSecondary} />
          <Text style={styles.countText}>
            {partners.length} partner{partners.length !== 1 ? 's' : ''} available
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Footer - Fixed Assign Button */}
      {selectedPartnerId && !isLoading && !error && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.assignButton, isAssigning && styles.assignButtonDisabled]}
            onPress={handleConfirmSelection}
            disabled={isAssigning}
            activeOpacity={0.9}
          >
            {isAssigning ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <View style={styles.assignButtonIcon}>
                  <Ionicons name="checkmark-done" size={22} color={Colors.white} />
                </View>
                <Text style={styles.assignButtonText}>Assign to Partner</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  clusterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  bannerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  countBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    paddingVertical: 60,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.error,
    fontWeight: '700',
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
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  partnerCard: {
    marginBottom: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
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
  partnerCardSelected: {
    borderWidth: 2,
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  partnerCardBusy: {
    backgroundColor: Colors.white,
    borderColor: '#FEF3C7',
  },
  selectionIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.success,
  },
  partnerCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  partnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarBusy: {
    backgroundColor: '#F59E0B',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  currentLoad: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 4,
  },
  textBusy: {
    color: '#92400E',
  },
  partnerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  checkmarkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 85,
    justifyContent: 'center',
  },
  statusAvailable: {
    backgroundColor: '#D1FAE5',
  },
  statusBusy: {
    backgroundColor: '#FEF3C7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTextAvailable: {
    color: '#065F46',
  },
  statusTextBusy: {
    color: '#92400E',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  assignButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  assignButtonDisabled: {
    opacity: 0.6,
  },
  assignButtonIcon: {
    marginRight: 8,
  },
  assignButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default SelectDeliveryPartnerScreen;
