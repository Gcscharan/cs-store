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
    // Removed pollingInterval - rely on socket events for real-time updates
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

  /** Returns true if the error is a known harmless Android lifecycle / background error */
  const isHarmlessLocationError = (err: any): boolean => {
    const msg = String(err?.message || err || '');
    return (
      msg.includes('ExpoKeepAwake') ||
      msg.includes('activity is no longer available') ||
      msg.includes("Couldn't start the foreground service") ||
      msg.includes('Foreground service cannot be started when the application is in the background') ||
      msg.includes('Call to function') ||
      msg.includes('has been rejected') ||
      msg.includes('no longer available')
    );
  };

  const startTracking = useCallback(async () => {
    // Hard gate: never attempt foreground service when not in foreground
    if (AppState.currentState !== 'active') {
      console.log('[DeliveryLocation] Skipping startTracking — app not active');
      return;
    }

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
        // Continue — foreground-only tracking
      }

      // Android permission race condition fix
      await new Promise<void>(resolve => setTimeout(() => resolve(), 300));

      // Re-check after async gap
      if (AppState.currentState !== 'active') {
        console.log('[DeliveryLocation] App went background during permission flow, aborting');
        return;
      }

      // Check if already tracking the same route
      const currentActiveRouteId = await storage.getItem('activeRouteId');
      const alreadyHasTask = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      
      if (alreadyHasTask && currentActiveRouteId === routeIdRef.current) {
        console.log('[DeliveryLocation] Already tracking current route, skipping restart');
        setIsTracking(true);
        return;
      }

      // Clean up any ghost watchers
      await stopTracking();

      // Don't start tracking if there's no route
      if (!routeIdRef.current) {
        console.log('[DeliveryLocation] No active route - skipping location tracking');
        setIsTracking(false);
        return;
      }

      setError(null);
      setIsTracking(true);

      if (routeIdRef.current) {
        await storage.setItem('activeRouteId', routeIdRef.current);
      }

      // Final foreground check right before native call
      if (AppState.currentState !== 'active') {
        console.log('[DeliveryLocation] App went background before startLocationUpdatesAsync, aborting');
        setIsTracking(false);
        return;
      }

      const isAlreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isAlreadyStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 20,
          timeInterval: 3000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Delivery in progress',
            notificationBody: "Live tracking active while you're on a route",
            notificationColor: '#f97316',
          },
        });
        console.log('[DeliveryLocation] Started BACKGROUND tracking');
      }
    } catch (err: any) {
      if (isHarmlessLocationError(err)) {
        console.warn('[DeliveryLocation] Suppressed harmless lifecycle error:', err?.message);
        setIsTracking(false);
      } else {
        console.error('[DeliveryLocation] Error starting tracking:', err);
        setError('Failed to start location tracking');
      }
    }
  }, [stopTracking]);

  useEffect(() => {
    // 5. AppState recovery logic — only restart when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabled && isOnDuty && routeId) {
        // Delay to let the Android activity fully resume before starting foreground service
        setTimeout(() => {
          if (AppState.currentState === 'active') {
            startTracking().catch((err) => {
              console.warn('[DeliveryLocation] startTracking rejected (AppState recovery):', err);
            });
          }
        }, 500);
      }
    });

    if (enabled && isOnDuty && routeId) {
      // Only start if not already tracking the same route
      startTracking().catch((err) => {
        console.warn('[DeliveryLocation] startTracking rejected (effect):', err);
      });
    } else {
      stopTracking();
    }

    return () => {
      sub.remove();
      // Only stop if the component is actually unmounting or duty/enabled changed
    };
  }, [enabled, isOnDuty, routeId, startTracking, stopTracking]);

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
