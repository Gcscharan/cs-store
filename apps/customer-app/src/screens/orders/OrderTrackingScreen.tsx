import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useGetOrderTrackingQuery } from '../../api/ordersApi';
import { logEvent } from '../../utils/analytics';
import { socketClient } from '../../services/socketClient';
import type { OrderTrackingRouteProp } from '../../navigation/types';

// Web Parity: Import core shared timeline constructor
import { buildCustomerOrderTimeline } from '@vyaparsetu/shared-utils';
import { getSafeIcon, safeDate, safeText } from '../../utils/safeRender';

const { width, height } = Dimensions.get('window');

// Terminal states — no tracking needed
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED', 'CANCELED', 'FAILED', 'RETURNED'];

// Web Parity: Deep mapping translation layer
const mapStatusToLabel = (status: string) => {
  if (!status) return status;
  const s = status.toUpperCase();
  const map: Record<string, string> = {
    ORDER_PLACED: 'Order Placed',
    PLACED: 'Order Placed',
    PENDING: 'Order Placed',
    CONFIRMED: 'Confirmed',
    PROCESSING: 'Confirmed',
    ORDER_PACKED: 'In Transit',
    PACKED: 'In Transit',
    OUT_FOR_DELIVERY: 'In Transit',
    IN_TRANSIT: 'In Transit',
    ORDER_IN_TRANSIT: 'In Transit',
    ORDER_DELIVERED: 'Delivered',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    FAILED: 'Failed',
    RETURNED: 'Returned',
    READY_FOR_PICKUP: 'In Transit',
    CUSTOMER_REFUND_INITIATED: 'Refund Initiated',
    CUSTOMER_REFUND_PROCESSING: 'Refund Processing',
    CUSTOMER_REFUND_FINAL: 'Refund Finalized',
  };
  return map[s] || (typeof status === 'string' && status.length > 0 ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ') : String(status));
};

const OrderTrackingScreen: React.FC = () => {
  const route = useRoute<OrderTrackingRouteProp>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);

  const [livePartnerLocation, setLivePartnerLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const { data: trackingData, isLoading, error, refetch } = useGetOrderTrackingQuery(orderId, {
    pollingInterval: isFocused && !socketClient.isConnected ? 30000 : 0,
  });

  useEffect(() => {
    if (!isFocused || !orderId) return;

    const status = String((trackingData as any)?.status || '').toUpperCase();
    if (TERMINAL_STATUSES.includes(status)) return;

    const unsubscribe = socketClient.subscribeToDeliveryLocation(orderId, (data) => {
      setLivePartnerLocation({
        latitude: data.latitude,
        longitude: data.longitude,
      });
    });

    return () => { unsubscribe(); };
  }, [isFocused, orderId, trackingData]);

  useEffect(() => {
    const status = String((trackingData as any)?.status || '').toUpperCase();
    if (status === 'DELIVERED') {
      logEvent('delivery_completed', { orderId });
    }
  }, [trackingData, orderId]);

  // 🔒 SAFETY: Validate and sanitize coordinates to prevent native crashes
  const sanitizeCoordinate = (coord: any): { latitude: number; longitude: number } | null => {
    if (!coord) return null;
    
    // Handle both {lat, lng} and {latitude, longitude} formats
    const latValue = coord.latitude ?? coord.lat;
    const lngValue = coord.longitude ?? coord.lng;
    
    // CRITICAL: Convert to number and validate
    const lat = typeof latValue === 'number' ? latValue : Number(latValue);
    const lng = typeof lngValue === 'number' ? lngValue : Number(lngValue);
    
    // Validate: must be valid numbers and within valid ranges
    if (
      isNaN(lat) || isNaN(lng) ||
      !isFinite(lat) || !isFinite(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      console.warn('[OrderTracking] Invalid coordinate detected:', { coord, parsed: { lat, lng } });
      return null;
    }
    
    return { latitude: lat, longitude: lng };
  };

  // 🔒 SAFETY: Sanitize all coordinate sources
  const partnerCoord = sanitizeCoordinate(
    livePartnerLocation || 
    (trackingData as any)?.partnerLocation || 
    (trackingData as any)?.liveLocation
  );
  const deliveryCoord = sanitizeCoordinate((trackingData as any)?.deliveryLocation);

  useEffect(() => {
    if (partnerCoord && deliveryCoord) {
      mapRef.current?.fitToCoordinates(
        [partnerCoord, deliveryCoord],
        { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: true }
      );
    }
  }, [partnerCoord, deliveryCoord]);

  // Web Parity: Timeline Builder logic
  const combinedTimeline = useMemo(() => {
    if (!trackingData) return [];
    
    // Core timeline using shared-utils
    const backendTimeline = Array.isArray((trackingData as any).timeline) ? (trackingData as any).timeline : [];
    const timeline = buildCustomerOrderTimeline(backendTimeline) as any[];

    // Refund logic mapping
    const refunds = Array.isArray((trackingData as any).refunds) ? (trackingData as any).refunds : [];
    if (!refunds.length) return timeline;

    const statuses = refunds.map(r => String(r.status || '').trim().toUpperCase());
    const hasCompleted = statuses.includes('COMPLETED');
    const hasProcessing = statuses.includes('PROCESSING') || statuses.includes('INITIATED');
    const hasFailed = statuses.includes('FAILED');
    const hasPartial = statuses.includes('PARTIAL');

    const stage = hasFailed && !hasCompleted ? 'FAILED' :
      hasPartial ? 'PARTIAL' :
      hasCompleted && !hasProcessing ? 'COMPLETED' :
      hasProcessing ? 'PROCESSING' : 'REQUESTED';

    const earliestCreatedAt = refunds
      .map(r => String(r.createdAt || r.updatedAt))
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

    const latestUpdatedAt = refunds
      .map(r => String(r.updatedAt || r.createdAt))
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const refundSteps = [];
    refundSteps.push({
      key: 'CUSTOMER_REFUND_INITIATED',
      label: stage === 'REQUESTED' ? 'Refund requested' : 'Refund initiated',
      timestamp: earliestCreatedAt,
      state: stage === 'REQUESTED' ? 'current' : 'completed',
    });

    refundSteps.push({
      key: 'CUSTOMER_REFUND_PROCESSING',
      label: 'Refund processing',
      timestamp: stage === 'COMPLETED' || stage === 'FAILED' || stage === 'PARTIAL' ? latestUpdatedAt : undefined,
      state: stage === 'PROCESSING' ? 'current' : (stage === 'REQUESTED' ? 'pending' : 'completed'),
    });

    refundSteps.push({
      key: 'CUSTOMER_REFUND_FINAL',
      label: stage === 'FAILED' ? 'Refund failed' : (stage === 'PARTIAL' ? 'Partial refund' : 'Refund completed'),
      timestamp: stage === 'COMPLETED' || stage === 'FAILED' || stage === 'PARTIAL' ? latestUpdatedAt : undefined,
      state: stage === 'FAILED' ? 'failed' : (stage === 'COMPLETED' ? 'completed' : (stage === 'PARTIAL' ? (hasProcessing ? 'current' : 'completed') : 'pending')),
    });

    return [...timeline, ...refundSteps];
  }, [trackingData]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Tracking" showBackButton />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary || '#3399cc'} />
          <Text style={styles.loadingText}>Connecting to live tracking...</Text>
        </View>
      </View>
    );
  }

  if (error || !trackingData) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Tracking" showBackButton />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error || '#dc2626'} />
          <Text style={styles.errorText}>Unable to load tracking data</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const td = trackingData as any;
  const status = mapStatusToLabel(td.status);
  const partner = td.partner;
  const eta = td.eta;
  const distance = td.distance;
  
  const currentStepLabel = 
    typeof combinedTimeline.find(s => s.state === 'current')?.label === 'string' 
      ? combinedTimeline.find(s => s.state === 'current')?.label 
      : status;

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Track Order" 
        subtitle={`#${orderId?.slice ? orderId.slice(-8).toUpperCase() : 'ORDER'}`}
        showBackButton 
        rightComponent={
          <View style={[styles.connectionDot, { backgroundColor: socketClient.isConnected ? '#16a34a' : '#f59e0b' }]} />
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Fixed Map Header Component */}
        <View style={styles.mapContainer}>
          {/* 🔒 SAFETY: Only render map if we have valid coordinates */}
          {(partnerCoord || deliveryCoord) ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: partnerCoord?.latitude || deliveryCoord?.latitude || 20.5937,
                longitude: partnerCoord?.longitude || deliveryCoord?.longitude || 78.9629,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {/* 🔒 SAFETY: Only render marker if coordinate is valid */}
              {partnerCoord && (
                <Marker
                  coordinate={{
                    latitude: partnerCoord.latitude,
                    longitude: partnerCoord.longitude,
                  }}
                  title="Delivery Partner"
                  description={partner?.name || 'On the way'}
                >
                  <View style={styles.partnerMarker}>
                    <Ionicons name="bicycle" size={20} color={Colors.white || '#ffffff'} />
                  </View>
                </Marker>
              )}

              {/* 🔒 SAFETY: Only render marker if coordinate is valid */}
              {deliveryCoord && (
                <Marker
                  coordinate={{
                    latitude: deliveryCoord.latitude,
                    longitude: deliveryCoord.longitude,
                  }}
                  title="Your Location"
                  pinColor={Colors.primary || '#3399cc'}
                />
              )}

              {/* 🔒 SAFETY: Only render polyline if BOTH coordinates are valid */}
              {partnerCoord && deliveryCoord && (
                <Polyline
                  coordinates={[
                    { latitude: partnerCoord.latitude, longitude: partnerCoord.longitude },
                    { latitude: deliveryCoord.latitude, longitude: deliveryCoord.longitude },
                  ]}
                  strokeWidth={4}
                  strokeColor={Colors.primary || '#3399cc'}
                />
              )}
            </MapView>
          ) : (
            <View style={[styles.map, styles.mapPlaceholder]}>
              <Ionicons name="map-outline" size={48} color={Colors.textMuted || '#999999'} />
              <Text style={styles.mapPlaceholderText}>Waiting for location data...</Text>
            </View>
          )}
          
          {/* Floating ETA Stats - Only show if we have both coordinates */}
          {partnerCoord && deliveryCoord && (
            <View style={styles.etaCard}>
              <View style={styles.etaRow}>
                <View>
                  <Text style={styles.etaLabel}>Arriving in</Text>
                  <Text style={styles.etaValue}>{eta || 'Calculating...'}</Text>
                </View>
                <View style={styles.divider} />
                <View>
                  <Text style={styles.etaLabel}>Distance</Text>
                  <Text style={styles.etaValue}>{distance || '-- km'}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Dynamic Context Card */}
        <View style={styles.bottomSheet}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: TERMINAL_STATUSES.includes((td.status||'').toUpperCase()) ? (Colors.textMuted || '#999999') : (Colors.success || '#16a34a') }]} />
            <Text style={styles.statusText}>{mapStatusToLabel(currentStepLabel)}</Text>
            {livePartnerLocation && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>● LIVE</Text>
              </View>
            )}
          </View>

          {partner && (
            <View style={styles.partnerInfo}>
              <View style={styles.partnerAvatar}>
                <Text style={styles.avatarTxt}>{(partner?.name && partner.name.length > 0) ? partner.name.charAt(0).toUpperCase() : 'D'}</Text>
              </View>
              <View style={styles.partnerDetails}>
                <Text style={styles.partnerName}>{partner?.name || 'Delivery Partner'}</Text>
                <Text style={styles.partnerSub}>{partner?.vehicleType || 'Executive'}</Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => {
                  if (partner?.phone && typeof partner.phone === 'string' && partner.phone.length > 0) {
                    Linking.openURL(`tel:${partner.phone}`);
                  }
                }}
              >
                <Ionicons name="call" size={20} color={Colors.white || '#ffffff'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Web Parity Timeline Builder */}
          <View style={styles.timelineContainer}>
            <Text style={styles.timelineHeaderTitle}>Order Status</Text>
            {combinedTimeline.map((step, index) => {
              const isLast = index === combinedTimeline.length - 1;
              const mappedLabel = mapStatusToLabel(step.label || step.key);
              
              let color = Colors.textLight || '#cccccc';
              let icon: any = 'ellipse-outline'; // pending
              let textColor = Colors.textMuted || '#999999';

              if (step.state === 'completed') {
                color = Colors.success || '#16a34a';
                icon = 'checkmark-circle';
                textColor = Colors.textPrimary || '#000000';
              } else if (step.state === 'current') {
                color = Colors.warning || '#f59e0b';
                icon = 'time';
                textColor = Colors.textPrimary || '#000000';
              } else if (step.state === 'failed') {
                color = Colors.error || '#dc2626';
                icon = 'close-circle';
                textColor = Colors.error || '#dc2626';
              }

              const safeIcon = getSafeIcon(step.state);

              return (
                <View key={step.key + index} style={styles.timelineStep}>
                  <View style={styles.timelineIconContainer}>
                    {safeIcon ? (
                      <Ionicons name={safeIcon as any} size={24} color={color || '#999'} />
                    ) : (
                      <View style={{ width: 24, height: 24 }} />
                    )}
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: step.state === 'completed' ? (Colors.success || '#16a34a') : (Colors.border || '#e5e7eb') }]} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineLabel, { color: textColor }]}>{mappedLabel}</Text>
                    {step.timestamp && !isNaN(new Date(step.timestamp).getTime()) && (
                      <Text style={styles.timelineTime}>
                        {new Date(step.timestamp).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </Text>
                    )}
                    {step.description && <Text style={styles.timelineDesc}>{step.description}</Text>}
                  </View>
                </View>
              );
            })}
          </View>

        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  mapContainer: { height: 350, position: 'relative', width: '100%' },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontWeight: '600' },
  errorText: { marginTop: 12, fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: Colors.white, fontWeight: '700' },
  partnerMarker: {
    backgroundColor: Colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.white,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  etaCard: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  etaRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  etaLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  etaValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  divider: { width: 1, height: 30, backgroundColor: Colors.border },
  bottomSheet: {
    padding: 24,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20, // Overlays map slightly
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 8 },
  statusText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  liveBadge: {
    marginLeft: 'auto',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveText: { fontSize: 10, fontWeight: '800', color: '#dc2626' },
  partnerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, backgroundColor: Colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTxt: { fontSize: 20, fontWeight: '700', color: Colors.textSecondary },
  partnerDetails: { flex: 1, marginLeft: 16 },
  partnerName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  partnerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineContainer: { marginTop: 10, paddingTop: 10 },
  timelineHeaderTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  timelineStep: { flexDirection: 'row', marginBottom: 0 },
  timelineIconContainer: { alignItems: 'center', width: 40 },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 30, paddingTop: 2 },
  timelineLabel: { fontSize: 15, fontWeight: '600' },
  timelineTime: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  timelineDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
});

export default OrderTrackingScreen;
