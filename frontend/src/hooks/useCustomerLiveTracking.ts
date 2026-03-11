import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getApiOrigin } from "../config/runtime";

/**
 * Customer Live Tracking Hook
 * Receives privacy-safe delivery partner location updates
 * Coordinates are rounded to 3 decimal places (~111m accuracy)
 */

export type CustomerLiveLocation = {
  riderLat: number;
  riderLng: number;
  etaMinutes: number;
  distanceRemainingM: number;
  lastUpdated: string;
  stale: boolean;
};

type LocationUpdatePayload = {
  riderLat: number;
  riderLng: number;
  etaMinutes: number;
  distanceRemainingM: number;
  lastUpdated: string;
};

type Params = {
  enabled: boolean;
  orderId: string | null;
  orderStatus?: string;
  staleAfterMs?: number;
};

const SOCKET_URL = getApiOrigin() || "/";

// Stop tracking when order reaches these statuses
const FINAL_STATUSES = ["DELIVERED", "CANCELLED", "REFUNDED"];

export const useCustomerLiveTracking = (params: Params) => {
  const { enabled, orderId, orderStatus, staleAfterMs = 20_000 } = params;

  const socketRef = useRef<Socket | null>(null);
  const lastReceiveAtRef = useRef<number | null>(null);
  const locationRef = useRef<CustomerLiveLocation | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [location, setLocation] = useState<CustomerLiveLocation | null>(null);
  const [lastUpdatedAgo, setLastUpdatedAgo] = useState<string>("");

  // Check if tracking should stop
  const shouldStopTracking = FINAL_STATUSES.includes(String(orderStatus || "").toUpperCase());

  // Update "last updated ago" text
  useEffect(() => {
    if (!location?.lastUpdated) return;

    const updateAgo = () => {
      const diff = Date.now() - new Date(location.lastUpdated).getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);

      if (minutes > 0) {
        setLastUpdatedAgo(`${minutes}m ago`);
      } else if (seconds > 10) {
        setLastUpdatedAgo(`${seconds}s ago`);
      } else {
        setLastUpdatedAgo("just now");
      }
    };

    updateAgo();
    const id = setInterval(updateAgo, 10000);
    return () => clearInterval(id);
  }, [location?.lastUpdated]);

  // WebSocket connection
  useEffect(() => {
    if (!enabled || !orderId || shouldStopTracking) {
      // Cleanup if tracking disabled
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

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
      // Join order-specific room
      socket.emit("join_order_room", {
        orderId,
        token,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      // Start polling fallback on disconnect
      startPollingFallback();
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    // Handle location updates
    const onLocation = (p: LocationUpdatePayload) => {
      if (!p?.riderLat || !p?.riderLng) return;

      const receivedAt = Date.now();
      lastReceiveAtRef.current = receivedAt;

      const next: CustomerLiveLocation = {
        riderLat: Number(p.riderLat),
        riderLng: Number(p.riderLng),
        etaMinutes: Number(p.etaMinutes) || 0,
        distanceRemainingM: Number(p.distanceRemainingM) || 0,
        lastUpdated: p.lastUpdated || new Date(receivedAt).toISOString(),
        stale: false,
      };

      locationRef.current = next;
      setLocation(next);

      // Stop polling if we're getting socket updates
      stopPollingFallback();
    };

    socket.on("order:location:update", onLocation);

    return () => {
      socket.off("order:location:update", onLocation);
      socket.disconnect();
      socketRef.current = null;
      stopPollingFallback();
    };
  }, [enabled, orderId, shouldStopTracking]);

  // Stale detection
  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      const last = lastReceiveAtRef.current;
      const current = locationRef.current;
      if (!last || !current) return;

      const nextStale = Date.now() - last > staleAfterMs;
      if (nextStale === current.stale) return;

      const next = { ...current, stale: nextStale };
      locationRef.current = next;
      setLocation(next);
    }, 1000);

    return () => clearInterval(id);
  }, [enabled, staleAfterMs]);

  // Polling fallback when socket disconnects
  const startPollingFallback = () => {
    if (pollIntervalRef.current) return;
    if (!orderId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch(`/api/orders/${orderId}/tracking`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.location) {
            const receivedAt = Date.now();
            lastReceiveAtRef.current = receivedAt;

            const next: CustomerLiveLocation = {
              riderLat: Number(data.location.riderLat),
              riderLng: Number(data.location.riderLng),
              etaMinutes: Number(data.location.etaMinutes) || 0,
              distanceRemainingM: Number(data.location.distanceRemainingM) || 0,
              lastUpdated: data.location.lastUpdated || new Date(receivedAt).toISOString(),
              stale: false,
            };

            locationRef.current = next;
            setLocation(next);
          }
        }
      } catch (error) {
        console.error("[CustomerTracking] Polling error:", error);
      }
    }, 15000); // Poll every 15 seconds
  };

  const stopPollingFallback = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Load from sessionStorage on mount
  useEffect(() => {
    if (!orderId) return;

    try {
      const cached = sessionStorage.getItem(`tracking:${orderId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as CustomerLiveLocation;
        const age = Date.now() - new Date(parsed.lastUpdated).getTime();
        // Only use if less than 5 minutes old
        if (age < 5 * 60 * 1000) {
          locationRef.current = { ...parsed, stale: age > staleAfterMs };
          setLocation(locationRef.current);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [orderId, staleAfterMs]);

  // Save to sessionStorage on update
  useEffect(() => {
    if (!orderId || !location) return;
    try {
      sessionStorage.setItem(`tracking:${orderId}`, JSON.stringify(location));
    } catch {
      // Ignore storage errors
    }
  }, [orderId, location]);

  return {
    isConnected,
    location,
    lastUpdatedAgo,
    shouldStopTracking,
  };
};

export default useCustomerLiveTracking;
