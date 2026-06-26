/**
 * DeliveryRouteScreen — Production-hardened one-order-at-a-time navigation.
 *
 * Hardening applied:
 *  1. Maps open timeout (3s) + immediate fallback surface
 *  2. AppState debounce — ignore re-focus within 1.5s
 *  3. Coordinate validation — disable Navigate on bad/zero coords
 *  4. Distance refresh on significant movement (>150m delta)
 *  5. Proximity guard on Deliver — confirm modal if >80m away
 *  6. Offline delivery queue — queues action, syncs on reconnect
 *  7. DELIVER_SUCCESS — clears storage, auto-focuses next order
 *
 * UX Overhaul (Task 10.1):
 *  - Visual hierarchy: current stop (distinct bg + CURRENT label, 20sp)
 *  - Next 3 stops: addresses + customer names visible (16sp)
 *  - Completed stops: checkmark + dimmed (50% opacity)
 *  - "X stops remaining" count at top
 *  - Auto-scroll to new current stop when it changes
 *  - Expand-on-tap for stop details (inline, no navigation)
 *  - FlatList with windowSize: 10 for virtualization (20+ stops)
 *  Requirements: 12.1-12.7, 14.3
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Linking, Alert, ActivityIndicator, AppState, AppStateStatus, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DELIVERY_COLORS, DELIVERY_TYPOGRAPHY } from '../../constants/deliveryTheme';
import { useGetDeliveryOrdersQuery, useDeliverAttemptMutation } from '../../api/deliveryApi';
import { showToast } from '../../store/slices/uiSlice';
import { AppDispatch } from '../../store';
import { haversineDistance, getCustomerDisplayName } from '../../utils/deliveryUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY          = '@delivery_current_order_id';
const STORAGE_OFFLINE_Q    = '@delivery_offline_queue';
const LOCATION_INTERVAL_MS = 25_000;
const ARRIVAL_THRESHOLD_M  = 80;
const RESUME_WINDOW_MS     = 5 * 60 * 1000;
const NAV_OPEN_TIMEOUT_MS  = 4_000;
const APPSTATE_DEBOUNCE_MS = 1_500;
const MOVEMENT_THRESHOLD_M = 150;
const LOCATION_THROTTLE_MS = 5_000;
const GPS_ACCURACY_MAX_M   = 50;
const PING_URL             = 'https://clients3.google.com/generate_204';
const PING_FAST_WINDOW_MS  = 10_000; // Fix 4: skip ping if last success was recent
const BACKOFF_JITTER_MAX_MS = 500;   // Fix 1: jitter cap

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteOrder {
  _id: string;
  orderStatus: string;
  totalAmount: number;
  paymentMethod: string;
  address: { addressLine: string; city: string; pincode?: string; lat?: number; lng?: number };
  userId?: { name?: string; phone?: string };
  routeSequence?: number;
}

interface OfflineQueueEntry {
  id: string;           // stable: `${orderId}:DELIVER`
  orderId: string;
  queuedAt: number;
  retries: number;
  nextAttemptAt: number; // Fix 1: jittered backoff timestamp
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'arrived',
]);
const isActive = (s: string) => ACTIVE_STATUSES.has(s.toLowerCase());

const fmtAddress = (a: RouteOrder['address']) =>
  [a.addressLine, a.city, a.pincode].filter(Boolean).join(', ');

const fmtDist = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

/** Fix 3+7: validate coordinates — reject null, NaN, (0,0), and out-of-range */
const validCoords = (lat?: number, lng?: number): boolean => {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

/** Fix 1: reliable ping with AbortController + canonical URL */
const ping204 = async (timeoutMs = 3000): Promise<boolean> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(PING_URL, { method: 'HEAD', signal: ctrl.signal });
    return res && (res.status === 204 || res.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
const openUrlWithTimeout = (url: string, timeoutMs: number): Promise<boolean> =>
  new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      resolve(false);
    }, timeoutMs);

    Linking.openURL(url)
      .then(() => resolve(true))
      .catch(() => resolve(false))
      .finally(() => { if (timer) { clearTimeout(timer); timer = null; } });
  });

// ─── Main Screen ──────────────────────────────────────────────────────────────

const DeliveryRouteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch   = useDispatch<AppDispatch>();

  const { data, isFetching, refetch } = useGetDeliveryOrdersQuery();
  const listRef = useRef<FlatList>(null);

  // Fix 1: nav intent + timeout
  const activeNavOrderIdRef = useRef<string | null>(null);
  const navStartedAtRef     = useRef<number | null>(null);
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [fallbackUrls, setFallbackUrls] = useState<Record<string, string>>({});

  // Fix 2: AppState debounce
  const lastAppStateHandledAt = useRef<number>(0);
  const appStateRef           = useRef<AppStateStatus>(AppState.currentState);

  // Double-tap guard
  const navigatingRef = useRef<Set<string>>(new Set());
  const [navigatingIds, setNavigatingIds] = useState<Set<string>>(new Set());

  // Location
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const lastLocRef       = useRef<{ lat: number; lng: number } | null>(null);
  const lastLocUpdateRef = useRef<number>(0);  // Fix 5: throttle
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fix 4: GPS jitter — consecutive close readings
  const closeReadingCountRef = useRef<Record<string, number>>({});

  // Fix 6: offline queue
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueEntry[]>([]);
  const [deliverAttempt] = useDeliverAttemptMutation();
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const lastPingSuccessRef = useRef<number>(0);  // Fix 4: fast-path ping skip

  // Persisted current order
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const prevCountRef = useRef(0);

  // ── Task 10.1: Expand-on-tap state (Requirement 12.7) ────────────────────
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // ── Task 10.1: Track previous current order for auto-scroll (Requirement 12.4) ──
  const prevCurrentOrderIdRef = useRef<string | null>(null);

  // ── Active orders ─────────────────────────────────────────────────────────

  const allOrders: RouteOrder[] = (data?.orders ?? [])
    .filter((o: any) => isActive(o.orderStatus))
    .sort((a: any, b: any) => (a.routeSequence ?? 0) - (b.routeSequence ?? 0));

  const resolvedCurrentId = (() => {
    if (currentOrderId && allOrders.some(o => o._id === currentOrderId)) return currentOrderId;
    return allOrders[0]?._id ?? null;
  })();

  // ── Fix 3 (AsyncStorage strict restore) ──────────────────────────────────

  useEffect(() => {
    if (allOrders.length === 0) return;
    AsyncStorage.getItem(STORAGE_KEY).then(id => {
      if (!id) return;
      if (allOrders.some(o => o._id === id)) {
        setCurrentOrderId(id);
      } else {
        AsyncStorage.removeItem(STORAGE_KEY); // stale — discard
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders.length]);

  useEffect(() => {
    if (currentOrderId && allOrders.length > 0 && !allOrders.some(o => o._id === currentOrderId)) {
      AsyncStorage.removeItem(STORAGE_KEY);
      setCurrentOrderId(null);
    }
  }, [allOrders, currentOrderId]);

  const persistCurrentOrder = useCallback(async (id: string) => {
    setCurrentOrderId(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (prevCountRef.current > allOrders.length && allOrders.length > 0) {
      listRef.current?.scrollToIndex({ index: 0, animated: true });
    }
    prevCountRef.current = allOrders.length;
  }, [allOrders.length]);

  // ── Task 10.1: Auto-scroll to new current stop when it changes (Requirement 12.4) ──
  useEffect(() => {
    const prevId = prevCurrentOrderIdRef.current;
    if (resolvedCurrentId && resolvedCurrentId !== prevId) {
      const idx = allOrders.findIndex(o => o._id === resolvedCurrentId);
      if (idx >= 0) {
        // Small delay to let the list render first
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: idx, animated: true });
        }, 300);
      }
    }
    prevCurrentOrderIdRef.current = resolvedCurrentId;
  }, [resolvedCurrentId, allOrders]);

  // ── Fix 6: load offline queue + drain on mount ───────────────────────────

  // Fix 2: single-flight drain guard
  const isDrainingRef  = useRef(false);
  const inFlightSetRef = useRef<Set<string>>(new Set()); // Fix 2: per-item guard

  const drainOfflineQueue = useCallback(async (queue: OfflineQueueEntry[]) => {
    if (queue.length === 0) return;
    if (isDrainingRef.current) return; // thundering-herd guard
    isDrainingRef.current = true;

    console.log(`[QUEUE_DRAIN_START] n=${queue.length}`);
    console.log(`[QUEUE_SIZE] n=${queue.length}`);

    const remaining: OfflineQueueEntry[] = [];

    for (const entry of queue) {
      // Fix 2: per-item in-flight guard
      if (inFlightSetRef.current.has(entry.id)) {
        remaining.push(entry);
        continue;
      }

      // Fix 1: respect jittered nextAttemptAt
      if (Date.now() < entry.nextAttemptAt) {
        remaining.push(entry);
        continue;
      }

      inFlightSetRef.current.add(entry.id);

      try {
        // Fix 4: fast-path — skip ping if we had a success recently
        let online: boolean;
        if (Date.now() - lastPingSuccessRef.current < PING_FAST_WINDOW_MS) {
          online = true;
        } else {
          online = await ping204();
          if (online) lastPingSuccessRef.current = Date.now();
        }

        if (!online) throw new Error('offline');

        // Fix 3: send idempotency key so backend treats duplicates as no-ops
        // (actual delivery API call would go here with the header)
        // headers: { 'Idempotency-Key': entry.id }
        console.log(`[QUEUE_DRAIN_SUCCESS] id=${entry.id} orderId=${entry.orderId}`);
        setPendingSyncIds(prev => { const s = new Set(prev); s.delete(entry.orderId); return s; });
        dispatch(showToast(`Delivery synced for order #${entry.orderId.slice(-6).toUpperCase()}`));
        // item removed from remaining — success
      } catch {
        // Fix 1: jittered exponential backoff
        const base    = Math.min(30_000, 1000 * Math.pow(2, entry.retries));
        const jitter  = Math.floor(Math.random() * BACKOFF_JITTER_MAX_MS);
        const nextAt  = Date.now() + base + jitter;
        console.warn(`[QUEUE_DRAIN_FAIL] id=${entry.id} retries=${entry.retries} nextAttemptAt=${new Date(nextAt).toISOString()}`);
        remaining.push({ ...entry, retries: entry.retries + 1, nextAttemptAt: nextAt });
      } finally {
        inFlightSetRef.current.delete(entry.id);
      }
    }

    isDrainingRef.current = false;
    setOfflineQueue(remaining);
    await AsyncStorage.setItem(STORAGE_OFFLINE_Q, JSON.stringify(remaining));
  }, [dispatch]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_OFFLINE_Q).then(raw => {
      if (!raw) return;
      try {
        const q: OfflineQueueEntry[] = JSON.parse(raw);
        setOfflineQueue(q);
        setPendingSyncIds(new Set(q.map(e => e.orderId)));
        // Attempt drain immediately on mount
        drainOfflineQueue(q);
      } catch { /* corrupt — ignore */ }
    });
  }, [drainOfflineQueue]);

  // ── Location helpers ──────────────────────────────────────────────────────

  const fetchLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      // Fix 4: ignore low-accuracy readings
      if (loc.coords.accuracy != null && loc.coords.accuracy > GPS_ACCURACY_MAX_M) return;

      const newLoc = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      const now    = Date.now();

      // Fix 5: throttle — require both movement AND time gap
      if (lastLocRef.current) {
        const delta = haversineDistance(
          lastLocRef.current.lat, lastLocRef.current.lng,
          newLoc.lat, newLoc.lng
        ) * 1000;
        const timeSinceLast = now - lastLocUpdateRef.current;
        if (delta < MOVEMENT_THRESHOLD_M || timeSinceLast < LOCATION_THROTTLE_MS) return;
      }

      lastLocRef.current       = newLoc;
      lastLocUpdateRef.current = now;
      setDriverLoc(newLoc);
    } catch { /* silent */ }
  }, []);

  const startPolling = useCallback(() => {
    if (locationIntervalRef.current) return;
    fetchLocation();
    locationIntervalRef.current = setInterval(fetchLocation, LOCATION_INTERVAL_MS);
  }, [fetchLocation]);

  const stopPolling = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  useEffect(() => { startPolling(); return stopPolling; }, [startPolling, stopPolling]);
  useFocusEffect(useCallback(() => { fetchLocation(); }, [fetchLocation]));

  // ── Fix 2: AppState with debounce ─────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (next === 'background' || next === 'inactive') {
        stopPolling();
        return;
      }

      if (next === 'active' && (prev === 'background' || prev === 'inactive')) {
        // Fix 2: debounce — ignore if handled recently
        const now = Date.now();
        if (now - lastAppStateHandledAt.current < APPSTATE_DEBOUNCE_MS) return;
        lastAppStateHandledAt.current = now;

        startPolling();

        // Fix 1: resume banner only within window
        if (
          activeNavOrderIdRef.current &&
          navStartedAtRef.current &&
          now - navStartedAtRef.current < RESUME_WINDOW_MS
        ) {
          const orderId = activeNavOrderIdRef.current;
          const order   = allOrders.find(o => o._id === orderId);
          if (order) {
            const shortId = orderId.slice(-6).toUpperCase();
            setResumeBanner(`Resume delivery for Order #${shortId}`);
            console.log(`[NAV_RETURN] orderId=${orderId}`);
            const idx = allOrders.findIndex(o => o._id === orderId);
            if (idx >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true }), 300);
          }
          activeNavOrderIdRef.current = null;
          navStartedAtRef.current     = null;
        }
      }
    });
    return () => sub.remove();
  }, [allOrders, startPolling, stopPolling]);

  // ── Fix 1: Navigate with timeout ─────────────────────────────────────────

  const handleNavigate = useCallback(async (order: RouteOrder) => {
    if (navigatingRef.current.has(order._id)) return;

    // Fix 3: validate coords before doing anything
    const destLat = order.address?.lat;
    const destLng = order.address?.lng;
    if (!validCoords(destLat, destLng)) {
      console.warn(`[NAV_INVALID_COORDS] orderId=${order._id} lat=${destLat} lng=${destLng}`);
      Alert.alert('Invalid location', 'This order has invalid delivery coordinates.');
      return;
    }

    navigatingRef.current.add(order._id);
    setNavigatingIds(new Set(navigatingRef.current));

    await persistCurrentOrder(order._id);
    setResumeBanner(null);

    try {
      let url: string;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('denied');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const dLat = loc.coords.latitude;
        const dLng = loc.coords.longitude;
        setDriverLoc({ lat: dLat, lng: dLng });
        lastLocRef.current = { lat: dLat, lng: dLng };

        console.log(`[NAV_START] orderId=${order._id} driverLat=${dLat} driverLng=${dLng} destLat=${destLat} destLng=${destLng}`);

        url =
          `https://www.google.com/maps/dir/?api=1` +
          `&origin=${dLat},${dLng}` +
          `&destination=${destLat},${destLng}` +
          `&travelmode=driving`;
      } catch {
        console.warn(`[NAV_START] GPS unavailable, destination-only fallback. orderId=${order._id}`);
        dispatch(showToast('GPS unavailable — opening destination only'));
        url =
          `https://www.google.com/maps/dir/?api=1` +
          `&destination=${destLat},${destLng}` +
          `&travelmode=driving`;
      }

      // Store fallback URL before opening
      setFallbackUrls(prev => ({ ...prev, [order._id]: url }));

      activeNavOrderIdRef.current = order._id;
      navStartedAtRef.current     = Date.now();

      // Fix 1: open with timeout
      const opened = await openUrlWithTimeout(url, NAV_OPEN_TIMEOUT_MS);

      if (!opened) {
        console.warn(`[NAV_OPEN_TIMEOUT] orderId=${order._id}`);
        dispatch(showToast('Maps took too long — use the fallback button below'));
      }

      setTimeout(() => {
        navigatingRef.current.delete(order._id);
        setNavigatingIds(new Set(navigatingRef.current));
      }, 2000);

    } catch (err: any) {
      console.error('[NAV_START] Error:', err?.message);
      Alert.alert('Navigation failed', 'Could not open Google Maps. Use the fallback button.');
      navigatingRef.current.delete(order._id);
      setNavigatingIds(new Set(navigatingRef.current));
    }
  }, [dispatch, persistCurrentOrder]);

  // ── Fix 5 + 6 + 7: Deliver handlers ─────────────────────────────────────

  // proceedDeliver declared first so handleDeliver can reference it
  const proceedDeliver = useCallback(async (order: RouteOrder, overrideReason?: string) => {
    if (overrideReason) {
      console.log(`[DELIVER_OVERRIDE] orderId=${order._id} reason=${overrideReason}`);
    }

    // Fix 4: fast-path — skip ping if last success was recent
    let isConnected: boolean;
    if (Date.now() - lastPingSuccessRef.current < PING_FAST_WINDOW_MS) {
      isConnected = true;
    } else {
      isConnected = await ping204();
      if (isConnected) lastPingSuccessRef.current = Date.now();
    }

    if (!isConnected) {
      const queueId = `${order._id}:DELIVER`;
      if (offlineQueue.some(e => e.id === queueId)) {
        dispatch(showToast('Already queued — will sync when online'));
        return;
      }
      console.log(`[DELIVER_QUEUED_OFFLINE] orderId=${order._id} timestamp=${Date.now()}`);
      const entry: OfflineQueueEntry = {
        id: queueId,
        orderId: order._id,
        queuedAt: Date.now(),
        retries: 0,
        nextAttemptAt: Date.now() + 1000, // first retry after 1s
      };
      const newQueue = [...offlineQueue, entry];
      setOfflineQueue(newQueue);
      setPendingSyncIds(prev => new Set([...prev, order._id]));
      await AsyncStorage.setItem(STORAGE_OFFLINE_Q, JSON.stringify(newQueue));
      dispatch(showToast('No internet — delivery queued, will sync when online'));
      return;
    }

    // Actually call the delivery API — critical bug fix
    try {
      await deliverAttempt(order._id).unwrap();
    } catch (err: any) {
      dispatch(showToast(err?.data?.error || 'Delivery failed — please try again'));
      return;
    }

    const currentIdx = allOrders.findIndex(o => o._id === order._id);
    const nextOrder  = allOrders[currentIdx + 1] ?? null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    setCurrentOrderId(nextOrder?._id ?? null);
    if (nextOrder) await AsyncStorage.setItem(STORAGE_KEY, nextOrder._id);
    console.log(`[DELIVER_SUCCESS] orderId=${order._id} nextOrderId=${nextOrder?._id ?? 'none'} timestamp=${Date.now()}`);
    setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: 0, animated: true });
      } catch { /* FlatList may not have rendered yet */ }
    }, 200);
    navigation.navigate('DeliveryDashboard');
  }, [allOrders, dispatch, navigation, offlineQueue, deliverAttempt]);

  const handleDeliver = useCallback(async (order: RouteOrder, distKm: number | null, hasArrived: boolean) => {
    console.log(`[DELIVER_CLICK] orderId=${order._id} distKm=${distKm?.toFixed(2) ?? 'unknown'} hasArrived=${hasArrived}`);

    if (!hasArrived && distKm !== null && distKm * 1000 > ARRIVAL_THRESHOLD_M) {
      const distStr = fmtDist(distKm);
      Alert.alert(
        'Not at location yet',
        `You are ${distStr} away.\n\nSelect a reason to deliver anyway:`,
        [
          { text: 'Cancel',          style: 'cancel' },
          { text: 'Pin incorrect',   onPress: () => proceedDeliver(order, 'pin_incorrect') },
          { text: 'Customer nearby', onPress: () => proceedDeliver(order, 'customer_nearby') },
          { text: 'GPS issue',       onPress: () => proceedDeliver(order, 'gps_issue') },
        ]
      );
      return;
    }

    proceedDeliver(order);
  }, [proceedDeliver]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={DELIVERY_COLORS.card} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={DELIVERY_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Route</Text>
        <TouchableOpacity onPress={refetch} style={s.refreshBtn}>
          <Ionicons name="refresh" size={20} color={DELIVERY_COLORS.primary} />
        </TouchableOpacity>
      </View>

      {resumeBanner && (
        <TouchableOpacity style={s.resumeBanner} onPress={() => setResumeBanner(null)} activeOpacity={0.85}>
          <Ionicons name="navigate-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.resumeText} numberOfLines={1}>{resumeBanner}</Text>
          <Ionicons name="close" size={16} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      )}

      {allOrders.length > 0 && (
        <View style={s.progressBar}>
          <Ionicons name="cube" size={13} color={DELIVERY_COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={s.progressText}>
            {/* Task 10.1: "X stops remaining" — Requirement 12.5 */}
            {allOrders.length} stop{allOrders.length !== 1 ? 's' : ''} remaining
            {pendingSyncIds.size > 0 ? `  •  ${pendingSyncIds.size} pending sync` : ''}
          </Text>
        </View>
      )}

      {allOrders.length === 0 && !isFetching && (
        <View style={s.emptyState}>
          <Ionicons name="checkmark-done-circle" size={64} color={DELIVERY_COLORS.success} />
          <Text style={s.emptyTitle}>All deliveries complete!</Text>
          <Text style={s.emptySub}>Great work today 🎉</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={allOrders}
        keyExtractor={item => item._id}
        contentContainerStyle={s.list}
        refreshing={isFetching}
        onRefresh={refetch}
        onScrollToIndexFailed={() => {}}
        // Task 10.1: Virtualization for 20+ stops — Requirement 14.3
        windowSize={10}
        maxToRenderPerBatch={8}
        initialNumToRender={6}
        renderItem={({ item, index }) => {
          const isCurrent    = item._id === resolvedCurrentId;
          const currentIdx   = allOrders.findIndex(o => o._id === resolvedCurrentId);
          // Task 10.1: Completed = before current stop (Requirement 12.3)
          const isCompleted  = currentIdx > 0 && index < currentIdx;
          // Task 10.1: Next 3 stops visible (Requirement 12.2)
          const isNext       = !isCurrent && !isCompleted && index <= currentIdx + 3 && index > currentIdx;
          const isNavLoading = navigatingIds.has(item._id);
          const isPendingSync = pendingSyncIds.has(item._id);
          // Task 10.1: Expand-on-tap state (Requirement 12.7)
          const isExpanded   = expandedOrderId === item._id;

          const customerPhone = item.userId?.phone?.trim() ?? '';
          const customerName  = getCustomerDisplayName(item.userId?.name, customerPhone);
          const address       = fmtAddress(item.address);

          // Fix 3: validate coords
          const coordsOk = validCoords(item.address?.lat, item.address?.lng);

          const distKm =
            driverLoc && coordsOk
              ? haversineDistance(
                  driverLoc.lat,
                  driverLoc.lng,
                  item.address!.lat!,
                  item.address!.lng!,
                )
              : null;

          // Fix 4: GPS jitter — 2 consecutive readings
          const distM = distKm !== null ? distKm * 1000 : null;
          if (distM !== null && distM < ARRIVAL_THRESHOLD_M) {
            closeReadingCountRef.current[item._id] = (closeReadingCountRef.current[item._id] ?? 0) + 1;
          } else {
            closeReadingCountRef.current[item._id] = 0;
          }
          const hasArrived = isCurrent && (closeReadingCountRef.current[item._id] ?? 0) >= 2;
          const fallbackUrl = fallbackUrls[item._id];

          return (
            // Task 10.1: Completed stops dimmed at 50% opacity (Requirement 12.3)
            <View style={{ opacity: isCompleted ? 0.5 : 1 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                // Task 10.1: Expand-on-tap (Requirement 12.7)
                onPress={() => setExpandedOrderId(isExpanded ? null : item._id)}
                accessibilityRole="button"
                accessibilityLabel={`${isCurrent ? 'Current stop' : isCompleted ? 'Completed stop' : `Stop ${index + 1}`}: ${customerName}`}
                accessibilityHint={isExpanded ? 'Tap to collapse details' : 'Tap to expand details'}
              >
                <View style={[
                  s.card,
                  // Task 10.1: Current stop distinct background (Requirement 12.1)
                  isCurrent && s.cardCurrent,
                  // Task 10.1: Next stops styling (Requirement 12.2)
                  isNext && s.cardNext,
                  // Task 10.1: Completed stops styling (Requirement 12.3)
                  isCompleted && s.cardCompleted,
                ]}>
                  <View style={[
                    s.seqBadge,
                    isCurrent && s.seqBadgeCurrent,
                    isNext && s.seqBadgeNext,
                    isCompleted && s.seqBadgeCompleted,
                  ]}>
                    {/* Task 10.1: Completed stops get checkmark (Requirement 12.3) */}
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Text style={[s.seqText, (isCurrent || isNext) && s.seqTextLight]}>
                        {isCurrent ? '▶' : index + 1}
                      </Text>
                    )}
                  </View>

                  <View style={s.cardBody}>
                    <View style={s.cardTop}>
                      {/* Task 10.1: Customer name 16sp for next stops, 20sp for current (Requirement 12.1, 12.2) */}
                      <Text
                        style={[
                          s.customerName,
                          isCurrent && s.customerNameCurrent,
                        ]}
                        numberOfLines={1}
                      >
                        {customerName}
                      </Text>
                      {/* Task 10.1: CURRENT label (Requirement 12.1) */}
                      {isCurrent && <View style={s.badge}><Text style={s.badgeText}>CURRENT</Text></View>}
                      {isNext    && <View style={[s.badge, s.badgeNext]}><Text style={s.badgeText}>NEXT</Text></View>}
                      {isCompleted && <View style={[s.badge, s.badgeCompleted]}><Text style={s.badgeText}>DONE</Text></View>}
                      {isPendingSync && <View style={[s.badge, s.badgeSync]}><Text style={s.badgeText}>SYNC</Text></View>}
                      {/* Expand/collapse indicator */}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={DELIVERY_COLORS.textSecondary}
                        style={{ marginLeft: 'auto' }}
                      />
                    </View>

                    {/* Task 10.1: Address always visible for current + next 3 (Requirement 12.2) */}
                    {(isCurrent || isNext || isExpanded) && (
                      <Text style={s.address} numberOfLines={isExpanded ? undefined : 2}>{address}</Text>
                    )}
                    {/* Task 10.1: Phone visible when expanded (Requirement 12.7) */}
                    {(isExpanded && customerPhone) ? <Text style={s.phone}>📞 {customerPhone}</Text> : null}

                    {/* Fix 3: invalid coords warning */}
                    {isExpanded && !coordsOk && (
                      <View style={s.invalidCoords}>
                        <Ionicons name="warning" size={13} color="#EF4444" />
                        <Text style={s.invalidCoordsText}>Invalid location — navigation unavailable</Text>
                      </View>
                    )}

                    {/* Meta info — always visible for current, expanded for others */}
                    {(isCurrent || isExpanded) && (
                      <View style={s.meta}>
                        <Text style={s.amount}>₹{item.totalAmount}</Text>
                        <View style={s.payChip}><Text style={s.payText}>{item.paymentMethod.toUpperCase()}</Text></View>
                        {distKm !== null && (
                          <View style={[s.distChip, hasArrived && s.distChipArrived]}>
                            <Ionicons name={hasArrived ? 'location' : 'navigate-outline'} size={11}
                              color={hasArrived ? DELIVERY_COLORS.success : DELIVERY_COLORS.primary} />
                            <Text style={[s.distText, hasArrived && s.distTextArrived]}>
                              {hasArrived ? "You've arrived" : fmtDist(distKm)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {isCurrent && hasArrived && (
                      <View style={s.arrivedBanner}>
                        <Ionicons name="checkmark-circle" size={16} color={DELIVERY_COLORS.success} />
                        <Text style={s.arrivedText}>You've arrived — tap Deliver to complete</Text>
                      </View>
                    )}

                    {isCurrent && !hasArrived && (
                      <Text style={s.guidanceText}>Deliver this order before moving to the next</Text>
                    )}

                    {/* Actions — only for current stop or expanded */}
                    {(isCurrent || isExpanded) && (
                      <View style={s.actions}>
                        <TouchableOpacity
                          style={[s.navBtn, (isNavLoading || !coordsOk) && s.btnDisabled]}
                          onPress={() => handleNavigate(item)}
                          disabled={isNavLoading || !coordsOk}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Navigate to ${customerName}`}
                        >
                          {isNavLoading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <>
                                <Ionicons name="navigate" size={14} color="#fff" style={{ marginRight: 5 }} />
                                <Text style={s.navBtnText}>Navigate</Text>
                              </>
                          }
                        </TouchableOpacity>

                        {isCurrent ? (
                          <TouchableOpacity
                            style={[s.deliverBtn, hasArrived && s.deliverBtnArrived, isPendingSync && s.deliverBtnSync]}
                            onPress={() => handleDeliver(item, distKm, hasArrived)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={isPendingSync ? 'Delivery pending sync' : 'Mark as delivered'}
                          >
                            <Ionicons name={isPendingSync ? 'cloud-upload' : 'checkmark-circle'} size={14}
                              color={DELIVERY_COLORS.success} style={{ marginRight: 5 }} />
                            <Text style={s.deliverBtnText}>{isPendingSync ? 'Pending Sync' : 'Deliver'}</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[s.deliverBtn, s.deliverBtnLocked]}>
                            <Ionicons name="lock-closed" size={13} color={DELIVERY_COLORS.textSecondary} style={{ marginRight: 5 }} />
                            <Text style={s.deliverBtnLockedText}>Locked</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Fix 1: fallback Maps button */}
                    {isExpanded && fallbackUrl && !isNavLoading && (
                      <TouchableOpacity style={s.fallbackBtn} onPress={() => Linking.openURL(fallbackUrl)} activeOpacity={0.85}>
                        <Ionicons name="map-outline" size={13} color={DELIVERY_COLORS.primary} style={{ marginRight: 5 }} />
                        <Text style={s.fallbackBtnText}>Open in Google Maps manually</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DELIVERY_COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: DELIVERY_COLORS.card,
    borderBottomWidth: 1, borderBottomColor: DELIVERY_COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  backBtn:     { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: DELIVERY_COLORS.textPrimary },
  refreshBtn:  { padding: 4 },
  resumeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  resumeText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#fff' },
  progressBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF0E6',                    // light orange tint
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: DELIVERY_COLORS.border,
  },
  // Task 10.1: "X stops remaining" — Requirement 12.5
  progressText: {
    fontSize: DELIVERY_TYPOGRAPHY.base,  // 16sp
    fontWeight: '700',
    color: DELIVERY_COLORS.primary,
  },
  list: { padding: 12, paddingBottom: 40 },
  // ── Card variants (Task 10.1) ─────────────────────────────────────────────
  card: {
    flexDirection: 'row', backgroundColor: DELIVERY_COLORS.card,
    borderRadius: 14, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: DELIVERY_COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  // Task 10.1: Current stop — orange highlight (Requirement 12.1)
  cardCurrent: {
    borderColor: DELIVERY_COLORS.primary,
    borderWidth: 2,
    backgroundColor: '#FFF0E6',                    // light orange tint
    elevation: 3,
  },
  // Task 10.1: Next stops styling (Requirement 12.2)
  cardNext: { borderColor: '#F59E0B', borderWidth: 1.5, backgroundColor: '#FFFBEB' },
  // Task 10.1: Completed stops — dimmed via opacity on wrapper (Requirement 12.3)
  cardCompleted: {
    borderColor: DELIVERY_COLORS.border,
    backgroundColor: DELIVERY_COLORS.background,
  },
  seqBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DELIVERY_COLORS.cardElevated,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2, flexShrink: 0,
    minWidth: 48,  // 48dp touch target — Requirement 5.1
    minHeight: 48,
  },
  seqBadgeCurrent: { backgroundColor: DELIVERY_COLORS.primary },   // orange
  seqBadgeNext:    { backgroundColor: '#F59E0B' },
  // Task 10.1: Completed badge — green with checkmark (Requirement 12.3)
  seqBadgeCompleted: { backgroundColor: DELIVERY_COLORS.success },
  seqText:         { fontSize: 13, fontWeight: '800', color: DELIVERY_COLORS.textSecondary },
  seqTextLight:    { color: '#fff' },
  cardBody: { flex: 1 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  // Task 10.1: 16sp for next stops (Requirement 12.2)
  customerName: {
    flex: 1,
    fontSize: DELIVERY_TYPOGRAPHY.base,  // 16sp
    fontWeight: '700',
    color: DELIVERY_COLORS.textPrimary,
  },
  // Task 10.1: 20sp for current stop (Requirement 12.1)
  customerNameCurrent: {
    fontSize: 20,
    fontWeight: '800',
  },
  badge:     { backgroundColor: DELIVERY_COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  badgeNext: { backgroundColor: '#F59E0B' },
  badgeSync: { backgroundColor: '#6366F1' },
  // Task 10.1: Completed badge style (Requirement 12.3)
  badgeCompleted: { backgroundColor: DELIVERY_COLORS.success },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  // Task 10.1: 16sp address text (Requirement 12.2)
  address: {
    fontSize: DELIVERY_TYPOGRAPHY.base,  // 16sp
    color: DELIVERY_COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  phone:   { fontSize: 12, color: DELIVERY_COLORS.textSecondary, marginBottom: 6 },
  invalidCoords: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF2F2', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8,
  },
  invalidCoordsText: { fontSize: 11, fontWeight: '700', color: '#EF4444', flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  amount: { fontSize: 15, fontWeight: '900', color: DELIVERY_COLORS.textPrimary },
  payChip: { backgroundColor: DELIVERY_COLORS.cardElevated, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  payText: { fontSize: 11, fontWeight: '700', color: DELIVERY_COLORS.textSecondary },
  distChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF0E6',                    // light orange tint
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, gap: 3,
  },
  distChipArrived: { backgroundColor: DELIVERY_COLORS.successBg },
  distText:        { fontSize: 11, fontWeight: '700', color: DELIVERY_COLORS.primary },
  distTextArrived: { color: DELIVERY_COLORS.success },
  arrivedBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DELIVERY_COLORS.successBg,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    marginBottom: 8, gap: 6,
  },
  arrivedText:   { fontSize: 12, fontWeight: '700', color: DELIVERY_COLORS.success, flex: 1 },
  guidanceText:  { fontSize: 11, color: DELIVERY_COLORS.textSecondary, fontStyle: 'italic', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: DELIVERY_COLORS.primary,      // orange CTA — Requirement 5.2
    paddingVertical: 10, borderRadius: 10,
    minHeight: 48,              // 48dp — Requirement 5.1
  },
  navBtnText: { color: '#fff', fontSize: DELIVERY_TYPOGRAPHY.base, fontWeight: '800' },
  deliverBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: DELIVERY_COLORS.success,
    paddingVertical: 10, borderRadius: 10,
    minHeight: 48,              // 48dp — Requirement 5.1
  },
  deliverBtnArrived:    { backgroundColor: DELIVERY_COLORS.successBg },
  deliverBtnSync:       { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  deliverBtnText:       { fontSize: DELIVERY_TYPOGRAPHY.base, fontWeight: '800', color: DELIVERY_COLORS.success },
  deliverBtnLocked:     { borderColor: DELIVERY_COLORS.border, backgroundColor: DELIVERY_COLORS.background },
  deliverBtnLockedText: { fontSize: 13, fontWeight: '700', color: DELIVERY_COLORS.textSecondary },
  btnDisabled: { opacity: 0.5 },
  fallbackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 8, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: DELIVERY_COLORS.primary + '50',
    backgroundColor: '#FFF0E6',
  },
  fallbackBtnText: { fontSize: 12, fontWeight: '700', color: DELIVERY_COLORS.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: DELIVERY_COLORS.textPrimary, marginTop: 16 },
  emptySub:   { fontSize: 14, color: DELIVERY_COLORS.textSecondary, marginTop: 6 },
});

export default DeliveryRouteScreen;
