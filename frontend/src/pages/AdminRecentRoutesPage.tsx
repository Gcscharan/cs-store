import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { ArrowLeft, Map, RefreshCw } from "lucide-react";
import { RootState } from "../store";

type RouteStatus = "CREATED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

type RecentRouteItem = {
  routeId: string;
  status: RouteStatus;
  assignedAt: string | null;
  updatedAt: string | null;
  deliveryBoy: { id: string; name: string; phone: string } | null;
  counts: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    completed: number;
  };
  progressPct: number;
};

const POLL_MS = 15_000;

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

const AdminRecentRoutesPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens } = useSelector((state: RootState) => state.auth);

  const [routes, setRoutes] = useState<RecentRouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const fetchRecent = useCallback(async () => {
    if (!tokens?.accessToken) return;
    try {
      setLoading(true);
      const response = await fetch("/api/admin/routes/recent?limit=50", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to load recent routes");
      }

      const list = Array.isArray((data as any).routes) ? (data as any).routes : [];
      if (aliveRef.current) {
        setRoutes(list);
        setLastUpdatedAt(new Date().toISOString());
      }
    } catch (e: any) {
      console.error("Fetch recent routes error:", e);
      toast.error(e?.message || "Failed to load recent routes");
      if (aliveRef.current) {
        setRoutes([]);
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [tokens?.accessToken]);

  useEffect(() => {
    if (!tokens?.accessToken) return;
    void fetchRecent();

    const id = window.setInterval(() => {
      void fetchRecent();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [tokens?.accessToken, fetchRecent]);

  const rows = useMemo(() => {
    return (routes || []).map((r) => {
      const total = Number(r?.counts?.total || 0);
      const completed = Number(r?.counts?.completed || 0);
      const pct = Math.max(0, Math.min(100, Number.isFinite(r.progressPct) ? r.progressPct : (total > 0 ? Math.round((completed / total) * 100) : 0)));
      return { ...r, _pct: pct };
    });
  }, [routes]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/admin/routes")}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Recent Assignings</h1>
              <p className="text-gray-600">Last assigned clusters (sorted by assigned time)</p>
              <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "—"}</p>
            </div>
          </div>

          <button
            onClick={() => void fetchRecent()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading && rows.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-600">Loading recent routes…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-900 font-semibold text-lg mb-2">No assigned routes yet.</p>
            <p className="text-gray-600">Assign a cluster to a delivery boy to see it here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Boy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((r) => (
                    <tr key={r.routeId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/routes/${encodeURIComponent(r.routeId)}`)}
                          title="Open cluster details"
                          className="text-left text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                        >
                          {r.routeId}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {r.deliveryBoy ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{r.deliveryBoy.name}</div>
                            <div className="text-xs text-gray-500">{r.deliveryBoy.phone}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">
                          {Number(r.counts?.completed || 0)} / {Number(r.counts?.total || 0)} completed
                        </div>
                        <div className="mt-2 w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${(r as any)._pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{(r as any)._pct}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(r.assignedAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(r.updatedAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/routes/${encodeURIComponent(r.routeId)}/map`)}
                          title="Open cluster live map"
                          className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <Map className="h-4 w-4" />
                          Open Map
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRecentRoutesPage;
