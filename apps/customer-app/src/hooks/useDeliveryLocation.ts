import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useUpdateLocationMutation, useGetCurrentRouteQuery } from '../api/deliveryApi';
import { LOCATION_TASK_NAME } from '../tasks/backgroundLocationTask';
import { storage } from '../utils/storage';

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export function useDeliveryLocation(isOnDuty: boolean, enabled: boolean = true) {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<LocationPoint | null>(null);

  const [updateLocation] = useUpdateLocationMutation();
  const { data: routeData } = useGetCurrentRouteQuery(undefined, {
    skip: !isOnDuty || !enabled,
    pollingInterval: 10000,
  });

  const routeId = routeData?.route?.routeId || null;
  const routeIdRef = useRef(routeId);
  routeIdRef.current = routeId; // Keep fresh without deep deps

  const stopTracking = useCallback(async () => {
    try {
      const hasTask = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      await storage.removeItem('activeRouteId');
    } catch (e) {
      console.log('Error stopping tracking:', e);
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(async () => {
    let mounted = true;
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Enable GPS', 'Please turn on location services');
        return;
      }

      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setError('Location permission denied');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background location permission denied');
        // We still continue, but tracking will be foreground-only
      }

      // 1. Android Permission Race Condition Fix
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (!mounted) return;

      // 2. Clean up ghost watchers FIRST
      await stopTracking();

      setError(null);
      setIsTracking(true);

      // Persist routeId for background tasks during cold boots
      if (routeIdRef.current) {
        await storage.setItem('activeRouteId', routeIdRef.current);
      }

      // 3. True background tracking using TaskManager (Prevent Deduplication)
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced, // Battery optimization
          distanceInterval: 20, // Only fire when moved 20 meters
          timeInterval: 3000, 
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "Delivery in progress",
            notificationBody: "Live tracking active while you're on a route",
            notificationColor: "#f97316",
          },
        });
        console.log('[DeliveryLocation] Started BACKGROUND tracking');
      }
    } catch (err) {
      console.error('[DeliveryLocation] Error starting tracking:', err);
      setError('Failed to start location tracking');
    }

    return () => {
      mounted = false;
    };
  }, [stopTracking]);

  useEffect(() => {
    // 5. AppState recovery logic
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabled && isOnDuty && routeId) {
        startTracking(); // restart clean
      }
    });

    if (enabled && isOnDuty && routeId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      sub.remove();
      stopTracking();
    };
  }, [enabled, isOnDuty, !!routeId, startTracking, stopTracking]);

  return {
    isTracking,
    error,
    lastLocation,
    routeId,
    startTracking,
    stopTracking,
  };
}

export default useDeliveryLocation;
