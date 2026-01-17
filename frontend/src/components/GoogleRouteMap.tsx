import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMapsOnce } from "../utils/googleMapsLoader";

// Google Maps loads at runtime; relax types for build-time safety
declare const google: any;

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

type LatLngPoint = { lat: number; lng: number };

type Checkpoint = {
  orderId: string;
  sequence: number | null;
  lat: number;
  lng: number;
  status: string;
  deliveredAt?: string | null;
};

type DriverLocation = {
  lat: number;
  lng: number;
  lastUpdatedAt: string | null;
  stale?: boolean;
} | null;

type Props = {
  routeId: string;
  warehouse: LatLngPoint;
  checkpoints: Checkpoint[];
  driverLocation: DriverLocation;
  highlightOrderId?: string | null;
};

type DirectionsCacheEntry = {
  fullPath: LatLngPoint[];
  legPaths: LatLngPoint[][];
  snappedStops: LatLngPoint[];
};

type CheckpointMarkerEntry = {
  orderId: string;
  marker: any;
  contentEl: HTMLDivElement;
  info: any;
};

const directionsCache = new Map<string, Promise<DirectionsCacheEntry>>();

const roundCoord = (v: number) => Math.round(v * 1e5) / 1e5;

const buildCacheKey = (routeId: string, origin: LatLngPoint, stops: LatLngPoint[]) => {
  const pts = [origin, ...stops].map((p) => `${roundCoord(p.lat)},${roundCoord(p.lng)}`).join(";");
  return `${routeId}::${pts}`;
};

const normalizeStatus = (raw: string): string => {
  const v = String(raw || "").trim().toUpperCase();
  if (v === "OUT_FOR_DELIVERY") return "IN_TRANSIT";
  return v;
};

const checkpointColor = (status: string): string => {
  const st = normalizeStatus(status);
  if (st === "DELIVERED") return "#16a34a";
  if (st === "FAILED") return "#dc2626";
  if (st === "IN_TRANSIT" || st === "PICKED_UP" || st === "ARRIVED") return "#1A73E8";
  return "#6b7280";
};

const findNearestIndex = (path: LatLngPoint[], target: LatLngPoint): number => {
  if (!path || path.length === 0) return 0;

  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  const tgt = new google.maps.LatLng(target.lat, target.lng);

  for (let i = 0; i < path.length; i += 1) {
    const p = path[i];
    const ll = new google.maps.LatLng(p.lat, p.lng);
    const d = google.maps.geometry?.spherical?.computeDistanceBetween
      ? google.maps.geometry.spherical.computeDistanceBetween(ll, tgt)
      : Math.hypot(p.lat - target.lat, p.lng - target.lng);

    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  return bestIdx;
};

const makeDashedLineIcons = () => {
  return [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 3,
      },
      offset: "0",
      repeat: "14px",
    },
  ];
};

const createAutoMarkerContent = (rotationDeg: number, opts?: { stale?: boolean }) => {
  const rot = Number.isFinite(rotationDeg) ? rotationDeg : 0;
  const stale = Boolean(opts?.stale);
  const el = document.createElement("div");
  el.style.width = "40px";
  el.style.height = "40px";
  el.style.borderRadius = "9999px";
  el.style.background = stale ? "rgba(156, 163, 175, 0.95)" : "rgba(245, 158, 11, 0.95)";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";

  const inner = document.createElement("div");
  inner.style.transform = `rotate(${rot}deg)`;
  inner.style.transformOrigin = "center";
  inner.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 17h10" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M6.5 17.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 0 0-3 0Z" fill="white"/>
      <path d="M14.5 17.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 0 0-3 0Z" fill="white"/>
      <path d="M5 16v-3.2c0-.6.2-1.1.6-1.5l2.4-2.6c.4-.4.9-.7 1.5-.7h5c.6 0 1.1.2 1.5.7l2.4 2.6c.4.4.6 1 .6 1.5V16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 12h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  el.appendChild(inner);
  return el;
};

