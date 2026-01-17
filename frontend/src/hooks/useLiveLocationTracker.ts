import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isOnline, saveOfflineAction } from "../utils/offlineSync";

type LiveLocationTrackerOptions = {
  accessToken: string | null | undefined;
  isOnDuty: boolean;
  enabled?: boolean;
};

type RouteState = {
  routeId: string | null;
  lastCheckedAt: number | null;
};

type LastPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

const MAX_ACCURACY_M = 50;
const MIN_MOVE_M = 10;
const MAX_SPEED_KMH = 120;
const SEND_THROTTLE_MS = 3000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function normalizeHeading(heading: number | null | undefined): number {
  if (typeof heading !== "number" || !Number.isFinite(heading)) return 0;
  const h = heading % 360;
  return h < 0 ? h + 360 : h;
}

export function useLiveLocationTracker({
  accessToken,
  isOnDuty,
  enabled = true,
}: LiveLocationTrackerOptions) {
  const verboseLoggingEnabled = useMemo(
    () => String(import.meta.env.VITE_DEV_LOW_POWER || "").toLowerCase() !== "true",
    []
  );

  const [routeState, setRouteState] = useState<RouteState>({
    routeId: null,
    lastCheckedAt: null,
  });
  const [isTracking, setIsTracking] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedRef = useRef<LastPoint | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const isSendingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(false);

  const apiBase = useMemo(() => {
    const raw = (import.meta as any)?.env?.VITE_API_URL;
    return typeof raw === "string" && raw.length > 0 ? raw : "";
  }, []);

  const canRun = Boolean(enabled && accessToken && isOnDuty);

  const clearWatch = useCallback((reason: string) => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
      if (verboseLoggingEnabled) {
        console.log(`[LiveLocation] stop watchPosition (${reason})`);
      }
    }
  }, [verboseLoggingEnabled]);

  const fetchCurrentRoute = useCallback(async (): Promise<string | null> => {
    if (!accessToken) return null;

    try {
      const res = await fetch(`${apiBase}/api/delivery/routes/current`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        if (verboseLoggingEnabled) {
          console.warn("[LiveLocation] current route fetch failed", res.status);
        }
        return null;
      }

      const data = await res.json();
      const routeId = data?.route?.routeId ? String(data.route.routeId) : null;
      return routeId;
    } catch (e) {
      if (verboseLoggingEnabled) {
        console.warn("[LiveLocation] current route fetch error", e);
      }
      return null;
    }
  }, [accessToken, apiBase, verboseLoggingEnabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canRun) {
      setRouteState({ routeId: null, lastCheckedAt: Date.now() });
      clearWatch("disabled");
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const routeId = await fetchCurrentRoute();
      if (cancelled) return;
      setRouteState({ routeId, lastCheckedAt: Date.now() });
      if (verboseLoggingEnabled) {
        console.log(`[LiveLocation] route check => routeId=${routeId || "null"}`);
      }
    };

    void refresh();

    const id = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [canRun, clearWatch, fetchCurrentRoute]);

  const sendLocation = useCallback(
    async (payload: any) => {
      if (!accessToken) return;

      if (!isOnline()) {
        await saveOfflineAction({ type: "location_update", payload });
        if (verboseLoggingEnabled) {
          console.log("[LiveLocation] queued (offline)", payload);
        }
        return;
      }

      try {
        const res = await fetch(`${apiBase}/api/delivery/location`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let bodyText: string | null = null;
          try {
            bodyText = await res.text();
          } catch {
            bodyText = null;
          }
          await saveOfflineAction({ type: "location_update", payload });
          if (verboseLoggingEnabled) {
            console.log("[LiveLocation] queued (server rejected)", res.status, bodyText, payload);
          }
          return;
        }

        if (verboseLoggingEnabled) {
          console.log("[LiveLocation] sent", payload);
        }
      } catch (e) {
        await saveOfflineAction({ type: "location_update", payload });
        if (verboseLoggingEnabled) {
          console.log("[LiveLocation] queued (network error)", payload);
        }
      }
    },
    [accessToken, apiBase, verboseLoggingEnabled]
  );

  const onPosition = useCallback(
    async (pos: GeolocationPosition) => {
      const routeId = routeState.routeId;
      if (!routeId) return;
      if (!mountedRef.current) return;
      if (!canRun) return;

      const coords = pos.coords;
      const lat = coords.latitude;
      const lng = coords.longitude;
      const accuracy = coords.accuracy;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (typeof accuracy === "number" && accuracy > MAX_ACCURACY_M) {
        if (verboseLoggingEnabled) {
          console.log("[LiveLocation] drop (accuracy)", { accuracy });
        }
        return;
      }

      const now = Date.now();

      const lastAccepted = lastAcceptedRef.current;
      if (lastAccepted) {
        const movedM = haversineMeters({ lat, lng }, lastAccepted);
        if (movedM < MIN_MOVE_M) {
          if (verboseLoggingEnabled) {
            console.log("[LiveLocation] drop (min-move)", { movedM });
          }
          return;
        }

        const dtSec = Math.max(0.001, (now - lastAccepted.timestamp) / 1000);
        const speedFromDeltaKmh = (movedM / dtSec) * 3.6;

        const speedMps = typeof coords.speed === "number" ? coords.speed : null;
        const speedKmh =
          speedMps != null && Number.isFinite(speedMps) ? speedMps * 3.6 : speedFromDeltaKmh;

        if (speedKmh > MAX_SPEED_KMH) {
          if (verboseLoggingEnabled) {
            console.log("[LiveLocation] drop (speed)", { speedKmh });
          }
          return;
        }
      }

      lastAcceptedRef.current = { lat, lng, timestamp: now };

      if (now - lastSentAtRef.current < SEND_THROTTLE_MS) {
        if (verboseLoggingEnabled) {
          console.log("[LiveLocation] throttle (skip)", { sinceMs: now - lastSentAtRef.current });
        }
        return;
      }

      if (isSendingRef.current) return;

      lastSentAtRef.current = now;
      isSendingRef.current = true;

      try {
        const speedMps = typeof coords.speed === "number" ? coords.speed : null;
        const speed = speedMps != null && Number.isFinite(speedMps) ? speedMps : 0;
        const heading = normalizeHeading(coords.heading);
        const rawTs = typeof pos.timestamp === "number" ? pos.timestamp : now;
        const timestamp =
          rawTs > 1_000_000_000_000
            ? rawTs
            : typeof performance !== "undefined" && typeof performance.timeOrigin === "number"
              ? performance.timeOrigin + rawTs
              : now;

        const payload = {
          lat,
          lng,
          accuracy: typeof accuracy === "number" ? accuracy : null,
          speed,
          heading,
          timestamp,
          routeId,
        };

        if (verboseLoggingEnabled) {
          console.log("[LiveLocation] capture", payload);
        }
        await sendLocation(payload);
      } finally {
        isSendingRef.current = false;
      }
    },
    [canRun, routeState.routeId, sendLocation, verboseLoggingEnabled]
  );

  const onError = useCallback((err: GeolocationPositionError) => {
    if (verboseLoggingEnabled) {
      console.warn("[LiveLocation] geolocation error", {
        code: err.code,
        message: err.message,
      });
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      if (verboseLoggingEnabled) {
        console.warn("[LiveLocation] geolocation not supported");
      }
      return;
    }

    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });

    setIsTracking(true);

    if (verboseLoggingEnabled) {
      console.log("[LiveLocation] start watchPosition", {
        watchId: watchIdRef.current,
      });
    }
  }, [onError, onPosition, verboseLoggingEnabled]);

  useEffect(() => {
    if (!canRun) {
      clearWatch("disabled");
      return;
    }

    if (!routeState.routeId) {
      clearWatch("no-active-route");
      return;
    }

    if (document.visibilityState !== "visible") {
      clearWatch("background");
      return;
    }

    startWatch();

    return () => {
      clearWatch("cleanup");
    };
  }, [canRun, clearWatch, routeState.routeId, startWatch]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        clearWatch("background");
        return;
      }

      if (canRun && routeState.routeId) {
        startWatch();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [canRun, clearWatch, routeState.routeId, startWatch]);

  return {
    activeRouteId: routeState.routeId,
    isTracking,
    lastRouteCheckedAt: routeState.lastCheckedAt,
  };
}

export default useLiveLocationTracker;
