import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { RootState } from "../store";

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
  deliveredAt?: string | null;
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

function statusBadgeClass(status: string): string {
  const st = String(status || "").toUpperCase();
  if (st === "CREATED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (st === "ASSIGNED") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (st === "IN_PROGRESS") return "bg-purple-50 text-purple-700 border-purple-200";
  if (st === "COMPLETED") return "bg-green-50 text-green-700 border-green-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function orderStatusBadgeClass(status: string): string {
  const st = normalizeStatus(status);
  if (st === "DELIVERED") return "bg-green-50 text-green-700 border-green-200";
  if (st === "FAILED") return "bg-red-50 text-red-700 border-red-200";
  if (st === "IN_TRANSIT" || st === "PICKED_UP" || st === "ARRIVED") return "bg-blue-50 text-blue-700 border-blue-200";
  if (st === "ASSIGNED") return "bg-gray-50 text-gray-700 border-gray-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function normalizeStatus(raw: string): string {
  const v = String(raw || "").trim().toUpperCase();
  if (v === "OUT_FOR_DELIVERY") return "IN_TRANSIT";
  return v;
}

const AdminRouteDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { routeId } = useParams();
  const { tokens } = useSelector((state: RootState) => state.auth);

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
              onClick={() => navigate("/admin/routes/recent")}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cluster Detail</h1>
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
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-bold text-gray-900">{detail.route.routeId}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(detail.route.status)}`}>
                      {detail.route.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    <div>
                      <span className="text-gray-500">Delivery boy:</span>{" "}
                      {detail.route.deliveryBoy ? `${detail.route.deliveryBoy.name} (${detail.route.deliveryBoy.phone})` : "—"}
                    </div>
                    <div>
                      <span className="text-gray-500">Assigned:</span> {formatDateTime(detail.route.assignedAt)}
                    </div>
                    <div>
                      <span className="text-gray-500">Updated:</span> {formatDateTime(detail.route.updatedAt)}
                    </div>
                  </div>
                </div>

                <div className="min-w-[240px]">
                  <div className="text-sm font-medium text-gray-900">
                    {detail.route.counts.completed} / {detail.route.counts.total} completed
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${detail.route.progressPct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{detail.route.progressPct}%</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Orders in cluster</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seq</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered at</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(detail.orders || []).map((o) => {
                      return (
                        <tr
                          key={o.orderId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{o.sequence ?? "—"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{String(o.orderId).slice(0, 12)}…</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${orderStatusBadgeClass(o.status)}`}>
                              {normalizeStatus(o.status) || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(o.deliveredAt)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {o.invalidLocation ? (
                              <span className="text-red-600">Invalid</span>
                            ) : (
                              <span className="text-gray-700">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={() => navigate("/admin/routes/recent")}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
              >
                Back to Recent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRouteDetailPage;