const bearingDeg = (from: LatLngPoint, to: LatLngPoint) => {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

const appendPath = (into: LatLngPoint[], pts: LatLngPoint[]) => {
  for (const p of pts) {
    if (!p) continue;
    const last = into.length > 0 ? into[into.length - 1] : null;
    if (last && last.lat === p.lat && last.lng === p.lng) continue;
    into.push(p);
  }
};

const toLatLngPoint = (pos: any, fallback: LatLngPoint): LatLngPoint => {
  if (!pos) return fallback;
  if (typeof pos.lat === "function" && typeof pos.lng === "function") {
    return { lat: pos.lat(), lng: pos.lng() };
  }
  if (typeof pos.lat === "number" && typeof pos.lng === "number") {
    return { lat: pos.lat, lng: pos.lng };
  }
  return fallback;
};

const getDirectionsCached = async (
  routeId: string,
  origin: LatLngPoint,
  orderedStops: LatLngPoint[],
  orderedStopsForIndexing: LatLngPoint[]
): Promise<DirectionsCacheEntry> => {
  const key = buildCacheKey(routeId, origin, orderedStops);
  const cached = directionsCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const ds = new google.maps.DirectionsService();

    const destination = orderedStops[orderedStops.length - 1];
    const intermediates = orderedStops.slice(0, Math.max(0, orderedStops.length - 1));

    const result = await ds.route({
      origin,
      destination,
      waypoints: intermediates.map((p) => ({ location: p, stopover: true })),
      optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    });

    const route = result?.routes?.[0];
    const legs = route?.legs || [];
    if (legs.length !== orderedStops.length) {
      throw new Error("Directions route legs mismatch for stops");
    }

    const legPaths: LatLngPoint[][] = [];
    const fullPath: LatLngPoint[] = [];
    const snappedStops: LatLngPoint[] = [];

    for (const leg of legs) {
      const legPath: LatLngPoint[] = [];
      const steps = leg?.steps || [];
      for (const st of steps) {
        const stepPath = st?.path || [];
        const pts: LatLngPoint[] = [];
        for (const sp of stepPath) {
          if (!sp) continue;
          if (typeof sp.lat === "function" && typeof sp.lng === "function") {
            pts.push({ lat: sp.lat(), lng: sp.lng() });
          } else if (typeof sp.lat === "number" && typeof sp.lng === "number") {
            pts.push({ lat: sp.lat, lng: sp.lng });
          }
        }
        appendPath(legPath, pts);
      }

      if (legPath.length < 2) {
        throw new Error("Directions route returned empty geometry");
      }

      legPaths.push(legPath);
      appendPath(fullPath, legPath);

      const end = leg?.end_location;
      if (end && typeof end.lat === "function" && typeof end.lng === "function") {
        snappedStops.push({ lat: end.lat(), lng: end.lng() });
      } else if (end && typeof end.lat === "number" && typeof end.lng === "number") {
        snappedStops.push({ lat: end.lat, lng: end.lng });
      } else {
        snappedStops.push(legPath[legPath.length - 1]);
      }
    }

    if (fullPath.length < 2) {
      throw new Error("Directions route returned empty geometry");
    }

    void orderedStopsForIndexing;

    return {
      fullPath,
      legPaths,
      snappedStops,
    };
  })();

  directionsCache.set(key, promise);
  return promise;
};

