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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useGetOrderTrackingQuery } from '../../api/ordersApi';
import { logEvent } from '../../utils/analytics';
import { socketClient } from '../../services/socketClient';
import type { OrderTrackingRouteProp } from '../../navigation/types';

// Web Parity: Import core shared timeline constructor
import { buildCustomerOrderTimeline } from '@vyaparsetu/shared-utils';

const { width, height } = Dimensions.get('window');

// 🔥 DEBUG MODE ENABLED - COMPREHENSIVE LOGGING
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[🔍 ORDER_TRACKING]', ...args);
};
const logError = (...args: any[]) => {
  console.error('[🔥 ORDER_TRACKING ERROR]', ...args);
};

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
  log('🚀 COMPONENT RENDER START');
  
  const route = useRoute<OrderTrackingRouteProp>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);

  log('📋 Route params:', { orderId, isFocused });

  const [livePartnerLocation, setLivePartnerLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const { data: trackingData, isLoading, error, refetch } = useGetOrderTrackingQuery(orderId, {
    pollingInterval: isFocused && !socketClient.isConnected ? 30000 : 0,
  });

  log('📡 API State:', { isLoading, hasError: !!error, hasData: !!trackingData });
  
  if (trackingData) {
    log('📦 Tracking Data:', JSON.stringify({
      status: (trackingData as any)?.status,
      partnerLocation: (trackingData as any)?.partnerLocation,
      deliveryLocation: (trackingData as any)?.deliveryLocation,
      partner: (trackingData as any)?.partner,
      eta: (trackingData as any)?.eta,
      distance: (trackingData as any)?.distance,
    }, null, 2));
  }

  useEffect(() => {
    if (!isFocused || !orderId) return;

    const status = String((trackingData as any)?.status || '').toUpperCase();
    if (TERMINAL_STATUSES.includes(status)) return;

    log('🔌 Setting up socket subscription');
    const unsubscribe = socketClient.subscribeToDeliveryLocation(orderId, (data) => {
      log('📍 Live location update:', data);
      setLivePartnerLocation({
        latitude: data.latitude,
        longitude: data.longitude,
      });
    });

    return () => { 
      log('🔌 Cleaning up socket subscription');
      unsubscribe(); 
    };
  }, [isFocused, orderId, trackingData]);

  useEffect(() => {
    const status = String((trackingData as any)?.status || '').toUpperCase();
    if (status === 'DELIVERED') {
      log('✅ Order delivered, logging event');
      logEvent('delivery_completed', { orderId });
    }
  }, [trackingData, orderId]);

  // 🔒 SAFETY: Validate and sanitize coordinates to prevent native crashes
  const sanitizeCoordinate = (coord: any): { latitude: number; longitude: number } | null => {
    log('🔍 Sanitizing coordinate:', coord);
    
    if (!coord) {
      log('⚠️ Coordinate is null/undefined');
      return null;
    }
    
    const lat = Number(coord.latitude);
    const lng = Number(coord.longitude);
    
    log('🔢 Parsed values:', { lat, lng, isNaNLat: isNaN(lat), isNaNLng: isNaN(lng) });
    
    // Validate: must be valid numbers and within valid ranges
    if (
      isNaN(lat) || isNaN(lng) ||
      !isFinite(lat) || !isFinite(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      logError('❌ Invalid coordinate detected:', {
        original: coord,
        parsed: { lat, lng },
        checks: {
          isNaNLat: isNaN(lat),
          isNaNLng: isNaN(lng),
          isFiniteLat: isFinite(lat),
          isFiniteLng: isFinite(lng),
          latInRange: lat >= -90 && lat <= 90,
          lngInRange: lng >= -180 && lng <= 180,
        }
      });
      return null;
    }
    
    log('✅ Coordinate validated:', { latitude: lat, longitude: lng });
    return { latitude: lat, longitude: lng };
  };

  const partnerCoord = sanitizeCoordinate(livePartnerLocation || (trackingData as any)?.partnerLocation);
  const deliveryCoord = sanitizeCoordinate((trackingData as any)?.deliveryLocation);

  log('🗺️ Final coordinates:', { 
    partnerCoord, 
    deliveryCoord,
    hasPartner: !!partnerCoord,
    hasDelivery: !!deliveryCoord
  });

  useEffect(() => {
    if (partnerCoord && deliveryCoord) {
      log('📍 Fitting map to coordinates');
      mapRef.current?.fitToCoordinates(
        [partnerCoord, deliveryCoord],
        { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: true }
      );
    }
  }, [partnerCoord, deliveryCoord]);

  // Web Parity: Timeline Builder logic
  const combinedTimeline = useMemo(() => {
    log('🕐 Building timeline');
    if (!trackingData) return [];
    
    // Core timeline using shared-utils
    const backendTimeline = Array.isArray((trackingData as any).timeline) ? (trackingData as any).timeline : [];
    const timeline = buildCustomerOrderTimeline(backendTimeline) as any[];

    log('📊 Timeline steps:', timeline.length);

    // Refund logic mapping
    const refunds = Array.isArray((trackingData as any).refunds) ? (trackingData as any).refunds : [];
    if (!refunds.length) return timeline;

    log('💰 Processing refunds:', refunds.length);

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
    log('⏳ Showing loading state');
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to live tracking...</Text>
      </View>
    );
  }

  if (error || !trackingData) {
    logError('❌ Error state:', error);
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Unable to load tracking data</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const td = trackingData as any;
  const status = mapStatusToLabel(td.status);
  const partner = td.partner;
  const eta = td.eta;
  const distance = td.distance;
  const currentStepLabel = combinedTimeline.find(s => s.state === 'current')?.label || status;

  log('🎨 Rendering main UI with:', { status, hasPartner: !!partner, eta, distance });

  // 🔥 BINARY SEARCH DEBUG FLAGS
  const RENDER_MAP = true; // Toggle this to test if map causes crash
  const RENDER_TIMELINE = true; // Toggle this to test if timeline causes crash
  const RENDER_PARTNER_INFO = true; // Toggle this to test if partner info causes crash

  log('🎛️ Debug flags:', { RENDER_MAP, RENDER_TIMELINE, RENDER_PARTNER_INFO });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Track Order [DEBUG]</Text>
          <Text style={styles.headerSub}>#{orderId?.slice ? orderId.slice(-8).toUpperCase() : 'ORDER'}</Text>
        </View>
        <View style={[styles.connectionDot, { backgroundColor: socketClient.isConnected ? '#16a34a' : '#f59e0b' }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* 🔥 DEBUG: MAP SECTION */}
        {RENDER_MAP ? (
          <View style={styles.mapContainer}>
            {log('🗺️ Rendering map section')}
            {/* 🔒 SAFETY: Only render map if we have valid coordinates */}
            {(partnerCoord || deliveryCoord) ? (
              <>
                {log('✅ Rendering MapView with coordinates')}
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
                  {partnerCoord && (
                    <>
                      {log('📍 Rendering partner marker:', partnerCoord)}
                      <Marker
                        coordinate={partnerCoord}
                        title="Delivery Partner"
                        description={partner?.name || 'On the way'}
                      >
                        <View style={styles.partnerMarker}>
                          <Ionicons name="bicycle" size={20} color={Colors.white} />
                        </View>
                      </Marker>
                    </>
                  )}

                  {deliveryCoord && (
                    <>
                      {log('📍 Rendering delivery marker:', deliveryCoord)}
                      <Marker
                        coordinate={deliveryCoord}
                        title="Your Location"
                        pinColor={Colors.primary}
                      />
                    </>
                  )}

                  {partnerCoord && deliveryCoord && (
                    <>
                      {log('📏 Rendering polyline')}
                      <Polyline
                        coordinates={[partnerCoord, deliveryCoord]}
                        strokeWidth={4}
                        strokeColor={Colors.primary}
                      />
                    </>
                  )}
                </MapView>
              </>
            ) : (
              <>
                {log('⚠️ Showing map placeholder')}
                <View style={[styles.map, styles.mapPlaceholder]}>
                  <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.mapPlaceholderText}>Waiting for location data...</Text>
                </View>
              </>
            )}
            
            {/* Floating ETA Stats */}
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
        ) : (
          <View style={styles.debugPlaceholder}>
            <Text style={styles.debugText}>🔥 MAP DISABLED FOR DEBUG</Text>
          </View>
        )}

        {/* Dynamic Context Card */}
        <View style={styles.bottomSheet}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: TERMINAL_STATUSES.includes((td.status||'').toUpperCase()) ? Colors.textMuted : Colors.success }]} />
            <Text style={styles.statusText}>{mapStatusToLabel(currentStepLabel)}</Text>
            {livePartnerLocation && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>● LIVE</Text>
              </View>
            )}
          </View>

          {/* 🔥 DEBUG: PARTNER INFO SECTION */}
          {RENDER_PARTNER_INFO && partner && (
            <View style={styles.partnerInfo}>
              <View style={styles.partnerAvatar}>
                <Text style={styles.avatarTxt}>{partner?.name?.charAt(0) || 'D'}</Text>
              </View>
              <View style={styles.partnerDetails}>
                <Text style={styles.partnerName}>{partner?.name || 'Delivery Partner'}</Text>
                <Text style={styles.partnerSub}>{partner?.vehicleType || 'Executive'}</Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => partner?.phone && Linking.openURL(`tel:${partner.phone}`)}
              >
                <Ionicons name="call" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          )}

          {/* 🔥 DEBUG: TIMELINE SECTION */}
          {RENDER_TIMELINE ? (
            <View style={styles.timelineContainer}>
              {log('🕐 Rendering timeline with', combinedTimeline.length, 'steps')}
              <Text style={styles.timelineHeaderTitle}>Order Status</Text>
              {combinedTimeline.map((step, index) => {
                const isLast = index === combinedTimeline.length - 1;
                const mappedLabel = mapStatusToLabel(step.label || step.key);
                
                let color = Colors.textLight;
                let icon = 'ellipse-outline'; // pending
                let textColor = Colors.textMuted;

                if (step.state === 'completed') {
                  color = Colors.success;
                  icon = 'checkmark-circle';
                  textColor = Colors.textPrimary;
                } else if (step.state === 'current') {
                  color = Colors.warning;
                  icon = 'time';
                  textColor = Colors.textPrimary;
                } else if (step.state === 'failed') {
                  color = Colors.error;
                  icon = 'close-circle';
                  textColor = Colors.error;
                }

                return (
                  <View key={step.key + index} style={styles.timelineStep}>
                    <View style={styles.timelineIconContainer}>
                      <Ionicons name={icon as any} size={24} color={color} />
                      {!isLast && <View style={[styles.timelineLine, { backgroundColor: step.state === 'completed' ? Colors.success : Colors.border }]} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, { color: textColor }]}>{mappedLabel}</Text>
                      {step.timestamp && (
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
          ) : (
            <View style={styles.debugPlaceholder}>
              <Text style={styles.debugText}>🔥 TIMELINE DISABLED FOR DEBUG</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
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
  debugPlaceholder: {
    height: 200,
    backgroundColor: '#fff3cd',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffc107',
    borderStyle: 'dashed',
    margin: 16,
  },
  debugText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#856404',
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
