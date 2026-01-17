import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { RootState } from "../store";
import { ArrowLeft, ChevronDown, ChevronUp, Truck } from "lucide-react";

type RouteStatus = "CREATED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

interface AdminRouteListItem {
  routeId: string;
  vehicleType: string;
  totalDistanceKm: number;
  estimatedTimeMin: number;
  status: RouteStatus;
  deliveryBoyId: string | null;
  orderIds: string[];
  routePath: string[];
  totalOrders: number;
  deliveredCount: number;
  failedCount: number;
  computedAt?: string;
}

interface DeliveryBoyListItem {
  user: {
    _id: string;
    name: string;
    phone?: string;
    status: string;
  };
  deliveryBoy: {
    _id: string;
    availability: "available" | "busy" | "offline";
    isActive: boolean;
    vehicleType?: string;
    currentLoad?: number;
    lastAssignedAt?: string;
  };
}

const canonicalVehicleType = (v: any): string => String(v || "").trim().toUpperCase();

const AdminRoutesPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [routes, setRoutes] = useState<AdminRouteListItem[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningRouteId, setAssigningRouteId] = useState<string>("");
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoyListItem[]>([]);
  const [loadingDeliveryBoys, setLoadingDeliveryBoys] = useState(false);
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate("/login");
      return;
    }

    void fetchRoutes();
  }, [isAuthenticated, user, navigate]);

  const fetchRoutes = async () => {
    try {
      setLoadingRoutes(true);
      const response = await fetch("/api/admin/routes", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }

      const data = await response.json().catch(() => ({}));
      const list = Array.isArray((data as any).routes) ? (data as any).routes : [];
      setRoutes(list);
    } catch (e: any) {
      console.error("Fetch routes error:", e);
      toast.error(e?.message || "Failed to load routes");
      setRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const fetchDeliveryBoys = async () => {
    try {
      setLoadingDeliveryBoys(true);
      const response = await fetch("/api/admin/delivery-boys-list", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch delivery boys");
      }

      const data = await response.json().catch(() => ({}));
      const list = Array.isArray((data as any).deliveryBoys) ? (data as any).deliveryBoys : [];
      setDeliveryBoys(list);
    } catch (e: any) {
      console.error("Fetch delivery boys error:", e);
      toast.error(e?.message || "Failed to load delivery boys");
      setDeliveryBoys([]);
    } finally {
      setLoadingDeliveryBoys(false);
    }
  };

  const openAssignModal = async (routeId: string) => {
    setAssigningRouteId(routeId);
    setSelectedDeliveryBoyId("");
    setShowAssignModal(true);
    await fetchDeliveryBoys();
  };

  const activeDeliveryBoyIds = useMemo(() => {
    const active = new Set<string>();
    for (const r of routes) {
      if (r.deliveryBoyId && (r.status === "ASSIGNED" || r.status === "IN_PROGRESS")) {
        active.add(String(r.deliveryBoyId));
      }
    }
    return active;
  }, [routes]);

  const eligibleDeliveryBoys = useMemo(() => {
    return (deliveryBoys || []).filter((b) => {
      const boy = b?.deliveryBoy;
      const u = b?.user;
      if (!boy || !u) return false;

      if (!boy.isActive) return false;
      if (String(u.status || "") !== "active") return false;
      if (boy.availability !== "available") return false;
      if (canonicalVehicleType(boy.vehicleType) !== "AUTO") return false;
      if (activeDeliveryBoyIds.has(String(boy._id))) return false;

      return true;
    });
  }, [deliveryBoys, activeDeliveryBoyIds]);

  const confirmAssign = async () => {
    if (!assigningRouteId) return;
    if (!selectedDeliveryBoyId) {
      toast.error("Select a delivery boy");
      return;
    }

    try {
      setIsAssigning(true);
      const response = await fetch(`/api/admin/routes/${encodeURIComponent(assigningRouteId)}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({ deliveryBoyId: selectedDeliveryBoyId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to assign route");
      }

      toast.success("Route assigned");
      setShowAssignModal(false);
      setAssigningRouteId("");
      setSelectedDeliveryBoyId("");
      await fetchRoutes();
    } catch (e: any) {
      console.error("Assign route error:", e);
      toast.error(e?.message || "Failed to assign route");
    } finally {
      setIsAssigning(false);
    }
  };

  const coverageLabel = (r: AdminRouteListItem): string => {
    const ids = Array.isArray(r.orderIds) ? r.orderIds : [];
    if (ids.length === 0) return "—";
    const prefix = String(ids[0]).slice(0, 4);
    const unique = new Set(ids.map((x) => String(x).slice(0, 4)));
    return unique.size <= 1 ? `Area ${prefix}…` : `Mixed (${unique.size} areas)`;
  };

  const renderEmptyState = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
        <p className="text-gray-900 font-semibold text-lg mb-2">No routes yet.</p>
        <p className="text-gray-600">No routes yet. Click ‘Cluster Orders’ to generate delivery routes.</p>
        <div className="mt-6">
          <button
            onClick={() => navigate("/admin/orders")}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Go to Orders
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/admin/orders")}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Routes / Clusters</h1>
              <p className="text-gray-600">Generated delivery routes (read-only)</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/admin/orders")}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
          >
            Cluster Orders
          </button>
        </div>

        {loadingRoutes ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-600">Loading routes…</p>
          </div>
        ) : routes.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-4">
            {routes.map((r) => {
              const isExpanded = !!expanded[r.routeId];
              const isLocked = r.status !== "CREATED";

              return (
                <div key={r.routeId} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Route</p>
                          <p className="text-xl font-bold text-gray-900">{r.routeId}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            r.status === "CREATED"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : r.status === "ASSIGNED"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : r.status === "IN_PROGRESS"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Orders</p>
                          <p className="font-semibold text-gray-900">{r.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Distance</p>
                          <p className="font-semibold text-gray-900">{Number(r.totalDistanceKm || 0).toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="text-gray-500">ETA</p>
                          <p className="font-semibold text-gray-900">{Math.round(Number(r.estimatedTimeMin || 0))} min</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Coverage</p>
                          <p className="font-semibold text-gray-900">{coverageLabel(r)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Assigned</p>
                          <p className="font-semibold text-gray-900">{r.deliveryBoyId ? "YES" : "NO"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center justify-end">
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [r.routeId]: !isExpanded }))}
                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                      >
                        {isExpanded ? (
                          <span className="inline-flex items-center gap-1">
                            <ChevronUp className="h-4 w-4" />
                            Hide
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <ChevronDown className="h-4 w-4" />
                            Details
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => void openAssignModal(r.routeId)}
                        disabled={isLocked}
                        title={isLocked ? "Route is locked after assignment" : "Assign delivery boy"}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Assign Delivery Boy
                        </span>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Ordered delivery sequence</p>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                            {(r.routePath || [])
                              .filter((x) => String(x).toUpperCase() !== "WAREHOUSE")
                              .map((id, idx) => (
                                <div key={`${r.routeId}-seq-${id}-${idx}`} className="text-sm text-gray-800">
                                  {idx + 1}. {String(id).slice(0, 12)}…
                                </div>
                              ))}
                            {(r.routePath || []).length === 0 && (
                              <div className="text-sm text-gray-500">No sequence available.</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Order IDs (read-only)</p>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                            {(r.orderIds || []).map((id, idx) => (
                              <div key={`${r.routeId}-order-${id}-${idx}`} className="text-sm text-gray-800">
                                • {String(id).slice(0, 12)}…
                              </div>
                            ))}
                            {(r.orderIds || []).length === 0 && (
                              <div className="text-sm text-gray-500">No orders in route.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 mt-4">
                        Orders inside a route are read-only. No drag/drop, no reordering, no manual edits.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Assign Delivery Boy</h3>
            <p className="text-gray-600 mb-6">
              Assign a delivery boy to route <span className="font-semibold">{assigningRouteId}</span>.
            </p>

            {loadingDeliveryBoys ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-gray-500 mt-2">Loading delivery boys…</p>
              </div>
            ) : eligibleDeliveryBoys.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-900 font-semibold">No eligible delivery boys</p>
                <p className="text-yellow-800 text-sm mt-1">
                  Only AUTO, AVAILABLE, active delivery boys with no active route are shown.
                </p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {eligibleDeliveryBoys.map((item) => {
                  const u = item.user;
                  const b = item.deliveryBoy;
                  return (
                    <label
                      key={b._id}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDeliveryBoyId === b._id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryBoy"
                        value={b._id}
                        checked={selectedDeliveryBoyId === b._id}
                        onChange={(e) => setSelectedDeliveryBoyId(e.target.value)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u?.name || "Unknown"}</p>
                            <p className="text-xs text-gray-500">{u?.phone || ""}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {canonicalVehicleType(b.vehicleType)}
                            </span>
                            {typeof b.currentLoad === "number" && (
                              <p className="text-xs text-gray-500 mt-1">Load: {b.currentLoad}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningRouteId("");
                  setSelectedDeliveryBoyId("");
                }}
                disabled={isAssigning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmAssign()}
                disabled={isAssigning || !selectedDeliveryBoyId}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
              >
                {isAssigning ? "Assigning…" : "Confirm Assignment"}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              One route → one delivery boy. One delivery boy → one active route. Route is locked after assignment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoutesPage;