const GoogleRouteMap: React.FC<Props> = ({ routeId, warehouse, checkpoints, driverLocation, highlightOrderId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const completedPolylineRef = useRef<any | null>(null);
  const activePolylineRef = useRef<any | null>(null);
  const pendingPolylineRef = useRef<any | null>(null);
  const trafficLayerRef = useRef<any | null>(null);

  const checkpointMarkersRef = useRef<CheckpointMarkerEntry[]>([]);
  const driverMarkerRef = useRef<any | null>(null);
  const driverAnimRef = useRef<number | null>(null);
  const fitKeyRef = useRef<string | null>(null);
  const lastProgrammaticAtRef = useRef<number>(0);
  const activeInfoRef = useRef<any | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [routingStatus, setRoutingStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routeEntry, setRouteEntry] = useState<DirectionsCacheEntry | null>(null);

  const [showRoute, setShowRoute] = useState(true);
  const [showCheckpoints, setShowCheckpoints] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showDriver, setShowDriver] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);

  const [driverInfoTick, setDriverInfoTick] = useState(0);

  const orderedCheckpoints = useMemo(() => {
    const valid = (checkpoints || [])
      .filter((c) => c && Number.isFinite(c.lat) && Number.isFinite(c.lng))
      .slice()
      .sort((a, b) => {
        const as = typeof a.sequence === "number" ? a.sequence : Number.POSITIVE_INFINITY;
        const bs = typeof b.sequence === "number" ? b.sequence : Number.POSITIVE_INFINITY;
        return as - bs;
      });
    return valid;
  }, [checkpoints]);

  const orderedStops = useMemo(() => orderedCheckpoints.map((c) => ({ lat: c.lat, lng: c.lng })), [orderedCheckpoints]);

  const directionsCacheKey = useMemo(() => {
    return buildCacheKey(routeId, warehouse, orderedStops);
  }, [routeId, warehouse, orderedStops]);

  const completedStopIdx = useMemo(() => {
    let best = -1;
    for (let i = 0; i < orderedCheckpoints.length; i += 1) {
      const st = normalizeStatus(orderedCheckpoints[i].status);
      const done = st === "DELIVERED" || st === "FAILED";
      if (done) best = i;
    }
    return best;
  }, [orderedCheckpoints]);

  useEffect(() => {
    let mounted = true;
    const prevAuthFailure = window.gm_authFailure;
    let listeners: any[] = [];

    const init = async () => {
      try {
        setRoutingError(null);
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
        if (!apiKey) {
          throw new Error("Missing VITE_GOOGLE_MAPS_API_KEY");
        }

        const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "";

        if (!mapId) {
          throw new Error(
            "Missing VITE_GOOGLE_MAPS_MAP_ID. A Map ID is required for Advanced Markers (AdvancedMarkerElement)."
          );
        }

        console.info("[GoogleMaps] VITE_GOOGLE_MAPS_API_KEY length:", apiKey.length);
        console.info("[GoogleMaps] Map ID present:", Boolean(mapId));

        window.gm_authFailure = () => {
          if (!mounted) return;
          console.error("Google Maps authentication failed (gm_authFailure)");
          setRoutingError(
            "Google Maps authentication failed. Check browser console for the exact Maps JS API error (RefererNotAllowedMapError / BillingNotEnabledMapError / ApiNotActivatedMapError / InvalidKeyMapError)."
          );
          setIsReady(false);
        };

        await loadGoogleMapsOnce(apiKey);

        if (!mounted) return;
        if (!mapRef.current) return;

        if (mapInstanceRef.current) {
          // Map already initialized; do not recreate on prop changes.
          setIsReady(true);
          return;
        }

        const map = new google.maps.Map(mapRef.current, {
          center: warehouse,
          zoom: 13,
          mapId,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          clickableIcons: false,
          disableDefaultUI: false,
          zoomControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          keyboardShortcuts: true,
          gestureHandling: "greedy",
          draggable: true,
          scrollwheel: true,
          disableDoubleClickZoom: false,
          draggableCursor: "grab",
          draggingCursor: "grabbing",
        });

        mapInstanceRef.current = map;

        trafficLayerRef.current = new google.maps.TrafficLayer();
        trafficLayerRef.current.setMap(map);

        const shouldDisableFollow = () => {
          const now = Date.now();
          if (now - lastProgrammaticAtRef.current < 650) return;
          setAutoFollow(false);
        };

        listeners = [];
        listeners.push(map.addListener("dragstart", shouldDisableFollow));
        listeners.push(map.addListener("zoom_changed", shouldDisableFollow));
        listeners.push(map.addListener("mousedown", shouldDisableFollow));
        listeners.push(map.addListener("touchstart", shouldDisableFollow));
        listeners.push(map.addListener("wheel", shouldDisableFollow));

        // Keep map stable across container resizes (drawer open, flex changes, window resize)
        if (typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current = new ResizeObserver(() => {
            const m = mapInstanceRef.current;
            if (!m) return;
            google.maps.event.trigger(m, "resize");
          });
          resizeObserverRef.current.observe(mapRef.current);
        }

        setIsReady(true);
      } catch (e: any) {
        console.error("Google Maps init error:", e);
        setRoutingError(e?.message || "Failed to load Google Maps");
        setIsReady(false);
      }
    };

    void init();

    return () => {
      mounted = false;
      window.gm_authFailure = prevAuthFailure;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      for (const l of listeners) {
        if (l && typeof l.remove === "function") l.remove();
      }
      listeners = [];
    };
  }, []);

  const clearPolylines = () => {
    for (const ref of [completedPolylineRef, activePolylineRef, pendingPolylineRef]) {
      if (ref.current) {
        ref.current.setMap(null);
        ref.current = null;
      }
    }
  };

  const clearCheckpointMarkers = () => {
    for (const entry of checkpointMarkersRef.current) {
      const marker = entry?.marker;
      if (marker && typeof marker.setMap === "function") {
        marker.setMap(null);
      } else if (marker) {
        marker.map = null;
      }
    }
    checkpointMarkersRef.current = [];
    if (activeInfoRef.current && typeof activeInfoRef.current.close === "function") {
      activeInfoRef.current.close();
    }
    activeInfoRef.current = null;
  };

  const clearDriverMarker = () => {
    if (driverMarkerRef.current) {
      driverMarkerRef.current.map = null;
      driverMarkerRef.current = null;
    }
    if (driverAnimRef.current) {
      cancelAnimationFrame(driverAnimRef.current);
      driverAnimRef.current = null;
    }
  };

  useEffect(() => {
    if (!isReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    // Checkpoints (AdvancedMarkerElement)
    clearCheckpointMarkers();
    if (!showCheckpoints) return;

    const markers: CheckpointMarkerEntry[] = [];
    for (let i = 0; i < orderedCheckpoints.length; i += 1) {
      const c = orderedCheckpoints[i];
      const label = String(c.sequence ?? "•");
      const bg = checkpointColor(c.status);

      const snapped = routeEntry?.snappedStops?.[i];
      const position = snapped && Number.isFinite(snapped.lat) && Number.isFinite(snapped.lng)
        ? snapped
        : { lat: c.lat, lng: c.lng };

      const el = document.createElement("div");
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.borderRadius = "9999px";
      el.style.background = bg;
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 3px 10px rgba(0,0,0,0.25)";
      el.style.color = "white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "12px";
      el.style.fontWeight = "700";
      el.textContent = label;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        content: el,
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="font-size: 12px;">
            <div style="font-weight: 700; margin-bottom: 4px;">Stop ${label}</div>
            <div><span style="color:#6b7280;">Order:</span> ${String(c.orderId).slice(0, 12)}…</div>
            <div><span style="color:#6b7280;">Status:</span> ${normalizeStatus(c.status) || "—"}</div>
            ${c.deliveredAt ? `<div><span style=\"color:#6b7280;\">Delivered:</span> ${new Date(c.deliveredAt).toLocaleString()}</div>` : ""}
          </div>
        `,
      });

      marker.addListener("gmp-click", () => {
        if (activeInfoRef.current && activeInfoRef.current !== info && typeof activeInfoRef.current.close === "function") {
          activeInfoRef.current.close();
        }
        info.open({ map, anchor: marker });
        activeInfoRef.current = info;
      });

      markers.push({
        orderId: String(c.orderId),
        marker,
        contentEl: el,
        info,
      });
    }

    checkpointMarkersRef.current = markers;

    return () => {
      clearCheckpointMarkers();
    };
  }, [isReady, orderedCheckpoints, routeEntry, showCheckpoints]);

  useEffect(() => {
    if (!isReady || !showCheckpoints) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeId = highlightOrderId ? String(highlightOrderId) : "";
    let nextActiveInfo: any | null = null;

    for (const entry of checkpointMarkersRef.current) {
      const isActive = Boolean(activeId && String(entry.orderId) === activeId);
      entry.contentEl.style.transition = "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease";
      entry.contentEl.style.transform = isActive ? "scale(1.15)" : "scale(1)";
      entry.contentEl.style.boxShadow = isActive
        ? "0 0 0 4px rgba(37, 99, 235, 0.55), 0 6px 18px rgba(0,0,0,0.25)"
        : "0 3px 10px rgba(0,0,0,0.25)";
      entry.contentEl.style.borderColor = isActive ? "#1d4ed8" : "white";
      if (entry.marker) {
        entry.marker.zIndex = isActive ? 10000 : 1;
      }

      if (isActive) {
        nextActiveInfo = entry.info;
      }
    }

    if (nextActiveInfo) {
      if (activeInfoRef.current && activeInfoRef.current !== nextActiveInfo && typeof activeInfoRef.current.close === "function") {
        activeInfoRef.current.close();
      }
      const activeEntry = checkpointMarkersRef.current.find((e) => String(e.orderId) === activeId);
      if (activeEntry) {
        nextActiveInfo.open({ map, anchor: activeEntry.marker });
      }
      activeInfoRef.current = nextActiveInfo;
    } else if (activeInfoRef.current && typeof activeInfoRef.current.close === "function") {
      activeInfoRef.current.close();
      activeInfoRef.current = null;
    }
  }, [highlightOrderId, isReady, orderedCheckpoints, showCheckpoints]);

  useEffect(() => {
    if (!driverLocation?.lastUpdatedAt) return;
    const id = window.setInterval(() => {
      setDriverInfoTick((x) => x + 1);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [driverLocation?.lastUpdatedAt]);

  useEffect(() => {
    if (!isReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    let mounted = true;

    const drawRoute = async () => {
      try {
        setRoutingError(null);
        if (!showRoute || orderedStops.length === 0) {
          clearPolylines();
          setRouteEntry(null);
          setRoutingStatus("ok");
          return;
        }

        setRoutingStatus("loading");

        const entry = await getDirectionsCached(routeId, warehouse, orderedStops, orderedStops);
        if (!mounted) return;

        setRouteEntry(entry);

        const legs = entry.legPaths;
        const lastLegIdx = Math.max(0, legs.length - 1);
        const completedLegIdx = Math.min(completedStopIdx, lastLegIdx);
        const activeLegIdx = completedLegIdx >= lastLegIdx ? -1 : Math.min(lastLegIdx, Math.max(0, completedLegIdx + 1));

        const completedPath: LatLngPoint[] = [];
        if (showCompleted && completedLegIdx >= 0) {
          for (let i = 0; i <= completedLegIdx; i += 1) {
            appendPath(completedPath, legs[i] || []);
          }
        }

        const activePath: LatLngPoint[] = activeLegIdx >= 0 ? (legs[activeLegIdx] || []) : [];

        const pendingPath: LatLngPoint[] = [];
        if (activeLegIdx >= 0) {
          for (let i = activeLegIdx + 1; i < legs.length; i += 1) {
            appendPath(pendingPath, legs[i] || []);
          }
        }

        clearPolylines();

        if (showRoute && showCompleted && completedPath.length >= 2) {
          completedPolylineRef.current = new google.maps.Polyline({
            path: completedPath,
            strokeColor: "#C0C0C0",
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map,
            zIndex: 1,
          });
        }

        if (showRoute && activePath.length >= 2) {
          activePolylineRef.current = new google.maps.Polyline({
            path: activePath,
            strokeColor: "#1A73E8",
            strokeOpacity: 1,
            strokeWeight: 7,
            map,
            zIndex: 2,
          });
        }

        if (showRoute && pendingPath.length >= 2) {
          pendingPolylineRef.current = new google.maps.Polyline({
            path: pendingPath,
            strokeOpacity: 0,
            icons: makeDashedLineIcons(),
            strokeWeight: 5,
            map,
            zIndex: 0,
          });
        }

        if (fitKeyRef.current !== directionsCacheKey) {
          fitKeyRef.current = directionsCacheKey;
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(warehouse);
          for (const p of entry.fullPath) bounds.extend(p);
          lastProgrammaticAtRef.current = Date.now();
          map.fitBounds(bounds, 60);
        }

        setRoutingStatus("ok");
      } catch (e: any) {
        console.error("Directions routing error:", e);
        if (!mounted) return;
        clearPolylines();
        setRoutingStatus("error");
        setRoutingError(e?.message || "Failed to fetch directions");
      }
    };

    void drawRoute();

    return () => {
      mounted = false;
    };
    // NOTE: do not depend on driverLocation (polling). Geometry must not refetch.
  }, [isReady, routeId, warehouse, orderedStops, completedStopIdx, showCompleted, showRoute]);

  useEffect(() => {
    if (!isReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    // Driver marker updates (socket-driven via props)
    if (!showDriver || !driverLocation || !Number.isFinite(driverLocation.lat) || !Number.isFinite(driverLocation.lng)) {
      clearDriverMarker();
      return;
    }

    const isStale = Boolean((driverLocation as any).stale);

    const ensureMarker = async () => {
      if (routingStatus === "loading") {
        // still ok to render driver, but we can't snap to route yet
      }

      const cachedPromise = directionsCache.get(directionsCacheKey);
      const cachedEntry = cachedPromise ? await cachedPromise.catch(() => null) : null;
      const path = cachedEntry?.fullPath || [];
      const raw = { lat: driverLocation.lat, lng: driverLocation.lng };
      const snapped = path.length > 0 ? path[findNearestIndex(path, raw)] : raw;

      const snapIdx = path.length > 0 ? findNearestIndex(path, snapped) : 0;
      const rotation = path.length > 2
        ? bearingDeg(snapped, path[Math.min(path.length - 1, snapIdx + 10)])
        : 0;

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: snapped,
          content: createAutoMarkerContent(rotation, { stale: isStale }),
          zIndex: 9999,
        });
        return;
      }

      const marker = driverMarkerRef.current;
      marker.content = createAutoMarkerContent(rotation, { stale: isStale });

      // Freeze marker when stale (no assumptions about live movement)
      if (isStale) {
        return;
      }

      const from = toLatLngPoint(marker.position, snapped);
      const to = snapped;

      const start = performance.now();
      const duration = 700;

      if (driverAnimRef.current) {
        cancelAnimationFrame(driverAnimRef.current);
        driverAnimRef.current = null;
      }

      const step = (t: number) => {
        const k = Math.min(1, (t - start) / duration);
        const lat = from.lat + (to.lat - from.lat) * k;
        const lng = from.lng + (to.lng - from.lng) * k;
        marker.position = { lat, lng };
        if (k < 1) {
          driverAnimRef.current = requestAnimationFrame(step);
        }
      };

      driverAnimRef.current = requestAnimationFrame(step);

      if (autoFollow) {
        const ll = new google.maps.LatLng(snapped.lat, snapped.lng);
        const b = map.getBounds();
        const shouldPan = !b || !b.contains(ll);
        if (shouldPan) {
          lastProgrammaticAtRef.current = Date.now();
          map.panTo(ll);
        }
      }
    };

    void ensureMarker();

    return () => {
      // keep marker between updates; do not clear
    };
  }, [isReady, showDriver, driverLocation, routingStatus, directionsCacheKey, autoFollow]);

  const driverLastUpdatedLabel = useMemo(() => {
    void driverInfoTick;
    if (!driverLocation?.lastUpdatedAt) return null;
    const ts = new Date(driverLocation.lastUpdatedAt).getTime();
    if (!Number.isFinite(ts)) return null;
    const ageMs = Math.max(0, Date.now() - ts);
    const sec = Math.floor(ageMs / 1000);
    if (sec < 60) return `Last updated ${sec}s ago`;
    const min = Math.floor(sec / 60);
    return `Last updated ${min}m ago`;
  }, [driverLocation?.lastUpdatedAt, driverInfoTick]);

  if (routingError) {
    return (
      <div className="h-full w-full bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-gray-800 font-semibold">Map unavailable</p>
          <p className="text-gray-600 text-sm mt-1">{routingError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={mapRef}
        className="h-full w-full"
        style={{ pointerEvents: "auto", touchAction: "pan-x pan-y" }}
      />

      <div className="absolute top-3 right-3 z-10 space-y-2" style={{ pointerEvents: "none" }}>
        {showDriver && driverLocation && driverLastUpdatedLabel ? (
          <div
            className={`bg-white/95 backdrop-blur rounded-lg border shadow-sm p-3 w-[240px] ${Boolean((driverLocation as any).stale) ? "border-gray-400" : "border-gray-200"}`}
            style={{ pointerEvents: "auto" }}
          >
            <div className="text-xs font-semibold text-gray-900">Driver</div>
            <div className={`mt-1 text-xs ${Boolean((driverLocation as any).stale) ? "text-gray-700" : "text-gray-700"}`}>
              {driverLastUpdatedLabel}
            </div>
            {Boolean((driverLocation as any).stale) ? (
              <div className="mt-1 text-xs text-gray-600">Stale: paused</div>
            ) : null}
          </div>
        ) : null}
        {!autoFollow && showDriver && driverLocation && Number.isFinite(driverLocation.lat) && Number.isFinite(driverLocation.lng) ? (
          <div
            className="bg-white/95 backdrop-blur rounded-lg border border-gray-200 shadow-sm p-2 w-[240px]"
            style={{ pointerEvents: "auto" }}
          >
            <button
              type="button"
              className="w-full text-xs font-semibold text-gray-900 border border-gray-200 rounded-md py-2 hover:bg-gray-50"
              onClick={() => {
                setAutoFollow(true);
                const map = mapInstanceRef.current;
                const marker = driverMarkerRef.current;
                if (map && marker && marker.position) {
                  const pos = toLatLngPoint(marker.position, { lat: driverLocation.lat, lng: driverLocation.lng });
                  lastProgrammaticAtRef.current = Date.now();
                  map.panTo(new google.maps.LatLng(pos.lat, pos.lng));
                  if (typeof map.getZoom === "function" && map.getZoom() < 15) {
                    map.setZoom(15);
                  }
                }
              }}
            >
              Re-center on delivery boy
            </button>
          </div>
        ) : null}
        <div
          className="bg-white/95 backdrop-blur rounded-lg border border-gray-200 shadow-sm p-3 w-[240px]"
          style={{ pointerEvents: "auto" }}
        >
          <div className="text-xs font-semibold text-gray-900">Legend</div>
          <div className="mt-2 space-y-2 text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-[3px]" style={{ background: "#C0C0C0" }} />
              Completed
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-[3px]" style={{ background: "#1A73E8" }} />
              Active
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-[3px] border-b-2 border-dashed" style={{ borderColor: "#A9A9A9" }} />
              Pending
            </div>
          </div>
        </div>

        <div
          className="bg-white/95 backdrop-blur rounded-lg border border-gray-200 shadow-sm p-3 w-[240px]"
          style={{ pointerEvents: "auto" }}
        >
          <div className="text-xs font-semibold text-gray-900">Toggles</div>
          <div className="mt-2 space-y-2 text-xs text-gray-700">
            <label className="flex items-center justify-between gap-3">
              <span>Show route</span>
              <input
                type="checkbox"
                checked={showRoute}
                onChange={(e) => setShowRoute(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Show checkpoints</span>
              <input
                type="checkbox"
                checked={showCheckpoints}
                onChange={(e) => setShowCheckpoints(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Show completed path</span>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Show delivery boy</span>
              <input
                type="checkbox"
                checked={showDriver}
                onChange={(e) => setShowDriver(e.target.checked)}
              />
            </label>
          </div>
        </div>

        <div
          className="bg-white/95 backdrop-blur rounded-lg border border-gray-200 shadow-sm p-3 w-[240px]"
          style={{ pointerEvents: "auto" }}
        >
          <div className="text-xs text-gray-700">
            {routingStatus === "loading" ? (
              <span>Routing: fetching Google Directions…</span>
            ) : routingStatus === "error" ? (
              <span className="text-red-700">Routing unavailable</span>
            ) : (
              <span>Routing: OK (cached)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleRouteMap;
