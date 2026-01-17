import React, { useEffect } from "react";

type RouteMapOrder = {
  orderId: string;
  itemsQty?: number;
  netAmount?: number;
  lat?: number | null;
  lng?: number | null;
  locationStatus?: "OK" | "MISSING" | "INVALID";
  locationSource?: "ORDER_ADDRESS" | "PINCODE_FALLBACK" | "NONE";
};

type RouteMapCluster = {
  tempClusterId: string;
  distanceKm?: number;
  estimatedTimeMin?: number;
  orders: RouteMapOrder[];
  routePath?: string[];
};

type RouteMapDrawerProps = {
  isOpen: boolean;
  cluster: RouteMapCluster;
  onClose: () => void;
};

const RouteMapDrawer: React.FC<RouteMapDrawerProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (isOpen) {
    console.warn("[RouteMapDrawer] Deprecated: map is available only on /admin/routes/:routeId");
  }

  return null;
};

export default RouteMapDrawer;
