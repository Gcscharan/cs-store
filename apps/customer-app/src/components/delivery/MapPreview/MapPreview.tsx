import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import {
  DELIVERY_COLORS,
  DELIVERY_TYPOGRAPHY,
  DELIVERY_SPACING,
  DELIVERY_RADIUS,
  DELIVERY_SHADOW,
} from '../../../constants/deliveryTheme';
import { haversineDistance, estimateETA } from '../../../utils/deliveryUtils';

interface MapPreviewProps {
  pickup: { lat: number; lng: number; label: string };
  drop: { lat: number; lng: number; label: string };
  onPress: () => void; // Opens Google Maps
}

const MapPreview: React.FC<MapPreviewProps> = ({ pickup, drop, onPress }) => {
  // FIX 4: Null guard — always first, prevents Android crash
  if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) return null;

  const distanceKm = haversineDistance(pickup.lat, pickup.lng, drop.lat, drop.lng);
  const etaMin = estimateETA(distanceKm);

  const midLat = (pickup.lat + drop.lat) / 2;
  const midLng = (pickup.lng + drop.lng) / 2;
  const latDelta = Math.abs(pickup.lat - drop.lat) * 1.6 + 0.01;
  const lngDelta = Math.abs(pickup.lng - drop.lng) * 1.6 + 0.01;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        {/* Pickup marker — blue/primary */}
        <Marker
          coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
          title={pickup.label}
        >
          <View style={styles.pickupMarker}>
            <Ionicons name="cube" size={14} color={DELIVERY_COLORS.white} />
          </View>
        </Marker>

        {/* Drop marker — red/danger */}
        <Marker
          coordinate={{ latitude: drop.lat, longitude: drop.lng }}
          title={drop.label}
        >
          <View style={styles.dropMarker}>
            <Ionicons name="location" size={14} color={DELIVERY_COLORS.white} />
          </View>
        </Marker>

        {/* Route polyline */}
        <Polyline
          coordinates={[
            { latitude: pickup.lat, longitude: pickup.lng },
            { latitude: drop.lat, longitude: drop.lng },
          ]}
          strokeWidth={3}
          strokeColor={DELIVERY_COLORS.primary}
        />
      </MapView>

      {/* Distance + ETA overlay chip */}
      <View style={styles.etaChip}>
        <Text style={styles.etaText}>
          {distanceKm.toFixed(1)} km · ~{etaMin} min
        </Text>
        <Ionicons name="chevron-forward" size={14} color={DELIVERY_COLORS.textPrimary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: DELIVERY_RADIUS.lg,
    overflow: 'hidden',
    marginHorizontal: DELIVERY_SPACING.lg,
    marginBottom: DELIVERY_SPACING.md,
    backgroundColor: DELIVERY_COLORS.card,
    ...DELIVERY_SHADOW.card,
  },
  pickupMarker: {
    backgroundColor: DELIVERY_COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: DELIVERY_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DELIVERY_COLORS.white,
  },
  dropMarker: {
    backgroundColor: DELIVERY_COLORS.danger,
    width: 28,
    height: 28,
    borderRadius: DELIVERY_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DELIVERY_COLORS.white,
  },
  etaChip: {
    position: 'absolute',
    bottom: DELIVERY_SPACING.sm,
    right: DELIVERY_SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.card,
    paddingHorizontal: DELIVERY_SPACING.sm,
    paddingVertical: DELIVERY_SPACING.xs,
    borderRadius: DELIVERY_RADIUS.full,
    gap: DELIVERY_SPACING.xs,
    ...DELIVERY_SHADOW.card,
  },
  etaText: {
    fontSize: DELIVERY_TYPOGRAPHY.sm,
    fontWeight: '600',
    color: DELIVERY_COLORS.textPrimary,
  },
});

export default MapPreview;
