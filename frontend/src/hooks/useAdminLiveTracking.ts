import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

import { getApiOrigin } from "../config/runtime";

export type AdminLiveDriverLocation = {
  driverId: string;
  routeId: string;
  lat: number;
  lng: number;
  lastUpdatedAt: string;
  stale: boolean;
};

type DriverLocationUpdatePayload = {
  driverId: string;
  routeId: string;
  lat: number;
  lng: number;
  timestamp?: number;
};

type Params = {
  enabled: boolean;
  adminUserId: string | null | undefined;
  driverId: string | null | undefined;
  routeId: string | null | undefined;
  seed?: {
    lat: number;
    lng: number;
    lastUpdatedAt: string | null;
    stale?: boolean;
  } | null;
  staleAfterMs?: number;
};

const SOCKET_URL = getApiOrigin() || "/";

export const useAdminLiveTracking = (params: Params) => {
  const {
    enabled,
    adminUserId,
    driverId,
    routeId,
    seed,
    staleAfterMs = 20_000,
  } = params;

  const socketRef = useRef<Socket | null>(null);
  const lastReceiveAtRef = useRef<number | null>(null);
  const seedAppliedRef = useRef<string | null>(null);
  const locationRef = useRef<AdminLiveDriverLocation | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [location, setLocation] = useState<AdminLiveDriverLocation | null>(null);

  const filterKey = useMemo(() => {
    const d = String(driverId || "");
    const r = String(routeId || "");
    return `${d}::${r}`;
  }, [driverId, routeId]);

  useEffect(() => {
    if (!enabled) return;

    const token =
      (typeof window !== "undefined" && typeof window.localStorage !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null) || "";

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: {
        token,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_room", {
        room: "admin_room",
        userId: adminUserId || "admin",
        userRole: "admin",
        token,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    const onLocation = (p: DriverLocationUpdatePayload) => {
      const d = String(p?.driverId || "");
      const r = String(p?.routeId || "");
      if (!d || !r) return;
      if (driverId && d !== String(driverId)) return;
      if (routeId && r !== String(routeId)) return;

      const receivedAt = Date.now();
      lastReceiveAtRef.current = receivedAt;

      const next: AdminLiveDriverLocation = {
        driverId: d,
        routeId: r,
        lat: Number(p.lat),
        lng: Number(p.lng),
        lastUpdatedAt: new Date(receivedAt).toISOString(),
        stale: false,
      };

      locationRef.current = next;
      setLocation(next);
    };

    socket.on("driver:location:update", onLocation);

    return () => {
      socket.off("driver:location:update", onLocation);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, adminUserId, driverId, routeId]);

  useEffect(() => {
    const d = String(driverId || "");
    const r = String(routeId || "");
    if (!enabled || !d || !r) return;

    const key = `${d}::${r}`;
    if (seedAppliedRef.current === key) return;

    const seedTs = seed?.lastUpdatedAt ? new Date(seed.lastUpdatedAt).getTime() : null;
    if (!seed || !Number.isFinite(seed.lat) || !Number.isFinite(seed.lng) || !seedTs) {
      seedAppliedRef.current = key;
      return;
    }

    lastReceiveAtRef.current = seedTs;
    const next: AdminLiveDriverLocation = {
      driverId: d,
      routeId: r,
      lat: Number(seed.lat),
      lng: Number(seed.lng),
      lastUpdatedAt: new Date(seedTs).toISOString(),
      stale: Boolean(seed.stale) || Date.now() - seedTs > staleAfterMs,
    };

    locationRef.current = next;
    setLocation(next);

    seedAppliedRef.current = key;
  }, [enabled, driverId, routeId, seed, staleAfterMs, filterKey]);

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      const last = lastReceiveAtRef.current;
      const current = locationRef.current;
      if (!last || !current) return;

      const nextStale = Date.now() - last > staleAfterMs;
      if (nextStale === current.stale) return;

      const next = { ...current, stale: nextStale };
      locationRef.current = next;
      setLocation(next);
    }, 1000);

    return () => window.clearInterval(id);
  }, [enabled, staleAfterMs]);

  return {
    isConnected,
    location,
  };
};
