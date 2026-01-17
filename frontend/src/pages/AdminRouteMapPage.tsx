import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { RootState } from "../store";
import ClusterRouteMap from "../components/ClusterRouteMap";
import GoogleRouteMap from "../components/GoogleRouteMap";
import { useAdminLiveTracking } from "../hooks/useAdminLiveTracking";

type RouteStatus = "CREATED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

type RouteOrder = {
  orderId: string;
  sequence: number | null;
  status: string;
  deliveredAt: string | null;
  invalidLocation: boolean;
};

type RouteCheckpoint = {
  orderId: string;
  sequence: number | null;
  lat: number;
  lng: number;
  status: string;
};

type LiveLocation = {
  driverId: string;
  routeId: string | null;
  lat: number;
  lng: number;
  lastUpdatedAt: string | null;
  stale: boolean;
};

type RouteSummary = {
  routeId: string;
  status: RouteStatus;
  computedAt: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  deliveryBoyId: string | null;
  deliveryBoy: {
    id: string;
    name: string;
    phone: string;
  } | null;
  counts: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    completed: number;
  };
  progressPct: number;
  warehouse: { lat: number; lng: number };
};

type RouteDetail = {
  route: RouteSummary;
  orders: RouteOrder[];
  checkpoints: RouteCheckpoint[];
  liveLocation: LiveLocation | null;
};

type ApiResponse = {
  success: boolean;
  generatedAt?: string;
  route?: RouteSummary;
  orders?: RouteOrder[];
  checkpoints?: RouteCheckpoint[];
  liveLocation?: LiveLocation | null;
  error?: string;
  message?: string;
};

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const AdminRouteMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { routeId } = useParams();
  const { tokens, user } = useSelector((state: RootState) => state.auth);

  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchDetail = useCallback(async () => {
    const rid = String(routeId || "").trim();
    if (!rid) return;
    if (!tokens?.accessToken) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/routes/${encodeURIComponent(rid)}/detail`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to load route detail");
      }

      if (aliveRef.current) {
        const route = (data as any).route as RouteSummary | undefined;
        if (route) {
          setDetail({
            route,
            orders: Array.isArray((data as any).orders) ? (data as any).orders : [],
            checkpoints: Array.isArray((data as any).checkpoints) ? (data as any).checkpoints : [],
            liveLocation: (data as any).liveLocation ?? null,
          });
        } else {
          setDetail(null);
        }
        setLastUpdatedAt(new Date().toISOString());
      }
    } catch (e: any) {
      console.error("Fetch route detail error:", e);
      toast.error(e?.message || "Failed to load route detail");
      if (aliveRef.current) {
        setDetail(null);
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [routeId, tokens?.accessToken]);

  useEffect(() => {
    if (!routeId) return;
    if (!tokens?.accessToken) return;
    void fetchDetail();
  }, [routeId, tokens?.accessToken, fetchDetail]);

  const live = useAdminLiveTracking({
    enabled: Boolean(tokens?.accessToken) && Boolean(detail?.route?.deliveryBoy?.id),
    adminUserId: (user as any)?.id || null,
    driverId: detail?.route?.deliveryBoy?.id || null,
    routeId: detail?.route?.routeId || null,
    seed: detail?.liveLocation
      ? {
          lat: detail.liveLocation.lat,
          lng: detail.liveLocation.lng,
          lastUpdatedAt: detail.liveLocation.lastUpdatedAt,
          stale: Boolean(detail.liveLocation.stale),
        }
      : null,
  });

  if (!routeId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-900 font-semibold">Missing routeId</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate(`/admin/routes/${encodeURIComponent(routeId)}`)}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cluster Live Map</h1>
              <p className="text-gray-600">Route {routeId}</p>
              <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "—"}</p>
            </div>
          </div>

          <button
            onClick={() => void fetchDetail()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {!detail ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-600">{loading ? "Loading route…" : "No data"}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">Map</p>
              <p className="text-xs text-gray-500 mt-1">Warehouse → checkpoints route + live driver marker</p>
            </div>
            <div className="h-[640px]">
              <ClusterRouteMap
                route={detail.route}
                orders={detail.orders}
                checkpoints={detail.checkpoints}
                liveLocation={
                  live.location
                    ? {
                        lat: live.location.lat,
                        lng: live.location.lng,
                        lastUpdatedAt: live.location.lastUpdatedAt,
                        stale: live.location.stale,
                      }
                    : detail.liveLocation
                    ? {
                        lat: detail.liveLocation.lat,
                        lng: detail.liveLocation.lng,
                        lastUpdatedAt: detail.liveLocation.lastUpdatedAt,
                        stale: detail.liveLocation.stale,
                      }
                    : null
                }
              >
                {(mapProps) => (
                  <GoogleRouteMap
                    routeId={mapProps.routeId}
                    warehouse={mapProps.warehouse}
                    checkpoints={mapProps.checkpoints}
                    driverLocation={mapProps.driverLocation}
                  />
                )}
              </ClusterRouteMap>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate(`/admin/routes/${encodeURIComponent(routeId)}`)}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Back to Cluster Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminRouteMapPage;
