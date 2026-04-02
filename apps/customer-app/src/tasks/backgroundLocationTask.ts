import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import axios from 'axios';
import { offlineQueue } from '../services/offlineQueue';
import { storage } from '../utils/storage';

export const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

// Server Flood Protection State (persists in memory as long as V8 Engine is alive in background)
let lastSentTime = 0;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[TaskManager] Error in location task:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[0];

    // 1. Spoofing Defense (Fake GPS Apps)
    if (loc.mocked) {
      console.warn('[TaskManager] Dropped mocked/fake GPS location');
      return;
    }

    // 2. Accuracy filtering: ignore bad GPS jumps
    if (loc.coords.accuracy && loc.coords.accuracy > 50) {
      return;
    }

    // 3. Flood Protection (Max 1 update per 2 seconds)
    const now = Date.now();
    if (now - lastSentTime < 2000) {
      return;
    }

    try {
      // 4. Background Auth Context & Cold Start State
      const [token, activeRouteId] = await Promise.all([
        storage.getItem('accessToken'),
        storage.getItem('activeRouteId') // Persisted by useDeliveryLocation
      ]);

      if (!token || !activeRouteId) return; // Cannot send without auth/route context

      // Send to backend
      const payload = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
        speed: loc.coords.speed || 0,
        heading: loc.coords.heading || 0,
        timestamp: loc.timestamp || Date.now(),
        routeId: activeRouteId,
      };

      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      
      await axios.put(`${API_URL}/delivery/location`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      lastSentTime = now;
      console.log('[TaskManager] Background location sent successfully');
    } catch (err: any) {
      console.error('[TaskManager] Failed to sync background location, queuing offline:', err.message);
      
      const activeRouteId = await storage.getItem('activeRouteId');
      if (!activeRouteId) return;

      // Retry on Location Send Failure
      offlineQueue.enqueue('LOCATION_UPDATE', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
        speed: loc.coords.speed || 0,
        heading: loc.coords.heading || 0,
        timestamp: loc.timestamp || Date.now(),
        routeId: activeRouteId,
      });
    }
  }
});
