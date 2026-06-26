import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from './useOrders';
import { getDriverLocation } from '../../services/locationService';
import { driverLocationStore } from '../../simulator/driverLocationStore';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const STORAGE_KEY_SORTED   = '@delivery_sorted_orders';
const STORAGE_KEY_CURRENT  = '@delivery_current_order';
const STORAGE_KEY_ARRANGED = '@delivery_route_arranged';

// ─── Warehouse (source of truth from shared-utils) ────────────────────────────
// Boya Bazar, Tiruvuru, Krishna District — lat/lng from WAREHOUSE_ADDRESS constant
const WAREHOUSE = { lat: 17.0956, lng: 80.6089 };

// Weighted scoring constants
// W1 = warehouse proximity weight (locality grouping)
// W2 = driver proximity weight (efficiency)
// W1 > W2 ensures city orders cluster first, but driver position still matters
const W1 = 0.6; // warehouse distance weight
const W2 = 0.4; // driver distance weight

// ─── Haversine (fast, always works) ──────────────────────────────────────────
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Coordinate validation ────────────────────────────────────────────────────
const isValidCoord = (lat?: number, lng?: number): boolean => {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

type RouteStop = {
  order: Order;
  score: number;
  warehouseDist: number;
  driverDist: number;
  roadMetres: number;
};

// ─── 2-opt optimization ────────────────────────────────────────────────────────
// Improves route by swapping segments to reduce total distance
// This fixes greedy routing inefficiencies (e.g., zig-zag patterns)
const twoOptOptimize = (
  route: RouteStop[],
  startLat: number,
  startLng: number,
): RouteStop[] => {
  if (route.length < 3) return route; // need at least 3 stops to optimize

  let improved = true;
  let optimized = [...route];

  while (improved) {
    improved = false;

    for (let i = 0; i < optimized.length - 1; i++) {
      for (let j = i + 2; j < optimized.length; j++) {
        // Calculate current segment distance
        const prevLat = i === 0 ? startLat : optimized[i - 1].order.address?.lat ?? startLat;
        const prevLng = i === 0 ? startLng : optimized[i - 1].order.address?.lng ?? startLng;
        const iLat = optimized[i].order.address?.lat;
        const iLng = optimized[i].order.address?.lng;
        const jPrevLat = optimized[j - 1].order.address?.lat;
        const jPrevLng = optimized[j - 1].order.address?.lng;
        const jLat = optimized[j].order.address?.lat;
        const jLng = optimized[j].order.address?.lng;
        if (
          iLat == null || iLng == null || jPrevLat == null || jPrevLng == null ||
          jLat == null || jLng == null
        ) {
          continue;
        }

        const currentDist =
          haversineKm(prevLat, prevLng, iLat, iLng) +
          haversineKm(jPrevLat, jPrevLng, jLat, jLng);

        // Calculate distance after reversing segment [i...j-1]
        const newDist =
          haversineKm(prevLat, prevLng, jPrevLat, jPrevLng) +
          haversineKm(iLat, iLng, jLat, jLng);

        // If reversing improves distance, apply it
        if (newDist < currentDist) {
          const segment = optimized.slice(i, j).reverse();
          optimized = [...optimized.slice(0, i), ...segment, ...optimized.slice(j)];
          improved = true;
        }
      }
    }
  }

  return optimized;
};

// ─── Google Distance Matrix (road distance) ───────────────────────────────────
const getRoadDistances = async (
  originLat: number,
  originLng: number,
  destinations: { lat: number; lng: number }[]
): Promise<number[] | null> => {
  if (!GOOGLE_MAPS_API_KEY || destinations.length === 0) return null;

  try {
    const origin = `${originLat},${originLng}`;
    const dests  = destinations.map(d => `${d.lat},${d.lng}`).join('|');
    const url    = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dests}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const res  = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK') {
      console.warn('[ROUTE_ARRANGEMENT] Distance Matrix API error:', json.status);
      return null;
    }

    const elements = json.rows?.[0]?.elements as any[];
    if (!elements || elements.length !== destinations.length) return null;

    return elements.map((el: any) =>
      el.status === 'OK' ? (el.distance.value as number) : Infinity
    );
  } catch (err) {
    console.warn('[ROUTE_ARRANGEMENT] Distance Matrix failed, using haversine fallback:', err);
    return null;
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useRouteArrangement = (activeOrders: Order[]) => {
  const [sortedOrderIds, setSortedOrderIds] = useState<string[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isArranged, setIsArranged]         = useState(false);
  const [isArranging, setIsArranging]       = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Synchronous mutex — prevents concurrent arrangeRoute() calls from racing.
  // React state (isArranging) is async and cannot guard against rapid double-taps.
  const isArrangingRef = useRef(false);

  // Fix 4 — debounce the route-already-arranged alert to avoid spamming
  // the driver if they tap the button multiple times in quick succession.
  const lastRouteAlertRef = useRef(0);

  // ── Subscribe to simulated movement (throttled) ─────────────────────────────
  useEffect(() => {
    let lastUpdate = 0;

    const unsub = driverLocationStore.subscribe((pos) => {
      const now = Date.now();

      if (now - lastUpdate < 1000) return; // throttle — prevent unnecessary re-renders at 5× speed
      lastUpdate = now;

      setDriverLocation(pos);
    });

    return unsub;
  }, []);

  // ── Load persisted state on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [sorted, current, arranged] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_SORTED),
          AsyncStorage.getItem(STORAGE_KEY_CURRENT),
          AsyncStorage.getItem(STORAGE_KEY_ARRANGED),
        ]);
        // All three keys must be present — if any is missing, stay in unarranged state (safe default)
        if (sorted && current && arranged === 'true') {
          setSortedOrderIds(JSON.parse(sorted));
          setCurrentOrderId(current);
          setIsArranged(true);
        }
      } catch (e) {
        // Read failure → stay in unarranged state (safe default)
        console.error('[ROUTE_ARRANGEMENT] Failed to load persisted state:', e);
      }
    })();
  }, []);

  // ── Auto-advance when current order is delivered ───────────────────────────
  useEffect(() => {
    if (!isArranged || !currentOrderId || sortedOrderIds.length === 0) return;

    const activeOrderIds = new Set(activeOrders.map(o => o._id));

    // Ghost-order guard: currentOrderId must exist in activeOrders
    // This handles slow network, stale cache, or socket delays
    if (activeOrderIds.has(currentOrderId)) return;

    // Current order is gone — find the first sortedOrderIds entry still in activeOrders
    const nextSurviving = sortedOrderIds.find(id => activeOrderIds.has(id));

    if (nextSurviving) {
      console.log('[ROUTE_ARRANGEMENT] Ghost-order guard: advancing to first surviving order:', nextSurviving);
      setCurrentOrderId(nextSurviving);
      AsyncStorage.setItem(STORAGE_KEY_CURRENT, nextSurviving);
    } else {
      console.log('[ROUTE_ARRANGEMENT] Ghost-order guard: no surviving orders — resetting');
      resetArrangement();
    }
  }, [activeOrders, currentOrderId, sortedOrderIds, isArranged]);

  // ── Core arrange logic ─────────────────────────────────────────────────────
  const arrangeRoute = useCallback(async () => {
    // 🔒 MUTEX GUARD — synchronous ref check prevents concurrent arrange calls.
    // React state (isArranging) is set asynchronously and cannot block a second
    // tap that fires before the first state update propagates (Fix #10).
    if (isArrangingRef.current) {
      console.warn('[ROUTE_ARRANGEMENT] Already arranging — skipping concurrent call');
      return;
    }
    isArrangingRef.current = true; // set synchronously before any await
    setIsArranging(true);

    // 🔥 FREEZE GUARD — once a route is arranged, block re-arrangement until
    // the driver explicitly resets. This replaces the simulation-only guard
    // that never fired in production (Fix #29).
    if (isArranged) {
      console.warn('[ROUTE_ARRANGEMENT] Route already arranged — call resetArrangement() first');
      // Fix 4 — debounce alert: max once every 2 seconds to avoid spam on rapid taps
      const now = Date.now();
      if (now - lastRouteAlertRef.current > 2_000) {
        lastRouteAlertRef.current = now;
        Alert.alert(
          'Route Already Arranged',
          'Tap "Reset" to clear the current route, then arrange again.',
          [{ text: 'OK' }]
        );
      }
      isArrangingRef.current = false;
      setIsArranging(false);
      return;
    }

    try {
      // 1. Get driver location (abstracted — real GPS in prod, simulated in dev)
      const { lat: driverLat, lng: driverLng } = await getDriverLocation();
      console.log('[ROUTE_ARRANGEMENT] Driver location:', { driverLat, driverLng });

      // 2. Filter eligible orders — picked up + valid coords only
      const eligible = activeOrders.filter(order => {
        const s = (order.orderStatus ?? '').toLowerCase();
        return (
          ['picked_up', 'in_transit', 'out_for_delivery', 'arrived'].includes(s) &&
          isValidCoord(order.address?.lat, order.address?.lng)
        );
      });

      if (eligible.length < 1) {
        Alert.alert(
          'Cannot Arrange Route',
          'Pick up at least one order with a valid delivery address before arranging your route.',
        );
        return;
      }

      // 3. Identify in-progress order — must remain currentOrderId after arrangement (Fix #9).
      //    An order is "in-progress" if it is the current order AND has an active delivery status.
      const IN_PROGRESS_STATUSES = ['in_transit', 'arrived'];
      const inProgressOrder = currentOrderId
        ? eligible.find(
            o =>
              o._id === currentOrderId &&
              IN_PROGRESS_STATUSES.includes((o.orderStatus ?? '').toLowerCase())
          ) ?? null
        : null;

      // Exclude in-progress order from the pool to be optimized
      const toOptimize = inProgressOrder
        ? eligible.filter(o => o._id !== inProgressOrder._id)
        : eligible;

      // 4. Sequential routing with phase separation and end penalty
      const driverToWarehouse = haversineKm(driverLat, driverLng, WAREHOUSE.lat, WAREHOUSE.lng);
      const W1 = driverToWarehouse < 5 ? 0.7 : 0.4;
      const W2 = 1 - W1;

      console.log('[ROUTE_ARRANGEMENT] Dynamic weights (first pick only):', {
        driverToWarehouseKm: driverToWarehouse.toFixed(1),
        W1_warehouse: W1,
        W2_driver: W2,
        strategy: driverToWarehouse < 5 ? 'CLUSTER_FIRST' : 'DRIVER_FIRST',
        inProgressOrderId: inProgressOrder?._id?.slice(-6) ?? 'none',
      });

      let optimizedRoute: RouteStop[] = [];

      if (toOptimize.length > 0) {
        let currentLat = driverLat;
        let currentLng = driverLng;
        const remaining = [...toOptimize];
        const route: typeof optimizedRoute = [];

        let stepNumber = 0;
        while (remaining.length > 0) {
          stepNumber++;
          const isFirstPick = stepNumber === 1;

          let bestOrder: Order | null = null;
          let bestScore = Infinity;
          let bestIndex = -1;
          let bestWarehouseDist = 0;
          let bestDriverDist = 0;

          remaining.forEach((order, idx) => {
            const lat = order.address?.lat;
            const lng = order.address?.lng;
            if (!isValidCoord(lat, lng)) return;

            const distFromCurrent = haversineKm(currentLat, currentLng, lat!, lng!);
            const distFromWarehouse = haversineKm(WAREHOUSE.lat, WAREHOUSE.lng, lat!, lng!);

            let score: number;
            if (isFirstPick) {
              score = (distFromWarehouse * W1) + (distFromCurrent * W2);
            } else {
              score = distFromCurrent;
              if (remaining.length <= 3) {
                score += distFromWarehouse * 0.2;
              }
            }

            if (score < bestScore) {
              bestScore = score;
              bestOrder = order;
              bestIndex = idx;
              bestWarehouseDist = distFromWarehouse;
              bestDriverDist = distFromCurrent;
            }
          });

          if (bestOrder && isValidCoord(bestOrder.address?.lat, bestOrder.address?.lng)) {
            route.push({ order: bestOrder, score: bestScore, warehouseDist: bestWarehouseDist, driverDist: bestDriverDist, roadMetres: Infinity });
            currentLat = bestOrder.address!.lat!;
            currentLng = bestOrder.address!.lng!;
            remaining.splice(bestIndex, 1);
          }
        }

        // Apply 2-opt optimization
        optimizedRoute = twoOptOptimize(route, driverLat, driverLng);
      }

      // 5. Build final sorted list — in-progress order is always first (Fix #9)
      const optimizedIds = optimizedRoute.map(x => x.order._id);
      const sorted = inProgressOrder
        ? [inProgressOrder._id, ...optimizedIds]
        : optimizedIds;

      // currentOrderId: preserve in-progress order, otherwise use first in sorted list
      const current = inProgressOrder ? inProgressOrder._id : sorted[0];

      console.log('[ROUTE_ARRANGED]', sorted);
      console.log('[CURRENT_ORDER]', current, inProgressOrder ? '(preserved — in-progress)' : '(new)');

      setSortedOrderIds(sorted);
      setCurrentOrderId(current);
      setIsArranged(true);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_SORTED,   JSON.stringify(sorted)),
        AsyncStorage.setItem(STORAGE_KEY_CURRENT,  current),
        AsyncStorage.setItem(STORAGE_KEY_ARRANGED, 'true'),
      ]);

    } catch (err) {
      console.error('[ROUTE_ARRANGEMENT] Error arranging route:', err);
    } finally {
      isArrangingRef.current = false; // always release mutex
      setIsArranging(false);
    }
  }, [activeOrders, currentOrderId, isArranged]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetArrangement = useCallback(async () => {
    setSortedOrderIds([]);
    setCurrentOrderId(null);
    setIsArranged(false);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_SORTED),
      AsyncStorage.removeItem(STORAGE_KEY_CURRENT),
      AsyncStorage.removeItem(STORAGE_KEY_ARRANGED),
    ]);
    console.log('[ROUTE_ARRANGEMENT] Reset');
  }, []);

  const isOrderLocked  = useCallback((id: string) => isArranged && id !== currentOrderId, [isArranged, currentOrderId]);
  const isOrderCurrent = useCallback((id: string) => isArranged && id === currentOrderId, [isArranged, currentOrderId]);

  const canArrangeRoute = activeOrders.filter(o =>
    ['picked_up', 'in_transit', 'out_for_delivery', 'arrived'].includes((o.orderStatus ?? '').toLowerCase())
  ).length >= 1;

  return {
    sortedOrderIds,
    currentOrderId,
    isArranged,
    isArranging,
    canArrangeRoute,
    arrangeRoute,
    resetArrangement,
    isOrderLocked,
    isOrderCurrent,
    driverLocation, // expose for UI distance display
  };
};
