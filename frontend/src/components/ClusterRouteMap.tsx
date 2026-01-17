import React, { useMemo } from "react";

type ClusterRouteSummary = {
  routeId: string;
  warehouse: { lat: number; lng: number };
};

type ClusterOrder = {
  orderId: string;
  deliveredAt: string | null;
};

type ClusterCheckpoint = {
  orderId: string;
  sequence: number | null;
  lat: number;
  lng: number;
  status: string;
  deliveredAt?: string | null;
};

type ClusterLiveLocation = {
  lat: number;
  lng: number;
  lastUpdatedAt: string | null;
  stale: boolean;
} | null;

type ClusterRouteMapProps = {
  route: ClusterRouteSummary;
  orders: ClusterOrder[];
  checkpoints: ClusterCheckpoint[];
  liveLocation: ClusterLiveLocation;
  children: (mapProps: {
    routeId: string;
    warehouse: { lat: number; lng: number };
    checkpoints: Array<ClusterCheckpoint & { deliveredAt: string | null }>;
    driverLocation: { lat: number; lng: number; lastUpdatedAt: string | null; stale?: boolean } | null;
  }) => React.ReactNode;
};

const ClusterRouteMap: React.FC<ClusterRouteMapProps> = ({ route, orders, checkpoints, liveLocation, children }) => {
  const mapCheckpoints = useMemo(() => {
    const deliveredAtByOrderId = new Map<string, string | null>();
    for (const o of orders || []) {
      deliveredAtByOrderId.set(String(o.orderId), o.deliveredAt || null);
    }
    return (checkpoints || []).map((c) => ({
      ...c,
      deliveredAt: deliveredAtByOrderId.get(String(c.orderId)) || null,
    }));
  }, [orders, checkpoints]);

  return (
    <>
      {children({
        routeId: route.routeId,
        warehouse: route.warehouse,
        checkpoints: mapCheckpoints,
        driverLocation: liveLocation
          ? {
              lat: liveLocation.lat,
              lng: liveLocation.lng,
              lastUpdatedAt: liveLocation.lastUpdatedAt,
              stale: liveLocation.stale,
            }
          : null,
      })}
    </>
  );
};

export default ClusterRouteMap;
